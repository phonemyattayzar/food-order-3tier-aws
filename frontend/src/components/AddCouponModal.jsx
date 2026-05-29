import { useState } from "react";
import { X, Tag } from "lucide-react";
import { apiRequest, parseApiError } from "../api/client";

export default function AddCouponModal({
  showAddCoupon,
  setShowAddCoupon,
  restaurantId,
  onCouponCreated,
}) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!showAddCoupon) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code || !discountValue || !validUntil) {
      setError("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discount_percent: discountType === "percent" ? parseInt(discountValue, 10) : null,
        discount_amount_mmk: discountType === "flat" ? parseInt(discountValue, 10) : null,
        min_order_amount_mmk: parseInt(minOrderAmount, 10) || 0,
        max_discount_mmk: maxDiscount ? parseInt(maxDiscount, 10) : null,
        valid_until: new Date(validUntil).toISOString(),
        is_active: true,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
        restaurant_id: restaurantId || null,
      };

      const { res, data } = await apiRequest("/coupons/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onCouponCreated("Coupon created successfully!");
        setShowAddCoupon(false);
        // Reset form
        setCode("");
        setDiscountValue("");
        setMinOrderAmount("0");
        setMaxDiscount("");
        setValidUntil("");
        setUsageLimit("");
      } else {
        setError(parseApiError(data, "Failed to create coupon"));
      }
    } catch {
      setError("Failed to communicate with server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="card-glass modal-content" style={{ maxWidth: "480px" }}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Tag size={18} color="var(--accent-primary)" />
            Add Discount Coupon
          </h3>
          <button className="modal-close" onClick={() => setShowAddCoupon(false)}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.08)",
              borderRadius: "var(--border-radius-md)",
              color: "var(--accent-danger)",
              fontSize: "0.8125rem",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="coupon-code">Coupon Code</label>
            <input
              id="coupon-code"
              type="text"
              className="form-control"
              placeholder="E.g. SAVE20, FIRSTORDER"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="coupon-type">Discount Type</label>
              <select
                id="coupon-type"
                className="form-control"
                value={discountType}
                onChange={(e) => {
                  setDiscountType(e.target.value);
                  setDiscountValue("");
                }}
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (MMK)</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="coupon-val">
                {discountType === "percent" ? "Percentage Value (%)" : "Flat Discount (MMK)"}
              </label>
              <input
                id="coupon-val"
                type="number"
                min="1"
                className="form-control"
                placeholder={discountType === "percent" ? "E.g. 15" : "E.g. 5000"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="coupon-min-order">Min Order (MMK)</label>
              <input
                id="coupon-min-order"
                type="number"
                min="0"
                className="form-control"
                placeholder="E.g. 10000"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
              />
            </div>

            {discountType === "percent" && (
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="coupon-max-disc">Max Discount (MMK)</label>
                <input
                  id="coupon-max-disc"
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="E.g. 3000"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="coupon-limit">Usage Limit (Total)</label>
              <input
                id="coupon-limit"
                type="number"
                min="1"
                className="form-control"
                placeholder="Unlimited if empty"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="coupon-expiry">Expiry Date</label>
              <input
                id="coupon-expiry"
                type="datetime-local"
                className="form-control"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "12px" }}
            disabled={submitting}
          >
            <span>{submitting ? "Creating..." : "Create Coupon"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
