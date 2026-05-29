import { Clock, MapPin, Store } from "lucide-react";
import { formatOrderStatus } from "../utils/orderStatus";

export default function OrderCard({
  order,
  children,
  highlightPending,
}) {
  return (
    <div
      className={`card-glass order-card ${
        highlightPending && order.order_status === "pending" ? "incoming-order-card" : ""
      }`}
    >
      <div className="order-card-header">
        <div>
          <div className="order-number">{order.order_number}</div>
          <div className="order-date">
            <Clock size={12} />
            {new Date(order.created_at).toLocaleString()}
          </div>
        </div>
        <span className={`order-status-badge status-${order.order_status}`}>
          {formatOrderStatus(order.order_status)}
        </span>
      </div>

      {order.restaurant_name && (
        <div className="order-meta-row">
          <Store size={14} color="var(--accent-primary)" />
          <span style={{ fontWeight: "600" }}>{order.restaurant_name}</span>
        </div>
      )}

      <div className="order-meta-row">
        <MapPin size={14} color="var(--accent-primary)" />
        <span>{order.delivery_address}</span>
      </div>

      {order.order_items?.length > 0 && (
        <div className="order-items-block">
          {order.order_items.map((item) => (
            <div key={item.id} className="order-item-line">
              <span>× {item.quantity}</span>
              <span>
                {(item.price_at_purchase * item.quantity).toLocaleString()} MMK
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="order-total-row" style={{ marginBottom: children ? "16px" : 0 }}>
        <span>Total</span>
        <span>{order.total_amount_mmk.toLocaleString()} MMK</span>
      </div>

      {children}
    </div>
  );
}
