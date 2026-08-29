import useStore from "../store/useStore";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

class WebSocketWrapper {
  constructor() {
    this.socket = null;
    this.token = null;
    this.listeners = {};
    this.reconnectTimeout = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 5000;
    this.intentionalDisconnect = false;
  }

  get connected() {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  get auth() {
    return { token: this.token };
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emitLocal(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  connect(token) {
    if (token) this.token = token;
    if (!this.token) return;

    this.intentionalDisconnect = false;
    
    // Replace http:// or https:// with ws:// or wss://
    let wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    if (!wsUrl.endsWith('/')) wsUrl += '/';
    wsUrl += `ws?token=${this.token}`;

    console.log("Connecting WebSocket to", wsUrl);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.reconnectDelay = 1000; // reset backoff
      this.emitLocal("connect");
    };

    this.socket.onclose = (event) => {
      this.emitLocal("disconnect", event.reason || "Connection closed");
      this.socket = null;
      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.event) {
          // Socket.io standard mapping
          // The backend sends { event: "TABLES_UPDATED", tables: [...] }
          // We pass the relevant data part to the callback, or the whole payload
          
          if (payload.event === "INITIAL_STATE") {
            this.emitLocal("INITIAL_STATE", payload);
          } else if (payload.event === "TABLES_UPDATED") {
            this.emitLocal("TABLES_UPDATED", payload.tables);
          } else if (payload.event === "TIMELINE_UPDATED") {
            this.emitLocal("TIMELINE_UPDATED", payload.timeline);
          } else {
            this.emitLocal(payload.event, payload);
          }
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };
  }

  disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    console.log(`WebSocket reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }
}

// Singleton instance
let socketInstance = null;

export const connectSocket = (token) => {
  if (!socketInstance) {
    socketInstance = new WebSocketWrapper();
    
    // Register global listeners
    socketInstance.on("connect", () => {
      console.log("WebSocket connected");
      useStore.getState().setIsConnected(true);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      useStore.getState().setIsConnected(false);
    });

    socketInstance.on("INITIAL_STATE", (data) => {
      console.log("INITIAL_STATE received");
      if (data.tables) {
        useStore.getState().setTables(data.tables);
      }
      if (data.timeline) {
        useStore.getState().setTimeline(data.timeline);
      }
    });

    socketInstance.on("TABLES_UPDATED", (tables) => {
      console.log("TABLES_UPDATED received");
      useStore.getState().setTables(tables);
    });

    socketInstance.on("TIMELINE_UPDATED", (timeline) => {
      console.log("TIMELINE_UPDATED received");
      useStore.getState().setTimeline(timeline);
    });
  }

  if (socketInstance.token !== token) {
    socketInstance.token = token;
    socketInstance.disconnect();
    socketInstance.connect(token);
  } else if (!socketInstance.connected) {
    socketInstance.connect(token);
  }
  
  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    useStore.getState().setIsConnected(false);
  }
};

export const getSocket = () => socketInstance;
