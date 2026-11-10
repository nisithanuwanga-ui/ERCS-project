import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
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
          : "Provide clear information to keep your response coordinated."}
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
        <form className="panel editor-form" onSubmit={submit}>
          {error && <Message>{error}</Message>}
          <div className="form-section-heading">
            <span className="section-number">01</span>
            <div>
              <h2>{config.singular} information</h2>
              <p>Required fields are marked with an asterisk.</p>
            </div>
          </div>
          <div className="form-grid">
            {fields.map((field) => (
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
                      setValues((v) => ({ ...v, [field.key]: value }))
                    }
                    recordId={
                      config.key === "allocations" ? "allocation" : undefined
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
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
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
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
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
                    min={field.min}
                    max={field.max}
                    maxLength={field.type === "number" ? undefined : 160}
                    value={String(values[field.key] ?? "")}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                  />
                )}{" "}
                {field.hint && <small>{field.hint}</small>}
              </div>
            ))}
          </div>
          {config.key === "allocations" && (
            <div className="info-note">
              Allocation checks the approved outstanding demand, resource
              eligibility, and current availability together. Retries of this
              submission use the same operation key.
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
      )}
    </>
  );
}
