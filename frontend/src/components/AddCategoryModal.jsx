import { X } from "lucide-react";

export default function AddCategoryModal({
  showAddCategory,
  setShowAddCategory,
  categoryForm,
  setCategoryForm,
  handleCreateCategory,
}) {
  if (!showAddCategory) return null;

  return (
    <div className="modal-overlay">
      <div className="card-glass modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Add Food Category</h3>
          <button className="modal-close" onClick={() => setShowAddCategory(false)}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreateCategory}>
          <div className="form-group">
            <label htmlFor="cat-name">Category Name</label>
            <input
              id="cat-name"
              type="text"
              className="form-control"
              placeholder="E.g. Appetizers, Drinks, Mains"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cat-desc">Description</label>
            <input
              id="cat-desc"
              type="text"
              className="form-control"
              placeholder="E.g. Fresh juices and carbonated beverages"
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
            <span>Create Category</span>
          </button>
        </form>
      </div>
    </div>
  );
}
