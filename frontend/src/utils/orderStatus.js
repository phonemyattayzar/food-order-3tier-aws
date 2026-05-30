export const ORDER_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "out_for_delivery", label: "Delivering" },
  { value: "completed", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export function formatOrderStatus(status) {
  const labels = {
    pending: "Awaiting approval",
    confirmed: "Confirmed",
    preparing: "Preparing",
    delivering: "Out for delivery",
    out_for_delivery: "Out for delivery",
    completed: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

export function getNextOwnerStatus(currentStatus) {
  const flow = {
    confirmed: { status: "preparing", label: "Start preparing" },
    preparing: { status: "out_for_delivery", label: "Out for delivery" },
    delivering: { status: "completed", label: "Mark delivered" },
    out_for_delivery: { status: "completed", label: "Mark delivered" },
  };
  return flow[currentStatus] || null;
}
