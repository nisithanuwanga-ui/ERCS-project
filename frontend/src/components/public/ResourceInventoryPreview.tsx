import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle,
  Database,
  Flame,
  Gauge,
  Package,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

interface ResourceCategory {
  id: string;
  name: string;
  icon: typeof Package;
  total: number;
  available: number;
  allocated: number;
  threshold: number;
  depot: string;
  unit: string;
  description: string;
  status: "optimal" | "warning" | "critical";
}

const inventoryCategories: ResourceCategory[] = [
  {
    id: "med",
    name: "Trauma & Field Medical Packs",
    icon: ShieldCheck,
    total: 250,
    available: 195,
    allocated: 55,
    threshold: 40,
    depot: "Depot Delta · Regional Hospital Cache",
    unit: "Standard Trauma Kits",
    description:
      "Triage dressings, IV starter fluids, defibrillators, burn care kits.",
    status: "optimal",
  },
  {
    id: "rescue",
    name: "Heavy Rescue & Extraction Vehicles",
    icon: Truck,
    total: 24,
    available: 16,
    allocated: 8,
    threshold: 5,
    depot: "Fleet Bay West · Station 9",
    unit: "Certified Vehicles",
    description:
      "All-terrain high-clearance 4x4 trucks, hydraulic spreaders, cutters.",
    status: "optimal",
  },
  {
    id: "power",
    name: "Emergency Mobile Generators",
    icon: Zap,
    total: 60,
    available: 14,
    allocated: 46,
    threshold: 20,
    depot: "Logistics Hub East · Grid Support",
    unit: "50kW Diesel Units",
    description:
      "Heavy continuous-output generators with automatic voltage regulators.",
    status: "warning",
  },
  {
    id: "shelter",
    name: "Disaster Shelter & Heat Modules",
    icon: Boxes,
    total: 180,
    available: 140,
    allocated: 40,
    threshold: 30,
    depot: "Central Supply Compound",
    unit: "Deployable Pods",
    description:
      "All-weather climate-controlled modular shelters, sleeping cots, blankets.",
    status: "optimal",
  },
  {
    id: "water",
    name: "Mobile Water Filtration Units",
    icon: Flame,
    total: 35,
    available: 6,
    allocated: 29,
    threshold: 10,
    depot: "Riverfront Staging Base",
    unit: "Reverse-Osmosis Skids",
    description:
      "High-volume potable water generators producing 2,000 gallons/hour.",
    status: "critical",
  },
];

export function ResourceInventoryPreview() {
  const [selectedId, setSelectedId] = useState<string>("med");

  const activeItem =
    inventoryCategories.find((c) => c.id === selectedId) ??
    inventoryCategories[0];
  const availPercent = Math.round(
    (activeItem.available / activeItem.total) * 100,
  );

  return (
    <section className="landing-resource-section" id="resource-management">
      <div className="landing-width">
        <div className="landing-section-top">
          <div>
            <span className="eyebrow">Real-Time Asset Ledger</span>
            <h2>
              Resource Management.
              <br />
              <span>Visibility across every depot and supply cache.</span>
            </h2>
          </div>
          <div>
            <p>
              Know exact asset locations, current quantities, deployment states,
              and minimum safety thresholds before issuing allocations.
              Guarded by PostgreSQL check constraints against double allocation.
            </p>
            <div className="demo-simulation-tag">
              <span className="live-dot" /> Illustrative inventory · Sample data
            </div>
          </div>
        </div>

        <div className="resource-showcase-grid">
          {/* Category Tabs / Cards */}
          <div className="resource-cards-column">
            {inventoryCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = cat.id === activeItem.id;
              const pct = Math.round((cat.available / cat.total) * 100);
              return (
                <div
                  key={cat.id}
                  className={`resource-preview-card ${isSelected ? "selected" : ""} status-${cat.status}`}
                  onClick={() => setSelectedId(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedId(cat.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="card-top-row">
                    <div className="cat-icon-wrap">
                      <Icon size={20} />
                    </div>
                    <div className="cat-info">
                      <h4>{cat.name}</h4>
                      <span className="depot-text">{cat.depot}</span>
                    </div>
                    <div className="stock-ratio">
                      <strong>
                        {cat.available} / {cat.total}
                      </strong>
                      <small>Available</small>
                    </div>
                  </div>

                  {/* Stock Gauge Bar */}
                  <div className="stock-gauge-bar">
                    <div
                      className={`gauge-fill fill-${cat.status}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deep-Dive Active Resource Telemetry Panel */}
          <div className="resource-telemetry-panel">
            <div className="telemetry-panel-header">
              <div className="panel-badge-row">
                <span className="badge-depot">{activeItem.depot}</span>
                {activeItem.status === "critical" && (
                  <span className="badge-alert-shortage">
                    <AlertTriangle size={13} /> BELOW SAFETY THRESHOLD
                  </span>
                )}
                {activeItem.status === "warning" && (
                  <span className="badge-alert-warning">
                    <Gauge size={13} /> ELEVATED DEMAND
                  </span>
                )}
                {activeItem.status === "optimal" && (
                  <span className="badge-alert-optimal">
                    <CheckCircle size={13} /> READY FOR DISPATCH
                  </span>
                )}
              </div>
              <h3>{activeItem.name}</h3>
              <p className="item-desc">{activeItem.description}</p>
            </div>

            {/* Gauge visualization circle & metrics */}
            <div className="telemetry-gauges-row">
              <div className="metric-pod pod-available">
                <span className="pod-label">READY TO ALLOCATE</span>
                <span className="pod-val">{activeItem.available}</span>
                <small>{activeItem.unit}</small>
              </div>

              <div className="metric-pod pod-deployed">
                <span className="pod-label">DEPLOYED IN FIELD</span>
                <span className="pod-val">{activeItem.allocated}</span>
                <small>{activeItem.unit}</small>
              </div>

              <div className="metric-pod pod-total">
                <span className="pod-label">TOTAL STOCK</span>
                <span className="pod-val">{activeItem.total}</span>
                <small>Safety floor: {activeItem.threshold}</small>
              </div>
            </div>

            {/* Availability Percentage Bar */}
            <div className="availability-progress-card">
              <div className="progress-labels">
                <span>Immediate Availability Readiness</span>
                <strong>{availPercent}% Ready</strong>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${availPercent < 30 ? "critical" : availPercent < 50 ? "warning" : "healthy"}`}
                  style={{ width: `${availPercent}%` }}
                />
              </div>
            </div>

            <div className="concurrency-guarantee-note">
              <Database size={16} />
              <div>
                <strong>Atomic Inventory Guarantee</strong>
                <p>
                  Every unit allocation runs inside an isolated SQL transaction
                  with row-level lock (<code>SELECT ... FOR UPDATE</code>) to
                  preclude double allocation or over-commitment.
                </p>
              </div>
            </div>

            <div className="telemetry-cta-footer">
              <Link to="/login" className="button resource-cta">
                Access Inventory Management <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
