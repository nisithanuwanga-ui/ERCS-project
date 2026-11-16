import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { can, roleLabels } from "../../shared/domain";
import type { PageResult, RecordData, Role } from "../../shared/domain";
import { useAuth } from "../app/useAuth";
import {
  Badge,
  Empty,
  Loading,
  Message,
  PageTitle,
  Refresh,
} from "../components/ui";
import { useApi } from "../hooks/useApi";
import { fieldLabel } from "./modules";
import type { ModuleConfig } from "./modules";
export function Cell({ column, value }: { column: string; value: unknown }) {
  if (value === null || value === undefined)
    return <span className="muted">—</span>;
  if (column.endsWith("_at"))
    return (
      <>
        {new Date(String(value)).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </>
    );
  if (["status", "priority", "availability", "severity"].includes(column))
    return <Badge value={value} />;
  if (column === "active")
    return <Badge value={value ? "active" : "disabled"} />;
  if (column === "role")
    return <>{roleLabels[String(value) as Role] ?? String(value)}</>;
  if (typeof value === "object") return <code>{JSON.stringify(value)}</code>;
  return <>{String(value)}</>;
}
export function RecordTable({
  rows,
  columns,
  path,
}: {
  rows: RecordData[];
  columns: string[];
  path?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {fieldLabel(c)}
              </th>
            ))}
            {path && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {columns.map((c, i) => (
                <td key={c} className={i === 0 ? "primary-cell" : ""}>
                  {i === 0 && path ? (
                    <Link to={`${path}/${r.id}`}>
                      <Cell column={c} value={r[c]} />
                    </Link>
                  ) : (
                    <Cell column={c} value={r[c]} />
                  )}
                </td>
              ))}
              {path && (
                <td>
                  <Link
                    className="table-action"
                    aria-label={`View ${String(r.code ?? r.name ?? "record")}`}
                    to={`${path}/${r.id}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function RecordList({ config }: { config: ModuleConfig }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const result = useApi<PageResult>(`/${config.key}?${params}`);
  const references = useApi<{ data: RecordData[] }>("/reference-data");
  const page = Number(params.get("page") ?? 1);
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }
  return (
    <>
      <PageTitle
        title={config.title}
        action={
          config.createPermission &&
          user &&
          can(user.role, config.createPermission) ? (
            <Link className="button" to={`${config.path}/new`}>
              <Plus size={16} />
              {config.key === "users"
                ? "Invite user"
                : `New ${config.singular.toLowerCase()}`}
            </Link>
          ) : undefined
        }
      >
        {config.description}
      </PageTitle>
      <section className="panel">
        <div className="list-toolbar">
          <form
            className="search-input"
            onSubmit={(e) => {
              e.preventDefault();
              update("q", String(new FormData(e.currentTarget).get("q") ?? ""));
            }}
          >
            <Search size={16} />
            <input
              aria-label={`Search ${config.title}`}
              placeholder={`Search ${config.title.toLowerCase()}…`}
              key={query}
              name="q"
              defaultValue={query}
            />
            <button className="text-button">Search</button>
          </form>
          <div className="filter-controls">
            {config.statuses && (
              <select
                aria-label="Filter by status"
                value={params.get("status") ?? ""}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="">All statuses</option>
                {config.statuses.map((s) => (
                  <option value={s} key={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Sort records"
              value={params.get("sort") ?? "newest"}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <Refresh onClick={result.refresh} />
          </div>
        </div>
        <div className="date-filters">
          <label>
            From
            <input
              type="date"
              value={params.get("from") ?? ""}
              onChange={(e) => update("from", e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={params.get("to") ?? ""}
              onChange={(e) => update("to", e.target.value)}
            />
          </label>
          {["incidents", "resource-requests"].includes(config.key) && (
            <label>
              Priority
              <select
                value={params.get("priority") ?? ""}
                onChange={(e) => update("priority", e.target.value)}
              >
                <option value="">All priorities</option>
                {["low", "medium", "high", "critical"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          )}
          <span className="results-count">
            {result.data?.meta.total ?? "—"} records
          </span>
        </div>
        {["incidents", "resources", "users", "audit-logs"].includes(
          config.key,
        ) && (
          <div className="date-filters extended-filters">
            {["incidents", "resources"].includes(config.key) && (
              <>
                <label>
                  Category
                  <select
                    aria-label="Filter by category"
                    value={params.get("category_id") ?? ""}
                    onChange={(e) => update("category_id", e.target.value)}
                  >
                    <option value="">All categories</option>
                    {references.data?.data
                      .filter(
                        (r) =>
                          r.kind ===
                          (config.key === "incidents"
                            ? "incident_category"
                            : "resource_category"),
                      )
                      .map((r) => (
                        <option value={r.id} key={r.id}>
                          {String(r.name)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Location
                  <input
                    key={params.get("location") ?? ""}
                    aria-label="Filter by location"
                    defaultValue={params.get("location") ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (params.get("location") ?? ""))
                        update("location", e.target.value);
                    }}
                    placeholder="Any location"
                  />
                </label>
              </>
            )}
            {config.key === "users" && (
              <>
                <label>
                  Role
                  <select
                    value={params.get("role") ?? ""}
                    onChange={(e) => update("role", e.target.value)}
                  >
                    <option value="">All roles</option>
                    {Object.entries(roleLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Account status
                  <select
                    value={params.get("active") ?? ""}
                    onChange={(e) => update("active", e.target.value)}
                  >
                    <option value="">All accounts</option>
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
              </>
            )}
            {config.key === "audit-logs" &&
              ["action", "entity_type"].map((key) => (
                <label key={key}>
                  {fieldLabel(key)}
                  <input
                    key={params.get(key) ?? ""}
                    defaultValue={params.get(key) ?? ""}
                    onBlur={(e) => {
                      if (e.target.value !== (params.get(key) ?? ""))
                        update(key, e.target.value);
                    }}
                    placeholder={`Exact ${fieldLabel(key).toLowerCase()}`}
                  />
                </label>
              ))}
          </div>
        )}
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <div className="panel-padding">
            <Message>{result.error}</Message>
            <Refresh onClick={result.refresh} />
          </div>
        ) : !result.data?.data.length ? (
          <Empty
            title={
              params.size ? "No matching records" : "Your workspace starts here"
            }
          >
            Try adjusting your filters or add the first record when you are
            ready.
          </Empty>
        ) : (
          <RecordTable
            rows={result.data.data}
            columns={config.columns}
            path={config.path}
          />
        )}
        <div className="pagination">
          <span>
            Page {page} · {result.data?.meta.total ?? 0} total records
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => {
                const p = new URLSearchParams(params);
                p.set("page", String(page - 1));
                setParams(p);
              }}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={
                !result.data ||
                page * result.data.meta.pageSize >= result.data.meta.total
              }
              onClick={() => {
                const p = new URLSearchParams(params);
                p.set("page", String(page + 1));
                setParams(p);
              }}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
