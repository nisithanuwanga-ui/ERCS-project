import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { can, grants, roleLabels, roles } from "../../shared/domain";
import type { RecordData } from "../../shared/domain";
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
import { RecordTable } from "./RecordList";
export function RolesPage() {
  const { user } = useAuth();
  if (!user || !can(user.role, "users.manage")) return <Navigate to="/403" />;
  return (
    <>
      <PageTitle title="Roles & permissions">
        Clear responsibilities. Authorized actions. Every role has a defined
        purpose.
      </PageTitle>
      <section className="panel">
        <div className="panel-padding">
          <h2>Operational permission matrix</h2>
          <p className="muted small-text">
            Roles are fixed and enforced by the backend. Administrator access
            does not bypass operational approval rules.
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                {roles.map((r) => (
                  <th key={r}>{roleLabels[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(grants).map((p) => (
                <tr key={p}>
                  <td>{p.replace(".", " · ").replaceAll("_", " ")}</td>
                  {roles.map((r) => (
                    <td key={r}>
                      <Badge
                        value={
                          can(r, p as keyof typeof grants)
                            ? "permitted"
                            : "restricted"
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="info-note">
        Field officers are limited to incidents they reported or are assigned
        to, their teams, and associated records. Every user can manage their own
        profile and password. Operational read access is granted to authorized
        viewers; sensitive account and team contact data remains restricted.
      </div>
    </>
  );
}
export function ShortagesPage() {
  const result = useApi<{ data: RecordData[]; categories: RecordData[] }>(
    "/shortages",
  );
  return (
    <>
      <PageTitle
        title="Shortage monitoring"
        action={<Refresh onClick={result.refresh} />}
      >
        Compare approved outstanding demand with allocatable inventory.
      </PageTitle>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Message>{result.error}</Message>
      ) : (
        <>
          <div className="info-note">
            Direct resource demand and category demand are shown separately to
            avoid counting a category request against every resource. Unapproved
            requests are excluded.
          </div>
          <section className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>Category supply & demand</h2>
                <p>
                  Operational available quantities and unissued category
                  requests
                </p>
              </div>
            </div>
            {result.data?.categories.some(
              (c) => Number(c.available) + Number(c.demand) > 0,
            ) ? (
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.data.categories}>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(x) => String(x).split(" ")[0]}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="available"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="demand"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty title="No supply or demand yet" />
            )}
          </section>
          <section className="panel">
            <div className="panel-padding">
              <h2>Resources needing attention</h2>
            </div>
            {result.data?.data.length ? (
              <RecordTable
                rows={result.data.data}
                columns={[
                  "name",
                  "category",
                  "available_quantity",
                  "threshold",
                  "outstanding_demand",
                  "shortage",
                  "status",
                ]}
                path="/resources"
              />
            ) : (
              <Empty title="No resource availability alerts">
                No stock thresholds or direct-demand shortages were found.
              </Empty>
            )}
          </section>
          <section className="panel">
            <div className="panel-padding">
              <h2>Category demand</h2>
            </div>
            {result.data?.categories.length ? (
              <RecordTable
                rows={result.data.categories}
                columns={["name", "available", "demand", "shortage"]}
              />
            ) : (
              <Empty />
            )}
          </section>
          <Link className="text-link" to="/resource-requests">
            Review resource requests →
          </Link>
        </>
      )}
    </>
  );
}
export function ProfilePage({ security = false }: { security?: boolean }) {
  const { user, reload } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  if (!user) return null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setSuccess("");
    setPending(true);
    try {
      if (security) {
        if (f.get("password") !== f.get("confirm"))
          throw new Error("Passwords do not match.");
        await api("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            current_password: f.get("current_password"),
            password: f.get("password"),
          }),
        });
        window.location.assign("/login");
      } else {
        await api("/profile", {
          method: "PATCH",
          body: JSON.stringify({ name: f.get("name") }),
        });
        await reload();
        setSuccess("Profile updated.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle title={security ? "Account security" : "My profile"}>
        {security
          ? "Keep your authorized access secure."
          : "Your identity and responsibilities in the ERCS workspace."}
      </PageTitle>
      <div className="profile-tabs">
        <Link to="/profile" className={!security ? "active" : ""}>
          Profile details
        </Link>
        <Link to="/profile/security" className={security ? "active" : ""}>
          Password & security
        </Link>
      </div>
      <form className="panel editor-form" onSubmit={submit}>
        {error && <Message>{error}</Message>}
        {success && <Message success>{success}</Message>}
        <h2>{security ? "Change your password" : "Account information"}</h2>
        <div className="form-grid">
          {security ? (
            <>
              <label className="span-two">
                Current password
                <input
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
              <label>
                Confirm new password
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                />
              </label>
              <div className="info-note span-two">
                Use at least 12 characters with uppercase, lowercase, and a
                number. Changing your password signs you out on every device.
              </div>
            </>
          ) : (
            <>
              <label>
                Display name
                <input
                  name="name"
                  defaultValue={user.name}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </label>
              <label>
                Email address
                <input type="email" value={user.email} readOnly />
              </label>
              <label>
                Role
                <input value={roleLabels[user.role]} readOnly />
              </label>
              <label>
                Account status
                <input value={user.active ? "Active" : "Disabled"} readOnly />
              </label>
            </>
          )}
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate("/dashboard")}
          >
            Back to overview
          </button>
          <button className="button" disabled={pending}>
            {pending
              ? "Saving…"
              : security
                ? "Update password"
                : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}
export function SettingsPage() {
  const { user } = useAuth();
  const result = useApi<{ data: RecordData[] }>("/reference-data");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (!user || !can(user.role, "settings.manage"))
    return <Navigate to="/403" />;
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError("");
    try {
      await api("/settings/reference-data", {
        method: "POST",
        body: JSON.stringify({ kind: f.get("kind"), name: f.get("name") }),
      });
      form.reset();
      result.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function toggle(item: RecordData) {
    setPending(true);
    setError("");
    try {
      await api(`/settings/reference-data/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      result.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageTitle title="System settings">
        Manage the reference values that keep your operations consistent.
      </PageTitle>
      {error && <Message>{error}</Message>}
      <form className="panel editor-form" onSubmit={add}>
        <h2>Add reference value</h2>
        <div className="form-grid">
          <label>
            Reference category
            <select name="kind">
              <option value="incident_category">Incident category</option>
              <option value="resource_category">Resource category</option>
              <option value="team_type">Team type</option>
            </select>
          </label>
          <label>
            Name
            <input name="name" required minLength={2} maxLength={100} />
          </label>
        </div>
        <div className="form-actions">
          <button className="button" disabled={pending}>
            Add reference value
          </button>
        </div>
      </form>
      <section className="panel">
        <div className="panel-padding">
          <h2>Reference data</h2>
          <p className="small-text muted">
            Deactivated values remain available in historical records.
          </p>
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <Message>{result.error}</Message>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {result.data?.data.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.kind).replaceAll("_", " ")}</td>
                    <td>{String(r.name)}</td>
                    <td>
                      <Badge value={r.active ? "active" : "inactive"} />
                    </td>
                    <td>
                      <button
                        className="text-button"
                        disabled={pending}
                        onClick={() => void toggle(r)}
                      >
                        {r.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="info-note">
        Resource shortage thresholds are managed on each inventory record by
        Resource Managers. Priorities and role grants follow the documented
        workflow and are not editable here.
      </div>
    </>
  );
}
