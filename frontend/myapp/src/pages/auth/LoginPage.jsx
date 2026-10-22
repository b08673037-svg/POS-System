import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Button from "../../components/Button.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      setSubmitting(true);
      await login(email.trim(), password);
      showToast("Welcome back", "success");
      // "Remember me" influences persistence in a real cookie setup —
      // with localStorage the session already persists across reloads.
      // We keep the checkbox for UX and can wire it up later.
      void remember;
      navigate(from, { replace: true });
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
            <div className="auth-brand-title">POS System</div>
            <div className="auth-brand-sub">Sign in to continue</div>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className={fieldErrors.email ? "input input-error" : "input"}
              type="email"
              value={email}
              autoComplete="email"
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {fieldErrors.email && (
              <span className="field-error">{fieldErrors.email}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                className={
                  fieldErrors.password ? "input input-error" : "input"
                }
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="field-error">{fieldErrors.password}</span>
            )}
          </div>

          <div className="auth-row">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password" className="auth-link">
              Forgot password?
            </Link>
          </div>

          {error && <div className="error-box">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            className="auth-submit"
            loading={submitting}
          >
            Sign in
          </Button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="auth-link">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}