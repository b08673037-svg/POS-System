import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

/**
 * Wraps routes that require authentication.
 * While the session is being verified on first load, shows a spinner
 * so the user is not flashed to login and back.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking session..." />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}