import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertCircle, ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <ShieldCheck size={25} />
      </span>
      <span>
        ERCS<small>Emergency coordination</small>
      </span>
    </Link>
  );
}
export function Badge({ value }: { value: unknown }) {
  const text = String(value ?? "unknown");
  return (
    <span className={`badge badge-${text}`}>{text.replaceAll("_", " ")}</span>
  );
}
export function Message({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div
      className={`message ${success ? "message-success" : ""}`}
      role={success ? "status" : "alert"}
    >
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Loading">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ShieldCheck size={28} />
      </span>
      <h3>{title}</h3>
      <p>
        {children ??
          "Records will appear here as your team starts coordinating."}
      </p>
    </div>
  );
}
export function ErrorPage({
  code,
  title,
  description,
}: {
  code: string;
  title: string;
  description: string;
}) {
  return (
    <main className="error-page">
      <Brand />
      <span className="error-code">{code}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link className="button" to={code === "401" ? "/login" : "/"}>
        <ArrowLeft size={18} />{" "}
        {code === "401" ? "Sign in again" : "Back to home"}
      </Link>
    </main>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow ?? "Operations workspace"}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Refresh({ onClick }: { onClick: () => void }) {
  return (
    <button className="button secondary" onClick={onClick}>
      <RefreshCw size={16} />
      Refresh
    </button>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error.name, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <ErrorPage
        code="Oops"
        title="Something went wrong"
        description="Reload the page to try again. Your saved records are safe."
      />
    ) : (
      this.props.children
    );
  }
}
