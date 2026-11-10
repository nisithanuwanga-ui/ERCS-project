import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Clock3,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell as ChartCell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { can } from "../../shared/domain";
import type { Permission, RecordData } from "../../shared/domain";
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
import { RecordTable } from "./RecordList";
import "../styles/dashboard.css";

interface NamedValue {
  name: string;
  value: number;
}
interface SummaryData {
  counts: Record<string, number>;
  recent: RecordData[];
  urgent: RecordData[];
  urgentRequests: RecordData[];
  trends: { date: string; incidents: number }[];
  resourceAvailability: NamedValue[];
  requestPriority: NamedValue[];
  activity: RecordData[];
  allocationActivity: { date: string; quantity: number }[];
  teamAvailability: {
    name: string;
    available: number;
    deployed: number;
    unavailable: number;
  }[];
  shortageCategories: {
    id: string;
    name: string;
    available: number;
    demand: number;
    shortage: number;
  }[];
  resourceAlerts: RecordData[];
  generatedAt: string;
}
const tones = {
  blue: "#2563eb",
  teal: "#0f766e",
  amber: "#f59e0b",
  red: "#dc2626",
  slate: "#cbd5e1",
};
const priorityColors: Record<string, string> = {
  critical: tones.red,
  high: tones.amber,
  medium: tones.blue,
  low: tones.teal,
};
const cards = [
  {
    key: "active_incidents",
    title: "Active incidents",
    icon: Activity,
    path: "/incidents?status=open",
    cardClass: "kpi-card-incidents",
    note: "Reported, active & controlled",
  },
  {
    key: "available_resources",
    title: "Available resource units",
    icon: Boxes,
    path: "/resources?status=operational",
    cardClass: "kpi-card-resources",
    note: "Operational and ready to allocate",
  },
  {
    key: "pending_requests",
    title: "Pending requests",
    icon: ClipboardList,
    path: "/resource-requests?status=awaiting_review",
    cardClass: "kpi-card-requests",
    note: "Awaiting review or decision",
  },
  {
    key: "active_allocations",
    title: "Active allocations",
    icon: Truck,
    path: "/allocations?status=active",
    cardClass: "kpi-card-allocations",
    note: "Resources still outstanding",
  },
  {
    key: "active_teams",
    title: "Active response teams",
    icon: Users,
    path: "/teams?status=operational",
    cardClass: "kpi-card-teams",
    note: "Available or currently deployed",
  },
  {
    key: "shortages",
    title: "Resource alerts",
    icon: ShieldAlert,
    path: "/shortages",
    cardClass: "kpi-card-shortages",
    note: "Low stock, unavailable or unmet demand",
  },
];
const actions: {
  title: string;
  path: string;
  permission?: Permission;
  icon: typeof Activity;
}[] = [
  {
    title: "Report incident",
    path: "/incidents/new",
    permission: "incidents.create",
    icon: Activity,
  },
  {
    title: "View incidents",
    path: "/incidents",
    icon: Activity,
  },
  {
    title: "Request resources",
    path: "/resource-requests/new",
    permission: "requests.create",
    icon: ClipboardList,
  },
  {
    title: "All requests",
    path: "/resource-requests",
    icon: ClipboardList,
  },
  {
    title: "Manage inventory",
    path: "/resources/new",
    permission: "resources.manage",
    icon: Boxes,
  },
  {
    title: "Allocate resources",
    path: "/allocations/new",
    permission: "allocations.manage",
    icon: Truck,
  },
  {
    title: "Manage teams",
    path: "/teams",
    permission: "teams.manage",
    icon: Users,
  },
  {
    title: "Monitor shortages",
    path: "/shortages",
    icon: ShieldAlert,
  },
];
const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (listener: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const ticks = { fontSize: 10, fill: "#64748b" };

function ChartPanel({
  id,
  title,
  description,
  summary,
  rows,
  columns,
  children,
  empty,
  period,
}: {
  id: string;
  title: string;
  description: string;
  summary: string;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  children: ReactNode;
  empty?: boolean;
  period: string;
}) {
  return (
    <section
      className="panel chart-panel ercs-chart-panel"
      aria-labelledby={`${id}-title`}
    >
      <div className="panel-heading">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="chart-period">{period}</span>
      </div>
      {empty ? (
        <Empty title="No data to display yet">
          The visualization appears when matching operational records are
          available.
        </Empty>
      ) : (
        <>
          <div className="chart-frame" aria-hidden="true">
            {children}
          </div>
          <p className="chart-readable-summary">{summary}</p>
        </>
      )}
      <details className="chart-data">
        <summary>
          View accessible data table <span aria-hidden="true">↗</span>
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              {title}: {description}
            </caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th scope="col" key={c.key}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, index) => (
                  <tr key={String(row.id ?? row.name ?? row.date ?? index)}>
                    {columns.map((c) => (
                      <td key={c.key}>{String(row[c.key] ?? "—")}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>No matching records.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function Grid() {
  return (
    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e6edf4" />
  );
}
function UrgentPanel({
  title,
  description,
  records,
  path,
  empty,
}: {
  title: string;
  description: string;
  records: RecordData[];
  path: string;
  empty: string;
}) {
  return (
    <section className="panel urgent-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="attention-mark">
          <ShieldAlert size={17} />
        </span>
      </div>
      {records.length ? (
        records.map((r) => (
          <Link className="urgent-item" to={`${path}/${r.id}`} key={r.id}>
            <Badge value={r.priority} />
            <strong>{String(r.title ?? r.resource ?? r.code)}</strong>
            <small>{String(r.location ?? r.incident ?? r.code)}</small>
            <ArrowUpRight size={17} />
          </Link>
        ))
      ) : (
        <Empty title={empty} />
      )}
    </section>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [days, setDays] = useState("30");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => true,
  );
  const result = useApi<{ data: SummaryData }>(
    `/dashboard/summary?days=${days}`,
  );
  if (result.loading)
    return (
      <div className="operations-dashboard">
        <PageTitle
          eyebrow="Command overview"
          title="Your response, in focus."
        />
        <Loading />
      </div>
    );
  if (result.error)
    return (
      <div className="operations-dashboard">
        <PageTitle title="Operational overview" />
        <Message>{result.error}</Message>
        <Refresh onClick={result.refresh} />
      </div>
    );
  const d = result.data?.data;
  if (!d) return null;
  const incidentTotal = d.trends.reduce((sum, r) => sum + r.incidents, 0),
    inventoryTotal = d.resourceAvailability.reduce(
      (sum, r) => sum + r.value,
      0,
    ),
    requestTotal = d.requestPriority.reduce((sum, r) => sum + r.value, 0),
    allocatedTotal = d.allocationActivity.reduce(
      (sum, r) => sum + r.quantity,
      0,
    ),
    teamTotal = d.teamAvailability.reduce(
      (sum, r) => sum + r.available + r.deployed + r.unavailable,
      0,
    ),
    deficitTotal = d.shortageCategories.reduce((sum, r) => sum + r.shortage, 0);
  const animation = {
    isAnimationActive: !reducedMotion,
    animationDuration: 450,
  };
  const period = `${days} days`;
  const visibleActions = user
    ? actions.filter((a) => !a.permission || can(user.role, a.permission))
    : [];

  const filteredUrgentRequests =
    priorityFilter === "all"
      ? d.urgentRequests
      : d.urgentRequests.filter(
          (r) => String(r.priority).toLowerCase() === priorityFilter,
        );

  const filteredUrgentIncidents =
    priorityFilter === "all"
      ? d.urgent
      : d.urgent.filter(
          (r) => String(r.priority).toLowerCase() === priorityFilter,
        );

  const filteredRecent =
    priorityFilter === "all"
      ? d.recent
      : d.recent.filter(
          (r) => String(r.priority).toLowerCase() === priorityFilter,
        );
  return (
    <div className="operations-dashboard">
      <PageTitle
        eyebrow="Command overview"
        title={`Good to see you, ${user?.name.split(" ")[0]}.`}
        action={
          <div className="action-row">
            <select
              aria-label="Chart date range"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <Refresh onClick={result.refresh} />
          </div>
        }
      >
        Your people, resources, and priorities. One coordinated view.
      </PageTitle>
      <section className="command-brief" aria-label="Workspace snapshot">
        <div className="brief-symbol">
          <Activity size={26} />
        </div>
        <div>
          <span className="eyebrow">Clarity for the next decision</span>
          <h2>A shared picture. A stronger response.</h2>
          <p>
            Current totals, with incident and activity trends for your selected
            period.
          </p>
        </div>
        <div className="snapshot-time">
          <Clock3 size={14} />
          <span>
            Updated{" "}
            {new Date(d.generatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
            <small>Refresh for the latest records</small>
          </span>
        </div>
      </section>
      <div className="kpi-grid">
        {cards.map(({ key, title, icon: Icon, path, cardClass, note }, index) => (
          <Link
            className={`kpi-card ${cardClass}`}
            to={path}
            key={key}
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <div className="kpi-card-top">
              <span className="kpi-icon-wrapper">
                <Icon size={22} />
              </span>
              <ArrowUpRight size={18} className="kpi-card-arrow" />
            </div>
            <strong className="kpi-metric-val">{d.counts[key]?.toLocaleString() ?? 0}</strong>
            <span className="kpi-card-label">{title}</span>
            <small className="kpi-card-note">{note}</small>
          </Link>
        ))}
      </div>
      <div className="dashboard-controls-bar">
        {visibleActions.length > 0 && (
          <nav
            className="dashboard-quick-actions"
            aria-label="Operational quick actions"
          >
            <span className="actions-label">Quick Actions:</span>
            {visibleActions.map(({ path, title, icon: Icon }) => (
              <Link to={path} key={path} className="quick-action-pill">
                <Icon size={16} />
                <span>{title}</span>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </nav>
        )}
        <div className="dashboard-filter-group">
          <label htmlFor="dashboard-priority-filter" className="actions-label">
            Filter Severity:
          </label>
          <select
            id="dashboard-priority-filter"
            className="filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="dashboard-charts">
        <ChartPanel
          id="incident-trends"
          title="Incident trends"
          description="New incident reports, day by day"
          period={period}
          summary={`${incidentTotal} incidents reported during this period.`}
          rows={d.trends}
          columns={[
            { key: "date", label: "Date" },
            { key: "incidents", label: "Incidents reported" },
          ]}
          empty={incidentTotal === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={d.trends}
              margin={{ left: -22, right: 12, top: 15 }}
            >
              <Grid />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                axisLine={false}
                tickLine={false}
                minTickGap={35}
                tick={ticks}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={ticks}
              />
              <Tooltip labelFormatter={(x) => shortDate(String(x))} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line
                dataKey="incidents"
                name="Incidents reported"
                type="monotone"
                stroke={tones.blue}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }}
                {...animation}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel
          id="resource-availability"
          title="Resource availability"
          description="Inventory units by current operational state"
          period="Current snapshot"
          summary={`${d.counts.available_resources} available units out of ${inventoryTotal} inventory units.`}
          rows={d.resourceAvailability.map((r) => ({ ...r }))}
          columns={[
            { key: "name", label: "Availability" },
            { key: "value", label: "Inventory units" },
          ]}
          empty={inventoryTotal === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={d.resourceAvailability.filter((r) => r.value > 0)}
                dataKey="value"
                nameKey="name"
                innerRadius={65}
                outerRadius={89}
                paddingAngle={3}
                stroke="none"
                {...animation}
              >
                {d.resourceAvailability
                  .filter((r) => r.value > 0)
                  .map((r) => (
                    <ChartCell
                      key={r.name}
                      fill={
                        (
                          {
                            Available: tones.teal,
                            Allocated: tones.blue,
                            Unavailable: tones.slate,
                          } as Record<string, string>
                        )[r.name]
                      }
                    />
                  ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <div className="dashboard-charts">
        <ChartPanel
          id="requests-priority"
          title="Requests by priority"
          description="All requests submitted during the reporting period"
          period={period}
          summary={`${requestTotal} requests submitted; ${d.counts.pending_requests} currently await a decision.`}
          rows={d.requestPriority.map((r) => ({ ...r }))}
          columns={[
            { key: "name", label: "Priority" },
            { key: "value", label: "Requests submitted" },
          ]}
          empty={requestTotal === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={d.requestPriority}
              margin={{ left: -22, right: 8, top: 15 }}
            >
              <Grid />
              <XAxis
                dataKey="name"
                tick={ticks}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={ticks}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="value"
                name="Requests submitted"
                radius={[5, 5, 0, 0]}
                maxBarSize={44}
                {...animation}
              >
                {d.requestPriority.map((r) => (
                  <ChartCell
                    key={r.name}
                    fill={priorityColors[r.name] ?? tones.blue}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <UrgentPanel
          title="High-priority requests"
          description="Urgent needs awaiting review or decision"
          records={filteredUrgentRequests}
          path="/resource-requests"
          empty="No urgent requests matching filter"
        />
      </div>
      <div className="dashboard-charts">
        <ChartPanel
          id="allocation-activity"
          title="Allocation activity"
          description="Resource units issued during the reporting period"
          period={period}
          summary={`${allocatedTotal} resource units issued during this period. Returns remain in allocation history.`}
          rows={d.allocationActivity}
          columns={[
            { key: "date", label: "Date" },
            { key: "quantity", label: "Units allocated" },
          ]}
          empty={allocatedTotal === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={d.allocationActivity}
              margin={{ left: -22, right: 12, top: 15 }}
            >
              <defs>
                <linearGradient
                  id="allocation-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={tones.teal} stopOpacity={0.2} />
                  <stop
                    offset="100%"
                    stopColor={tones.teal}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <Grid />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                minTickGap={35}
                axisLine={false}
                tickLine={false}
                tick={ticks}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={ticks}
              />
              <Tooltip labelFormatter={(x) => shortDate(String(x))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                dataKey="quantity"
                name="Units allocated"
                type="monotone"
                fill="url(#allocation-fill)"
                stroke={tones.teal}
                strokeWidth={2.5}
                {...animation}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel
          id="team-availability"
          title="Team availability"
          description="Team readiness by response capability"
          period="Current snapshot"
          summary={`${teamTotal} teams in your view; ${d.counts.available_teams} available and ${d.counts.active_teams} operational.`}
          rows={d.teamAvailability}
          columns={[
            { key: "name", label: "Team type" },
            { key: "available", label: "Available" },
            { key: "deployed", label: "Deployed" },
            { key: "unavailable", label: "Unavailable" },
          ]}
          empty={teamTotal === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={d.teamAvailability}
              margin={{ left: -22, right: 8, top: 15 }}
            >
              <Grid />
              <XAxis
                dataKey="name"
                tick={ticks}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={ticks}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="available"
                name="Available"
                stackId="teams"
                fill={tones.teal}
                maxBarSize={44}
                {...animation}
              />
              <Bar
                dataKey="deployed"
                name="Deployed"
                stackId="teams"
                fill={tones.blue}
                maxBarSize={44}
                {...animation}
              />
              <Bar
                dataKey="unavailable"
                name="Unavailable"
                stackId="teams"
                fill={tones.slate}
                radius={[4, 4, 0, 0]}
                maxBarSize={44}
                {...animation}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
      <div className="dashboard-charts">
        <ChartPanel
          id="resource-shortages"
          title="Resource shortages"
          description="Available supply against approved, unissued demand"
          period="Current snapshot"
          summary={`${deficitTotal} units of category-level unmet demand. Specific-resource alerts are shown separately.`}
          rows={d.shortageCategories}
          columns={[
            { key: "name", label: "Category" },
            { key: "available", label: "Available units" },
            { key: "demand", label: "Approved demand" },
            { key: "shortage", label: "Unmet demand" },
          ]}
          empty={!d.shortageCategories.some((r) => r.available + r.demand > 0)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={d.shortageCategories}
              margin={{ left: -22, right: 8, top: 15 }}
            >
              <Grid />
              <XAxis
                dataKey="name"
                tickFormatter={(x) => String(x).split(" ")[0]}
                tick={ticks}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={ticks}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="available"
                name="Available supply"
                fill={tones.blue}
                radius={[4, 4, 0, 0]}
                maxBarSize={25}
                {...animation}
              />
              <Bar
                dataKey="demand"
                name="Approved demand"
                fill={tones.amber}
                radius={[4, 4, 0, 0]}
                maxBarSize={25}
                {...animation}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <section className="panel urgent-panel">
          <div className="panel-heading">
            <div>
              <h2>Resource alerts</h2>
              <p>Thresholds and specific-resource demand</p>
            </div>
            <Link className="text-link" to="/shortages">
              Monitor <ArrowUpRight size={14} />
            </Link>
          </div>
          {d.resourceAlerts.length ? (
            d.resourceAlerts.map((r) => (
              <Link
                className="resource-alert-item"
                to={`/resources/${r.id}`}
                key={r.id}
              >
                <span className="resource-alert-icon">
                  <Boxes size={18} />
                </span>
                <div>
                  <strong>{String(r.name)}</strong>
                  <span>
                    {String(r.available_quantity)} available · threshold{" "}
                    {String(r.threshold)}
                  </span>
                  <small>
                    {Number(r.shortage) > 0
                      ? `${String(r.shortage)} units of unmet demand`
                      : r.status !== "operational"
                        ? String(r.status)
                        : "At or below minimum availability"}
                  </small>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))
          ) : (
            <Empty title="No resource alerts">
              No resource-level threshold or demand alerts were found.
            </Empty>
          )}
        </section>
      </div>
      <div className="dashboard-charts">
        <section className="panel">
          <div className="panel-heading panel-padding">
            <div>
              <h2>Recent incidents</h2>
              <p>The latest reports in your workspace</p>
            </div>
            <Link className="text-link" to="/incidents">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {filteredRecent.length ? (
            <RecordTable
              rows={filteredRecent}
              columns={["code", "title", "priority", "status"]}
              path="/incidents"
            />
          ) : (
            <Empty title="No incidents matching filter" />
          )}
        </section>
        <UrgentPanel
          title="Priority incidents"
          description="Open incidents with high or critical priority"
          records={filteredUrgentIncidents}
          path="/incidents"
          empty="No urgent incidents matching filter"
        />
      </div>
      <section className="panel panel-padding dashboard-activity">
        <div className="panel-heading">
          <div>
            <h2>Recent operational activity</h2>
            <p>Traceable changes across your workspace</p>
          </div>
          {user && can(user.role, "audit.read") && (
            <Link className="text-link" to="/audit-logs">
              Open audit log <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        {d.activity.length ? (
          <div className="activity-timeline">
            {d.activity.map((a) => (
              <div key={a.id}>
                <span className="timeline-dot" />
                <strong>{String(a.actor ?? "System")}</strong>
                <p>
                  {String(a.action).replaceAll(".", " · ").replaceAll("_", " ")}
                </p>
                <small>{new Date(String(a.created_at)).toLocaleString()}</small>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Your activity will appear here" />
        )}
      </section>
    </div>
  );
}
