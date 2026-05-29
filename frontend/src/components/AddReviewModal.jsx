import { useState } from "react";
import { Star, X } from "lucide-react";

export default function AddReviewModal({ show, onClose, onSubmit, restaurantName, orderId }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [hover, setHover] = useState(0);

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content card-glass">
        <div className="modal-header">
          <h2>Rate your experience at {restaurantName}</h2>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ rating, comment, order_id: orderId });
        }}>
          <div className="rating-input-group">
            <p>How was the food and service?</p>
            <div className="stars-input">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="star-btn"
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)}
                >
                  <Star
                    size={32}
                    fill={(hover || rating) >= s ? "var(--accent-warning)" : "none"}
                    color="var(--accent-warning)"
                  />
                </button>
              ))}
            </div>
            <span className="rating-label">
              {rating === 5 ? "Excellent!" : rating === 4 ? "Very Good" : rating === 3 ? "Average" : rating === 2 ? "Poor" : "Terrible"}
            </span>
          </div>

          <div className="form-group">
            <label>Comment (optional)</label>
            <textarea
              className="form-control"
              placeholder="What did you like or dislike?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Review</button>
          </div>
        </form>
      </div>
    </div>
  );
}
