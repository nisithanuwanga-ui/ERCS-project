import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  Compass,
  MapPin,
  Radio,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/ui";
import { PublicHeader } from "../components/public/PublicHeader";
import { WorkflowExplorer } from "../components/public/WorkflowExplorer";
import { PlatformPreview } from "../components/public/PlatformPreview";
import { IncidentStreamPreview } from "../components/public/IncidentStreamPreview";
import { ResourceInventoryPreview } from "../components/public/ResourceInventoryPreview";
import { TeamCoordinationPreview } from "../components/public/TeamCoordinationPreview";
import "../styles/public.css";
import "../styles/integration.css";
import { useApi } from "../hooks/useApi";

const responsibilities = [
  {
    role: "System Administrator",
    scope: "Platform Governance",
    desc: "Authorized account provisioning, invitation tokens, system reference categories, and immutable audit inspection.",
    icon: Server,
    color: "blue",
  },
  {
    role: "Emergency Coordinator",
    scope: "Tactical Operations",
    desc: "Incident lifecycle management, operational priority triage, demand approval/rejection, and team dispatch.",
    icon: Compass,
    color: "teal",
  },
  {
    role: "Resource Manager",
    scope: "Supply Chain & Depots",
    desc: "Depot inventory thresholds, concurrency-safe resource allocations, returns processing, and shortage alerts.",
    icon: Boxes,
    color: "amber",
  },
  {
    role: "Field Officer",
    scope: "Frontline Response",
    desc: "Scoped incident reporting, on-scene status telemetry updates, and urgent frontline resource requests.",
    icon: MapPin,
    color: "cyan",
  },
  {
    role: "Authorized Viewer",
    scope: "Executive Oversight",
    desc: "Read-only situational monitoring, aggregate operational metrics, and command dashboard visibility.",
    icon: ShieldCheck,
    color: "slate",
  },
];

export function HomePage() {
  const health = useApi<{success: boolean}>("/db-health");
  return (
    <div className="public-site">
      <a href="#public-main" className="skip-link">
        Skip to content
      </a>
      <PublicHeader />
      <main id="public-main">
        {/* =========================================================================
            SECTION 1 — HERO SECTION
            ========================================================================= */}
        <section className="landing-hero landing-width" id="hero">
          <p className="integration-preview-notice">Interactive product preview. All example incidents, stock levels and teams below are illustrative scenarios, not live operational records. Sign-in and additional coordination services are awaiting connection.</p>
          <div className="hero-editorial">
            <div>
              <span className="hero-kicker">
                <span className="pulse-indicator" /> Connected When Seconds Count
              </span>
              <h1 className="hero-headline">
                Emergency Resource
                <br />
                Coordination,
                <br />
                <em>Reimagined.</em>
              </h1>
            </div>
            <div className="hero-editorial-aside">
              <span className="hero-aside-number">
                MISSION-CRITICAL OPERATIONS
              </span>
              <p>
                A unified, real-time command platform bringing incidents, personnel,
                and life-saving supply logistics together into one coordinated
                operational picture.
              </p>
              <div className="hero-cta-group">
                <Link className="button hero-primary" to="/login">
                  Access Operations Platform <ArrowUpRight size={18} />
                </Link>
                <a className="button secondary hero-secondary" href="#about-ercs">
                  Explore Architecture <ArrowRight size={17} />
                </a>
              </div>
            </div>
          </div>

          <div className="cinematic-frame">
            <img
              src="/images/home/emergency-logistics.webp"
              srcSet="/images/home/emergency-logistics-800.webp 800w, /images/home/emergency-logistics.webp 1672w"
              sizes="(max-width: 740px) calc(100vw - 44px), (max-width: 1320px) calc(100vw - 104px), 1216px"
              width="1672"
              height="941"
              fetchPriority="high"
              alt="Emergency response coordinators reviewing logistics beside rescue vehicles and supplies in a green hill-country community"
            />
            <div className="cinematic-shade" />
            <div className="hero-network" aria-hidden="true">
              <svg viewBox="0 0 1100 420" preserveAspectRatio="none">
                <path d="M-40 330C120 310 170 130 350 160S490 330 650 210 850 60 1140 115" />
                <circle cx="350" cy="160" r="7" />
                <circle cx="650" cy="210" r="7" />
                <circle cx="930" cy="100" r="7" />
              </svg>
            </div>
            <div className="cinematic-caption">
              <span>
                <Compass size={18} /> From Command Post to Frontline
              </span>
              <strong>
                Prepared together.
                <br />
                Decisive in crisis.
              </strong>
            </div>
            <div className="response-note">
              <span className="response-note-icon">
                <Radio size={24} />
              </span>
              <div>
                <small>INTEGRATED COMMAND LOOP</small>
                <strong>Incident · Demand · Allocation · Return</strong>
                <span>Illustrative coordination workflow</span>
              </div>
              <ArrowUpRight size={20} />
            </div>
            <span className="visual-note">Coordination Workspace Preview</span>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2 — ABOUT ERCS (EDITORIAL SPLIT-SCREEN)
            ========================================================================= */}
        <section className="about-ercs-section" id="about-ercs">
          <div className="landing-width about-grid">
            <div className="about-narrative">
              <span className="eyebrow">Enterprise Operational Architecture</span>
              <h2>
                Built for the high-stakes reality of critical incident response.
              </h2>
              <p className="lead-paragraph">
                During natural disasters and large-scale emergencies, communication
                breakdowns and inventory ambiguity cost lives. ERCS replaces fragmented
                spreadsheets and disconnected phone chains with a single source of
                truth.
              </p>
              <p className="body-paragraph">
                The intended coordination workflow links resource requests to incidents,
                tracks allocations and returns, and records operational decisions.
                The previews below illustrate these workflows while their backend
                services are being connected.
              </p>

              <div className="about-pillars-grid">
                <div className="about-pillar-card">
                  <span className="pillar-icon blue">
                    <MapPin size={22} />
                  </span>
                  <div>
                    <strong>Situational Awareness</strong>
                    <p>Live incident tracking, severity grading, and field updates.</p>
                  </div>
                </div>
                <div className="about-pillar-card">
                  <span className="pillar-icon teal">
                    <Boxes size={22} />
                  </span>
                  <div>
                    <strong>Atomic Stock Control</strong>
                    <p>An allocation workflow designed to track stock and returns.</p>
                  </div>
                </div>
                <div className="about-pillar-card">
                  <span className="pillar-icon cyan">
                    <Users size={22} />
                  </span>
                  <div>
                    <strong>Squad Coordination</strong>
                    <p>A team assignment workflow for coordinated deployment.</p>
                  </div>
                </div>
                <div className="about-pillar-card">
                  <span className="pillar-icon amber">
                    <ShieldCheck size={22} />
                  </span>
                  <div>
                    <strong>Role-Based Security</strong>
                    <p>Granular RBAC boundaries across 5 specialized operational roles.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="about-visual-side">
              <div className="command-telemetry-mockup">
                <div className="mockup-header">
                  <div className="header-status">
                    <span className="status-live-beacon" />
                    <strong>REGIONAL DISPATCH NETWORK</strong>
                  </div>
                  <span className="mockup-pill">ILLUSTRATIVE PREVIEW</span>
                </div>

                <div className="network-nodes-preview">
                  <div className="preview-node node-primary">
                    <span className="node-type">COMMAND CENTER</span>
                    <h4>Central Emergency Operations Center</h4>
                    <p>Coordinating 4 active disaster sectors across County jurisdiction.</p>
                    <div className="node-tags">
                      <span>12 Active Squads</span>
                      <span>96.4% Stock Readiness</span>
                    </div>
                  </div>

                  <div className="preview-subnodes">
                    <div className="subnode-card">
                      <div className="subnode-dot teal" />
                      <div>
                        <strong>Depot Delta Logistics</strong>
                        <small>195 Trauma Packs Ready</small>
                      </div>
                    </div>
                    <div className="subnode-card">
                      <div className="subnode-dot blue" />
                      <div>
                        <strong>Fleet Base West</strong>
                        <small>16 Heavy Rescue Trucks Available</small>
                      </div>
                    </div>
                    <div className="subnode-card">
                      <div className="subnode-dot amber" />
                      <div>
                        <strong>Station 4 Air Wing</strong>
                        <small>AeroMedical Unit Deployed</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3 — INCIDENT MANAGEMENT (ANIMATED PREVIEW)
            ========================================================================= */}
        <IncidentStreamPreview />

        {/* =========================================================================
            SECTION 4 — RESOURCE MANAGEMENT (INVENTORY & DEPOTS)
            ========================================================================= */}
        <ResourceInventoryPreview />

        {/* =========================================================================
            SECTION 5 — RESOURCE REQUEST WORKFLOW (6-STAGE INTERACTIVE PROCESS)
            ========================================================================= */}
        <WorkflowExplorer />

        {/* =========================================================================
            SECTION 6 — RESPONSE TEAM COORDINATION (SQUADS & DISPATCH)
            ========================================================================= */}
        <TeamCoordinationPreview />

        {/* =========================================================================
            SECTION 7 — DASHBOARD PREVIEW
            ========================================================================= */}
        <PlatformPreview />

        {/* =========================================================================
            SECTION 8 — SECURITY AND ACCESS CONTROL (5 SPECIALIZED ROLES)
            ========================================================================= */}
        <section id="access" className="access-story">
          <div className="landing-width access-story-grid">
            <div className="access-story-copy">
              <span className="eyebrow">Enterprise Security Governance</span>
              <h2>
                The right access.
                <br />
                <span>Defined accountability.</span>
              </h2>
              <p>
                Emergency coordination brings high-stress cross-functional teams
                together. The access design calls for
                invitation-only onboarding, cryptographic session cookies, and
                strict backend permission enforcement. These access services are awaiting backend integration.
              </p>
              <ul className="security-guarantees-list">
                {[
                  "Administrator-issued invitation tokens (no public signup tampering)",
                  "Planned server-enforced role permissions",
                  "Planned password protection and session management",
                  "Planned audit history for operational decisions",
                ].map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={19} className="security-check-icon" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="security-cta-row">
                <Link to="/register" className="button secondary">
                  Activate Account with Invitation <ArrowRight size={17} />
                </Link>
              </div>
            </div>

            <div className="role-story">
              <div className="role-story-heading">
                <span className="icon-circle blue">
                  <ShieldCheck size={26} />
                </span>
                <div>
                  <small>ROLE-BASED AUTHORIZATION MATRIX</small>
                  <strong>Five Specialized Roles. One Unified Chain of Command.</strong>
                </div>
              </div>
              <div className="roles-list-stack">
                {responsibilities.map((r, i) => {
                  const Icon = r.icon;
                  return (
                    <div className="role-story-row" key={r.role}>
                      <span className="role-idx">{String(i + 1).padStart(2, "0")}</span>
                      <div className="role-icon-box">
                        <Icon size={18} />
                      </div>
                      <div className="role-info">
                        <div className="role-title-line">
                          <strong>{r.role}</strong>
                          <span className="role-scope-badge">{r.scope}</span>
                        </div>
                        <p>{r.desc}</p>
                      </div>
                      <Check size={18} className="role-check" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 9 — CALL TO ACTION (CINEMATIC BANNER)
            ========================================================================= */}
        <section className="final-cta-section">
          <div className="landing-width final-cta-card">
            <div className="cta-copy">
              <span className="eyebrow cta-eyebrow">Ready for Coordinated Emergency Response?</span>
              <h2>
                Clearer decisions.
                <br />
                Faster relief.
              </h2>
              <p>
                Connect your emergency managers, logistics warehouses, and field
                officers in one coordinated operational workspace.
              </p>
            </div>
            <div className="cta-actions-column">
              <Link className="button cta-primary-btn" to="/login">
                Access Operations Platform <ArrowUpRight size={19} />
              </Link>
              <Link className="cta-secondary-link" to="/register">
                Activate an authorized account <ArrowRight size={15} />
              </Link>
              <span className="demo-credentials-callout">
                Account access requires the sign-in service
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          SECTION 10 — FOOTER
          ========================================================================= */}
      <footer className="landing-footer landing-width">
        <div className="footer-top-grid">
          <div className="footer-brand-col">
            <Brand />
            <p>
              Emergency Resource Coordination System (ERCS) — A mission-critical
              command and supply-chain platform engineered for local, regional,
              and multi-agency emergency operations.
            </p>
            <div className="system-status-indicator">
              <span className="status-ping-green" style={{background: health.data?.success ? "#10b981" : "#f59e0b"}} />
              <span>{health.loading ? "Checking incident database…" : health.data?.success ? "Incident database connected" : "Incident database unavailable"}</span>
            </div>
          </div>

          <div className="footer-links-col">
            <h4>Platform Architecture</h4>
            <a href="#hero">Overview</a>
            <a href="#about-ercs">About ERCS</a>
            <a href="#incident-management">Incident Stream</a>
            <a href="#resource-management">Resource Catalog</a>
            <a href="#workflow">6-Stage Workflow</a>
          </div>

          <div className="footer-links-col">
            <h4>Operations</h4>
            <a href="#response-teams">Response Teams</a>
            <a href="#dashboard-preview">Command Dashboard</a>
            <a href="#access">Security & RBAC</a>
            <Link to="/login">Sign In</Link>
            <Link to="/register">Activate Account</Link>
          </div>

          <div className="footer-links-col">
            <h4>Compliance & Technology</h4>
            <span>PostgreSQL ACID Transactions</span>
            <span>Row-Level Concurrency Locks</span>
            <span>Argon2 Password Hashing</span>
            <span>HttpOnly Session Isolation</span>
            <span>Full Audit Trail Logging</span>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <small>© 2026 Emergency Resource Coordination System. All rights reserved.</small>
          <div className="footer-meta-tags">
            <span>Clarity</span>
            <span>·</span>
            <span>Coordination</span>
            <span>·</span>
            <span>Accountability</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
