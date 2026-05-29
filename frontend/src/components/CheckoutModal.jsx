import { useState } from "react";
import { X, MapPin, Tag } from "lucide-react";
import { apiRequest, parseApiError } from "../api/client";

export default function CheckoutModal({
  showCheckout,
  setShowCheckout,
  cart,
  deliveryAddress,
  setDeliveryAddress,
  onPlaceOrder,
  submitting,
  restaurantName,
  restaurantId,
}) {
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  if (!showCheckout) return null;

  const cartTotal = cart.reduce((sum, item) => sum + item.price_mmk * item.quantity, 0);

  // Calculate discount based on coupon rules
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_amount_mmk) {
      discount = appliedCoupon.discount_amount_mmk;
    } else if (appliedCoupon.discount_percent) {
      discount = Math.floor(cartTotal * (appliedCoupon.discount_percent / 100));
      if (appliedCoupon.max_discount_mmk) {
        discount = Math.min(discount, appliedCoupon.max_discount_mmk);
      }
    }
  }

  const finalTotal = Math.max(0, cartTotal - discount);

  const handleValidateCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidating(true);
    setValidationError("");
    setAppliedCoupon(null);

    try {
      const code = couponInput.trim().toUpperCase();
      const { res, data } = await apiRequest(
        `/coupons/validate/${code}?restaurant_id=${restaurantId}`
      );

      if (res.ok) {
        // Validate minimum order amount
        if (data.min_order_amount_mmk && cartTotal < data.min_order_amount_mmk) {
          setValidationError(
            `Minimum order amount of ${data.min_order_amount_mmk.toLocaleString()} MMK required for this coupon.`
          );
        } else {
          setAppliedCoupon(data);
        }
      } else {
        setValidationError(parseApiError(data, "Invalid or expired coupon code."));
      }
    } catch {
      setValidationError("Failed to validate coupon.");
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setValidationError("");
  };

  const handleClose = () => {
    handleRemoveCoupon();
    setShowCheckout(false);
  };

  return (
    <div className="modal-overlay">
      <div className="card-glass modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Checkout — {restaurantName}</h3>
          <button className="modal-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="checkout-summary">
          {cart.map((item) => (
            <div key={item.menu_item_id} className="checkout-line">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{(item.price_mmk * item.quantity).toLocaleString()} MMK</span>
            </div>
          ))}

          {discount > 0 && (
            <div className="checkout-line" style={{ color: "var(--accent-success)", fontWeight: "600" }}>
              <span>Coupon Discount ({appliedCoupon.discount_percent ? `${appliedCoupon.discount_percent}%` : "Flat"})</span>
              <span>-{discount.toLocaleString()} MMK</span>
            </div>
          )}

          <div className="checkout-total">
            <span>Total</span>
            <span>{finalTotal.toLocaleString()} MMK</span>
          </div>
        </div>

        {/* Form submits to onPlaceOrder, passing appliedCoupon code if any */}
        <form onSubmit={(e) => onPlaceOrder(e, appliedCoupon?.code)}>
          {/* Coupon Code Box */}
          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Tag size={14} color="var(--accent-primary)" />
              <span>Promo Coupon Code</span>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                className="form-control"
                placeholder="E.g. SAVE20"
                style={{ textTransform: "uppercase" }}
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value);
                  setValidationError("");
                }}
                disabled={appliedCoupon !== null}
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRemoveCoupon}
                  style={{ borderColor: "var(--accent-danger)", color: "var(--accent-danger)" }}
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleValidateCoupon}
                  disabled={validating || !couponInput.trim()}
                >
                  {validating ? "Checking..." : "Apply"}
                </button>
              )}
            </div>

            {validationError && (
              <p style={{ color: "var(--accent-danger)", fontSize: "0.75rem", marginTop: "6px", margin: "6px 0 0" }}>
                ⚠️ {validationError}
              </p>
            )}

            {appliedCoupon && (
              <p style={{ color: "var(--accent-success)", fontSize: "0.75rem", fontWeight: "600", margin: "6px 0 0" }}>
                ✓ Coupon &quot;{appliedCoupon.code}&quot; applied successfully!
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="delivery-address">
              <MapPin size={14} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
              Delivery Address
            </label>
            <textarea
              id="delivery-address"
              className="form-control"
              rows="3"
              placeholder="Building, street, township..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px" }}
            disabled={submitting || cart.length === 0}
          >
            <span>{submitting ? "Placing order..." : "Place Order"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
