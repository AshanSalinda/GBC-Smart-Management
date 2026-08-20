import { io } from "socket.io-client";
import useStore from "../store/useStore";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

let socket = null;

export const connectSocket = (token) => {
  if (socket) {
    if (socket.auth.token !== token) {
      socket.auth.token = token;
      socket.disconnect();
      socket.connect();
    } else if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  socket = io(BACKEND_URL, {
    auth: { token },
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("WebSocket connected");
    useStore.getState().setIsConnected(true);
  });

  socket.on("disconnect", (reason) => {
    console.log("WebSocket disconnected:", reason);
    useStore.getState().setIsConnected(false);
  });

  socket.on("INITIAL_STATE", (data) => {
    console.log("INITIAL_STATE received");
    if (data.tables) {
      useStore.getState().setTables(data.tables);
    }
    if (data.timeline) {
      useStore.getState().setTimeline(data.timeline);
    }
  });

  // Using TABLES_UPDATED as per full-state broadcast strategy
  socket.on("TABLES_UPDATED", (tables) => {
    console.log("TABLES_UPDATED received");
    useStore.getState().setTables(tables);
  });

  // Using TIMELINE_UPDATED as per full-state broadcast strategy
  socket.on("TIMELINE_UPDATED", (timeline) => {
    console.log("TIMELINE_UPDATED received");
    useStore.getState().setTimeline(timeline);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    useStore.getState().setIsConnected(false);
  }
};

export const getSocket = () => socket;
