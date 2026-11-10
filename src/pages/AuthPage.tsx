import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand, Message } from "../components/ui";
import { useAuth } from "../app/useAuth";
import { api } from "../services/api";
import {
  SecureNetworkVisual,
  InvitationVisual,
} from "../components/public/AccessVisuals";
import "../styles/access.css";
export function AuthPage({ register = false }: { register?: boolean }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    setPending(true);
    try {
      if (register) {
        if (password !== form.get("confirm"))
          throw new Error("Passwords do not match.");
        await api("/auth/activate", {
          method: "POST",
          body: JSON.stringify({
            token: form.get("token"),
            name: form.get("name"),
            email: form.get("email"),
            password,
          }),
        });
        setSuccess(true);
      } else {
        await signIn(
          String(form.get("email")),
          password,
          form.get("remember") === "on",
        );
        navigate("/dashboard");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <main
      className={`access-page ${register ? "activation-page" : "signin-page"}`}
    >
      <section className="access-form-panel">
        <div className="access-header">
          <Brand />
          <Link className="back-link" to="/">
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
        <div className="access-form-card">
          <span className="icon-circle blue">
            <LockKeyhole size={24} />
          </span>
          <span className="eyebrow">
            {register
              ? "Authorized personnel only"
              : "Your operations workspace"}
          </span>
          <h1>{register ? "Welcome to the team." : "Welcome back."}</h1>
          <p>
            {register
              ? "Activate your account using the invitation issued by your administrator."
              : "Sign in to access the Emergency Resource Coordination System."}
          </p>
          {error && <Message>{error}</Message>}
          {success ? (
            <>
              <Message success>
                Your account is ready. Sign in to access your workspace.
              </Message>
              <Link className="button" to="/login">
                Continue to sign in <ArrowRight size={17} />
              </Link>
            </>
          ) : (
            <form onSubmit={submit} className="form-stack" aria-busy={pending}>
              {register && (
                <>
                  <label>
                    Invitation token
                    <input
                      name="token"
                      autoComplete="off"
                      required
                      defaultValue={
                        new URLSearchParams(window.location.search).get(
                          "token",
                        ) ?? ""
                      }
                    />
                  </label>
                  <label>
                    Full name
                    <input
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                </>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="name@organization.gov"
                />
              </label>
              <label>
                Password
                <span className="password-wrap">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    required
                    minLength={register ? 12 : 1}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {register ? (
                <>
                  <small>
                    Use at least 12 characters, including uppercase, lowercase,
                    and a number.
                  </small>
                  <label>
                    Confirm password
                    <input
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                    />
                  </label>
                </>
              ) : (
                <div className="form-inline">
                  <label className="checkbox">
                    <input name="remember" type="checkbox" /> Remember this
                    device for 7 days
                  </label>
                </div>
              )}
              <button className="button full" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : register
                    ? "Activate account"
                    : "Sign in securely"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          <p className="auth-switch">
            {register
              ? "Already have an account?"
              : "Invited to join your team?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Activate your account"}
            </Link>
          </p>
          <div className="security-note">
            <ShieldCheck size={18} />
            <span>
              Access is restricted to authorized emergency response personnel.
              Contact your administrator for account assistance.
            </span>
          </div>
        </div>
        <div className="access-form-footer">
          <small>© 2026 ERCS · Built for coordinated response.</small>
          {import.meta.env.DEV && <span>Development workspace</span>}
        </div>
      </section>
      {register ? <InvitationVisual /> : <SecureNetworkVisual />}
    </main>
  );
}
