import { create } from 'zustand';

const useStore = create((set) => ({
  tables: [],
  timeline: [],
  isConnected: false,

  setTables: (tables) => set({ tables }),
  setTimeline: (timeline) => set({ timeline }),
  setIsConnected: (isConnected) => set({ isConnected }),
}));

export default useStore;
