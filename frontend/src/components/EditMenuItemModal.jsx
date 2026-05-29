import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { API_BASE, apiRequest, parseApiError } from "../api/client";

export default function EditMenuItemModal({
  showEditMenuItem,
  setShowEditMenuItem,
  menuItem,
  groupedMenu,
  onSave,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceMmk, setPriceMmk] = useState("");
  const [preparationTime, setPreparationTime] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (menuItem) {
      setName(menuItem.name || "");
      setDescription(menuItem.description || "");
      setPriceMmk(menuItem.price_mmk || "");
      setPreparationTime(menuItem.preparation_time_minutes || "");
      setIsAvailable(menuItem.is_available ?? true);
      setCategoryId(menuItem.category_id || "");
      setImageUrl(menuItem.image_url || "");
      setError("");
    }
  }, [menuItem]);

  if (!showEditMenuItem || !menuItem) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/menu-items/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(parseApiError(errData, "Upload failed"));
      }

      const data = await res.json();
      setImageUrl(data.image_url);
    } catch (err) {
      setError(err.message || "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !priceMmk) {
      setError("Name and Price are required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price_mmk: parseInt(priceMmk, 10),
        is_available: isAvailable,
        preparation_time_minutes: preparationTime ? parseInt(preparationTime, 10) : null,
        category_id: categoryId || null,
        image_url: imageUrl || null,
      };

      const { res, data } = await apiRequest(`/menu-items/${menuItem.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSave("Menu item updated successfully!");
        setShowEditMenuItem(false);
      } else {
        setError(parseApiError(data, "Failed to update menu item"));
      }
    } catch {
      setError("Failed to communicate with server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="card-glass modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Edit Menu Item</h3>
          <button className="modal-close" onClick={() => setShowEditMenuItem(false)}>
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
            <label htmlFor="edit-item-cat">Category</label>
            <select
              id="edit-item-cat"
              className="form-control"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>-- Choose a category --</option>
              {groupedMenu.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-item-name">Item Name</label>
            <input
              id="edit-item-name"
              type="text"
              className="form-control"
              placeholder="E.g. Fried Dumplings"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-item-desc">Item Description</label>
            <textarea
              id="edit-item-desc"
              className="form-control"
              rows="2"
              placeholder="Crispy dumplings stuffed with chicken & green onions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Dish Image</label>
            {imageUrl ? (
              <div className="image-upload-preview-container">
                <img
                  src={imageUrl}
                  alt="Dish Preview"
                  className="image-upload-preview"
                />
                <button
                  type="button"
                  className="image-upload-remove-btn"
                  onClick={() => setImageUrl("")}
                >
                  <X size={14} /> Remove Image
                </button>
              </div>
            ) : (
              <label className="image-upload-dropzone">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
                <div className="image-upload-placeholder">
                  {uploading ? (
                    <div className="upload-spinner-container">
                      <div className="upload-spinner" />
                      <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        Uploading image...
                      </span>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="upload-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="upload-title">Click to upload dish image</span>
                      <span className="upload-subtitle">Supports JPG, PNG, WEBP or GIF</span>
                    </>
                  )}
                </div>
              </label>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="edit-item-price">Price (MMK)</label>
              <input
                id="edit-item-price"
                type="number"
                className="form-control"
                placeholder="5500"
                min="0"
                value={priceMmk}
                onChange={(e) => setPriceMmk(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="edit-item-prep">Prep Time (Mins)</label>
              <input
                id="edit-item-prep"
                type="number"
                className="form-control"
                placeholder="15"
                min="1"
                value={preparationTime}
                onChange={(e) => setPreparationTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
            <input
              id="edit-item-avail"
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            <label htmlFor="edit-item-avail" style={{ margin: 0, cursor: "pointer" }}>Is Food Available</label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "16px" }}
            disabled={submitting}
          >
            <span>{submitting ? "Saving..." : "Save Changes"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
