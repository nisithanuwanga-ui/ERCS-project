import {
  Activity,
  ArrowUpRight,
  Boxes,
  CheckCheck,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
export function PlatformPreview() {
  return (
    <section className="platform-preview-section" id="dashboard-preview">
      <div className="landing-width">
        <div className="landing-section-top">
          <div>
            <span className="eyebrow">Clarity at the center</span>
            <h2>
              A command view.
              <br />
              <span>Without the complexity.</span>
            </h2>
          </div>
          <div>
            <p>
              Incidents, resources, requests and response teams in one focused
              workspace. Your dashboard is built from your operational records.
            </p>
            <Link className="text-link" to="/login">
              Explore your workspace <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <div
          className="product-preview"
          aria-label="Illustrative dashboard preview, not live operational data"
        >
          <div className="product-rail" aria-hidden="true">
            <span className="preview-logo">
              <ShieldCheck size={22} />
            </span>
            {[LayoutDashboard, Activity, Boxes, Radio, Users].map((Icon, i) => (
              <span key={i} className={i === 0 ? "selected" : ""}>
                <Icon size={17} />
              </span>
            ))}
          </div>
          <div className="product-stage">
            <div className="product-toolbar">
              <span>
                ERCS <ChevronRight size={12} /> Operational overview
              </span>
              <span className="tour-label">
                Product preview · illustrative only
              </span>
            </div>
            <div className="product-greeting">
              <div>
                <small>YOUR OPERATIONS, CONNECTED</small>
                <h3>One picture. A coordinated response.</h3>
              </div>
              <span>
                <span className="pulse-dot" /> Shared workspace
              </span>
            </div>
            <div className="product-signals">
              {[
                {
                  icon: Radio,
                  label: "Incidents",
                  state: "Report & prioritize",
                },
                {
                  icon: Boxes,
                  label: "Resources",
                  state: "Know what is available",
                },
                {
                  icon: CheckCheck,
                  label: "Requests",
                  state: "Review & coordinate",
                },
                {
                  icon: Users,
                  label: "Response teams",
                  state: "Assign & respond",
                },
              ].map(({ icon: Icon, label, state }) => (
                <div key={label}>
                  <Icon size={19} />
                  <strong>{label}</strong>
                  <small>{state}</small>
                </div>
              ))}
            </div>
            <div className="product-panels">
              <div className="product-chart">
                <div>
                  <strong>From awareness to action</strong>
                  <span>Connected workflow</span>
                </div>
                <svg
                  viewBox="0 0 580 175"
                  role="img"
                  aria-label="Schematic line connecting report, review, allocation and return; no operational values"
                >
                  <defs>
                    <linearGradient id="tour-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#2563eb" stopOpacity=".14" />
                      <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M22 32H558M22 76H558M22 120H558"
                    stroke="#e7edf4"
                    strokeDasharray="3 5"
                  />
                  <path
                    d="M24 128 C95 126 95 99 165 99 S235 64 305 70 S375 34 445 42 S505 25 556 21 L556 150 L24 150Z"
                    fill="url(#tour-fill)"
                  />
                  <path
                    className="preview-trace"
                    d="M24 128 C95 126 95 99 165 99 S235 64 305 70 S375 34 445 42 S505 25 556 21"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                  />
                  {[
                    [24, 128],
                    [165, 99],
                    [305, 70],
                    [445, 42],
                    [556, 21],
                  ].map(([cx, cy], i) => (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill="white"
                      stroke="#2563eb"
                      strokeWidth="2"
                    />
                  ))}
                  <text x="24" y="170">
                    Report
                  </text>
                  <text x="150" y="170">
                    Request
                  </text>
                  <text x="285" y="170">
                    Review
                  </text>
                  <text x="420" y="170">
                    Allocate
                  </text>
                  <text x="525" y="170">
                    Return
                  </text>
                </svg>
              </div>
              <div className="product-readiness">
                <strong>Keep the context close.</strong>
                <div>
                  <MapPin size={17} />
                  <span>
                    Incident context<small>Location, priority, updates</small>
                  </span>
                </div>
                <div>
                  <Boxes size={17} />
                  <span>
                    Resource visibility<small>Availability and demand</small>
                  </span>
                </div>
                <div>
                  <ShieldCheck size={17} />
                  <span>
                    Accountable decisions
                    <small>Role-based access and audit</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="preview-caption">
          This schematic explains the workspace. Actual charts and indicators
          use PostgreSQL-backed operational data after sign-in.
        </p>
      </div>
    </section>
  );
}
