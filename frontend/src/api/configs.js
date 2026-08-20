import apiClient from './client';

export const getConfig = async () => {
  const response = await apiClient.get('/api/configs');
  return response.data;
};

export const updateConfig = async (configData) => {
  const response = await apiClient.patch('/api/configs', configData);
  return response.data;
};
