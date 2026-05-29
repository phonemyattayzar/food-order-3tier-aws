import { TrendingUp, ShoppingBag, DollarSign, Calendar, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export default function OwnerAnalyticsView({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const { res, data } = await apiRequest("/orders/sales-summary");
        if (res.ok) setSummary(data);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) return <div className="p-24 text-center">Loading sales data...</div>;

  return (
    <div className="analytics-view">
      <div className="view-header">
        <button className="btn btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <h1>Business Insights</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon revenue"><DollarSign size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <span className="stat-value">{summary?.total_revenue?.toLocaleString()} MMK</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orders"><ShoppingBag size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Orders</span>
            <span className="stat-value">{summary?.total_orders}</span>
          </div>
        </div>
      </div>

      <section className="analytics-section">
        <h2>Recent Performance (Last 30 Days)</h2>
        <div className="card-glass overflow-x">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary?.daily_sales.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td>{day.orders}</td>
                  <td>{day.revenue?.toLocaleString()} MMK</td>
                </tr>
              ))}
              {summary?.daily_sales.length === 0 && (
                <tr><td colSpan="3" className="text-center">No sales recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
