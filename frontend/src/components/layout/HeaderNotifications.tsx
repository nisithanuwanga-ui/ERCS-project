import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { RecordData } from "../../../shared/domain";
import { useApi } from "../../hooks/useApi";

interface SummaryData {
  counts: Record<string, number>;
  urgent: RecordData[];
  urgentRequests: RecordData[];
  resourceAlerts: RecordData[];
}

export function HeaderNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "incidents" | "requests" | "resources">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data, loading, error, refresh } = useApi<{ data: SummaryData }>("/dashboard/summary?days=7");

  const urgent = data?.data?.urgent ?? [];
  const urgentRequests = data?.data?.urgentRequests ?? [];
  const resourceAlerts = data?.data?.resourceAlerts ?? [];

  const total = urgent.length + urgentRequests.length + resourceAlerts.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="header-notifications-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className={`icon-button notification-bell-button ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={error ? "Operational notifications unavailable" : loading ? "Checking operational notifications" : `Operational notifications: ${total} active alerts`}
        title={error ? "Operational notifications unavailable" : loading ? "Checking operational notifications" : `Operational notifications: ${total} active alerts`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="notification-badge-pulse" aria-hidden="true">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="notification-popover"
          role="dialog"
          aria-label="Operational alerts popover"
        >
          <div className="notification-popover-header">
            <div>
              <h3>Operational Alerts</h3>
              <p>
                {error ? "Notifications unavailable" : loading ? "Checking notifications…" : total === 0
                  ? "No current priority alerts"
                  : `${total} priority ${total === 1 ? "alert" : "alerts"} requiring review`}
              </p>
            </div>
            <div className="notification-header-actions">
              <button
                type="button"
                className="icon-button notification-action-btn"
                onClick={() => void refresh()}
                title="Refresh notifications"
                aria-label="Refresh notifications"
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} />
              </button>
              <button
                type="button"
                className="icon-button notification-action-btn"
                onClick={() => setIsOpen(false)}
                title="Close notifications"
                aria-label="Close notifications"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {total > 0 && (
            <div className="notification-tabs">
              <button
                type="button"
                className={`notification-tab ${activeTab === "all" ? "active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All ({total})
              </button>
              {urgent.length > 0 && (
                <button
                  type="button"
                  className={`notification-tab ${activeTab === "incidents" ? "active" : ""}`}
                  onClick={() => setActiveTab("incidents")}
                >
                  Incidents ({urgent.length})
                </button>
              )}
              {urgentRequests.length > 0 && (
                <button
                  type="button"
                  className={`notification-tab ${activeTab === "requests" ? "active" : ""}`}
                  onClick={() => setActiveTab("requests")}
                >
                  Requests ({urgentRequests.length})
                </button>
              )}
              {resourceAlerts.length > 0 && (
                <button
                  type="button"
                  className={`notification-tab ${activeTab === "resources" ? "active" : ""}`}
                  onClick={() => setActiveTab("resources")}
                >
                  Shortages ({resourceAlerts.length})
                </button>
              )}
            </div>
          )}

          <div className="notification-list">
            {error ? (<div className="notification-empty" role="alert"><ShieldAlert size={32} /><strong>Notifications unavailable</strong><p>{error}</p></div>) : loading ? (<div className="notification-empty" role="status">Checking alerts…</div>) : total === 0 ? (
              <div className="notification-empty">
                <CheckCircle2 size={32} className="nominal-icon" />
                <strong>Zero Active Critical Alerts</strong>
                <p>No priority alerts were returned by the notification service.</p>
              </div>
            ) : (
              <>
                {(activeTab === "all" || activeTab === "incidents") &&
                  urgent.map((inc) => (
                    <Link
                      key={`inc-${inc.id}`}
                      to={`/incidents/${inc.id}`}
                      className="notification-item alert-incident"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="notif-icon-box red">
                        <Activity size={16} />
                      </span>
                      <div className="notif-content">
                        <div className="notif-line">
                          <strong className="notif-title">
                            {String(inc.title ?? inc.code)}
                          </strong>
                          <span className="notif-priority-badge red">
                            {String(inc.priority).toUpperCase()}
                          </span>
                        </div>
                        <p className="notif-sub">
                          {String(inc.code)} · {String(inc.location ?? "Field Zone")}
                        </p>
                      </div>
                      <ArrowUpRight size={15} className="notif-arrow" />
                    </Link>
                  ))}

                {(activeTab === "all" || activeTab === "requests") &&
                  urgentRequests.map((req) => (
                    <Link
                      key={`req-${req.id}`}
                      to={`/resource-requests/${req.id}`}
                      className="notification-item alert-request"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="notif-icon-box amber">
                        <ClipboardList size={16} />
                      </span>
                      <div className="notif-content">
                        <div className="notif-line">
                          <strong className="notif-title">
                            {String(req.resource ?? req.code ?? "Supply Request")}
                          </strong>
                          <span className="notif-priority-badge amber">
                            {String(req.priority).toUpperCase()}
                          </span>
                        </div>
                        <p className="notif-sub">
                          Request #{String(req.id).slice(0, 8)} · Awaiting Review
                        </p>
                      </div>
                      <ArrowUpRight size={15} className="notif-arrow" />
                    </Link>
                  ))}

                {(activeTab === "all" || activeTab === "resources") &&
                  resourceAlerts.map((res) => (
                    <Link
                      key={`res-${res.id}`}
                      to={`/resources/${res.id}`}
                      className="notification-item alert-resource"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="notif-icon-box rose">
                        <Boxes size={16} />
                      </span>
                      <div className="notif-content">
                        <div className="notif-line">
                          <strong className="notif-title">{String(res.name)}</strong>
                          <span className="notif-priority-badge rose">SHORTAGE</span>
                        </div>
                        <p className="notif-sub">
                          {String(res.available_quantity)} in stock (threshold:{" "}
                          {String(res.threshold)})
                        </p>
                      </div>
                      <ArrowUpRight size={15} className="notif-arrow" />
                    </Link>
                  ))}
              </>
            )}
          </div>

          <div className="notification-popover-footer">
            <Link
              to="/dashboard"
              className="notif-footer-link"
              onClick={() => setIsOpen(false)}
            >
              Open Command Overview <ShieldAlert size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
