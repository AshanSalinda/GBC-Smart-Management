/**
 * Internal event names and payload interfaces for the EventEmitter-based
 * decoupling between modules (Cache ↔ MQTT ↔ WebSocket Gateway).
 */

export const TABLES_UPDATED_EVENT = 'tables.updated';
export const TIMELINE_UPDATED_EVENT = 'timeline.updated';
export const HARDWARE_SYNC_REQUEST_EVENT = 'hardware.sync.request';

export interface HardwareSyncRequestPayload {
  macAddress: string;
  event: string;
}
