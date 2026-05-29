import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import OrderCard from "./OrderCard";
import { ORDER_STATUS_FILTERS, getNextOwnerStatus } from "../utils/orderStatus";

export default function OrderHistoryView({
  orders,
  loading,
  statusFilter,
  setStatusFilter,
  onBack,
  onApprove,
  onReject,
  onAdvanceStatus,
  actionId,
  isAdmin,
  lastUpdated,
}) {
  return (
    <div>
      <button className="btn btn-secondary back-btn" onClick={onBack} style={{ marginBottom: "24px" }}>
        <ArrowLeft size={16} />
        <span>Back to Restaurants</span>
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
        <div>
          <h2 style={{ fontWeight: "800", letterSpacing: "-0.03em" }}>Order Management</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", marginTop: "4px" }}>
            {isAdmin
              ? "View and manage orders from all restaurants."
              : "Approve orders and track status through delivery."}
          </p>
        </div>
        {lastUpdated && (
          <span className="live-indicator">
            <span className="live-dot" />
            Updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="status-filter-tabs">
        {ORDER_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`status-filter-tab ${statusFilter === f.value ? "active" : ""}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "40px" }}>
          Loading orders...
        </p>
      ) : orders.length === 0 ? (
        <div className="card-glass" style={{ textAlign: "center", padding: "64px 24px", marginTop: "24px" }}>
          <h3 style={{ fontWeight: "600" }}>No orders in this category</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "8px" }}>
            {statusFilter === "pending"
              ? "New customer orders will appear here for approval."
              : "Try another filter to see more orders."}
          </p>
        </div>
      ) : (
        <div className="orders-list" style={{ marginTop: "24px" }}>
          {orders.map((order) => {
            const nextStep = getNextOwnerStatus(order.order_status);
            return (
              <OrderCard
                key={order.id}
                order={order}
                highlightPending={statusFilter === "all" || statusFilter === "pending"}
              >
                {order.order_status === "pending" && (
                  <div className="order-action-row">
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={actionId === order.id}
                      onClick={() => onApprove(order.id)}
                    >
                      <CheckCircle size={16} />
                      <span>{actionId === order.id ? "Processing..." : "Approve"}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary order-reject-btn"
                      disabled={actionId === order.id}
                      onClick={() => onReject(order.id)}
                    >
                      <XCircle size={16} />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
                {nextStep && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    disabled={actionId === order.id}
                    onClick={() => onAdvanceStatus(order.id, nextStep.status)}
                  >
                    <span>{actionId === order.id ? "Updating..." : nextStep.label}</span>
                  </button>
                )}
              </OrderCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
