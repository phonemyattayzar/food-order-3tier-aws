import { X } from "lucide-react";

export default function AddRestaurantModal({
  showAddRestaurant,
  setShowAddRestaurant,
  restaurantForm,
  setRestaurantForm,
  handleCreateRestaurant,
}) {
  if (!showAddRestaurant) return null;

  return (
    <div className="modal-overlay">
      <div className="card-glass modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Register Restaurant</h3>
          <button className="modal-close" onClick={() => setShowAddRestaurant(false)}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreateRestaurant}>
          <div className="form-group">
            <label htmlFor="res-name">Restaurant Name</label>
            <input
              id="res-name"
              type="text"
              className="form-control"
              placeholder="E.g. Shwe Lar Hotpot"
              value={restaurantForm.name}
              onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="res-desc">Description</label>
            <textarea
              id="res-desc"
              className="form-control"
              rows="2"
              placeholder="Special hotpot & fresh meats"
              value={restaurantForm.description}
              onChange={(e) => setRestaurantForm({ ...restaurantForm, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="res-phone">Phone Number</label>
            <input
              id="res-phone"
              type="text"
              className="form-control"
              value={restaurantForm.phone_number}
              onChange={(e) => setRestaurantForm({ ...restaurantForm, phone_number: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="res-address">Address Detail</label>
            <input
              id="res-address"
              type="text"
              className="form-control"
              placeholder="E.g. No 123, Yankin Road"
              value={restaurantForm.address}
              onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="res-township">Township</label>
            <input
              id="res-township"
              type="text"
              className="form-control"
              placeholder="E.g. Yankin"
              value={restaurantForm.township}
              onChange={(e) => setRestaurantForm({ ...restaurantForm, township: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
            <input
              id="res-open"
              type="checkbox"
              checked={restaurantForm.is_open}
              onChange={(e) => setRestaurantForm({ ...restaurantForm, is_open: e.target.checked })}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            <label htmlFor="res-open" style={{ margin: 0, cursor: "pointer" }}>Is Store Open</label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "16px" }}>
            <span>Create Storefront</span>
          </button>
        </form>
      </div>
    </div>
  );
}
