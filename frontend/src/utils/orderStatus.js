export const ORDER_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "delivering", label: "Delivering" },
  { value: "completed", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function formatOrderStatus(status) {
  const labels = {
    pending: "Awaiting approval",
    confirmed: "Confirmed",
    preparing: "Preparing",
    delivering: "Out for delivery",
    completed: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

export function getNextOwnerStatus(currentStatus) {
  const flow = {
    confirmed: { status: "preparing", label: "Start preparing" },
    preparing: { status: "delivering", label: "Out for delivery" },
    delivering: { status: "completed", label: "Mark delivered" },
  };
  return flow[currentStatus] || null;
}
