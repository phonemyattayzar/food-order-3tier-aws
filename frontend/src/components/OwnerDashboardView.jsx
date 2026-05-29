import { useState, useEffect } from "react";
import { DollarSign, Clipboard, Calendar, ArrowLeft, TrendingUp } from "lucide-react";
import { apiRequest } from "../api/client";

export default function OwnerDashboardView({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSalesSummary = async () => {
    setLoading(true);
    try {
      const { res, data } = await apiRequest("/orders/sales/summary");
      if (res.ok) {
        setSummary(data);
      }
    } catch (err) {
      console.error("Error fetching sales summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesSummary();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "24px" }}>
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div>
          <h2 style={{ fontWeight: "800", letterSpacing: "-0.03em" }}>Sales & Revenue Dashboard</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Track your storefront revenue, order counts, and daily performance metrics.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading statistics...</p>
        </div>
      ) : !summary ? (
        <div className="card-glass" style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
          Failed to load dashboard statistics. Please try again later.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Summary Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            <div className="card-glass" style={{ padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--accent-success)", padding: "12px", borderRadius: "var(--border-radius-md)" }}>
                <DollarSign size={24} />
              </div>
              <div>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                  Total Revenue
                </span>
                <h3 style={{ fontSize: "1.75rem", fontWeight: "800", margin: "4px 0 0" }}>
                  {summary.total_revenue.toLocaleString()} MMK
                </h3>
              </div>
            </div>

            <div className="card-glass" style={{ padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--accent-primary)", padding: "12px", borderRadius: "var(--border-radius-md)" }}>
                <Clipboard size={24} />
              </div>
              <div>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                  Completed Orders
                </span>
                <h3 style={{ fontSize: "1.75rem", fontWeight: "800", margin: "4px 0 0" }}>
                  {summary.total_orders} Order(s)
                </h3>
              </div>
            </div>

            <div className="card-glass" style={{ padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--accent-warning)", padding: "12px", borderRadius: "var(--border-radius-md)" }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                  Avg Order Value
                </span>
                <h3 style={{ fontSize: "1.75rem", fontWeight: "800", margin: "4px 0 0" }}>
                  {summary.total_orders > 0
                    ? Math.round(summary.total_revenue / summary.total_orders).toLocaleString()
                    : 0}{" "}
                  MMK
                </h3>
              </div>
            </div>
          </div>

          {/* Daily Sales Chart/Table */}
          <div className="card-glass" style={{ padding: "24px" }}>
            <h3 style={{ fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={18} color="var(--accent-primary)" />
              Daily Sales History (Last 30 Days)
            </h3>

            {summary.daily_sales.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                No daily sales history available yet. Complete customer orders to populate this graph.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="order-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-glass)", textAlign: "left" }}>
                      <th style={{ padding: "12px 16px", color: "var(--text-muted)" }}>Date</th>
                      <th style={{ padding: "12px 16px", color: "var(--text-muted)" }}>Orders Completed</th>
                      <th style={{ padding: "12px 16px", color: "var(--text-muted)", textAlign: "right" }}>Daily Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.daily_sales.map((day) => (
                      <tr key={day.date} style={{ borderBottom: "1px solid var(--border-glass)" }}>
                        <td style={{ padding: "12px 16px", fontWeight: "500" }}>{day.date}</td>
                        <td style={{ padding: "12px 16px" }}>{day.orders} Completed</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "var(--accent-success)" }}>
                          {day.revenue.toLocaleString()} MMK
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
