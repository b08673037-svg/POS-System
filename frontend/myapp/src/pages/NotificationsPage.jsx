import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";
import { AlertTriangle, Info, CheckCircle2, ArrowRight } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/notifications");
        if (!cancelled) setNotifications(res.data.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Spinner label="Loading notifications..." />;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="page-subtitle">System alerts and pending actions requiring your attention.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {notifications.length === 0 ? (
          <div className="notif-empty" style={{ padding: '80px 20px' }}>
            <CheckCircle2 size={48} />
            <h3 style={{ margin: '16px 0 8px', fontSize: 20, fontWeight: 800 }}>You're all caught up!</h3>
            <p style={{ fontSize: 15 }}>There are no pending alerts or low stock warnings right now.</p>
          </div>
        ) : (
          <div className="notif-list" style={{ maxHeight: 'none' }}>
            {notifications.map((n) => (
              <div key={n.id} className="notif-item" style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
                <div className={`notif-icon ${n.type}`} style={{ width: 44, height: 44 }}>
                  {n.type === 'warning' ? <AlertTriangle size={22} /> : <Info size={22} />}
                </div>
                <div className="notif-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p className="notif-title" style={{ fontSize: 16, marginBottom: 6 }}>{n.title}</p>
                  <p className="notif-message" style={{ fontSize: 14 }}>{n.message}</p>
                </div>
                <Link 
                  to={n.link} 
                  className="btn btn-secondary" 
                  style={{ marginLeft: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  View <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}