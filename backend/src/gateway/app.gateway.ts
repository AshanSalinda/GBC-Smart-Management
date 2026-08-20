import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { FirebaseService } from '../auth/firebase.service';
import { VenueCacheService } from '../state/venue-cache.service';
import { BookingsService } from '../bookings/bookings.service';
import { BookingDocument } from '../database/schemas/booking.schema';
import { TableState } from '../state/venue-cache.service';
import {
  TABLES_UPDATED_EVENT,
  TIMELINE_UPDATED_EVENT,
} from '../common/events/event-types';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly venueCacheService: VenueCacheService,
    private readonly bookingsService: BookingsService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized.');
  }

  /* ─── Connection Lifecycle ──────────────────────────────────── */

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split('Bearer ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: no token provided.`);
        client.disconnect(true);
        return;
      }

      const decoded = await this.firebaseService.verifyIdToken(token);
      const role = (decoded?.role as string) || '';

      if (!role) {
        this.logger.warn(`Client ${client.id} disconnected: no role assigned.`);
        client.disconnect(true);
        return;
      }

      // Join role-based room
      client.join(`room:${role}`);
      (client as any).userRole = role;
      (client as any).userEmail = decoded.email || decoded.uid;

      this.logger.log(
        `Client ${client.id} connected. Role: ${role}, Email: ${(client as any).userEmail}`,
      );

      // Emit INITIAL_STATE to the newly connected client
      const tables = this.venueCacheService.getAllTables();
      const payload: any = {
        event: 'INITIAL_STATE',
        serverTime: new Date().toISOString(),
        tables,
      };

      if (role === 'admin' || role === 'staff') {
        payload.timeline = await this.bookingsService.getTimeline(new Date().toISOString());
      }

      client.emit('INITIAL_STATE', payload);
    } catch (error: any) {
      this.logger.warn(`Client ${client.id} disconnected: ${error.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected.`);
  }

  /* ─── Event Listeners (Decoupled via EventEmitter) ──────────── */

  /**
   * Broadcasts TABLES_UPDATED to all connected clients whenever
   * the in-memory cache emits a table state change.
   */
  @OnEvent(TABLES_UPDATED_EVENT)
  handleTablesUpdated(payload: TableState[]): void {
    this.server.emit('TABLES_UPDATED', payload);
  }

  /**
   * Broadcasts TIMELINE_UPDATED to all connected clients when
   * the timeline mutates.
   */
  @OnEvent(TIMELINE_UPDATED_EVENT)
  handleTimelineUpdated(payload: BookingDocument[]): void {
    this.server.to('room:admin').to('room:staff').emit('TIMELINE_UPDATED', payload);
  }
}
