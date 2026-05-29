import { ChefHat, Sun, Sunset, Sparkles, User, LogOut, Package, ClipboardList, TrendingUp, ShieldAlert } from "lucide-react";
import NotificationBell from "./NotificationBell";

export default function Header({
  theme,
  setTheme,
  activeUser,
  handleLogout,
  setSelectedRestaurant,
  onMyOrders,
  showMyOrders,
  onOrderManagement,
  showOrderManagement,
  pendingOrderCount,
  notifications,
  unreadNotificationCount,
  onMarkAllNotificationsRead,
  onMarkNotificationRead,
  onNotificationsOpenOrders,
  onOpenOwnerDashboard,
  showOwnerDashboard,
  onOpenAdminDashboard,
  showAdminDashboard,
}) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div
          className="app-logo"
          style={{ cursor: "pointer" }}
          onClick={() => setSelectedRestaurant(null)}
        >
          <ChefHat size={26} color="var(--accent-primary)" />
          <span>Sar Mel (စားမယ်)</span>
        </div>

        <div className="profile-bar">
          {/* Theme Toggle Button Group */}
          <div className="theme-toggle-group">
            <button
              className={`theme-toggle-btn ${theme === "bright" ? "active" : ""}`}
              onClick={() => setTheme("bright")}
              title="Bright Premium Light"
            >
              <Sun size={14} />
            </button>
            <button
              className={`theme-toggle-btn ${theme === "sunset" ? "active" : ""}`}
              onClick={() => setTheme("sunset")}
              title="Warm Sunset Foodie"
            >
              <Sunset size={14} />
            </button>
            <button
              className={`theme-toggle-btn ${theme === "mint" ? "active" : ""}`}
              onClick={() => setTheme("mint")}
              title="Fresh Organic Mint"
            >
              <Sparkles size={14} />
            </button>
          </div>

          {activeUser ? (
            <>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadNotificationCount}
                onMarkAllRead={onMarkAllNotificationsRead}
                onMarkRead={onMarkNotificationRead}
                onOpenOrders={onNotificationsOpenOrders}
              />
              {activeUser.role === "admin" && onOpenAdminDashboard && (
                <button
                  className={`btn btn-secondary ${showAdminDashboard ? "active" : ""}`}
                  onClick={onOpenAdminDashboard}
                  style={{ padding: "6px 12px" }}
                >
                  <ShieldAlert size={14} />
                  <span>Admin Panel</span>
                </button>
              )}
              {activeUser.role === "owner" && onOpenOwnerDashboard && (
                <button
                  className={`btn btn-secondary ${showOwnerDashboard ? "active" : ""}`}
                  onClick={onOpenOwnerDashboard}
                  style={{ padding: "6px 12px" }}
                >
                  <TrendingUp size={14} />
                  <span>Sales Dashboard</span>
                </button>
              )}
              {(activeUser.role === "owner" || activeUser.role === "admin") && onOrderManagement && (
                <button
                  className={`btn btn-secondary ${showOrderManagement ? "active" : ""}`}
                  onClick={onOrderManagement}
                  style={{ padding: "6px 12px", position: "relative" }}
                >
                  <ClipboardList size={14} />
                  <span>Orders</span>
                  {pendingOrderCount > 0 && (
                    <span className="header-badge-count">{pendingOrderCount}</span>
                  )}
                </button>
              )}
              {activeUser.role === "customer" && onMyOrders && (
                <button
                  className={`btn btn-secondary ${showMyOrders ? "active" : ""}`}
                  onClick={onMyOrders}
                  style={{ padding: "6px 12px" }}
                >
                  <Package size={14} />
                  <span>My Orders</span>
                </button>
              )}
              <div className="user-badge">
                <User size={14} />
                <span>{activeUser.full_name}</span>
                <span className={`badge-role ${activeUser.role}`}>
                  {activeUser.role}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleLogout}
                style={{ padding: "6px 12px" }}
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <span className="user-badge" style={{ color: "var(--text-muted)" }}>
              Not Logged In
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
