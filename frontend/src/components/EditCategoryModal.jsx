import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { apiRequest, parseApiError } from "../api/client";

export default function EditCategoryModal({
  showEditCategory,
  setShowEditCategory,
  category,
  onSave,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setDescription(category.description || "");
      setError("");
    }
  }, [category]);

  if (!showEditCategory || !category) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
      };

      const { res, data } = await apiRequest(`/categories/${category.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSave("Category updated successfully!");
        setShowEditCategory(false);
      } else {
        setError(parseApiError(data, "Failed to update category"));
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
          <h3 className="modal-title">Edit Category</h3>
          <button className="modal-close" onClick={() => setShowEditCategory(false)}>
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
            <label htmlFor="edit-cat-name">Category Name</label>
            <input
              id="edit-cat-name"
              type="text"
              className="form-control"
              placeholder="E.g. Appetizers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-cat-desc">Description</label>
            <input
              id="edit-cat-desc"
              type="text"
              className="form-control"
              placeholder="E.g. Fresh juices and carbonated beverages"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px" }}
            disabled={submitting}
          >
            <span>{submitting ? "Saving..." : "Save Changes"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
