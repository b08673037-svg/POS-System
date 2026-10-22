import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client.js";
import { 
  LayoutDashboard, ShoppingCart, Package, Tags, Users, Truck, 
  CreditCard, ShoppingBag, Warehouse, BarChart3, LogOut, Search, Bell, Menu, Settings,
  AlertTriangle, Info, CheckCircle2
} from "lucide-react";

const links = [
  { to: "/", end: true, label: "Dashboard", Icon: LayoutDashboard },
  { to: "/checkout", label: "Checkout", Icon: ShoppingCart },
  { to: "/products", label: "Products", Icon: Package },
  { to: "/categories", label: "Categories", Icon: Tags },
  { to: "/customers", label: "Customers", Icon: Users },
  { to: "/suppliers", label: "Suppliers", Icon: Truck },
  { to: "/sales", label: "Sales", Icon: CreditCard },
  { to: "/purchases", label: "Purchases", Icon: ShoppingBag },
  { to: "/inventory", label: "Inventory", Icon: Warehouse },
  { to: "/reports", label: "Reports", Icon: BarChart3 },
  { to: "/notifications", label: "Notifications", Icon: Bell }, // <-- NEW LINK
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const notifRef = useRef(null);

  const closeSidebar = () => setSidebarOpen(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) => isActive ? "nav-link nav-link-active" : "nav-link";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    api.get("/notifications")
      .then((res) => {
        setNotifications(res.data.data);
        if (res.data.data.length > 0) setHasUnread(true);
      })
      .catch((err) => console.error("Failed to load notifications", err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleNotifications = () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen) setHasUnread(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/products?search=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch("");
    }
  };

  const initials = (user?.name || "?").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">POS</span>
          <span className="brand-name">
            POS System
            <small>Management Suite</small>
          </span>
        </div>

        <nav className="sidebar-nav" onClick={closeSidebar}>
          <div className="nav-section-title">Main</div>
          {links.slice(0, 4).map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="nav-section-title">Management</div>
          {links.slice(4).map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
           <button onClick={handleLogout} className="nav-link" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <Settings size={18} />
             <span>Settings / Logout</span>
           </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:30}} />}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-toggle" onClick={() => setSidebarOpen((s) => !s)}>
              <Menu size={20} />
            </button>
            <h1 className="topbar-title">Hi, {user?.name?.split(' ')[0] || "Admin"}!</h1>
          </div>

          <div className="topbar-right">
            <form className="search-wrap" onSubmit={handleSearchSubmit}>
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </form>

            <div className="notif-wrapper" ref={notifRef}>
              <button className="icon-btn" onClick={toggleNotifications}>
                <Bell size={20} />
                {hasUnread && <span className="notification-dot" />}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <h4>Notifications</h4>
                    <span>{notifications.length} alerts</span>
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">
                        <CheckCircle2 size={32} />
                        <p>You're all caught up!</p>
                      </div>
                    ) : (
                      // Show only first 5 in the dropdown
                      notifications.slice(0, 5).map((n) => (
                        <Link 
                          to={n.link} 
                          key={n.id} 
                          className="notif-item"
                          onClick={() => setNotifOpen(false)}
                        >
                          <div className={`notif-icon ${n.type}`}>
                            {n.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}
                          </div>
                          <div className="notif-content">
                            <p className="notif-title">{n.title}</p>
                            <p className="notif-message">{n.message}</p>
                          </div>
                        </Link>
                      ))
                    )}
                    {notifications.length > 5 && (
                       <Link to="/notifications" className="notif-view-all" onClick={() => setNotifOpen(false)}>
                         View all notifications
                       </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="user-profile">
              <div className="user-info">
                <span className="user-name">{user?.name || "Admin User"}</span>
                <span className="user-role">{user?.role || "Administrator"}</span>
              </div>
              <div className="avatar" title={user?.name}>{initials}</div>
            </div>

            <button onClick={handleLogout} className="icon-btn" title="Logout" style={{ marginLeft: '8px' }}>
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}