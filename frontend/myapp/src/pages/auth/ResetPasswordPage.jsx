import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client.js";
import { useToast } from "../../context/ToastContext.jsx";
import Button from "../../components/Button.jsx";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/auth/reset-password/${token}`, { password });
      showToast("Password updated — please sign in", "success");
      navigate("/login", { replace: true });
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
            <div className="auth-brand-title">Set a new password</div>
            <div className="auth-brand-sub">
              Choose something you haven&apos;t used before
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label htmlFor="password">New password</label>
            <div className="password-wrap">
              <input
                id="password"
                className="input"
                type={showPw ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              className="input"
              type={showPw ? "text" : "password"}
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            className="auth-submit"
            loading={submitting}
          >
            Update password
          </Button>

          <div className="auth-footer">
            <Link to="/login" className="auth-link">
              ← Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}