import apiClient from './client';

export const createBooking = async (bookingData) => {
  const payload = {
    tableId: bookingData.tableId,
    bookerName: bookingData.player,
    bookerMobile: bookingData.mobile,
    checkInTime: new Date(bookingData.startTime).toISOString(),
    checkOutTime: new Date(bookingData.startTime + bookingData.duration).toISOString(),
    amount: bookingData.amount,
    isPaid: bookingData.paid
  };

  const response = await apiClient.post('/api/bookings', payload);
  return response.data;
};

export const updateBooking = async (bookingId, updatedData) => {
  const payload = {};

  if (updatedData.startTime !== undefined && updatedData.duration !== undefined) {
    payload.checkInTime = new Date(updatedData.startTime).toISOString();
    payload.checkOutTime = new Date(updatedData.startTime + updatedData.duration).toISOString();
  }

  if (updatedData.amount !== undefined) {
    payload.amount = updatedData.amount;
  }

  if (updatedData.paid !== undefined) {
    payload.isPaid = updatedData.paid;
  }

  const response = await apiClient.patch(`/api/bookings/${bookingId}`, payload);
  return response.data;
};

export const cancelBooking = async (bookingId) => {
  const response = await apiClient.delete(`/api/bookings/${bookingId}`);
  return response.data;
};
