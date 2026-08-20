import apiClient from './client';

export const listUsers = async (maxResults = 100, pageToken = '') => {
  const params = { maxResults };
  if (pageToken) params.pageToken = pageToken;
  
  const response = await apiClient.get('/api/users', { params });
  return response.data;
};

export const setRole = async (uid, role) => {
  const response = await apiClient.patch(`/api/users/${uid}/role`, { role });
  return response.data;
};

export const deleteUser = async (uid) => {
  const response = await apiClient.delete(`/api/users/${uid}`);
  return response.data;
};
