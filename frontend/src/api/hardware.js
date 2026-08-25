import apiClient from './client';

export const hardwareApi = {
  getHealth: async () => {
    const response = await apiClient.get('/api/hardware/health');
    return response.data;
  },
};
