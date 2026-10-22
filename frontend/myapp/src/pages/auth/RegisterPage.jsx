import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Button from "../../components/Button.jsx";

/**
 * Rough strength score: 0 to 4.
 * Not a security guarantee, just a visual hint.
 */
const scorePassword = (pw) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const strength = scorePassword(form.password);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Full name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      errs.email = "Enter a valid email address";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    if (form.confirm !== form.password)
      errs.confirm = "Passwords do not match";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    
    try {
      setSubmitting(true);
      // The updated register function returns the email, not a token
      const registeredEmail = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      
      showToast("Account created! Check your email for the code.", "success");
      
      // Redirect to the OTP verification page and pass the email
      navigate("/verify-otp", { state: { email: registeredEmail }, replace: true });
      
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <span className="brand-mark">POS</span>
          <div>
            <div className="auth-brand-title">Create your account</div>
            <div className="auth-brand-sub">Join the POS system</div>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              className={fieldErrors.name ? "input input-error" : "input"}
              value={form.name}
              autoFocus
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ahmed Khan"
            />
            {fieldErrors.name && (
              <span className="field-error">{fieldErrors.name}</span>
            )}
          </div>

          <div className="auth-grid-2">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={fieldErrors.email ? "input input-error" : "input"}
                value={form.email}
                autoComplete="email"
                onChange={(e) => setField("email", e.target.value)}
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <span className="field-error">{fieldErrors.email}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="phone">Phone (optional)</label>
              <input
                id="phone"
                className="input"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="03001234567"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                className={
                  fieldErrors.password ? "input input-error" : "input"
                }
                type={showPw ? "text" : "password"}
                value={form.password}
                autoComplete="new-password"
                onChange={(e) => setField("password", e.target.value)}
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
            {form.password && (
              <div className="pw-meter">
                <div className={`pw-meter-bar pw-meter-${strength}`} />
                <span className={`pw-meter-label pw-meter-label-${strength}`}>
                  {LABELS[strength]}
                </span>
              </div>
            )}
            {fieldErrors.password && (
              <span className="field-error">{fieldErrors.password}</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <div className="password-wrap">
              <input
                id="confirm"
                className={fieldErrors.confirm ? "input input-error" : "input"}
                type={showConfirm ? "text" : "password"}
                value={form.confirm}
                autoComplete="new-password"
                onChange={(e) => setField("confirm", e.target.value)}
                placeholder="Repeat your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.confirm && (
              <span className="field-error">{fieldErrors.confirm}</span>
            )}
          </div>

          {error && <div className="error-box">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            className="auth-submit"
            loading={submitting}
          >
            Create account
          </Button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}