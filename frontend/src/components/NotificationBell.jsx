import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onOpenOrders,
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="notification-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className="btn btn-secondary notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="header-badge-count notification-badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel card-glass">
          <div className="notification-panel-header">
            <span style={{ fontWeight: "700" }}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-read" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p style={{ padding: "16px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              No notifications yet.
            </p>
          ) : (
            <div className="notification-list">
              {notifications.slice(0, 12).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notification-item ${n.is_read ? "" : "unread"}`}
                  onClick={() => {
                    if (!n.is_read) onMarkRead(n.id);
                    if (onOpenOrders) onOpenOrders();
                    setOpen(false);
                  }}
                >
                  <div className="notification-item-title">{n.title}</div>
                  <div className="notification-item-message">{n.message}</div>
                  <div className="notification-item-time">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
