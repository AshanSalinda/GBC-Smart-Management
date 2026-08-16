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
import {
  TABLE_UPDATED_EVENT,
  BOOKING_MUTATED_EVENT,
} from '../common/events/event-types';
import type { TableUpdatedPayload, BookingMutatedPayload } from '../common/events/event-types';

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
   * Broadcasts TABLE_UPDATED to all connected clients whenever
   * the in-memory cache emits a table state change.
   */
  @OnEvent(TABLE_UPDATED_EVENT)
  handleTableUpdated(payload: TableUpdatedPayload): void {
    this.server.emit('TABLE_UPDATED', {
      event: 'TABLE_UPDATED',
      serverTime: new Date().toISOString(),
      data: payload,
    });
  }

  /**
   * Broadcasts BOOKING_MUTATED to all connected clients when
   * a booking is created, updated, or cancelled.
   */
  @OnEvent(BOOKING_MUTATED_EVENT)
  handleBookingMutated(payload: BookingMutatedPayload): void {
    this.server.to('room:admin').to('room:staff').emit('BOOKING_MUTATED', {
      event: 'BOOKING_MUTATED',
      ...payload,
    });
  }
}
