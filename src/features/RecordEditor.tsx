import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { can } from "../../shared/domain";
import type { RecordData } from "../../shared/domain";
import { useAuth } from "../app/useAuth";
import { api } from "../services/api";
import { Loading, Message, PageTitle } from "../components/ui";
import { useApi } from "../hooks/useApi";
import type { Field, ModuleConfig } from "./modules";
interface Detail {
  data: RecordData;
  details?: { members?: RecordData[] };
}
function SelectField({
  field,
  value,
  onChange,
  recordId,
  requestId,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  recordId?: string;
  requestId?: string;
}) {
  const [search, setSearch] = useState("");
  const searchable = ["requests", "resources", "incidents"].includes(
    field.source ?? "",
  );
  let path =
    field.source === "people"
      ? "/people"
      : field.source === "requests"
        ? "/resource-requests?pageSize=100&eligible=true"
        : field.source === "incidents"
          ? "/incidents?pageSize=100"
          : field.source === "resources"
            ? "/resources?pageSize=100"
            : "/reference-data";
  if (searchable) path += `&q=${encodeURIComponent(search)}`;
  if (requestId && field.source === "resources")
    path += `&request_id=${encodeURIComponent(requestId)}`;
  const result = useApi<{ data: RecordData[] }>(path);
  let options = result.data?.data ?? [];
  if (
    ["incident_category", "resource_category", "team_type"].includes(
      field.source ?? "",
    )
  )
    options = options.filter(
      (x) => x.kind === field.source && (x.active || x.id === value),
    );
  if (field.source === "requests")
    options = options.filter((x) =>
      ["approved", "partially_fulfilled"].includes(String(x.status)),
    );
  if (field.source === "incidents")
    options = options.filter(
      (x) =>
        !["resolved", "closed"].includes(String(x.status)) || x.id === value,
    );
  if (field.source === "resources" && recordId)
    options = options.filter((x) => x.status === "operational");
  return (
    <>
      {searchable && (
        <input
          type="search"
          aria-label={`Search ${field.source} options`}
          placeholder="Filter choices by name or code…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange("");
          }}
        />
      )}
      {result.error ? (
        <Message>{result.error}</Message>
      ) : (
        <select
          id={`field-${field.key}`}
          name={field.key}
          required={field.required}
          multiple={field.type === "multiselect"}
          disabled={result.loading}
          value={
            field.type === "multiselect"
              ? ((value as string[]) ?? [])
              : String(value ?? "")
          }
          onChange={(e) =>
            onChange(
              field.type === "multiselect"
                ? Array.from(e.target.selectedOptions, (o) => o.value)
                : e.target.value,
            )
          }
        >
          {field.type !== "multiselect" && (
            <option value="">
              {result.loading ? "Loading options…" : "Select an option"}
            </option>
          )}
          {options.map((x) => (
            <option key={x.id} value={x.id}>
              {String(x.title ?? x.name ?? x.code)}
              {x.available_quantity !== undefined
                ? ` · ${x.available_quantity} available`
                : ""}
              {x.quantity !== undefined
                ? ` · ${Number(x.quantity) - Number(x.issued_quantity)} outstanding`
                : ""}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
export function RecordEditor({
  config,
  edit = false,
}: {
  config: ModuleConfig;
  edit?: boolean;
}) {
  const { id } = useParams();
  const { user } = useAuth();
  const permission = edit ? config.editPermission : config.createPermission;
  const result = useApi<Detail>(edit ? `/${config.key}/${id}` : "/profile");
  if (!user || !permission || !can(user.role, permission))
    return <Navigate to="/403" replace />;
  if (edit && result.loading) return <Loading />;
  if (edit && result.error) return <Message>{result.error}</Message>;
  if (
    edit &&
    config.key === "resource-requests" &&
    result.data &&
    (result.data.data.status !== "pending" ||
      (result.data.data.requester_id !== user.id &&
        !can(user.role, "requests.review")))
  )
    return (
      <Message>
        Only pending requests belonging to you can be edited. Coordinators can
        also edit pending requests.
      </Message>
    );
  return (
    <EditorForm
      key={`${config.key}-${id ?? "new"}`}
      config={config}
      id={edit ? id : undefined}
      initial={edit ? result.data : undefined}
    />
  );
}
function EditorForm({
  config,
  id,
  initial,
}: {
  config: ModuleConfig;
  id?: string;
  initial?: Detail;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...(config.key === "resource-requests"
      ? { incident_id: params.get("incident_id") ?? "" }
      : {}),
    ...(config.key === "allocations"
      ? { request_id: params.get("request_id") ?? "" }
      : {}),
    ...initial?.data,
    member_ids: initial?.details?.members?.map((x) => x.id) ?? [],
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState("");
  const [operationKey] = useState(() => crypto.randomUUID());
  const fields =
    config.key === "users" && id
      ? ([
          { key: "name", label: "Display name", required: true },
          {
            key: "role",
            label: "Role",
            type: "select",
            options: [
              "administrator",
              "coordinator",
              "resource_manager",
              "field_officer",
              "viewer",
            ],
            required: true,
          },
          { key: "active", label: "Account active", type: "checkbox" },
        ] as Field[])
      : config.fields;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.key];
      if (field.type === "number") body[field.key] = Number(value ?? 0);
      else if (field.type === "checkbox") body[field.key] = Boolean(value);
      else if (field.type === "multiselect") body[field.key] = value ?? [];
      else if (
        field.key === "resource_id" ||
        (field.key === "category_id" && config.key === "resource-requests")
      )
        body[field.key] = value || null;
      else body[field.key] = value ?? "";
    }
    if (
      config.key === "resource-requests" &&
      Boolean(body.resource_id) === Boolean(body.category_id)
    ) {
      setError(
        "Select a specific resource or a resource category. Choose one so the request can be fulfilled correctly.",
      );
      setPending(false);
      return;
    }
    if (
      config.key === "resources" &&
      body.kind === "asset" &&
      body.total_quantity !== 1
    ) {
      setError("An indivisible asset must have a total quantity of one.");
      setPending(false);
      return;
    }
    try {
      const r = await api<{ data: RecordData & { token?: string } }>(
        `/${config.key}${id ? `/${id}` : ""}`,
        {
          method: id ? "PATCH" : "POST",
          headers:
            config.key === "allocations"
              ? { "Idempotency-Key": operationKey }
              : {},
          body: JSON.stringify(body),
        },
      );
      if (r.data.token) {
        setInvitation(
          `${window.location.origin}/register?token=${encodeURIComponent(r.data.token)}`,
        );
        return;
      }
      navigate(`${config.path}/${r.data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const guidance: Record<
    string,
    { title: string; copy: string; steps: string[] }
  > = {
    incidents: {
      title: "Build the operational picture",
      copy: "Describe the event, assess the impact, and pinpoint where the response is needed.",
      steps: [
        "Report and assess",
        "Assign response teams",
        "Track to resolution",
      ],
    },
    resources: {
      title: "Register response capacity",
      copy: "Record accurate quantities and a storage location. The minimum threshold will flag stock that needs attention.",
      steps: [
        "Identify the resource",
        "Set stock and readiness",
        "Monitor movements",
      ],
    },
    "resource-requests": {
      title: "Connect demand to an incident",
      copy: "Request a specific resource or an eligible category. A coordinator reviews each request before resources can be allocated.",
      steps: [
        "Describe the need",
        "Coordinator review",
        "Allocate approved stock",
      ],
    },
    allocations: {
      title: "Deploy approved resources",
      copy: "Select an approved request, choose eligible stock, and enter the quantity to deploy. Partial fulfillment is supported.",
      steps: [
        "Choose approved demand",
        "Check eligible availability",
        "Track deployment and returns",
      ],
    },
    teams: {
      title: "Prepare a response unit",
      copy: "Choose a team type, an active leader, and authorized members. Available teams can then be assigned to an incident.",
      steps: ["Define the team", "Choose personnel", "Manage assignments"],
    },
  };
  const context = guidance[config.key];
  const sectionDefinitions: Record<string, [string, string[]][]> = {
    incidents: [
      ["Event details", ["title", "category_id", "description"]],
      ["Impact and response priority", ["severity", "priority", "location"]],
    ],
    resources: [
      ["Resource identity", ["name", "category_id", "description", "kind"]],
      [
        "Stock and readiness",
        ["total_quantity", "threshold", "status", "location"],
      ],
    ],
    "resource-requests": [
      [
        "Incident and demand",
        ["incident_id", "resource_id", "category_id", "quantity"],
      ],
      ["Priority and justification", ["priority", "justification"]],
    ],
    allocations: [
      ["Approved demand", ["request_id"]],
      ["Resource deployment", ["resource_id", "quantity"]],
    ],
    teams: [
      ["Team profile", ["name", "type_id", "contact", "status"]],
      ["Authorized personnel", ["lead_id", "member_ids"]],
    ],
  };
  const sections = (
    sectionDefinitions[config.key] ?? [
      [`${config.singular} information`, fields.map((field) => field.key)],
    ]
  ).map(([title, keys]) => ({
    title,
    fields: fields.filter((field) => keys.includes(field.key)),
  }));
  return (
    <>
      <Link className="back-link" to={config.path}>
        <ArrowLeft size={15} />
        Back to {config.title.toLowerCase()}
      </Link>
      <PageTitle
        title={
          config.key === "users" && !id
            ? "Invite authorized personnel"
            : `${id ? "Edit" : "Create"} ${config.singular.toLowerCase()}`
        }
      >
        {config.key === "users" && !id
          ? "The role is assigned here. Your invitation expires in 48 hours."
          : (context?.copy ??
            "Provide clear information to keep your response coordinated.")}
      </PageTitle>
      {invitation ? (
        <section className="panel panel-padding">
          <span className="icon-circle teal">
            <CheckCircle2 />
          </span>
          <h2>Invitation created</h2>
          <p>
            Share this link privately with the intended recipient. It is shown
            only now and grants access to the assigned role.
          </p>
          <label>
            Activation link
            <input
              readOnly
              value={invitation}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Link className="button" to="/admin/users">
            Back to user management
          </Link>
        </section>
      ) : (
        <div className="workflow-editor-layout">
          <form
            className="panel editor-form"
            onSubmit={submit}
            aria-busy={pending}
          >
            {error && <Message>{error}</Message>}
            <p className="muted small-text">
              Required fields are marked with an asterisk.
            </p>
            {sections.map((section, index) => (
              <section className="workflow-step" key={section.title}>
                <div className="form-section-heading">
                  <span className="section-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2>{section.title}</h2>
                  </div>
                </div>
                <div className="form-grid">
                  {section.fields.map((field) => (
                    <div
                      key={field.key}
                      className={
                        field.type === "textarea"
                          ? "span-two"
                          : field.type === "checkbox"
                            ? "checkbox"
                            : ""
                      }
                    >
                      <label htmlFor={`field-${field.key}`}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                      {field.source ? (
                        <SelectField
                          field={field}
                          value={values[field.key]}
                          onChange={(value) =>
                            setValues((v) => ({
                              ...v,
                              ...(config.key === "allocations" &&
                              field.key === "request_id"
                                ? { resource_id: "" }
                                : {}),
                              ...(config.key === "resource-requests" &&
                              value &&
                              field.key === "resource_id"
                                ? { category_id: "" }
                                : {}),
                              ...(config.key === "resource-requests" &&
                              value &&
                              field.key === "category_id"
                                ? { resource_id: "" }
                                : {}),
                              [field.key]: value,
                            }))
                          }
                          recordId={
                            config.key === "allocations"
                              ? "allocation"
                              : undefined
                          }
                          requestId={
                            config.key === "allocations"
                              ? String(values.request_id ?? "")
                              : undefined
                          }
                        />
                      ) : field.type === "select" ? (
                        <select
                          id={`field-${field.key}`}
                          name={field.key}
                          required={field.required}
                          value={String(values[field.key] ?? "")}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [field.key]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((option) => (
                            <option value={option} key={option}>
                              {option.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          id={`field-${field.key}`}
                          name={field.key}
                          required={field.required}
                          minLength={field.min}
                          maxLength={5000}
                          value={String(values[field.key] ?? "")}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      ) : field.type === "checkbox" ? (
                        <input
                          id={`field-${field.key}`}
                          name={field.key}
                          type="checkbox"
                          checked={Boolean(values[field.key])}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [field.key]: e.target.checked,
                            }))
                          }
                        />
                      ) : (
                        <input
                          id={`field-${field.key}`}
                          name={field.key}
                          type={field.type ?? "text"}
                          required={field.required}
                          min={
                            field.key === "total_quantity" && id
                              ? Number(
                                  initial?.data.allocated_quantity ??
                                    field.min ??
                                    0,
                                )
                              : field.min
                          }
                          max={field.max}
                          step={field.type === "number" ? 1 : undefined}
                          maxLength={field.type === "number" ? undefined : 160}
                          value={String(values[field.key] ?? "")}
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      )}{" "}
                      {field.hint && <small>{field.hint}</small>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {config.key === "allocations" && (
              <div className="info-note">
                Only approved outstanding demand can be allocated. Availability
                is checked again when you save. You can allocate a smaller
                quantity and fulfill the remainder later.
              </div>
            )}
            <div className="form-actions">
              <Link className="button secondary" to={config.path}>
                Cancel
              </Link>
              <button className="button" disabled={pending}>
                {pending
                  ? "Saving…"
                  : id
                    ? "Save changes"
                    : config.key === "users"
                      ? "Create invitation"
                      : `Create ${config.singular.toLowerCase()}`}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
          {context && (
            <aside className="panel panel-padding workflow-form-context">
              <span className="eyebrow">{config.singular} workflow</span>
              <h2>{context.title}</h2>
              <p>{context.copy}</p>
              <ol className="workflow-progress">
                {context.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {config.key === "resources" && (
                <p className="info-note">
                  Allocated quantities stay reserved. Stock adjustments cannot
                  reduce total quantity below outstanding allocations.
                </p>
              )}
              {config.key === "teams" && (
                <p className="info-note">
                  A team can have one active assignment at a time. Complete its
                  deployment before marking it unavailable.
                </p>
              )}
              {config.key === "resource-requests" && (
                <p className="info-note">
                  Requests begin as pending. Record the quantity and operational
                  justification so the coordinator can make a clear decision.
                </p>
              )}
            </aside>
          )}
        </div>
      )}
    </>
  );
}
