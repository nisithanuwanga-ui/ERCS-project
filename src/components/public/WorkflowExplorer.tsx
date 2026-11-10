import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ClipboardCheck,
  FileSearch,
  PackageCheck,
  Radio,
  RotateCcw,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

const steps = [
  {
    title: "Incident Identification & Scope",
    short: "Incident",
    label: "01 / Incident Triage",
    icon: Radio,
    description:
      "A verified emergency event is captured with geographic coordinates, priority rating, and initial containment objectives.",
    event: "Incident Logged & Scaled",
    detail: "Location, hazard severity, and operational authority established.",
    next: "Establishes the foundation for all incoming resource requests",
    color: "blue",
  },
  {
    title: "Operational Need Submission",
    short: "Request",
    label: "02 / Resource Request",
    icon: ClipboardCheck,
    description:
      "Field officers submit structured supply, vehicle, or equipment requisitions directly tied to the active incident ID.",
    event: "Request Submitted to Queue",
    detail: "Item category, quantity required, and mission justification recorded.",
    next: "Routes to emergency coordinator queue for priority evaluation",
    color: "cyan",
  },
  {
    title: "Coordinator Feasibility Review",
    short: "Review",
    label: "03 / Priority Review",
    icon: FileSearch,
    description:
      "Authorized coordinators inspect stock availability, urgency, and competing demands across simultaneous response operations.",
    event: "Under Technical Review",
    detail: "Coordinator validates justification and stock availability across depots.",
    next: "Coordinator renders formal approval or documented rejection",
    color: "amber",
  },
  {
    title: "Authorized Demand Approval",
    short: "Approval",
    label: "04 / Requisition Approval",
    icon: CheckCheck,
    description:
      "The requisition is formally approved in the database. Outstanding demand is registered without premature inventory mutation.",
    event: "Requisition Approved",
    detail: "Approved demand unlocked for Resource Manager fulfillment.",
    next: "Demand queued for transactional inventory allocation",
    color: "teal",
  },
  {
    title: "Atomic Inventory Commitment",
    short: "Allocation",
    label: "05 / Concurrency-Safe Allocation",
    icon: Truck,
    description:
      "Resource Managers execute allocations via atomic database transactions with row-level locks, guaranteeing zero double-allocations.",
    event: "Stock Allocated & Locked",
    detail: "Inventory deducted from available units; tracking IDs stamped.",
    next: "Resources packaged and transferred into field operational deployment",
    color: "blue",
  },
  {
    title: "Field Deployment & Return",
    short: "Release",
    label: "06 / Release & Return",
    icon: RotateCcw,
    description:
      "Equipment is utilized on scene. Once the mission completes, undamaged items return to inventory while consumables are audited.",
    event: "Release & Stock Restored",
    detail: "Cumulative accounting reconciled in audit movements ledger.",
    next: "Assets returned to operational standby for the next emergency",
    color: "teal",
  },
];

export function WorkflowExplorer() {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const step = steps[active];
  const Icon = step.icon;

  return (
    <section className="landing-workflow landing-width" id="workflow">
      <div className="landing-section-intro">
        <span className="eyebrow">End-to-End Operational Lifecycle</span>
        <h2>
          Resource Request Workflow.
          <br />
          <span>Six connected stages from crisis to resolution.</span>
        </h2>
        <p>
          Discover how demand moves from initial field report through review,
          approval, concurrency-safe allocation, and final field return.
        </p>
      </div>
      <div className="workflow-explorer">
        <div
          role="tablist"
          aria-label="Emergency coordination workflow"
          className="workflow-tabs six-stages"
        >
          {steps.map((s, i) => (
            <button
              key={s.short}
              role="tab"
              ref={(element) => {
                buttons.current[i] = element;
              }}
              id={`workflow-tab-${i}`}
              aria-selected={i === active}
              aria-controls="workflow-panel"
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                let next = active;
                if (e.key === "ArrowRight") next = (active + 1) % steps.length;
                else if (e.key === "ArrowLeft")
                  next = (active + steps.length - 1) % steps.length;
                else if (e.key === "Home") next = 0;
                else if (e.key === "End") next = steps.length - 1;
                else return;
                e.preventDefault();
                setActive(next);
                buttons.current[next]?.focus();
              }}
            >
              <span className="step-num">
                {i < active ? (
                  <Check size={14} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span className="step-name">{s.short}</span>
              <ArrowRight size={15} className="step-arrow" />
            </button>
          ))}
        </div>
        <div
          id="workflow-panel"
          role="tabpanel"
          aria-labelledby={`workflow-tab-${active}`}
          className="workflow-detail"
          tabIndex={0}
        >
          <div className="workflow-detail-copy" key={`copy-${active}`}>
            <span className={`workflow-symbol ${step.color}`}>
              <Icon size={28} />
            </span>
            <span className="eyebrow">{step.label}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <div className="workflow-detail-callout">
              <span className="callout-label">Next Stage Trigger</span>
              <p>{step.next}</p>
            </div>
          </div>
          <div className="workflow-detail-visual" key={`vis-${active}`}>
            <div className="workflow-card-stack">
              <div className="workflow-visual-header">
                <span className="visual-stage-badge">
                  STAGE {active + 1} OF 6
                </span>
                <span className="visual-guard-badge">
                  <ShieldCheck size={14} /> Transactional Audit Guard
                </span>
              </div>
              <div className="visual-event-card">
                <div className="event-icon-box">
                  <Icon size={22} />
                </div>
                <div>
                  <strong>{step.event}</strong>
                  <p>{step.detail}</p>
                </div>
              </div>
              <div className="visual-pipeline-status">
                <span className="pulse-indicator" />
                <span>
                  Stage active in ERCS PostgreSQL transactional engine
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
