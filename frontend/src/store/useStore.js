import { create } from 'zustand';

const useStore = create((set) => ({
  tables: [],
  timeline: [],
  isConnected: false,
  globalConfig: null,

  setTables: (tables) => set({ tables }),
  setTimeline: (timeline) => set({ timeline }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setGlobalConfig: (globalConfig) => set({ globalConfig }),
}));

export default useStore;
