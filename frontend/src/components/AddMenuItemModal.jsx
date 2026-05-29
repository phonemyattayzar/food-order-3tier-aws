import { useState } from "react";
import { X } from "lucide-react";
import { API_BASE, parseApiError } from "../api/client";

export default function AddMenuItemModal({
  showAddMenuItem,
  setShowAddMenuItem,
  menuItemForm,
  setMenuItemForm,
  groupedMenu,
  handleCreateMenuItem,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!showAddMenuItem) return null;

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
      setMenuItemForm({ ...menuItemForm, image_url: data.image_url });
    } catch (err) {
      setError(err.message || "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="card-glass modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Add Menu Item</h3>
          <button className="modal-close" onClick={() => setShowAddMenuItem(false)}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreateMenuItem}>
          <div className="form-group">
            <label htmlFor="item-cat">Select Category</label>
            <select
              id="item-cat"
              className="form-control"
              value={menuItemForm.category_id}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, category_id: e.target.value })}
              required
            >
              <option value="" disabled>-- Choose a category --</option>
              {groupedMenu.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="item-name">Item Name</label>
            <input
              id="item-name"
              type="text"
              className="form-control"
              placeholder="E.g. Fried Dumplings"
              value={menuItemForm.name}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="item-desc">Item Description</label>
            <textarea
              id="item-desc"
              className="form-control"
              rows="2"
              placeholder="Crispy dumplings stuffed with chicken & green onions"
              value={menuItemForm.description}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Dish Image</label>
            {menuItemForm.image_url ? (
              <div className="image-upload-preview-container">
                <img
                  src={menuItemForm.image_url}
                  alt="Dish Preview"
                  className="image-upload-preview"
                />
                <button
                  type="button"
                  className="image-upload-remove-btn"
                  onClick={() => setMenuItemForm({ ...menuItemForm, image_url: "" })}
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
            {error && <div className="upload-error-message">{error}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="item-price">Price (MMK)</label>
            <input
              id="item-price"
              type="number"
              className="form-control"
              placeholder="5500"
              min="0"
              value={menuItemForm.price_mmk}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, price_mmk: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="item-prep">Preparation Time (Minutes)</label>
            <input
              id="item-prep"
              type="number"
              className="form-control"
              placeholder="15"
              min="1"
              value={menuItemForm.preparation_time_minutes}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, preparation_time_minutes: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
            <input
              id="item-avail"
              type="checkbox"
              checked={menuItemForm.is_available}
              onChange={(e) => setMenuItemForm({ ...menuItemForm, is_available: e.target.checked })}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            <label htmlFor="item-avail" style={{ margin: 0, cursor: "pointer" }}>Is Food Available</label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "16px" }}>
            <span>Add Item to Menu</span>
          </button>
        </form>
      </div>
    </div>
  );
}

