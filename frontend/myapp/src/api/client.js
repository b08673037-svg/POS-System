import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

/* ---------- Request: attach Bearer token if present ---------- */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pos_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ---------- Response: unwrap errors, handle 401 globally ---------- */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject(
        new Error(
          "Cannot reach the server. Is the backend running on http://localhost:5000?"
        )
      );
    }

    const { status, data } = error.response;

    // A 401 means the token is missing, invalid, or expired.
    // Clear local state and redirect to login — but do not redirect
    // from the login endpoint itself (a bad password returns 401).
    if (
      status === 401 &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/register") &&
      !window.location.pathname.startsWith("/forgot-password") &&
      !window.location.pathname.startsWith("/reset-password")
    ) {
      localStorage.removeItem("pos_token");
      localStorage.removeItem("pos_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    const message =
      (data && data.message) || `Request failed with status ${status}`;

    return Promise.reject(new Error(message));
  }
);

export default api;