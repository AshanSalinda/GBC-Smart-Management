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
  const payload = {
    checkInTime: new Date(updatedData.startTime).toISOString(),
    checkOutTime: new Date(updatedData.startTime + updatedData.duration).toISOString(),
    amount: updatedData.amount,
    isPaid: updatedData.paid
  };

  const response = await apiClient.patch(`/api/bookings/${bookingId}`, payload);
  return response.data;
};
