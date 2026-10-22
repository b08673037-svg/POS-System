import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import Button from "../../components/Button.jsx";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">POS</span>
          <div>
            <div className="auth-brand-title">Forgot password</div>
            <div className="auth-brand-sub">
              We&apos;ll email you a reset link
            </div>
          </div>
        </div>

        {sent ? (
          <div className="auth-form">
            <div className="success-box">
              If an account with that email exists, a reset link has been sent.
              Check your inbox — the link expires in 30 minutes.
            </div>
            <Link to="/login" className="auth-link">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                autoComplete="email"
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <Button
              type="submit"
              variant="primary"
              className="auth-submit"
              loading={submitting}
            >
              Send reset link
            </Button>

            <div className="auth-footer">
              <Link to="/login" className="auth-link">
                ← Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}