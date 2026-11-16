import {
  Check,
  CheckCheck,
  KeyRound,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
export function SecureNetworkVisual() {
  return (
    <section
      className="access-visual network-visual"
      aria-label="Secure network visualization"
    >
      <div className="access-visual-top">
        <span className="access-visual-index">
          ERCS / AUTHORIZED OPERATIONS
        </span>
        <span className="visual-security-label">
          <ShieldCheck size={13} /> Secure access
        </span>
      </div>
      <div className="network-artwork">
        <svg
          className="network-map"
          viewBox="0 0 600 500"
          role="img"
          aria-label="Abstract geographic network connecting an authorized user to incident, inventory and response team systems"
        >
          <defs>
            <pattern
              id="secure-grid"
              width="35"
              height="35"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M35 0H0V35"
                fill="none"
                stroke="#9cb9d0"
                strokeOpacity=".17"
              />
            </pattern>
            <radialGradient id="secure-halo">
              <stop stopColor="#bfdde9" stopOpacity=".7" />
              <stop offset="1" stopColor="#eaf1f6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="600" height="500" fill="url(#secure-grid)" />
          <ellipse
            cx="300"
            cy="245"
            rx="230"
            ry="200"
            fill="url(#secure-halo)"
          />
          <path
            d="m124 91 61 22 16 42 60 19 36-38 43 8 27-29 36 35 43 6 30 56-10 48 23 38-29 54-33 20-10 43-55 18-46-26-32-59-49-13-18-46-49-39 9-48-32-33Z"
            fill="#d7e5ec"
            fillOpacity=".45"
            stroke="#b8d0dc"
            strokeWidth="1"
          />
          <g fill="none" stroke="#a0bfce" strokeWidth=".8" opacity=".6">
            <path d="m185 113 30 91 84 42-10 109M261 174l38 72 104 15 43-105M147 239l152 7 103 116M340 144l-41 102 52 84 60 7M215 204l90-68M299 246l-16 91 58 39" />
            <circle cx="300" cy="247" r="80" />
            <circle cx="300" cy="247" r="135" />
            <circle cx="300" cy="247" r="192" strokeDasharray="2 9" />
          </g>
          <g
            className="secure-connections"
            fill="none"
            stroke="#438cb8"
            strokeWidth="1.5"
            strokeDasharray="4 7"
          >
            <path d="M300 247C230 250 235 132 165 126" />
            <path d="M300 247C365 249 385 145 448 157" />
            <path d="M300 247C375 263 350 350 425 367" />
            <path d="M300 247C232 248 238 364 161 353" />
          </g>
          <g fill="#73b6c5" stroke="#eaf3f8" strokeWidth="5">
            <circle cx="165" cy="126" r="7" />
            <circle cx="448" cy="157" r="7" />
            <circle cx="425" cy="367" r="7" />
            <circle cx="161" cy="353" r="7" />
          </g>
        </svg>
        <div className="network-core">
          <div className="core-rings" />
          <span>
            <ShieldCheck size={41} strokeWidth={1.4} />
          </span>
          <small>AUTHORIZED ACCESS</small>
        </div>
        <div className="network-tag tag-incidents">
          <span />
          <div>
            <small>INCIDENT CONTEXT</small>
            <strong>Shared awareness</strong>
          </div>
          <Check size={13} />
        </div>
        <div className="network-tag tag-resources">
          <span />
          <div>
            <small>RESOURCE VISIBILITY</small>
            <strong>Ready to coordinate</strong>
          </div>
        </div>
        <div className="network-security-card">
          <span>
            <KeyRound size={18} />
          </span>
          <div>
            <strong>Your role. Your workspace.</strong>
            <small>Access designed around responsibility.</small>
          </div>
          <LockKeyhole size={14} />
        </div>
      </div>
      <div className="access-visual-copy">
        <span className="eyebrow">Confidence starts with connection</span>
        <h2>
          A clear connection.
          <br />A shared responsibility.
        </h2>
        <p>
          Enter a focused workspace where people, resources and operational
          decisions stay connected.
        </p>
        <div className="access-visual-foot">
          <span>
            <ShieldCheck size={13} /> Role-based access
          </span>
          <span>
            <CheckCheck size={13} /> Accountable workflows
          </span>
        </div>
      </div>
    </section>
  );
}
export function InvitationVisual() {
  return (
    <section
      className="access-visual invitation-visual"
      aria-label="Authorized team invitation visualization"
    >
      <div className="access-visual-top">
        <span className="access-visual-index">ERCS / TEAM ACTIVATION</span>
        <span className="visual-security-label">
          <UserCheck size={13} /> By invitation
        </span>
      </div>
      <div className="invitation-artwork">
        <svg
          className="invitation-lines"
          viewBox="0 0 600 440"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="invite-dots"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill="#abc7bd" opacity=".4" />
            </pattern>
          </defs>
          <rect width="600" height="440" fill="url(#invite-dots)" />
          <circle cx="300" cy="220" r="154" fill="none" stroke="#c6ddd3" />
          <circle
            cx="300"
            cy="220"
            r="192"
            fill="none"
            stroke="#d4e3db"
            strokeDasharray="3 10"
          />
          <path
            className="invite-connection"
            d="M137 135C300 30 300 400 465 300M130 320C290 420 310 30 470 125"
            fill="none"
            stroke="#93bcad"
            strokeDasharray="4 8"
          />
        </svg>
        <div className="invite-person person-one">
          <span>
            <Users size={22} />
          </span>
          <div>
            <small>SHARED PURPOSE</small>
            <strong>Response team</strong>
          </div>
          <Check size={14} />
        </div>
        <div className="invitation-envelope">
          <div className="invitation-sheet">
            <span className="envelope-seal">
              <ShieldCheck size={32} />
            </span>
            <small>YOU HAVE BEEN INVITED</small>
            <strong>A place on the team.</strong>
            <span className="letter-line" />
            <span className="letter-line short-line" />
            <span className="invitation-stamp">
              <UserCheck size={12} /> Authorized personnel
            </span>
          </div>
          <div className="envelope-front" />
          <span className="envelope-check">
            <MailCheck size={24} />
          </span>
        </div>
        <div className="invite-person person-two">
          <span>
            <UserCheck size={22} />
          </span>
          <div>
            <small>DEFINED RESPONSIBILITY</small>
            <strong>Your authorized role</strong>
          </div>
          <Check size={14} />
        </div>
      </div>
      <div className="access-visual-copy">
        <span className="eyebrow">A stronger response starts together</span>
        <h2>
          You belong in
          <br />
          the bigger picture.
        </h2>
        <p>
          Your administrator has made space for you. Activate your account and
          connect with the people behind the response.
        </p>
        <div className="access-visual-foot">
          <span>
            <MailCheck size={13} /> Invitation-based access
          </span>
          <span>
            <ShieldCheck size={13} /> Your role, assigned securely
          </span>
        </div>
      </div>
    </section>
  );
}
