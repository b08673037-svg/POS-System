import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import Button from "../../components/Button.jsx";

export default function VerifyOtpPage() {
  const { verifyOtp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const email = location.state?.email;
  
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // If someone navigates here directly without registering, send them back
  useEffect(() => {
    if (!email) navigate("/register", { replace: true });
  }, [email, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (otp.length < 6) {
      setError("Please enter the full 6-digit code");
      return;
    }

    try {
      setSubmitting(true);
      await verifyOtp(email, otp);
      showToast("Account verified and logged in!", "success");
      navigate("/", { replace: true });
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
            <div className="auth-brand-title">Verify your email</div>
            <div className="auth-brand-sub">We sent a code to {email}</div>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          <div className="field">
            <label htmlFor="otp">6-Digit Code</label>
            <input
              id="otp"
              className={error ? "input input-error" : "input"}
              type="text"
              maxLength="6"
              value={otp}
              autoFocus
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} // Only allow numbers
              placeholder="000000"
              style={{ fontSize: "24px", textAlign: "center", letterSpacing: "8px" }}
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <Button
            type="submit"
            variant="primary"
            className="auth-submit"
            loading={submitting}
          >
            Verify & Sign In
          </Button>
        </form>

        <div className="auth-footer">
          Didn't receive a code? Check your spam folder or{" "}
          <Link to="/register" className="auth-link">
            try again
          </Link>
        </div>
      </div>
    </div>
  );
}