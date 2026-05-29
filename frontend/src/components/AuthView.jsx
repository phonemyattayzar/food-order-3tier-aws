import { useState } from "react";
import { LogIn, PlusCircle } from "lucide-react";

export default function AuthView({
  users,
  regForm,
  setRegForm,
  handleLogin,
  handleRegister,
}) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const onLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      return;
    }
    setLoginLoading(true);
    try {
      await handleLogin(loginEmail, loginPassword);
    } finally {
      setLoginLoading(false);
    }
  };

  const prefillEmail = (email) => {
    setLoginEmail(email);
    setShowRegister(false);
  };

  return (
    <div className="auth-grid">
      <div className="card-glass">
        <h2 style={{ marginBottom: "8px", fontWeight: "700" }}>Welcome to Sar Mel</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.9375rem" }}>
          Sign in with your email and password. Protected actions (creating restaurants, categories, and menu items) require a valid session.
        </p>

        <form onSubmit={onLogin}>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-control"
              placeholder="phyo@sarmel.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "8px" }}
            disabled={loginLoading}
          >
            <LogIn size={18} />
            <span>{loginLoading ? "Signing in..." : "Sign In"}</span>
          </button>
        </form>

        {users.length > 0 && (
          <>
            <h3
              style={{
                fontSize: "0.875rem",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                letterSpacing: "0.05em",
                marginTop: "28px",
                marginBottom: "12px",
              }}
            >
              Quick fill (test accounts)
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "12px" }}>
              Tap a profile to fill the email — you still need that account&apos;s password.
            </p>
            <div className="user-select-list">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="user-select-item"
                  onClick={() => prefillEmail(u.email)}
                >
                  <div>
                    <div style={{ fontWeight: "600" }}>{u.full_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                  </div>
                  <div className={`badge-role ${u.role}`}>{u.role}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card-glass">
        {!showRegister ? (
          <>
            <h2 style={{ marginBottom: "8px", fontWeight: "700" }}>New here?</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.9375rem" }}>
              Register as a restaurant owner or customer. You&apos;ll be signed in automatically after registration.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "100%" }}
              onClick={() => setShowRegister(true)}
            >
              <PlusCircle size={18} />
              <span>Create an account</span>
            </button>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: "8px", fontWeight: "700" }}>Create Account</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.9375rem" }}>
              Register a new profile to test owner and customer flows.
            </p>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  className="form-control"
                  placeholder="E.g. Ko Phyo"
                  value={regForm.full_name}
                  onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-control"
                  placeholder="phyo@sarmel.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-role">Role</label>
                <select
                  id="reg-role"
                  className="form-control"
                  value={regForm.role}
                  onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                >
                  <option value="customer">Customer (Browse and order)</option>
                  <option value="owner">Restaurant Owner (Add restaurant & manage menu)</option>
                  <option value="admin">Admin (Approve orders for all restaurants)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
                <PlusCircle size={18} />
                <span>Register & Sign In</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%", marginTop: "10px" }}
                onClick={() => setShowRegister(false)}
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
