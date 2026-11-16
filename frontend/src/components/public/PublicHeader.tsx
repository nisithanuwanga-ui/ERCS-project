import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../ui";
export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="landing-header">
      <div className="landing-width landing-header-inner">
        <Brand />
        <nav
          id="public-navigation"
          className={open ? "expanded" : ""}
          aria-label="Main navigation"
        >
          <a href="#platform" onClick={() => setOpen(false)}>
            The platform
          </a>
          <a href="#workflow" onClick={() => setOpen(false)}>
            How it works
          </a>
          <a href="#access" onClick={() => setOpen(false)}>
            Built on trust
          </a>
          <Link className="mobile-sign-in" to="/login">
            Sign in to ERCS
          </Link>
        </nav>
        <div className="landing-nav-actions">
          <Link className="nav-access" to="/login">
            Sign in <ArrowUpRight size={16} />
          </Link>
          <button
            className="public-menu"
            onClick={() => setOpen((v) => !v)}
            aria-label={
              open ? "Close public navigation" : "Open public navigation"
            }
            aria-expanded={open}
            aria-controls="public-navigation"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
