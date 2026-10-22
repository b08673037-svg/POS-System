import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/client.js";

const AuthContext = createContext(null);

const TOKEN_KEY = "pos_token";
const USER_KEY = "pos_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  /* -------------------------------------------------------------
   *  On mount, if we have a token, verify it by fetching /me.
   *  This keeps the session consistent across page refreshes and
   *  catches revoked or expired tokens early.
   * ------------------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/auth/me");
        if (!cancelled) {
          setUser(res.data.data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.data.user));
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------------------------------------
   *  Login
   * ------------------------------------------------------------- */
  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { user: u, token } = res.data.data;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  /* -------------------------------------------------------------
   *  Register
   *  Returns the email address so the UI can redirect to the
   *  OTP verification page.
   * ------------------------------------------------------------- */
  const register = useCallback(async (payload) => {
    const res = await api.post("/auth/register", payload);
    // We do NOT get a token here anymore. The backend returns { email }
    return res.data.data.email; 
  }, []);

  /* -------------------------------------------------------------
   *  Verify OTP
   *  This acts as the actual login step after registration.
   * ------------------------------------------------------------- */
  const verifyOtp = useCallback(async (email, otp) => {
    const res = await api.post("/auth/verify-otp", { email, otp });
    const { user: u, token } = res.data.data;
    
    // Save token and user to localStorage, then update state
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
    
    return u;
  }, []);

  /* -------------------------------------------------------------
   *  Logout
   * ------------------------------------------------------------- */
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore — we clear local state regardless
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = { user, loading, login, register, logout, verifyOtp };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}