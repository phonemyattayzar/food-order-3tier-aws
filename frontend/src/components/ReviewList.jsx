import { Star } from "lucide-react";
import { format } from "date-fns";

export default function ReviewList({ reviews, ratingInfo }) {
  return (
    <div className="review-list-section">
      <div className="rating-summary-card card-glass">
        <div className="rating-big">
          <span className="rating-avg">{ratingInfo?.average_rating || "0.0"}</span>
          <div className="stars-row">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={20}
                fill={s <= Math.round(ratingInfo?.average_rating || 0) ? "var(--accent-warning)" : "none"}
                color="var(--accent-warning)"
              />
            ))}
          </div>
          <span className="rating-count">{ratingInfo?.review_count || 0} reviews</span>
        </div>
      </div>

      <div className="reviews-container">
        {reviews.map((r) => (
          <div key={r.id} className="review-item card-glass">
            <div className="review-header">
              <div className="review-user">
                <span className="user-initials">{r.user_name?.charAt(0) || "U"}</span>
                <div>
                  <div className="user-name">{r.user_name || "Anonymous"}</div>
                  <div className="review-date small text-muted">
                    {r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : ""}
                  </div>
                </div>
              </div>
              <div className="review-stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    fill={s <= r.rating ? "var(--accent-warning)" : "none"}
                    color="var(--accent-warning)"
                  />
                ))}
              </div>
            </div>
            {r.comment && <p className="review-comment">{r.comment}</p>}
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="empty-state">
            <p>No reviews yet. Be the first to rate this restaurant!</p>
          </div>
        )}
      </div>
    </div>
  );
}
