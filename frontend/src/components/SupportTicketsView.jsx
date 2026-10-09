import { useState } from "react";
import { ArrowLeft, Clock3, LifeBuoy, MessageSquareText, Send } from "lucide-react";

export default function SupportTicketsView({
  tickets,
  loading,
  submitting,
  onBack,
  onRefresh,
  onSubmit,
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const created = await onSubmit({ subject: subject.trim(), message: message.trim() });
    if (created) {
      setSubject("");
      setMessage("");
    }
  };

  return (
    <section className="support-view">
      <button type="button" className="btn btn-secondary back-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Back to restaurants</span>
      </button>

      <div className="support-heading">
        <div className="support-heading-icon"><LifeBuoy size={24} /></div>
        <div>
          <p className="support-eyebrow">WE’RE HERE TO HELP</p>
          <h1>Support requests</h1>
          <p className="support-description">
            Send our team a message and keep track of the requests you’ve sent.
          </p>
        </div>
      </div>

      <div className="support-grid">
        <form className="card-glass support-form" onSubmit={handleSubmit}>
          <div className="support-section-title">
            <MessageSquareText size={19} />
            <h2>Start a request</h2>
          </div>
          <div className="form-group">
            <label htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              className="form-control"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What do you need help with?"
              minLength={3}
              maxLength={160}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="support-message">Message</label>
            <textarea
              id="support-message"
              className="form-control support-message-input"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us a little more so we can help."
              maxLength={5000}
              rows={6}
              required
            />
            <span className="support-character-count">{message.length}/5000</span>
          </div>
          <button className="btn btn-primary support-submit" disabled={submitting}>
            <Send size={16} />
            <span>{submitting ? "Sending…" : "Send request"}</span>
          </button>
        </form>

        <div className="support-history">
          <div className="support-history-heading">
            <div>
              <h2>Your requests</h2>
              <p>Only you can see the requests on this list.</p>
            </div>
            <button type="button" className="btn btn-secondary support-refresh" onClick={onRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {loading && tickets.length === 0 ? (
            <div className="card-glass support-empty">Loading your requests…</div>
          ) : tickets.length === 0 ? (
            <div className="card-glass support-empty">
              <MessageSquareText size={34} />
              <h3>No requests yet</h3>
              <p>Your submitted requests will appear here.</p>
            </div>
          ) : (
            <div className="support-ticket-list">
              {tickets.map((ticket) => (
                <article className="card-glass support-ticket-card" key={ticket.id}>
                  <div className="support-ticket-card-top">
                    <h3>{ticket.subject}</h3>
                    <span className={`support-ticket-status status-${ticket.status}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="support-ticket-message">{ticket.message}</p>
                  <p className="support-ticket-date">
                    <Clock3 size={14} />
                    {new Date(ticket.created_at).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
