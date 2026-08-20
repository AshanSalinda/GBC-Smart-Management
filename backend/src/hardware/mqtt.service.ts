import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import * as mqtt from 'mqtt';
import { VenueCacheService, TableState } from '../state/venue-cache.service';
import { TABLES_UPDATED_EVENT } from '../common/events/event-types';

/**
 * MQTT Client for ESP32 relay control.
 *
 * - On boot, connects to the cloud MQTT broker.
 * - Subscribes to acknowledgment and sync-request topics.
 * - Listens for TABLE_UPDATED_EVENT via EventEmitter and publishes relay commands.
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly venueCacheService: VenueCacheService,
  ) {}

  public isConnected(): boolean {
    return this.client?.connected || false;
  }

  onModuleInit() {
    const url = this.configService.get<string>('mqtt.url')!;
    const username = this.configService.get<string>('mqtt.username');
    const password = this.configService.get<string>('mqtt.password');

    this.client = mqtt.connect(url, {
      clientId: 'GBC_BACKEND_SERVER',
      username,
      password,
      clean: false,
      keepalive: 30,
      reconnectPeriod: 5000,
      will: {
        topic: 'gbc/hardware/status',
        payload: Buffer.from(JSON.stringify({
          status: 'OFFLINE',
          timestamp: new Date().toISOString(),
        })),
        qos: 1,
        retain: false,
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker.');

      // Subscribe to ACK and sync-request topics
      this.client.subscribe('gbc/hardware/table/+/ack', { qos: 1 });
      this.client.subscribe('gbc/hardware/sync/request', { qos: 1 });
      this.client.subscribe('gbc/hardware/status', { qos: 1 });

      // Publish online status
      this.client.publish(
        'gbc/hardware/status',
        JSON.stringify({ status: 'ONLINE', timestamp: new Date().toISOString() }),
        { qos: 1 },
      );

      // Proactively publish full state sync so ESP32 knows the current truth
      // even if it was already online during the backend restart
      this.publishFullStateSync();
    });

    this.client.on('message', (topic, message) => {
      this.handleIncomingMessage(topic, message.toString());
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT connection error: ${err.message}`);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
      this.logger.log('MQTT client disconnected.');
    }
  }

  /* ─── Event Listener (Decoupled via EventEmitter) ──────────── */

  /**
   * Listens for table state changes from the in-memory cache.
   * Publishes the appropriate relay command to the ESP32.
   */
  @OnEvent(TABLES_UPDATED_EVENT)
  handleTablesUpdated(tables: TableState[]): void {
    for (const payload of tables) {
      // Only publish to hardware if there is a pending transition
      if (payload.lightStatus === 'PENDING-ON' || payload.lightStatus === 'PENDING-OFF') {
        const relayState = payload.lightStatus === 'PENDING-ON' ? 'ON' : 'OFF';

        const commandPayload = {
          commandId: `cmd_${Date.now()}_${payload.tableId}`,
          tableId: payload.tableId,
          relayState,
          timestamp: new Date().toISOString(),
        };

        const topic = `gbc/hardware/table/${payload.tableId}/set`;
        this.client.publish(topic, JSON.stringify(commandPayload), { qos: 1 });
        this.logger.log(`[MQTT] Published to ${topic}: relay ${relayState}`);
      }
    }
  }

  /* ─── Incoming Message Handler ──────────────────────────────── */

  private handleIncomingMessage(topic: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // ─── ACK from ESP32 ───────────────────────────────────────
      if (topic.startsWith('gbc/hardware/table/') && topic.endsWith('/ack')) {
        this.logger.log(
          `[MQTT] ACK received: Table ${data.tableId}, Relay ${data.relayState}, ` +
          `Executed: ${data.executed}`,
        );
        this.venueCacheService.confirmLightStatus(data.tableId, data.relayState);
        return;
      }

      // ─── Hardware sync request (ESP32 booted) ─────────────────
      if (topic === 'gbc/hardware/sync/request') {
        this.logger.log(`[MQTT] ESP32 sync request from MAC: ${data.macAddress}`);
        this.publishFullStateSync();
        return;
      }

      // ─── Hardware status (LWT) ────────────────────────────────
      if (topic === 'gbc/hardware/status') {
        this.logger.warn(`[MQTT] Hardware status: ${data.status}`);
        return;
      }
    } catch (err: any) {
      this.logger.error(`Failed to parse MQTT message on ${topic}: ${err.message}`);
    }
  }

  /**
   * Publishes the full in-memory light state for all 4 tables
   * to the ESP32 sync response topic.
   */
  private publishFullStateSync(): void {
    const cache = this.venueCacheService.getCacheMap();
    const relayStates = Object.values(cache).map((table) => ({
      tableId: table.tableId,
      relayState: table.lightStatus === 'ON' || table.lightStatus === 'PENDING-ON' ? 'ON' : 'OFF',
    }));

    const payload = {
      commandId: `sync_${Date.now()}`,
      relays: relayStates,
      timestamp: new Date().toISOString(),
    };

    this.client.publish('gbc/hardware/sync/response', JSON.stringify(payload), { qos: 1 });
    this.logger.log('[MQTT] Published full state sync response to ESP32.');
  }
}
