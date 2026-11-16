import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Truck,
  Users,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { can, priorities } from "../../shared/domain";
import type { PageResult, Permission, RecordData } from "../../shared/domain";
import { useAuth } from "../app/useAuth";
import { Badge, Empty, Loading, Message, PageTitle } from "../components/ui";
import { useApi } from "../hooks/useApi";
import { Cell } from "./RecordList";
import { modules } from "./modules";

interface Point {
  name: string;
  value: number;
}
interface Summary {
  data: {
    counts: Record<string, number>;
    distribution: Point[];
    secondary: Point[];
    activity: { date: string; quantity: number; released: number }[];
  };
}
type Workspace = ReturnType<typeof useWorkspace>;
function useWorkspace(key: string) {
  const [params, setParams] = useSearchParams();
  const list = useApi<PageResult>(`/${key}?${params}`);
  const summary = useApi<Summary>(`/${key}/summary`);
  const references = useApi<{ data: RecordData[] }>("/reference-data");
  const { user } = useAuth();
  function update(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (name !== "page") next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }
  return {
    key,
    params,
    update,
    list,
    summary,
    references,
    user,
    reset: () => setParams(new URLSearchParams()),
    refresh: () => {
      list.refresh();
      summary.refresh();
      references.refresh();
    },
    allowed: (permission: Permission) => !!user && can(user.role, permission),
    count: (name: string) =>
      summary.data
        ? Number(summary.data.data.counts[name] ?? 0).toLocaleString()
        : "—",
  };
}
function Header({
  w,
  eyebrow,
  action,
  children,
}: {
  w: Workspace;
  eyebrow: string;
  action: string;
  children: ReactNode;
}) {
  const config = modules[w.key];
  return (
    <PageTitle
      title={config.title}
      eyebrow={eyebrow}
      action={
        <div className="management-actions">
          <button
            className="button secondary"
            onClick={w.refresh}
            disabled={w.list.loading || w.summary.loading}
          >
            <RefreshCw size={17} />
            Refresh data
          </button>
          {config.createPermission && w.allowed(config.createPermission) && (
            <Link className="button" to={`${config.path}/new`}>
              <Plus size={18} />
              {action}
            </Link>
          )}
        </div>
      }
    >
      {children}
    </PageTitle>
  );
}
function Metrics({
  w,
  items,
}: {
  w: Workspace;
  items: {
    key: string;
    label: string;
    note: string;
    filter?: string;
    icon: ReactNode;
    tone?: string;
  }[];
}) {
  return (
    <>
      <div
        className="module-metrics"
        style={{ "--metric-count": items.length } as CSSProperties}
      >
        {items.map((item) => (
          <Link
            className={`module-metric ${item.tone ?? "blue"}`}
            to={`${modules[w.key].path}${item.filter ? `?${item.filter}` : ""}`}
            key={item.key}
          >
            <span className="metric-top">
              {item.label}
              <span className="metric-icon">{item.icon}</span>
            </span>
            <strong>{w.count(item.key)}</strong>
            <span className="metric-bottom">
              {item.note}
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
      {w.summary.error && (
        <Message>{w.summary.error} Use Refresh data to retry.</Message>
      )}
    </>
  );
}
function Chart({
  title,
  subtitle,
  points: loadedPoints,
  donut = false,
}: {
  title: string;
  subtitle: string;
  points?: Point[];
  donut?: boolean;
}) {
  const points = loadedPoints ?? [];
  const total = points.reduce((n, p) => n + Number(p.value), 0);
  const colors = [
    "#2563eb",
    "#0d9488",
    "#f59e0b",
    "#e15b64",
    "#7c6bd6",
    "#64748b",
  ];
  const gradient = points
    .reduce<{ segments: string[]; cursor: number }>(
      (acc, p, i) => {
        const span = total ? (Number(p.value) / total) * 100 : 0;
        const next = acc.cursor + span;
        const color = colors[i % colors.length];
        return {
          segments: [...acc.segments, `${color} ${acc.cursor}% ${next}%`],
          cursor: next,
        };
      },
      { segments: [], cursor: 0 },
    )
    .segments.join(",");
  return (
    <section
      className={`panel module-chart ${donut ? "with-donut" : ""}`}
      aria-label={title}
    >
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {loadedPoints === undefined ? (
        <div className="chart-no-data" role="status">
          Loading live summary…
        </div>
      ) : total === 0 ? (
        <div className="chart-no-data">No activity recorded yet.</div>
      ) : (
        <div className="module-chart-body">
          {donut && (
            <div
              className="module-donut"
              role="img"
              aria-label={`${title}: ${points.map((p) => `${p.name} ${p.value}`).join(", ")}`}
              style={{ background: `conic-gradient(${gradient})` }}
            >
              <span>
                <strong>{total.toLocaleString()}</strong>
                <small>total</small>
              </span>
            </div>
          )}
          <div className="module-bars">
            {points.map((p, i) => (
              <div className="module-bar" key={p.name}>
                <div>
                  <span>
                    <i style={{ background: colors[i % colors.length] }} />
                    {p.name.replaceAll("_", " ")}
                  </span>
                  <strong>{Number(p.value).toLocaleString()}</strong>
                </div>
                {!donut && (
                  <div className="module-bar-track">
                    <span
                      style={{
                        width: `${(Number(p.value) / Math.max(...points.map((x) => Number(x.value)), 1)) * 100}%`,
                        background: colors[i % colors.length],
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
function Select({
  w,
  name,
  label,
  options,
}: {
  w: Workspace;
  name: string;
  label: string;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label>
      {label}
      <select
        value={w.params.get(name) ?? ""}
        onChange={(e) => w.update(name, e.target.value)}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          return (
            <option key={value} value={value}>
              {typeof o === "string" ? o.replaceAll("_", " ") : o.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
function ReferenceFilter({
  w,
  name = "category_id",
  label,
  kind,
}: {
  w: Workspace;
  name?: string;
  label: string;
  kind: string;
}) {
  return (
    <Select
      w={w}
      name={name}
      label={label}
      options={(w.references.data?.data ?? [])
        .filter((r) => r.kind === kind)
        .map((r) => ({ value: r.id, label: String(r.name) }))}
    />
  );
}
function RemoteFilter({
  w,
  name,
  label,
  endpoint,
}: {
  w: Workspace;
  name: string;
  label: string;
  endpoint: string;
}) {
  const term = w.params.get(`${name}_search`) ?? "";
  const options = useApi<{ data: RecordData[] }>(
    `${endpoint}${endpoint.includes("?") ? "&" : "?"}pageSize=100&q=${encodeURIComponent(term)}`,
  );
  return (
    <div className="remote-filter">
      <label>
        {label}
        <input
          type="search"
          aria-label={`Find ${label.toLowerCase()} filter options`}
          placeholder="Find options…"
          key={term}
          defaultValue={term}
          onBlur={(e) => {
            if (e.target.value !== term)
              w.update(`${name}_search`, e.target.value);
          }}
        />
      </label>
      <Select
        w={w}
        name={name}
        label={`${label} selection`}
        options={(options.data?.data ?? []).map((r) => ({
          value: r.id,
          label: String(r.title ?? r.name ?? r.code),
        }))}
      />
      {options.error && (
        <span role="alert" className="filter-error">
          {options.error}
        </span>
      )}
    </div>
  );
}
function TextFilter({
  w,
  name,
  label,
  placeholder,
}: {
  w: Workspace;
  name: string;
  label: string;
  placeholder?: string;
}) {
  const value = w.params.get(name) ?? "";
  return (
    <label>
      {label}
      <input
        key={value}
        defaultValue={value}
        placeholder={placeholder ?? `Any ${label.toLowerCase()}`}
        onBlur={(e) => {
          if (e.target.value !== value) w.update(name, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            w.update(name, e.currentTarget.value);
          }
        }}
      />
    </label>
  );
}
function Dates({ w }: { w: Workspace }) {
  return (
    <>
      {["from", "to"].map((name) => (
        <label key={name}>
          {name === "from"
            ? ({
                incidents: "Reported from",
                "resource-requests": "Requested from",
                allocations: "Allocated from",
              }[w.key] ?? "Created from")
            : "Through date"}
          <input
            type="date"
            aria-label={name === "from" ? "From date" : "To date"}
            value={w.params.get(name) ?? ""}
            onChange={(e) => w.update(name, e.target.value)}
          />
        </label>
      ))}
    </>
  );
}
function Filters({
  w,
  placeholder,
  children,
}: {
  w: Workspace;
  placeholder: string;
  children: ReactNode;
}) {
  const q = w.params.get("q") ?? "";
  const applied = [...w.params.keys()].filter(
    (k) => !["page", "pageSize", "sort"].includes(k) && !k.endsWith("_search"),
  ).length;
  return (
    <section className="panel module-filters">
      <div className="module-search-row">
        <form
          className="module-search"
          onSubmit={(e) => {
            e.preventDefault();
            w.update("q", String(new FormData(e.currentTarget).get("q") ?? ""));
          }}
        >
          <Search size={19} />
          <input
            type="search"
            name="q"
            aria-label={`Search ${modules[w.key].title}`}
            placeholder={placeholder}
            defaultValue={q}
            key={q}
          />
          <button className="button secondary" type="submit">
            Search
          </button>
        </form>
        <button className="text-button reset-filters" onClick={w.reset}>
          <X size={15} />
          Reset filters
          {applied > 0 && <span className="filter-count">{applied}</span>}
        </button>
      </div>
      <details className="module-filter-details" open>
        <summary>
          <SlidersHorizontal size={16} />
          Workspace filters<span>Refine your operational view</span>
        </summary>
        <div className="module-filter-grid">{children}</div>
        {w.references.error && (
          <Message>
            {w.references.error} Refresh data to reload filter options.
          </Message>
        )}
      </details>
    </section>
  );
}
interface Column {
  key: string;
  label: string;
  render?: (r: RecordData) => ReactNode;
}
function Results({
  w,
  title,
  columns,
  children,
}: {
  w: Workspace;
  title: string;
  columns?: Column[];
  children?: ReactNode;
}) {
  const page = Number(w.params.get("page") ?? 1);
  const total = w.list.data?.meta.total ?? 0;
  const pageSize =
    w.list.data?.meta.pageSize ?? Number(w.params.get("pageSize") ?? 15);
  return (
    <section className="panel module-results">
      <div className="module-results-heading">
        <div>
          <h2>
            {title}
            <span className="result-total">
              {w.list.loading ? "…" : total.toLocaleString()}
            </span>
          </h2>
          <p>
            {w.params.size
              ? "Records matching your current view"
              : "Latest records across your authorized workspace"}
          </p>
        </div>
        <label className="module-sort">
          Sort by
          <select
            aria-label="Sort records"
            value={w.params.get("sort") ?? "newest"}
            onChange={(e) => w.update("sort", e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {w.list.loading ? (
        <Loading />
      ) : w.list.error ? (
        <div className="panel-padding">
          <Message>{w.list.error}</Message>
          <button className="button secondary" onClick={w.refresh}>
            Retry loading
          </button>
        </div>
      ) : !w.list.data?.data.length ? (
        <Empty
          title={
            w.params.size
              ? "No matching records"
              : `No ${modules[w.key].title.toLowerCase()} yet`
          }
        >
          Create your first record or adjust the filters to broaden this view.
        </Empty>
      ) : (
        (children ?? (
          <div
            className="table-scroll"
            role="region"
            aria-label={`${title} table, scroll horizontally for all columns`}
            tabIndex={0}
          >
            <table className="management-table">
              <thead>
                <tr>
                  {columns?.map((c) => (
                    <th scope="col" key={c.key}>
                      {c.label}
                    </th>
                  ))}
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {w.list.data.data.map((row) => (
                  <tr key={row.id}>
                    {columns?.map((c, index) => (
                      <td
                        key={c.key}
                        className={index === 0 ? "primary-cell" : ""}
                      >
                        {c.render ? (
                          c.render(row)
                        ) : index === 0 ? (
                          <Link to={`${modules[w.key].path}/${row.id}`}>
                            {String(row[c.key] ?? "—")}
                          </Link>
                        ) : (
                          <Cell column={c.key} value={row[c.key]} />
                        )}
                      </td>
                    ))}
                    <td>
                      <RowActions w={w} row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
      <div className="module-pagination">
        <label>
          Rows per page
          <select
            aria-label="Rows per page"
            value={w.params.get("pageSize") ?? "15"}
            onChange={(e) => w.update("pageSize", e.target.value)}
          >
            {[15, 30, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <span>
          {total
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
            : "0 records"}{" "}
          · Page {page}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={page <= 1 || w.list.loading}
            onClick={() => w.update("page", String(page - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={page * pageSize >= total || w.list.loading}
            onClick={() => w.update("page", String(page + 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
function RowActions({ w, row }: { w: Workspace; row: RecordData }) {
  const path = `${modules[w.key].path}/${row.id}`;
  const config = modules[w.key];
  return (
    <div className="module-row-actions">
      <Link
        to={path}
        className="text-link"
        aria-label={`View ${String(row.code ?? row.name)}`}
      >
        View details
        <ArrowRight size={14} />
      </Link>
      {config.editPermission &&
        w.allowed(config.editPermission) &&
        (w.key !== "resource-requests" ||
          (row.status === "pending" &&
            (row.requester_id === w.user?.id ||
              w.allowed("requests.review")))) && (
          <Link to={`${path}/edit`}>Edit</Link>
        )}
      {w.key === "resource-requests" &&
        w.allowed("requests.review") &&
        ["pending", "under_review"].includes(String(row.status)) && (
          <Link to={`${path}/review`}>Review request</Link>
        )}
      {w.key === "allocations" &&
        w.allowed("allocations.manage") &&
        Number(row.outstanding_quantity) > 0 && (
          <Link to={`${path}#operations`}>Release resources</Link>
        )}
      {w.key === "resources" && (
        <Link to={`${path}#movements`}>Stock history</Link>
      )}
      {w.key === "incidents" && w.allowed("incidents.manage") && (
        <Link to={`${path}#operations`}>Update status / assign</Link>
      )}
    </div>
  );
}
function Availability({ row }: { row: RecordData }) {
  const total = Number(row.total_quantity);
  const available = Number(row.available_quantity);
  const low = available <= Number(row.threshold);
  return (
    <div className={`inventory-availability ${low ? "is-low" : ""}`}>
      <strong>
        {available.toLocaleString()} <small>of {total.toLocaleString()}</small>
      </strong>
      <progress
        aria-label={`${String(row.name)} available quantity`}
        value={available}
        max={Math.max(total, 1)}
      />
      {low && (
        <span>
          <AlertTriangle size={12} />
          Low stock
        </span>
      )}
    </div>
  );
}

export function IncidentsWorkspace() {
  const w = useWorkspace("incidents");
  return (
    <div className="management-workspace incident-workspace">
      <Header w={w} eyebrow="Incident command" action="New incident">
        A clear operational picture. Coordinate teams, track escalation, and
        bring every incident to resolution.
      </Header>
      <Metrics
        w={w}
        items={[
          {
            key: "total",
            label: "Total incidents",
            note: "All reported incidents",
            icon: <Activity />,
          },
          {
            key: "active",
            label: "Active incidents",
            note: "Response in progress",
            filter: "status=open",
            icon: <Clock3 />,
            tone: "teal",
          },
          {
            key: "critical",
            label: "Critical incidents",
            note: "Immediate attention",
            filter: "severity=critical&status=open",
            icon: <AlertTriangle />,
            tone: "red",
          },
          {
            key: "resolved",
            label: "Resolved incidents",
            note: "Response completed",
            filter: "status=completed",
            icon: <CheckCircle2 />,
            tone: "violet",
          },
        ]}
      />
      <div className="incident-insights">
        <div className="command-brief">
          <span className="module-kicker">
            <Shield size={17} />
            Command brief
          </span>
          <h2>
            From first report
            <br />
            to coordinated response.
          </h2>
          <p>
            Open an incident to update its status, assign a response team, or
            request the supplies needed on the ground.
          </p>
          <div className="command-stages">
            <span>01 Report</span>
            <ArrowRight size={14} />
            <span>02 Respond</span>
            <ArrowRight size={14} />
            <span>03 Resolve</span>
          </div>
        </div>
        <Chart
          title="Incident priority distribution"
          subtitle="All authorized incidents · live totals"
          points={w.summary.data?.data.distribution}
        />
        <Chart
          title="Severity overview"
          subtitle="Impact across the response area"
          points={w.summary.data?.data.secondary}
          donut
        />
      </div>
      <Filters w={w} placeholder="Search incident ID, title, or location…">
        <ReferenceFilter w={w} label="Incident type" kind="incident_category" />
        <Select
          w={w}
          name="severity"
          label="Severity"
          options={[...priorities]}
        />
        <Select
          w={w}
          name="priority"
          label="Priority"
          options={[...priorities]}
        />
        <Select
          w={w}
          name="status"
          label="Status"
          options={modules.incidents.statuses!.map((value) => ({
            value,
            label:
              value === "completed"
                ? "Resolved and closed"
                : value === "open"
                  ? "All unresolved"
                  : value,
          }))}
        />
        <TextFilter w={w} name="location" label="Location" />
        <RemoteFilter
          w={w}
          name="team_id"
          label="Assigned team"
          endpoint="/teams"
        />
        <Dates w={w} />
      </Filters>
      <Results
        w={w}
        title="Incident register"
        columns={[
          { key: "code", label: "Incident ID" },
          { key: "title", label: "Title" },
          { key: "category", label: "Category" },
          { key: "severity", label: "Severity" },
          { key: "priority", label: "Priority" },
          { key: "status", label: "Status" },
          { key: "location", label: "Location" },
          { key: "created_at", label: "Reported date" },
          { key: "assigned_team", label: "Assigned team" },
        ]}
      />
    </div>
  );
}
export function InventoryWorkspace() {
  const w = useWorkspace("resources");
  return (
    <div className="management-workspace inventory-workspace">
      <Header w={w} eyebrow="Supply & readiness" action="New resource">
        Know what is ready, where it is stored, and how much remains available
        for the next response.
      </Header>
      <Metrics
        w={w}
        items={[
          {
            key: "total_quantity",
            label: "Total inventory",
            note: "Units across all resources",
            icon: <Boxes />,
          },
          {
            key: "available",
            label: "Available resources",
            note: "Units ready to deploy",
            filter: "availability=available",
            icon: <CheckCircle2 />,
            tone: "teal",
          },
          {
            key: "allocated",
            label: "Allocated resources",
            note: "Units in the field",
            filter: "availability=allocated",
            icon: <Truck />,
            tone: "violet",
          },
          {
            key: "maintenance",
            label: "Under maintenance",
            note: "Resource records",
            filter: "status=maintenance",
            icon: <Shield />,
            tone: "amber",
          },
          {
            key: "low_stock",
            label: "Low-stock resources",
            note: "At or below threshold",
            filter: "low_stock=true",
            icon: <AlertTriangle />,
            tone: "red",
          },
        ]}
      />
      <div className="inventory-insights">
        <Chart
          title="Inventory by category"
          subtitle="Total units · all storage locations"
          points={w.summary.data?.data.distribution}
        />
        <Chart
          title="Stock distribution"
          subtitle="Available, allocated, and offline units"
          points={w.summary.data?.data.secondary}
          donut
        />
        <Link to="/resources?low_stock=true" className="stock-alert">
          <AlertTriangle size={24} />
          <span className="module-kicker">Replenishment watch</span>
          <strong>
            {w.count("low_stock")} resources
            <br />
            need a stock check
          </strong>
          <p>
            Review thresholds before committing resources to another response.
          </p>
          <span>
            Review low stock
            <ArrowRight size={17} />
          </span>
        </Link>
      </div>
      <Filters
        w={w}
        placeholder="Search resource name, ID, or storage location…"
      >
        <ReferenceFilter
          w={w}
          label="Resource category"
          kind="resource_category"
        />
        <Select
          w={w}
          name="status"
          label="Operational status"
          options={modules.resources.statuses!}
        />
        <Select
          w={w}
          name="availability"
          label="Availability"
          options={[
            { value: "available", label: "Available stock" },
            { value: "allocated", label: "Allocated stock" },
          ]}
        />
        <TextFilter w={w} name="location" label="Storage location" />
        <Select
          w={w}
          name="low_stock"
          label="Stock level"
          options={[
            { value: "true", label: "Low stock" },
            { value: "false", label: "Above threshold" },
          ]}
        />
      </Filters>
      <Results
        w={w}
        title="Inventory ledger"
        columns={[
          { key: "code", label: "Resource ID" },
          { key: "name", label: "Resource name" },
          { key: "category", label: "Category" },
          { key: "total_quantity", label: "Total quantity" },
          {
            key: "available_quantity",
            label: "Available quantity",
            render: (r) => <Availability row={r} />,
          },
          { key: "allocated_quantity", label: "Allocated quantity" },
          { key: "status", label: "Status" },
          { key: "location", label: "Storage location" },
        ]}
      />
    </div>
  );
}
export function RequestsWorkspace() {
  const w = useWorkspace("resource-requests");
  return (
    <div className="management-workspace requests-workspace">
      <Header w={w} eyebrow="Review & authorization" action="New request">
        Turn field requirements into accountable decisions, with a clear record
        at every stage.
      </Header>
      <Metrics
        w={w}
        items={[
          {
            key: "pending",
            label: "Pending requests",
            note: "Awaiting a decision",
            filter: "status=awaiting_review",
            icon: <Clock3 />,
            tone: "amber",
          },
          {
            key: "approved",
            label: "Approved requests",
            note: "Ready for allocation",
            filter: "status=approved",
            icon: <ClipboardCheck />,
            tone: "teal",
          },
          {
            key: "rejected",
            label: "Rejected requests",
            note: "Decision recorded",
            filter: "status=rejected",
            icon: <X />,
            tone: "red",
          },
          {
            key: "partially_fulfilled",
            label: "Partially fulfilled",
            note: "Further supply needed",
            filter: "status=partially_fulfilled",
            icon: <Boxes />,
            tone: "violet",
          },
        ]}
      />
      <nav className="request-workflow" aria-label="Request workflow views">
        {[
          {
            label: "Awaiting review",
            filter: "status=awaiting_review",
            detail: "Assess needs & justification",
            icon: <ClipboardCheck />,
          },
          {
            label: "Approved",
            filter: "status=approved",
            detail: "Authorize resource deployment",
            icon: <CheckCircle2 />,
          },
          {
            label: "Partially fulfilled",
            filter: "status=partially_fulfilled",
            detail: "Coordinate remaining demand",
            icon: <Truck />,
          },
          {
            label: "Completed",
            filter: "status=completed",
            detail: "View fulfilled requirements",
            icon: <Shield />,
          },
        ].map((s, i) => (
          <Link key={s.label} to={`/resource-requests?${s.filter}`}>
            <span className="workflow-number">0{i + 1}</span>
            {s.icon}
            <span>
              <strong>{s.label}</strong>
              <small>{s.detail}</small>
            </span>
            <ArrowRight size={17} />
          </Link>
        ))}
      </nav>
      <div className="request-insights">
        <Chart
          title="Request status distribution"
          subtitle="All requests · current lifecycle stage"
          points={w.summary.data?.data.distribution}
          donut
        />
        <Chart
          title="Requests by priority"
          subtitle="Review the most urgent requirements first"
          points={w.summary.data?.data.secondary}
        />
      </div>
      <Filters
        w={w}
        placeholder="Search request ID, incident, resource, or requester…"
      >
        <RemoteFilter
          w={w}
          name="incident_id"
          label="Linked incident"
          endpoint="/incidents"
        />
        <ReferenceFilter
          w={w}
          label="Resource category"
          kind="resource_category"
        />
        <Select
          w={w}
          name="priority"
          label="Request priority"
          options={[...priorities]}
        />
        <Select
          w={w}
          name="status"
          label="Request status"
          options={modules["resource-requests"].statuses!}
        />
        <RemoteFilter
          w={w}
          name="requester_id"
          label="Requester"
          endpoint="/directory/people"
        />
        <Dates w={w} />
      </Filters>
      <Results
        w={w}
        title="Request review queue"
        columns={[
          { key: "code", label: "Request ID" },
          { key: "incident", label: "Incident" },
          { key: "resource", label: "Requested resource" },
          { key: "quantity", label: "Quantity" },
          { key: "priority", label: "Priority" },
          { key: "requester", label: "Requested by" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Request date" },
        ]}
      />
    </div>
  );
}
function AllocationActivity({ w }: { w: Workspace }) {
  const points = w.summary.data?.data.activity ?? [];
  const max = Math.max(
    1,
    ...points.flatMap((p) => [Number(p.quantity), Number(p.released)]),
  );
  return (
    <section
      className="panel module-chart allocation-activity"
      aria-label="Allocation activity"
    >
      <h2>Allocation activity</h2>
      <p>Allocated and released quantities · last 14 days</p>
      <div className="activity-key">
        <span>
          <i />
          Allocated
        </span>
        <span>
          <i />
          Released
        </span>
      </div>
      {!points.some((p) => Number(p.quantity) || Number(p.released)) ? (
        <div className="chart-no-data">
          No allocation activity in this period.
        </div>
      ) : (
        <>
          <div className="activity-columns" aria-hidden="true">
            {points.map((p) => (
              <div
                key={p.date}
                title={`${p.date}: ${p.quantity} allocated, ${p.released} released`}
              >
                <div>
                  <i
                    style={{ height: `${(Number(p.quantity) / max) * 100}%` }}
                  />
                  <i
                    style={{ height: `${(Number(p.released) / max) * 100}%` }}
                  />
                </div>
                <small>
                  {new Date(p.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </small>
              </div>
            ))}
          </div>
          <details className="chart-data">
            <summary>View activity data table</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Allocated</th>
                    <th>Released</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.date}>
                      <td>{p.date.slice(0, 10)}</td>
                      <td>{p.quantity}</td>
                      <td>{p.released}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
export function AllocationsWorkspace() {
  const w = useWorkspace("allocations");
  return (
    <div className="management-workspace allocations-workspace">
      <Header w={w} eyebrow="Deployment & recovery" action="New allocation">
        Deploy against approved requests. Track partial fulfillment and recover
        resources safely.
      </Header>
      <Metrics
        w={w}
        items={[
          {
            key: "active",
            label: "Active allocations",
            note: "Resources in the field",
            filter: "status=active",
            icon: <Truck />,
            tone: "blue",
          },
          {
            key: "completed",
            label: "Completed allocations",
            note: "All resources released",
            filter: "status=returned",
            icon: <CheckCircle2 />,
            tone: "teal",
          },
          {
            key: "partially_fulfilled",
            label: "Partially fulfilled",
            note: "Requests awaiting balance",
            filter: "status=partially_fulfilled",
            icon: <Boxes />,
            tone: "violet",
          },
          {
            key: "outstanding_quantity",
            label: "Outstanding quantity",
            note: "Units to recover",
            filter: "status=active",
            icon: <ArrowDownToLine />,
            tone: "amber",
          },
        ]}
      />
      <div className="allocation-insights">
        <AllocationActivity w={w} />
        <div className="allocation-guidance">
          <span className="module-kicker">
            <Shield size={17} />
            Deployment checks
          </span>
          <h2>Every unit accounted for.</h2>
          <ol>
            <li>
              <strong>Approved demand</strong>
              <span>Choose an approved or partially fulfilled request.</span>
            </li>
            <li>
              <strong>Available supply</strong>
              <span>Eligible stock is checked before allocation.</span>
            </li>
            <li>
              <strong>Tracked recovery</strong>
              <span>Release operational units to restore availability.</span>
            </li>
          </ol>
          {w.allowed("allocations.manage") && (
            <Link className="text-link" to="/allocations/new">
              Create an allocation
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
      <Filters
        w={w}
        placeholder="Search allocation ID, request, incident, or resource…"
      >
        <RemoteFilter
          w={w}
          name="incident_id"
          label="Incident"
          endpoint="/incidents"
        />
        <RemoteFilter
          w={w}
          name="resource_id"
          label="Resource"
          endpoint="/resources"
        />
        <Select
          w={w}
          name="status"
          label="Allocation status"
          options={["active", "returned", "partially_fulfilled"]}
        />
        <RemoteFilter
          w={w}
          name="responsible_id"
          label="Responsible user"
          endpoint="/directory/people"
        />
        <Dates w={w} />
      </Filters>
      <Results
        w={w}
        title="Deployment register"
        columns={[
          { key: "code", label: "Allocation ID" },
          { key: "incident", label: "Incident" },
          { key: "resource", label: "Resource" },
          { key: "quantity", label: "Allocated quantity" },
          { key: "released_quantity", label: "Released quantity" },
          { key: "outstanding_quantity", label: "Outstanding quantity" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Allocation date" },
          { key: "responsible", label: "Responsible user" },
        ]}
      />
    </div>
  );
}
export function TeamsWorkspace() {
  const w = useWorkspace("teams");
  return (
    <div className="management-workspace teams-workspace">
      <Header w={w} eyebrow="People & deployment" action="New response team">
        The right expertise, connected to the right incident. Manage readiness
        and field assignments in one place.
      </Header>
      <Metrics
        w={w}
        items={[
          {
            key: "total",
            label: "Total teams",
            note: "Registered response units",
            icon: <Users />,
          },
          {
            key: "available",
            label: "Available teams",
            note: "Ready for assignment",
            filter: "availability=available",
            icon: <CheckCircle2 />,
            tone: "teal",
          },
          {
            key: "deployed",
            label: "Deployed teams",
            note: "Responding in the field",
            filter: "availability=deployed",
            icon: <Truck />,
            tone: "violet",
          },
          {
            key: "unavailable",
            label: "Unavailable teams",
            note: "Off duty or offline",
            filter: "availability=unavailable",
            icon: <Clock3 />,
            tone: "amber",
          },
        ]}
      />
      <div className="team-insights">
        <Chart
          title="Team readiness"
          subtitle="Live availability across response units"
          points={w.summary.data?.data.distribution}
          donut
        />
        <Chart
          title="Response capabilities"
          subtitle="Teams by specialization"
          points={w.summary.data?.data.secondary}
        />
      </div>
      <Filters w={w} placeholder="Search team name, ID, or team leader…">
        <ReferenceFilter
          w={w}
          name="type_id"
          label="Team type"
          kind="team_type"
        />
        <Select
          w={w}
          name="availability"
          label="Availability"
          options={["available", "deployed", "unavailable"]}
        />
        <RemoteFilter
          w={w}
          name="incident_id"
          label="Assigned incident"
          endpoint="/incidents"
        />
        <RemoteFilter
          w={w}
          name="lead_id"
          label="Team leader"
          endpoint="/directory/people"
        />
      </Filters>
      <Results w={w} title="Response team directory">
        <div className="team-directory">
          {w.list.data?.data.map((team) => (
            <article className="response-team-card" key={team.id}>
              <div className="team-card-top">
                <span className="team-emblem">
                  <Users size={26} />
                </span>
                <Badge value={team.availability} />
              </div>
              <span className="team-reference">
                {String(team.code)} · {String(team.type)}
              </span>
              <h3>
                <Link to={`/teams/${team.id}`}>{String(team.name)}</Link>
              </h3>
              <dl>
                <div>
                  <dt>Team leader</dt>
                  <dd>{String(team.lead)}</dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>{String(team.member_count ?? 0)} personnel</dd>
                </div>
              </dl>
              <div className="team-current">
                <MapPin size={16} />
                <span>
                  <small>Current assignment</small>
                  <strong>
                    {String(
                      team.current_incident ??
                        (team.availability === "unavailable"
                          ? "Unavailable for assignment"
                          : "Ready for next assignment"),
                    )}
                  </strong>
                </span>
              </div>
              <div className="team-card-actions">
                <Link className="text-link" to={`/teams/${team.id}`}>
                  View team details
                  <ArrowRight size={16} />
                </Link>
                {w.allowed("teams.manage") && (
                  <Link to={`/teams/${team.id}/edit`}>Edit team</Link>
                )}
              </div>
              {w.allowed("teams.manage") &&
                team.availability === "available" && (
                  <Link
                    className="button secondary full"
                    to={`/teams/${team.id}/assignments`}
                  >
                    Assign to incident
                  </Link>
                )}
            </article>
          ))}
        </div>
      </Results>
    </div>
  );
}
