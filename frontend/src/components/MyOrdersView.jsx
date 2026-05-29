import { ArrowLeft, Package, XCircle } from "lucide-react";
import OrderCard from "./OrderCard";

export default function MyOrdersView({
  orders,
  loading,
  onBack,
  onCancel,
  actionId,
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
          <h2 style={{ fontWeight: "800", letterSpacing: "-0.03em" }}>My Orders</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", marginTop: "4px" }}>
            Status updates automatically every few seconds.
          </p>
        </div>
        {lastUpdated && (
          <span className="live-indicator">
            <span className="live-dot" />
            Live · {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {loading && orders.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "40px" }}>
          Loading orders...
        </p>
      ) : orders.length === 0 ? (
        <div className="card-glass" style={{ textAlign: "center", padding: "64px 24px" }}>
          <Package size={48} style={{ margin: "0 auto 16px", strokeWidth: 1.5, color: "var(--text-muted)" }} />
          <h3 style={{ fontWeight: "600" }}>No orders yet</h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "8px" }}>
            Browse a restaurant menu and add items to your cart to place your first order.
          </p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order}>
              {order.order_status === "pending" && (
                <button
                  type="button"
                  className="btn btn-secondary order-reject-btn"
                  style={{ width: "100%" }}
                  disabled={actionId === order.id}
                  onClick={() => onCancel(order.id)}
                >
                  <XCircle size={16} />
                  <span>{actionId === order.id ? "Cancelling..." : "Cancel order"}</span>
                </button>
              )}
            </OrderCard>
          ))}
        </div>
      )}
    </div>
  );
}
