import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  LifeBuoy,
  MapPin,
  Radio,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DemoIncident {
  id: string;
  code: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium";
  status: "reported" | "active" | "controlled" | "resolved";
  location: string;
  reportedAgo: string;
  assignedTeams: number;
  icon: typeof Flame;
  updates: string;
}

const demoIncidents: DemoIncident[] = [
  {
    id: "1",
    code: "INC-2026-041",
    title: "Mountain Ridge Wildfire Perimeter",
    category: "Wildfire",
    severity: "critical",
    status: "active",
    location: "Highland Ridge · Sector 4B",
    reportedAgo: "14m ago",
    assignedTeams: 4,
    icon: Flame,
    updates: "Containment line established at Northern Ridge flank.",
  },
  {
    id: "2",
    code: "INC-2026-039",
    title: "River Valley Flash Flood Inundation",
    category: "Flood",
    severity: "high",
    status: "controlled",
    location: "Cedar Fork Corridor · Milepost 12",
    reportedAgo: "1h 22m ago",
    assignedTeams: 3,
    icon: LifeBuoy,
    updates: "Water receding. Evacuation corridors secured.",
  },
  {
    id: "3",
    code: "INC-2026-038",
    title: "Industrial Complex Structural Breach",
    category: "Hazmat / Rescue",
    severity: "high",
    status: "active",
    location: "Westside Logistics Hub",
    reportedAgo: "2h 45m ago",
    assignedTeams: 2,
    icon: ShieldAlert,
    updates: "Perimeter isolated. Hazmat containment squad deployed.",
  },
  {
    id: "4",
    code: "INC-2026-035",
    title: "Suburban Grid Power Substation Failure",
    category: "Infrastructure",
    severity: "medium",
    status: "resolved",
    location: "District 9 Substation",
    reportedAgo: "5h 10m ago",
    assignedTeams: 1,
    icon: AlertTriangle,
    updates: "Auxiliary generators operating. Primary grid restored.",
  },
];

const statusSteps = [
  { key: "reported", label: "Reported" },
  { key: "active", label: "Active" },
  { key: "controlled", label: "Controlled" },
  { key: "resolved", label: "Resolved" },
] as const;

export function IncidentStreamPreview() {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [activeIncidentId, setActiveIncidentId] = useState<string>("1");

  const filtered =
    selectedSeverity === "all"
      ? demoIncidents
      : demoIncidents.filter((inc) => inc.severity === selectedSeverity);

  const activeIncident =
    demoIncidents.find((i) => i.id === activeIncidentId) ?? demoIncidents[0];

  return (
    <section className="landing-incident-section" id="incident-management">
      <div className="landing-width">
        <div className="landing-section-top">
          <div>
            <span className="eyebrow">Real-Time Situational Awareness</span>
            <h2>
              Incident Management.
              <br />
              <span>Coordinated from the first report.</span>
            </h2>
          </div>
          <div>
            <p>
              Instantly triage incoming field reports, assign priority ratings,
              track perimeter containment, and log timestamped updates into an
              immutable audit trail.
            </p>
            <div className="demo-simulation-tag">
              <span className="live-dot" /> Demonstration telemetry ·
              Simulation data
            </div>
          </div>
        </div>

        <div className="incident-console-grid">
          {/* Left panel: Incident List */}
          <div className="incident-list-card">
            <div className="incident-list-header">
              <div className="incident-list-title">
                <Radio size={18} className="telemetry-icon" />
                <h3>Active Incident Stream</h3>
              </div>
              <div
                className="severity-pill-group"
                role="group"
                aria-label="Filter severity"
              >
                {["all", "critical", "high", "medium"].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    className={`filter-chip ${selectedSeverity === sev ? "active" : ""}`}
                    onClick={() => setSelectedSeverity(sev)}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="incident-items-scroll">
              {filtered.map((item) => {
                const Icon = item.icon;
                const isSelected = item.id === activeIncident.id;
                return (
                  <div
                    key={item.id}
                    className={`incident-stream-item ${isSelected ? "selected" : ""} severity-${item.severity}`}
                    onClick={() => setActiveIncidentId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setActiveIncidentId(item.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="item-icon-box">
                      <Icon size={20} />
                    </div>
                    <div className="item-body">
                      <div className="item-meta-top">
                        <span className="item-code">{item.code}</span>
                        <span className="item-time">
                          <Clock size={12} /> {item.reportedAgo}
                        </span>
                      </div>
                      <h4>{item.title}</h4>
                      <div className="item-meta-bottom">
                        <span className="item-location">
                          <MapPin size={13} /> {item.location}
                        </span>
                        <span className={`status-pill pill-${item.status}`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel: Active Incident Deep Dive */}
          <div className="incident-detail-card">
            <div className="detail-header">
              <div>
                <div className="code-badge-row">
                  <span className="code-tag">{activeIncident.code}</span>
                  <span
                    className={`severity-badge sev-${activeIncident.severity}`}
                  >
                    {activeIncident.severity.toUpperCase()} PRIORITY
                  </span>
                </div>
                <h3>{activeIncident.title}</h3>
                <p className="detail-loc">
                  <MapPin size={15} /> {activeIncident.location}
                </p>
              </div>
              <div className="active-teams-stat">
                <Users size={18} />
                <div>
                  <strong>{activeIncident.assignedTeams} Teams</strong>
                  <small>On Scene / Assigned</small>
                </div>
              </div>
            </div>

            {/* Lifecycle Progress Pipeline */}
            <div className="lifecycle-track-box">
              <span className="lifecycle-label">
                Operational Status Lifecycle
              </span>
              <div className="lifecycle-stepper">
                {statusSteps.map((step, idx) => {
                  const currentIdx = statusSteps.findIndex(
                    (s) => s.key === activeIncident.status,
                  );
                  const isDone = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div
                      key={step.key}
                      className={`step-node ${isDone ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                    >
                      <div className="step-circle">
                        {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                      </div>
                      <span className="step-text">{step.label}</span>
                      {idx < statusSteps.length - 1 && (
                        <div
                          className={`step-connector ${idx < currentIdx ? "active" : ""}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="incident-updates-box">
              <span className="box-title">Latest Tactical Log Entry</span>
              <p>{activeIncident.updates}</p>
            </div>

            <div className="incident-actions-footer">
              <Link to="/login" className="button incident-cta">
                View in Operational Workspace <ArrowRight size={17} />
              </Link>
              <span className="verification-text">
                <Activity size={14} /> Logged in PostgreSQL Audit Stream
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

