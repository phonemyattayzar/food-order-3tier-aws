import { Users, Store, ShoppingBag, DollarSign, Check, X, ShieldAlert, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest, parseApiError } from "../api/client";

export default function AdminDashboardView({ onBack, onRestaurantStatusChanged }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, restRes] = await Promise.all([
        apiRequest("/admin/stats"),
        apiRequest("/admin/users"),
        apiRequest("/admin/restaurants?status=pending"),
      ]);

      if (statsRes.res.ok) setStats(statsRes.data);
      if (usersRes.res.ok) setUsers(usersRes.data);
      if (restRes.res.ok) setRestaurants(restRes.data);
    } catch (err) {
      console.error("Admin fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleUser = async (user_id, is_active) => {
    setActionId(user_id);
    try {
      const { res } = await apiRequest(`/admin/users/${user_id}/active?is_active=${!is_active}`, {
        method: "PATCH",
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === user_id ? { ...u, is_active: !is_active } : u));
      }
    } finally {
      setActionId(null);
    }
  };

  const handleUpdateStatus = async (restaurant_id, status) => {
    setActionId(restaurant_id);
    try {
      const { res } = await apiRequest(`/admin/restaurants/${restaurant_id}/status?status=${status}`, {
        method: "PATCH",
      });
      if (res.ok) {
        setRestaurants(prev => prev.filter(r => r.id !== restaurant_id));
        if (status === "approved") {
          setStats(prev => ({
            ...prev,
            total_restaurants: (prev?.total_restaurants ?? 0) + 1,
          }));
        }
        onRestaurantStatusChanged?.();
      }
    } finally {
      setActionId(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="admin-loading">
        <RefreshCw className="animate-spin" />
        <p>Loading Platform Statistics...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="view-header">
        <button className="btn btn-secondary" onClick={onBack}>← Back to Home</button>
        <h1>Platform Administration</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon users"><Users size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{stats?.total_users || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon restaurants"><Store size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Active Shops</span>
            <span className="stat-value">{stats?.total_restaurants || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orders"><ShoppingBag size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Orders</span>
            <span className="stat-value">{stats?.total_orders || 0}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon revenue"><DollarSign size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">{stats?.total_revenue?.toLocaleString() || 0} MMK</span>
          </div>
        </div>
      </div>

      <div className="admin-sections">
        <section className="admin-section">
          <h2>Pending Approvals ({restaurants.length})</h2>
          <div className="card-glass overflow-x">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Restaurant Name</th>
                  <th>Owner</th>
                  <th>Township</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.map(r => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td><span className="text-muted small">{r.owner_id}</span></td>
                    <td>{r.township}</td>
                    <td>
                      <div className="btn-group">
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleUpdateStatus(r.id, "approved")}
                          disabled={actionId === r.id}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleUpdateStatus(r.id, "suspended")}
                          disabled={actionId === r.id}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {restaurants.length === 0 && (
                  <tr><td colSpan="4" className="text-center">No pending registrations</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2>User Management</h2>
          <div className="card-glass overflow-x">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge-role ${u.role}`}>{u.role}</span></td>
                    <td>
                      <span className={`status-pill ${u.is_active ? "active" : "suspended"}`}>
                        {u.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`btn ${u.is_active ? "btn-outline-danger" : "btn-outline-success"} btn-sm`}
                        onClick={() => handleToggleUser(u.id, u.is_active)}
                        disabled={actionId === u.id || u.role === "admin"}
                      >
                        {u.is_active ? <ShieldAlert size={14} /> : <Check size={14} />}
                        {u.is_active ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
