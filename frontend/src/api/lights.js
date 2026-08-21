import apiClient from './client';

export const toggleLight = async (tableId, targetState) => {
  const response = await apiClient.post('/api/lights/toggle', {
    tableId,
    targetState
  });
  return response.data;
};
