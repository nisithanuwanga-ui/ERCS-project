import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { can, incidentStates } from "../../shared/domain";
import type { PageResult, RecordData } from "../../shared/domain";
import { useAuth } from "../app/useAuth";
import { api } from "../services/api";
import {
  Badge,
  Empty,
  Loading,
  Message,
  PageTitle,
  Refresh,
} from "../components/ui";
import { useApi } from "../hooks/useApi";
import { Cell, RecordTable } from "./RecordList";
import { fieldLabel } from "./modules";
import type { ModuleConfig } from "./modules";
interface Details {
  data: RecordData;
  details: Record<string, RecordData[]>;
}
function ReturnDialog({
  id,
  outstanding,
  onDone,
}: {
  id: string;
  outstanding: number;
  onDone: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    setPending(true);
    try {
      await api(`/allocations/${id}/releases`, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({
          quantity: Number(form.get("quantity")),
          reason: form.get("reason"),
        }),
      });
      dialog.current?.close();
      setKey(crypto.randomUUID());
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button className="button" onClick={() => dialog.current?.showModal()}>
        Return resources
      </button>
      <dialog
        ref={dialog}
        className="action-dialog"
        aria-labelledby="return-resources-title"
        onClick={(e) => {
          if (e.target === dialog.current && !pending) dialog.current.close();
        }}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <form onSubmit={submit}>
          <span className="eyebrow">Inventory return</span>
          <h2 id="return-resources-title">Return allocated resources</h2>
          <p>
            Confirm the quantity returned in operational condition. Outstanding
            quantity: <strong>{outstanding}</strong>.
          </p>
          {error && <Message>{error}</Message>}
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min={1}
              max={outstanding}
              required
              defaultValue={outstanding}
            />
          </label>
          <label>
            Return notes
            <textarea name="reason" required minLength={3} maxLength={1000} />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button className="button" disabled={pending}>
              {pending ? "Returning…" : "Confirm return"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
interface Confirmation {
  title: string;
  description: string;
  path: string;
  body: object;
  method?: string;
}
function ConfirmationDialog({
  confirmation,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  confirmation: Confirmation;
  pending: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="action-dialog"
      aria-labelledby="confirm-action-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <span className="eyebrow">Confirm action</span>
        <h2 id="confirm-action-title">{confirmation.title}</h2>
        <p>{confirmation.description}</p>
        {error && <Message>{error}</Message>}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={onClose}
          >
            Go back
          </button>
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : "Confirm action"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function AdjustmentDialog({
  record,
  onDone,
}: {
  record: RecordData;
  onDone: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [delta, setDelta] = useState("");
  const nextTotal = Number(record.total_quantity) + Number(delta);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    setPending(true);
    try {
      await api(`/resources/${record.id}/adjustments`, {
        method: "POST",
        body: JSON.stringify({
          quantity_delta: Number(delta),
          reason: form.get("reason"),
        }),
      });
      dialog.current?.close();
      setDelta("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="button full"
        onClick={() => dialog.current?.showModal()}
      >
        Adjust inventory
      </button>
      <dialog
        ref={dialog}
        className="action-dialog"
        aria-labelledby="adjustment-title"
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <form onSubmit={submit}>
          <span className="eyebrow">Inventory movement</span>
          <h2 id="adjustment-title">Adjust inventory</h2>
          <p>
            {String(record.name)} ·{" "}
            {Number(record.total_quantity).toLocaleString()} total ·{" "}
            {Number(record.allocated_quantity).toLocaleString()} allocated
          </p>
          {error && <Message>{error}</Message>}
          <label>
            Quantity adjustment
            <input
              type="number"
              name="quantity_delta"
              min={-Number(record.available_quantity)}
              max={100000000 - Number(record.total_quantity)}
              step={1}
              required
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
          </label>
          <p className="muted small-text">
            Use a positive quantity for incoming stock or a negative quantity
            for a correction. New total:{" "}
            <strong>
              {Number.isFinite(nextTotal) ? nextTotal.toLocaleString() : "—"}
            </strong>
            .
          </p>
          <label>
            Adjustment reason
            <textarea name="reason" minLength={3} maxLength={1000} required />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button className="button" disabled={pending || !Number(delta)}>
              {pending ? "Adjusting…" : "Confirm adjustment"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
export function RecordDetails({
  config,
  review = false,
  assignments = false,
}: {
  config: ModuleConfig;
  review?: boolean;
  assignments?: boolean;
}) {
  const { id } = useParams();
  const { user } = useAuth();
  const result = useApi<Details>(`/${config.key}/${id}`);
  const incidents = useApi<PageResult>(
    config.key === "teams"
      ? "/incidents?pageSize=100"
      : "/incidents?pageSize=1",
  );
  const teams = useApi<PageResult>(
    config.key === "incidents" && user && can(user.role, "teams.manage")
      ? "/teams?pageSize=100&availability=available"
      : "/reference-data",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  if (!user) return <Navigate to="/login" />;
  if (review && !can(user.role, "requests.review"))
    return <Navigate to="/403" />;
  if (assignments && config.key !== "teams") return <Navigate to="/403" />;
  if (result.loading) return <Loading />;
  if (result.error)
    return (
      <section className="panel panel-padding">
        <Message>{result.error}</Message>
        <Refresh onClick={result.refresh} />
        <Link className="back-link" to={config.path}>
          Back to {config.title.toLowerCase()}
        </Link>
      </section>
    );
  if (!result.data) return null;
  const record = result.data.data;
  const details = result.data.details;
  const incidentStateIndex = incidentStates.indexOf(
    record.status as (typeof incidentStates)[number],
  );
  const nextIncidentStatus =
    incidentStateIndex >= 0
      ? incidentStates[incidentStateIndex + 1]
      : undefined;
  async function action(path: string, body: object, method = "POST") {
    setError("");
    setSuccess("");
    setPending(true);
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setSuccess("Changes saved.");
      setConfirmation(null);
      result.refresh();
      teams.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const visible = Object.entries(record).filter(
    ([k]) => !["id", "session_version"].includes(k) && !k.endsWith("_id"),
  );
  return (
    <>
      <Link className="back-link" to={config.path}>
        <ArrowLeft size={15} />
        Back to {config.title.toLowerCase()}
      </Link>
      <PageTitle
        eyebrow={String(record.code ?? config.singular)}
        title={String(
          record.title ?? record.name ?? record.code ?? config.singular,
        )}
        action={
          <div className="action-row">
            {config.editPermission &&
              can(user.role, config.editPermission) &&
              (config.key !== "resource-requests" ||
                (record.status === "pending" &&
                  (record.requester_id === user.id ||
                    can(user.role, "requests.review")))) && (
                <Link
                  className="button secondary"
                  to={`${config.path}/${id}/edit`}
                >
                  <Pencil size={15} />
                  Edit
                </Link>
              )}
            {config.key === "allocations" &&
              can(user.role, "allocations.manage") &&
              Number(record.quantity) > Number(record.released_quantity) && (
                <ReturnDialog
                  id={id!}
                  outstanding={
                    Number(record.quantity) - Number(record.released_quantity)
                  }
                  onDone={() => {
                    setSuccess(
                      "Resources returned. Available inventory has been updated.",
                    );
                    result.refresh();
                  }}
                />
              )}
          </div>
        }
      >
        Created {new Date(String(record.created_at)).toLocaleString()}
      </PageTitle>
      {error && !confirmation && <Message>{error}</Message>}
      {success && <Message success>{success}</Message>}
      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          pending={pending}
          error={error}
          onClose={() => {
            setConfirmation(null);
            setError("");
          }}
          onConfirm={() => {
            void action(
              confirmation.path,
              confirmation.body,
              confirmation.method,
            );
          }}
        />
      )}
      <nav className="detail-section-nav" aria-label="Record sections">
        <a href="#overview">Overview</a>
        {details.assignments && <a href="#assignments">Assignments</a>}
        {details.allocations && <a href="#allocations">Allocations</a>}
        {details.movements && <a href="#movements">Stock movements</a>}
        <a href="#history">History</a>
      </nav>
      <div className="detail-grid" id="overview">
        <section className="panel panel-padding">
          <div className="panel-heading">
            <h2>
              {{
                incidents: "Incident assessment",
                resources: "Inventory position",
                "resource-requests": "Request assessment",
                allocations: "Deployment summary",
                teams: "Team profile",
              }[config.key] ?? "Overview"}
            </h2>
            {record.status !== undefined && <Badge value={record.status} />}
          </div>
          {["resources", "resource-requests", "allocations"].includes(
            config.key,
          ) && (
            <div className="record-snapshot">
              {(config.key === "resources"
                ? [
                    ["Total stock", record.total_quantity],
                    ["Available", record.available_quantity],
                    ["Allocated", record.allocated_quantity],
                  ]
                : config.key === "allocations"
                  ? [
                      ["Deployed", record.quantity],
                      ["Returned", record.released_quantity],
                      [
                        "Outstanding",
                        Number(record.quantity) -
                          Number(record.released_quantity),
                      ],
                    ]
                  : [
                      ["Requested", record.quantity],
                      ["Issued", record.issued_quantity],
                      [
                        "Unfulfilled",
                        Number(record.quantity) -
                          Number(record.issued_quantity),
                      ],
                    ]
              ).map(([label, value]) => (
                <div className="snapshot-metric" key={String(label)}>
                  <span>{String(label)}</span>
                  <strong>{Number(value ?? 0).toLocaleString()}</strong>
                </div>
              ))}
            </div>
          )}
          <dl className="detail-fields">
            {visible.map(([k, v]) => (
              <div
                key={k}
                className={
                  ["description", "justification", "metadata"].includes(k)
                    ? "span-two"
                    : ""
                }
              >
                <dt>{fieldLabel(k)}</dt>
                <dd>
                  <Cell column={k} value={v} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <aside className="panel panel-padding" id="operations">
          <h2>Operational actions</h2>
          <p className="muted small-text">
            Actions are available according to your role and the current
            workflow.
          </p>
          {config.key === "incidents" &&
            can(user.role, "incidents.manage") &&
            nextIncidentStatus && (
              <button
                className="button full"
                disabled={pending}
                onClick={() => {
                  void action(
                    `/incidents/${id}`,
                    { status: nextIncidentStatus },
                    "PATCH",
                  );
                }}
              >
                Move to {nextIncidentStatus}
              </button>
            )}
          {config.key === "incidents" &&
            !["resolved", "closed"].includes(String(record.status)) &&
            can(user.role, "requests.create") && (
              <Link
                className="button secondary full"
                to={`/resource-requests/new?incident_id=${id}`}
              >
                <Plus size={15} />
                Create resource request
              </Link>
            )}
          {config.key === "resource-requests" && (
            <>
              {can(user.role, "requests.review") &&
                record.status === "pending" && (
                  <button
                    className="button full"
                    disabled={pending}
                    onClick={() =>
                      void action(
                        `/resource-requests/${id}/status`,
                        { status: "under_review" },
                        "PATCH",
                      )
                    }
                  >
                    Start review
                  </button>
                )}
              {can(user.role, "requests.review") &&
                record.status === "under_review" && (
                  <form
                    className="form-stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const approved = f.get("status") === "approved";
                      setError("");
                      setConfirmation({
                        title: approved
                          ? "Approve this request?"
                          : "Reject this request?",
                        description: `${approved ? "This request will become eligible for allocation." : "This request will be closed without allocating stock."} Reason: ${String(f.get("reason"))}`,
                        path: `/resource-requests/${id}/status`,
                        body: {
                          status: f.get("status"),
                          reason: f.get("reason"),
                        },
                        method: "PATCH",
                      });
                    }}
                  >
                    <label>
                      Decision
                      <select name="status">
                        <option value="approved">Approve request</option>
                        <option value="rejected">Reject request</option>
                      </select>
                    </label>
                    <label>
                      Decision reason
                      <textarea
                        name="reason"
                        minLength={3}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <button className="button" disabled={pending}>
                      Save decision
                    </button>
                  </form>
                )}
              {["approved", "partially_fulfilled"].includes(
                String(record.status),
              ) &&
                can(user.role, "allocations.manage") && (
                  <Link
                    className="button full"
                    to={`/allocations/new?request_id=${id}`}
                  >
                    Allocate resources
                  </Link>
                )}
              {["pending", "under_review"].includes(String(record.status)) &&
                (can(user.role, "requests.review") ||
                  (record.status === "pending" &&
                    record.requester_id === user.id)) && (
                  <button
                    className="button secondary full"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setConfirmation({
                        title: "Cancel this request?",
                        description:
                          "The request will be closed and cannot be allocated. Its history will remain available.",
                        path: `/resource-requests/${id}/status`,
                        body: { status: "cancelled" },
                        method: "PATCH",
                      });
                    }}
                  >
                    Cancel request
                  </button>
                )}
            </>
          )}
          {config.key === "teams" &&
            can(user.role, "teams.manage") &&
            record.availability === "available" && (
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action(
                    `/incidents/${String(f.get("incident_id"))}/team-assignments`,
                    { team_id: id },
                  );
                }}
              >
                <label>
                  Assign to incident
                  <select
                    name="incident_id"
                    required
                    disabled={incidents.loading || pending}
                  >
                    <option value="">Select an incident</option>
                    {incidents.data?.data
                      .filter(
                        (i) =>
                          !["resolved", "closed"].includes(String(i.status)),
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {String(i.title)}
                        </option>
                      ))}
                  </select>
                </label>
                {incidents.error && <Message>{incidents.error}</Message>}
                <button
                  className="button"
                  disabled={pending || incidents.loading}
                >
                  Assign team
                </button>
              </form>
            )}
          {config.key === "resources" &&
            record.kind !== "asset" &&
            can(user.role, "resources.manage") && (
              <AdjustmentDialog
                record={record}
                onDone={() => {
                  setSuccess(
                    "Inventory adjusted. The movement has been recorded.",
                  );
                  result.refresh();
                }}
              />
            )}
          {config.key === "teams" && can(user.role, "teams.manage") && (
            <>
              {record.availability === "deployed" && (
                <p className="info-note">
                  This team is deployed. Complete its active assignment before
                  assigning another incident or marking it unavailable.
                </p>
              )}
              <button
                className="button secondary full"
                disabled={pending || record.availability === "deployed"}
                onClick={() => {
                  setError("");
                  setConfirmation({
                    title: "Update team availability?",
                    description:
                      record.status === "operational"
                        ? "The team will be unavailable for new assignments."
                        : "The team will be available for new assignments.",
                    path: `/teams/${id}`,
                    method: "PATCH",
                    body: {
                      name: record.name,
                      type_id: record.type_id,
                      lead_id: record.lead_id,
                      contact: record.contact ?? "",
                      status:
                        record.status === "operational"
                          ? "unavailable"
                          : "operational",
                      member_ids:
                        details.members?.map((member) => member.id) ?? [],
                    },
                  });
                }}
              >
                Mark{" "}
                {record.status === "operational" ? "unavailable" : "available"}
              </button>
            </>
          )}
          {config.key === "incidents" &&
            can(user.role, "teams.manage") &&
            !["resolved", "closed"].includes(String(record.status)) && (
              <form
                className="form-stack update-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void action(`/incidents/${id}/team-assignments`, {
                    team_id: data.get("team_id"),
                  });
                }}
              >
                <label>
                  Assign response team
                  <select
                    name="team_id"
                    required
                    disabled={teams.loading || pending}
                  >
                    <option value="">Select an available team</option>
                    {teams.data?.data
                      .filter((team) => team.availability === "available")
                      .map((team) => (
                        <option key={team.id} value={team.id}>
                          {String(team.name)} · {String(team.type)}
                        </option>
                      ))}
                  </select>
                </label>
                {teams.error && <Message>{teams.error}</Message>}
                {!teams.loading && !teams.error && !teams.data?.data.length && (
                  <p className="info-note">
                    No response teams are currently available.
                  </p>
                )}
                <button
                  className="button secondary"
                  disabled={
                    pending || teams.loading || !teams.data?.data.length
                  }
                >
                  Assign response team
                </button>
              </form>
            )}
          {["allocations", "resource-requests"].includes(config.key) &&
            record.incident_id !== undefined && (
              <Link
                className="button secondary full"
                to={`/incidents/${String(record.incident_id)}`}
              >
                View linked incident
              </Link>
            )}
          {config.key === "allocations" && (
            <Link
              className="button secondary full"
              to={`/resource-requests/${String(record.request_id)}`}
            >
              View approved request
            </Link>
          )}
          {config.key === "allocations" && (
            <Link
              className="button secondary full"
              to={`/resources/${String(record.resource_id)}`}
            >
              View resource inventory
            </Link>
          )}
          {config.key === "incidents" &&
            (user.role === "coordinator" || user.role === "field_officer") && (
              <form
                className="form-stack update-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action(`/incidents/${id}/updates`, {
                    note: f.get("note"),
                  });
                }}
              >
                <label>
                  Operational update
                  <textarea
                    name="note"
                    required
                    minLength={3}
                    maxLength={5000}
                  />
                </label>
                <button className="button secondary" disabled={pending}>
                  Add update
                </button>
              </form>
            )}
          {!["incidents", "resource-requests", "teams", "allocations"].includes(
            config.key,
          ) && (
            <div className="info-note">
              Changes to this record are recorded in the audit history.
            </div>
          )}
        </aside>
      </div>
      {details.assignments && (
        <section className="panel panel-padding" id="assignments">
          <h2>Team assignments</h2>
          {!details.assignments.length ? (
            <Empty title="No assignments yet" />
          ) : (
            <div className="assignment-list">
              {details.assignments.map((a) => (
                <div className="assignment-row" key={a.id}>
                  <div>
                    <strong>
                      <Link
                        to={
                          config.key === "teams"
                            ? `/incidents/${String(a.incident_id)}`
                            : `/teams/${String(a.team_id)}`
                        }
                      >
                        {String(a.team ?? a.incident ?? "Assignment")}
                      </Link>
                    </strong>
                    <small>
                      {new Date(String(a.created_at)).toLocaleString()}
                    </small>
                  </div>
                  <Badge value={a.status} />
                  {Boolean(a.can_advance) &&
                    !["completed", "cancelled"].includes(String(a.status)) && (
                      <>
                        <button
                          className="button secondary"
                          disabled={pending}
                          onClick={() =>
                            void action(
                              `/team-assignments/${a.id}`,
                              {
                                status: (
                                  {
                                    assigned: "responding",
                                    responding: "on_scene",
                                    on_scene: "completed",
                                  } as Record<string, string>
                                )[String(a.status)],
                              },
                              "PATCH",
                            )
                          }
                        >
                          Advance status
                        </button>
                        {can(user.role, "teams.manage") && (
                          <button
                            className="text-button"
                            disabled={pending}
                            onClick={() =>
                              void action(
                                `/team-assignments/${a.id}`,
                                { status: "cancelled" },
                                "PATCH",
                              )
                            }
                          >
                            Cancel assignment
                          </button>
                        )}
                      </>
                    )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {(
        ["requests", "allocations", "releases", "movements", "members"] as const
      ).map(
        (key) =>
          details[key] && (
            <section key={key} id={key} className="panel">
              <div className="panel-heading panel-padding">
                <h2>{fieldLabel(key)}</h2>
                <span className="badge">{details[key].length}</span>
              </div>
              {details[key].length ? (
                <RecordTable
                  rows={details[key]}
                  columns={
                    key === "requests"
                      ? ["code", "status", "quantity", "issued_quantity"]
                      : key === "allocations"
                        ? [
                            "code",
                            "incident",
                            "quantity",
                            "released_quantity",
                            "created_at",
                          ]
                        : key === "releases"
                          ? ["quantity", "reason", "created_at"]
                          : key === "members"
                            ? ["name"]
                            : ["action", "quantity_delta", "created_at"]
                  }
                  path={
                    key === "requests"
                      ? "/resource-requests"
                      : key === "allocations"
                        ? "/allocations"
                        : undefined
                  }
                />
              ) : (
                <Empty title={`No ${key} yet`} />
              )}
            </section>
          ),
      )}
      <section className="panel panel-padding" id="history">
        <h2>
          {config.key === "resources"
            ? "Inventory audit history"
            : config.key === "teams"
              ? "Team and assignment history"
              : config.key === "resource-requests"
                ? "Request decision history"
                : config.key === "allocations"
                  ? "Allocation history"
                  : "Incident timeline and status history"}
        </h2>
        {details.history?.length ? (
          <div className="activity-timeline">
            {details.history.map((h) => (
              <div key={h.id}>
                <span className="timeline-dot" />
                <strong>{String(h.actor)}</strong>
                <p>
                  {h.next_status
                    ? `${String(h.previous_status ?? "Created")} → ${String(h.next_status)}`
                    : String(h.note ?? h.action)}
                </p>
                {Boolean(h.next_status && h.note) && <p>{String(h.note)}</p>}
                <small>{new Date(String(h.created_at)).toLocaleString()}</small>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No status changes yet" />
        )}
      </section>
    </>
  );
}
