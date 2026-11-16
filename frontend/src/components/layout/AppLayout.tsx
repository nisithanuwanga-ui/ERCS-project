import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  ClipboardList,
  FileClock,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { can, roleLabels } from "../../../shared/domain";
import type { Permission } from "../../../shared/domain";
import { useAuth } from "../../app/useAuth";
import { Brand, Loading, Message } from "../ui";
import { HeaderNotifications } from "./HeaderNotifications";
import "../../styles/workspace.css";
const navigation = [
  { to: "/dashboard", title: "Overview", icon: LayoutDashboard },
  { to: "/incidents", title: "Incidents", icon: Activity },
  { to: "/resources", title: "Resource inventory", icon: Boxes },
  { to: "/resource-requests", title: "Resource requests", icon: ClipboardList },
  { to: "/allocations", title: "Allocations", icon: Truck },
  { to: "/teams", title: "Response teams", icon: Users },
  { to: "/shortages", title: "Shortage monitoring", icon: SlidersHorizontal },
  {
    to: "/admin/users",
    title: "User management",
    icon: UserRound,
    permission: "users.manage",
  },
  {
    to: "/admin/roles",
    title: "Roles & permissions",
    icon: ShieldCheck,
    permission: "users.manage",
  },
  {
    to: "/audit-logs",
    title: "Audit logs",
    icon: FileClock,
    permission: "audit.read",
  },
  {
    to: "/settings",
    title: "Settings",
    icon: Settings,
    permission: "settings.manage",
  },
];
export function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  const current = navigation.find((n) => location.pathname.startsWith(n.to));
  return (
    <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="workspace-sidebar"
        className={`sidebar ${open ? "is-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <Link
            className="sidebar-rail-brand"
            to="/"
            aria-label="ERCS home"
            title="ERCS home"
          >
            <ShieldCheck size={24} />
          </Link>
          <button
            className="icon-button mobile-only"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="pulse-dot" />{" "}
          <span className="workspace-label-text">Operations workspace</span>
        </div>
        <span className="nav-section-title">COORDINATION</span>
        <nav aria-label="Workspace navigation">
          {navigation
            .filter(
              (n) =>
                !n.permission || can(user.role, n.permission as Permission),
            )
            .map(({ to, title, icon: Icon }, i) => (
              <NavLink
                key={to}
                to={to}
                aria-label={title}
                title={title}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""} ${i === 7 ? "nav-divider" : ""}`
                }
              >
                <Icon size={18} />
                <span className="sidebar-link-label">{title}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className="sidebar-link"
            to="/profile"
            aria-label="My profile"
            title="My profile"
            onClick={() => setOpen(false)}
          >
            <UserRound size={18} />
            <span className="sidebar-link-label">My profile</span>
          </Link>
          <Link
            className="sidebar-link"
            to="/"
            aria-label="Public website"
            title="Public website"
            onClick={() => setOpen(false)}
          >
            <ArrowUpRight size={18} />
            <span className="sidebar-link-label">Public website</span>
          </Link>
          <div className="sidebar-account">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div className="sidebar-account-details">
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => {
                void signOut()
                  .then(() => navigate("/login"))
                  .catch((e: Error) => setError(e.message));
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button desktop-sidebar-toggle"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={
                collapsed ? "Expand navigation" : "Collapse navigation"
              }
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-controls="workspace-sidebar"
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
            <button
              className="icon-button mobile-only"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="workspace-sidebar"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current?.title ?? "My account"}</strong>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              navigate(`/incidents?q=${encodeURIComponent(String(q))}`);
            }}
          >
            <Search size={15} />
            <input
              name="q"
              aria-label="Search incidents"
              placeholder="Search incidents…"
            />
          </form>
          <HeaderNotifications />
          <Link to="/profile" className="top-account">
            <span className="avatar small">{user.name.slice(0, 1)}</span>
            <span>
              {user.name}
              <small>{roleLabels[user.role]}</small>
            </span>
          </Link>
        </header>
        <main id="main-content" className="workspace-content">
          {user.is_demo && (
            <div className="development-demo-badge">
              <FlaskConical size={15} />
              <strong>Development demo</strong>
              <span>Fictional account · local environment only</span>
            </div>
          )}
          {error && <Message>{error}</Message>}
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>ERCS · Emergency Resource Coordination System</span>
          <span>
            <ShieldCheck size={12} /> Authorized workspace
          </span>
        </footer>
      </div>
    </div>
  );
}
