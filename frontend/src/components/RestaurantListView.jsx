import { useState, useEffect } from "react";
import { Plus, Store, MapPin, Phone, ChevronRight, Search, Filter, X } from "lucide-react";

export default function RestaurantListView({
  activeUser,
  loading,
  restaurants,
  setShowAddRestaurant,
  handleViewRestaurant,
  searchVal,
  townshipVal,
  onApplyFilters,
}) {
  const [localSearch, setLocalSearch] = useState(searchVal || "");
  const [localTownship, setLocalTownship] = useState(townshipVal || "");
  const [allTownships, setAllTownships] = useState([]);

  // Dynamically build list of unique townships from restaurants
  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      // Gather all townships from restaurants
      const townships = restaurants
        .map((r) => r.township)
        .filter(Boolean)
        .map((t) => t.trim());
      const uniqueTownships = Array.from(new Set(townships)).sort();
      
      // If we don't have filters, update the dropdown options
      if (!searchVal && !townshipVal) {
        setAllTownships(uniqueTownships);
      } else if (allTownships.length === 0) {
        setAllTownships(uniqueTownships);
      }
    }
  }, [restaurants, searchVal, townshipVal, allTownships.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onApplyFilters(localSearch, localTownship);
  };

  const handleTownshipChange = (e) => {
    const val = e.target.value;
    setLocalTownship(val);
    onApplyFilters(localSearch, val);
  };

  const handleClear = () => {
    setLocalSearch("");
    setLocalTownship("");
    onApplyFilters("", "");
  };

  const hasActiveFilters = searchVal || townshipVal;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontWeight: "800", letterSpacing: "-0.03em" }}>Explore Restaurants</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            {activeUser.role === "customer"
              ? "Pick a restaurant, add dishes to your cart, and place an order."
              : "Discover local dining spots or manage your storefront."}
          </p>
        </div>

        {activeUser.role === "owner" && (
          <button className="btn btn-primary" onClick={() => setShowAddRestaurant(true)}>
            <Plus size={18} />
            <span>Register Restaurant</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search by restaurant name..."
            style={{ paddingLeft: "42px" }}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        <div style={{ position: "relative", width: "200px", minWidth: "150px" }}>
          <Filter
            size={16}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <select
            className="form-control"
            style={{ paddingLeft: "38px" }}
            value={localTownship}
            onChange={handleTownshipChange}
          >
            <option value="">All Townships</option>
            {allTownships.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            {/* Fallback common townships if list is empty */}
            {allTownships.length === 0 && (
              <>
                <option value="Bahan">Bahan</option>
                <option value="Sanchaung">Sanchaung</option>
                <option value="Kamayut">Kamayut</option>
                <option value="Hlaing">Hlaing</option>
                <option value="Yankin">Yankin</option>
                <option value="Latha">Latha</option>
              </>
            )}
          </select>
        </div>

        <button type="submit" className="btn btn-primary">
          <span>Search</span>
        </button>

        {hasActiveFilters && (
          <button type="button" className="btn btn-secondary" onClick={handleClear}>
            <X size={16} />
            <span>Clear</span>
          </button>
        )}
      </form>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading restaurants...</p>
        </div>
      ) : restaurants.length === 0 ? (
        <div className="card-glass" style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-secondary)", marginTop: "24px" }}>
          <Store size={48} style={{ margin: "0 auto 16px", strokeWidth: 1.5, color: "var(--text-muted)" }} />
          <h3 style={{ color: "var(--text-primary)", fontWeight: "600" }}>No restaurants found</h3>
          <p style={{ fontSize: "0.875rem", marginTop: "4px" }}>
            {hasActiveFilters
              ? "Try adjusting your search query or township filter."
              : activeUser.role === "owner"
              ? "Be the first to register your restaurant and upload a menu!"
              : "Ask owners to register their restaurant storefronts."}
          </p>
          {hasActiveFilters ? (
            <button className="btn btn-secondary" onClick={handleClear} style={{ marginTop: "20px" }}>
              <span>Reset Filters</span>
            </button>
          ) : (
            activeUser.role === "owner" && (
              <button className="btn btn-primary" onClick={() => setShowAddRestaurant(true)} style={{ marginTop: "20px" }}>
                <Plus size={18} />
                <span>Register Restaurant Now</span>
              </button>
            )
          )}
        </div>
      ) : (
        <div className="restaurant-grid">
          {restaurants.map((restaurant) => (
            <div key={restaurant.id} className="card-glass restaurant-card" onClick={() => handleViewRestaurant(restaurant)}>
              <div className="restaurant-banner">
                <Store size={36} color="rgba(255,255,255,0.15)" />
                <div className="restaurant-banner-overlay" />
              </div>
              <div className="restaurant-info">
                <div className="restaurant-title">
                  <span>{restaurant.name}</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    {restaurant.status && restaurant.status !== "approved" && (
                      <span
                        className="restaurant-status"
                        style={{
                          background: restaurant.status === "pending" ? "rgba(251, 191, 36, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: restaurant.status === "pending" ? "#f59e0b" : "#ef4444",
                          fontSize: "0.6875rem",
                          textTransform: "capitalize",
                        }}
                      >
                        {restaurant.status === "pending" ? "Awaiting approval" : restaurant.status}
                      </span>
                    )}
                    <span className={`restaurant-status ${restaurant.is_open ? "status-open" : "status-closed"}`}>
                      {restaurant.is_open ? "Open" : "Closed"}
                    </span>
                  </div>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", height: "36px", marginBottom: "8px" }}>
                  {restaurant.description || "No description provided."}
                </p>

                <div className="restaurant-meta">
                  <div className="meta-item">
                    <MapPin size={13} color="var(--text-muted)" />
                    <span>{restaurant.township}</span>
                  </div>
                  <div className="meta-item">
                    <Phone size={13} color="var(--text-muted)" />
                    <span>{restaurant.phone_number}</span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", borderTop: "1px solid var(--border-glass)", paddingTop: "12px" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                    View Menu
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
