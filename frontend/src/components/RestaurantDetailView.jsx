import { useState, useEffect } from "react";
import {
  MapPin,
  Phone,
  Layers,
  Utensils,
  Clock,
  Plus,
  Minus,
  ShoppingCart,
  Star,
  Tag,
  Edit2,
  Trash2,
} from "lucide-react";
import { apiRequest, parseApiError } from "../api/client";
import AddCouponModal from "./AddCouponModal";

export default function RestaurantDetailView({
  selectedRestaurant,
  setSelectedRestaurant,
  activeUser,
  groupedMenu,
  activeCategoryFilter,
  setActiveCategoryFilter,
  setShowAddCategory,
  setShowAddMenuItem,
  setMenuItemForm,
  canOrder,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onOpenCheckout,
  onRefreshMenu,
}) {
  const isOwner = activeUser.id === selectedRestaurant.owner_id;

  // Review & Rating states
  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState({ average_rating: 0, total_reviews: 0 });
  const [completedOrders, setCompletedOrders] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Form State for review submission
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState("");
  const [formOrderId, setFormOrderId] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Coupon State
  const [showAddCoupon, setShowAddCoupon] = useState(false);

  const getCartQty = (menuItemId) => {
    const entry = cart.find((c) => c.menu_item_id === menuItemId);
    return entry?.quantity || 0;
  };

  const loadReviewsAndRating = async () => {
    setReviewsLoading(true);
    try {
      const [reviewsRes, ratingRes] = await Promise.all([
        apiRequest(`/reviews/restaurant/${selectedRestaurant.id}`),
        apiRequest(`/reviews/restaurant/${selectedRestaurant.id}/rating`),
      ]);
      if (reviewsRes.res.ok) {
        setReviews(reviewsRes.data);
      }
      if (ratingRes.res.ok) {
        setRatingSummary(ratingRes.data);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadCompletedOrders = async () => {
    if (!activeUser || activeUser.role !== "customer") return;
    try {
      const { res, data } = await apiRequest(`/orders/user/${activeUser.id}`);
      if (res.ok) {
        // Filter orders for this restaurant that are completed
        const matchingOrders = data.filter(
          (o) => o.restaurant_id === selectedRestaurant.id && o.order_status === "completed"
        );
        setCompletedOrders(matchingOrders);
      }
    } catch (err) {
      console.error("Failed to load user completed orders:", err);
    }
  };

  useEffect(() => {
    loadReviewsAndRating();
    loadCompletedOrders();
  }, [selectedRestaurant.id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess(false);

    try {
      const payload = {
        restaurant_id: selectedRestaurant.id,
        rating: formRating,
        comment: formComment || null,
        order_id: formOrderId || null,
      };

      const { res, data } = await apiRequest("/reviews/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitSuccess(true);
        setFormComment("");
        setFormOrderId("");
        setFormRating(5);
        loadReviewsAndRating(); // reload
      } else {
        const errorDetail = data?.detail || "Failed to submit review";
        setSubmitError(errorDetail);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;
    try {
      const { res, data } = await apiRequest(`/menu-items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        onRefreshMenu();
      } else {
        alert(parseApiError(data, "Failed to delete item"));
      }
    } catch {
      alert("Network error");
    }
  };

  const handleEditMenuItem = (item) => {
    setMenuItemForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price_mmk: item.price_mmk,
      is_available: item.is_available,
      preparation_time_minutes: item.preparation_time_minutes || "",
      category_id: item.category_id || "",
      image_url: item.image_url || "",
    });
    setShowAddMenuItem(true);
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={14}
          fill={i <= rating ? "var(--accent-warning)" : "none"}
          color={i <= rating ? "var(--accent-warning)" : "var(--text-muted)"}
          style={{ marginRight: "2px" }}
        />
      );
    }
    return <div style={{ display: "flex" }}>{stars}</div>;
  };

  const renderInteractiveStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={24}
          fill={i <= formRating ? "var(--accent-warning)" : "none"}
          color={i <= formRating ? "var(--accent-warning)" : "var(--text-muted)"}
          style={{ cursor: "pointer", transition: "transform 0.1s" }}
          onClick={() => setFormRating(i)}
        />
      );
    }
    return <div style={{ display: "flex", gap: "8px", margin: "8px 0" }}>{stars}</div>;
  };

  const handleCouponCreated = (msg) => {
    // optional
  };

  return (
    <div style={{ paddingBottom: canOrder && cart.length > 0 ? "100px" : undefined }}>
      {/* Back Navigation Header */}
      <div className="detail-header">
        <button className="btn btn-secondary back-btn" onClick={() => setSelectedRestaurant(null)}>
          <span>← Back to Restaurants</span>
        </button>

        <div className="restaurant-detail-hero">
          <div className="restaurant-banner-overlay" />
          <div className="restaurant-hero-details">
            <div className="restaurant-hero-name">
              {selectedRestaurant.name}
              <span className={`restaurant-status ${selectedRestaurant.is_open ? "status-open" : "status-closed"}`} style={{ fontSize: "0.8rem", padding: "4px 8px" }}>
                {selectedRestaurant.is_open ? "Open" : "Closed"}
              </span>
            </div>
            <p style={{ color: "var(--text-secondary)", maxWidth: "600px", fontSize: "0.9375rem" }}>
              {selectedRestaurant.description || "No description provided."}
            </p>
            
            {/* Rating Stars Summary in Header */}
            {ratingSummary.total_reviews > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--accent-warning)", fontWeight: "700" }}>
                  <Star size={16} fill="var(--accent-warning)" color="var(--accent-warning)" />
                  <span>{ratingSummary.average_rating ? ratingSummary.average_rating.toFixed(1) : "0.0"}</span>
                </div>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  ({ratingSummary.total_reviews} reviews)
                </span>
              </div>
            )}
            
            <div className="restaurant-meta" style={{ flexDirection: "row", gap: "24px", marginTop: "16px", color: "var(--text-primary)", fontWeight: "500", fontSize: "0.875rem" }}>
              <div className="meta-item">
                <MapPin size={15} color="var(--accent-primary)" />
                <span>{selectedRestaurant.address}, {selectedRestaurant.township}</span>
              </div>
              <div className="meta-item">
                <Phone size={15} color="var(--accent-success)" />
                <span>{selectedRestaurant.phone_number}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Owner Controls */}
      {canOrder && !selectedRestaurant.is_open && (
        <div className="card-glass" style={{ marginBottom: "24px", padding: "16px 20px", background: "rgba(220, 38, 38, 0.06)" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
            This restaurant is currently closed. Ordering is unavailable until they reopen.
          </p>
        </div>
      )}

      {canOrder && selectedRestaurant.is_open && (
        <div className="card-glass" style={{ marginBottom: "24px", padding: "16px 20px", background: "rgba(5, 150, 105, 0.06)" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>
            Tap <strong style={{ color: "var(--text-primary)" }}>Add</strong> on any available dish to build your cart, then checkout when ready.
          </p>
        </div>
      )}

      {activeUser.role === "owner" && isOwner && (
        <div className="card-glass" style={{ marginBottom: "32px", display: "flex", gap: "12px", alignItems: "center", background: "rgba(99, 102, 241, 0.04)" }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: "700" }}>Restaurant Management Console</h4>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              You own this restaurant. Add categories, menu items, and coupons below.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => setShowAddCategory(true)}>
              <Layers size={16} />
              <span>Add Category</span>
            </button>
            <button className="btn btn-success" onClick={() => {
              // Prefill first category if available
              if (groupedMenu.length > 0) {
                setMenuItemForm(f => ({ ...f, category_id: groupedMenu[0].id }));
              }
              setShowAddMenuItem(true);
            }}>
              <Utensils size={16} />
              <span>Add Menu Item</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setShowAddCoupon(true)} style={{ borderColor: "var(--accent-primary)" }}>
              <Tag size={16} color="var(--accent-primary)" />
              <span style={{ color: "var(--accent-primary)" }}>Add Coupon</span>
            </button>
          </div>
        </div>
      )}

      {/* Categories & Menu Items Layout */}
      <div className="menu-section">
        {/* Category Sidebar navigation */}
        <div className="menu-sidebar">
          <span className="menu-sidebar-title">Categories</span>
          <div
            className={`menu-cat-link ${activeCategoryFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveCategoryFilter("all")}
          >
            All Categories
          </div>

          {groupedMenu.map((cat) => (
            <div
              key={cat.id}
              className={`menu-cat-link ${activeCategoryFilter === cat.id ? "active" : ""}`}
              onClick={() => setActiveCategoryFilter(cat.id)}
            >
              {cat.name} ({cat.menu_items?.length || 0})
            </div>
          ))}

          {/* Reviews tab link at the bottom of sidebar */}
          <div style={{ borderTop: "1px solid var(--border-glass)", margin: "12px 0" }} />
          <div
            className={`menu-cat-link ${activeCategoryFilter === "reviews" ? "active" : ""}`}
            onClick={() => setActiveCategoryFilter("reviews")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Star size={14} style={{ fill: activeCategoryFilter === "reviews" ? "currentColor" : "none" }} />
            <span>Reviews ({ratingSummary.total_reviews})</span>
          </div>
        </div>

        {/* Menu Items Grid or Reviews Grid */}
        <div className="menu-content" style={{ flex: 1 }}>
          {activeCategoryFilter === "reviews" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Rating Overview Card */}
              <div className="card-glass" style={{ padding: "24px", display: "flex", alignItems: "center", gap: "40px", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "3rem", fontWeight: "800", color: "var(--text-primary)", lineHeight: 1 }}>
                    {ratingSummary.average_rating ? ratingSummary.average_rating.toFixed(1) : "0.0"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                    {renderStars(Math.round(ratingSummary.average_rating || 0))}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Based on {ratingSummary.total_reviews} reviews
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: "200px" }}>
                  <h4 style={{ fontWeight: "600", marginBottom: "8px" }}>Customer Feedback</h4>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    Reviews and ratings are written by real customers who ordered meals from this restaurant.
                  </p>
                </div>
              </div>

              {/* Review Input Form for customers */}
              {canOrder && (
                <div className="card-glass" style={{ padding: "24px" }}>
                  <h4 style={{ fontWeight: "700", marginBottom: "12px" }}>Write a Review</h4>
                  
                  {submitSuccess && (
                    <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "var(--border-radius-md)", color: "var(--accent-success)", marginBottom: "16px", fontSize: "0.875rem" }}>
                      Review submitted successfully! Thank you for your feedback.
                    </div>
                  )}

                  {submitError && (
                    <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.1)", borderRadius: "var(--border-radius-md)", color: "var(--accent-danger)", marginBottom: "16px", fontSize: "0.875rem" }}>
                      {submitError}
                    </div>
                  )}

                  <form onSubmit={handleReviewSubmit}>
                    <div className="form-group" style={{ marginBottom: "16px" }}>
                      <label style={{ marginBottom: "4px" }}>Rating</label>
                      {renderInteractiveStars()}
                    </div>

                    {completedOrders.length > 0 && (
                      <div className="form-group" style={{ marginBottom: "16px" }}>
                        <label htmlFor="review-order-id">Link to a Completed Order (Optional)</label>
                        <select
                          id="review-order-id"
                          className="form-control"
                          value={formOrderId}
                          onChange={(e) => setFormOrderId(e.target.value)}
                        >
                          <option value="">No order link</option>
                          {completedOrders.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.order_number} ({new Date(o.created_at).toLocaleDateString()} - {o.total_amount_mmk.toLocaleString()} MMK)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: "16px" }}>
                      <label htmlFor="review-comment">Comments / Feedback</label>
                      <textarea
                        id="review-comment"
                        className="form-control"
                        rows="3"
                        placeholder="Tell us what you liked or disliked about the food..."
                        value={formComment}
                        onChange={(e) => setFormComment(e.target.value)}
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                      <span>{submitLoading ? "Submitting..." : "Submit Review"}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Reviews List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h4 style={{ fontWeight: "700" }}>Customer Reviews</h4>
                
                {reviewsLoading ? (
                  <p style={{ color: "var(--text-secondary)" }}>Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                    No reviews written yet. Be the first to write a review!
                  </p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="card-glass" style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                            {rev.user_name || "Anonymous User"}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                            {renderStars(rev.rating)}
                            {rev.order_id && (
                              <span style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--accent-success)", fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", fontWeight: "600" }}>
                                Verified Order
                              </span>
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                        {rev.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : groupedMenu.length === 0 ? (
            <div className="card-glass" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-secondary)" }}>
              <Utensils size={40} style={{ margin: "0 auto 16px", strokeWidth: 1.5, color: "var(--text-muted)" }} />
              <h3 style={{ color: "var(--text-primary)", fontWeight: "600" }}>No menu items yet</h3>
              <p style={{ fontSize: "0.875rem", marginTop: "4px" }}>
                {isOwner
                  ? "Get started by adding your first food category and menu item!"
                  : "This restaurant hasn't uploaded their menu yet."}
              </p>
            </div>
          ) : (
            groupedMenu
              .filter((cat) => activeCategoryFilter === "all" || activeCategoryFilter === cat.id)
              .map((cat) => (
                <div key={cat.id} className="category-group" id={`cat-${cat.id}`}>
                  <div className="category-header">
                    <div>
                      <h3 className="category-title">{cat.name}</h3>
                      {cat.description && <p className="category-desc">{cat.description}</p>}
                    </div>
                  </div>

                  {(!cat.menu_items || cat.menu_items.length === 0) ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", fontStyle: "italic" }}>
                      No items in this category yet.
                    </p>
                  ) : (
                    <div className="menu-items-list">
                      {cat.menu_items.map((item) => {
                        const qty = getCartQty(item.id);
                        return (
                          <div key={item.id} className="menu-item-card flex-row-card">
                            {item.image_url && (
                              <div className="menu-item-image-wrapper">
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="menu-item-image"
                                />
                              </div>
                            )}
                            <div className="menu-item-details">
                              <div>
                                <div className="item-name">{item.name}</div>
                                {item.description && <p className="item-desc">{item.description}</p>}
                              </div>
                              <div className="item-footer">
                                <div className="item-price">
                                  {item.price_mmk.toLocaleString()} MMK
                                </div>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                                  {item.preparation_time_minutes && (
                                    <span className="item-badge" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-glass)", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                                      <Clock size={10} />
                                      {item.preparation_time_minutes}m
                                    </span>
                                  )}
                                  <span className={`item-badge ${item.is_available ? "status-open" : "status-closed"}`}>
                                    {item.is_available ? "Available" : "Sold Out"}
                                  </span>

                                  {isOwner && (
                                    <div style={{ display: "flex", gap: "4px", marginLeft: "4px" }}>
                                      <button 
                                        className="btn btn-secondary btn-icon-sm" 
                                        onClick={() => handleEditMenuItem(item)}
                                        title="Edit Item"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button 
                                        className="btn btn-secondary btn-icon-sm" 
                                        style={{ color: "var(--accent-danger)", borderColor: "rgba(220,38,38,0.2)" }}
                                        onClick={() => handleDeleteMenuItem(item.id)}
                                        title="Delete Item"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {canOrder && selectedRestaurant.is_open && item.is_available && (
                                <div className="qty-controls">
                                  {qty === 0 ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      style={{ padding: "6px 14px", fontSize: "0.8125rem" }}
                                      onClick={() => onAddToCart(item)}
                                    >
                                      <Plus size={14} />
                                      <span>Add</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="qty-btn"
                                        onClick={() => onUpdateCartQty(item.id, qty - 1)}
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="qty-value">{qty}</span>
                                      <button
                                        type="button"
                                        className="qty-btn"
                                        onClick={() => onAddToCart(item)}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>

      {canOrder && cart.length > 0 && (
        <div className="cart-bar">
          <div className="cart-bar-info">
            <ShoppingCart size={16} style={{ display: "inline", marginRight: "8px", verticalAlign: "middle" }} />
            {cart.reduce((n, c) => n + c.quantity, 0)} item(s) ·{" "}
            <span className="cart-bar-total">
              {cart.reduce((sum, c) => sum + c.price_mmk * c.quantity, 0).toLocaleString()} MMK
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onOpenCheckout}>
            Checkout
          </button>
        </div>
      )}

      {/* Add Coupon Modal for storefront owner */}
      <AddCouponModal
        showAddCoupon={showAddCoupon}
        setShowAddCoupon={setShowAddCoupon}
        restaurantId={selectedRestaurant.id}
        onCouponCreated={handleCouponCreated}
      />
    </div>
  );
}
