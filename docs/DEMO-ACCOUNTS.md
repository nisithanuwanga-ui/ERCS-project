# Local demo accounts

These fictional credentials are public examples for a **local development environment only**. They are not production secrets and must never be used for deployed access.

| Role | Email | Password |
|---|---|---|
| System Administrator | `admin@ercs.demo` | `DemoAdmin2026!` |
| Emergency Coordinator | `coordinator@ercs.demo` | `DemoCoord2026!` |
| Resource Manager | `resources@ercs.demo` | `DemoResource2026!` |
| Field Officer | `officer@ercs.demo` | `DemoOfficer2026!` |
| Authorized Viewer | `viewer@ercs.demo` | `DemoViewer2026!` |

## Explicit setup

Keep `npm run dev:database` running, or configure a local PostgreSQL connection in ignored `.env`. Then run:

```sh
npm run db:migrate
npm run db:seed-demo
npm run test:demo
```

The seed requires `NODE_ENV=development` or `test` and a loopback PostgreSQL host. It refuses hosted connections and connection-query host overrides. It stores Argon2 password hashes and marks these users `is_demo=true`. Existing non-demo users and operational records are preserved. Running it again preserves the same demo IDs and makes no duplicate audit entries. If a reserved email belongs to a non-demo user, or a demo account has been deliberately modified or disabled, the entire seed transaction fails rather than overwrite it.

No API startup, migration, Docker command, or production bootstrap invokes this seed automatically. Only the explicit seed command imports the public example passwords. They are not embedded in frontend components or production authentication code.

## Development labels and production denial

The login and authenticated identity APIs include `is_demo`; the UI can clearly label demo sessions. User-management reads also include the marker. Production login rejects demo markers and the five reserved public email identities. Authenticated middleware rejects existing flagged demo sessions as well, so changing `NODE_ENV` to production does not leave a previously signed-in demo session usable. This is an additional safeguard: never deploy a copy of a demo database as a production database.

Administrators configure accounts and references; coordinators manage incidents/review; Resource Managers manage inventory; field officers operate only within their assigned scope; viewers have read-only operational access. Demo credentials do not bypass those permissions.

`npm run test:demo` applies local migrations, verifies seed idempotency, all five password hashes and actual CSRF/session login flows, then tests production login/session/seed rejection in the verifier process. It does not change the environment of a separately running API server. See the verification log for the actual execution result.

Verified locally on 2026-11-08: migration 002 applied; five users created; repeated seed preserved identities; all five CSRF/session sign-ins succeeded; production seed/login/existing-session rejection succeeded. The verifier reported **7 checks passed**. The unit suite reported **12 tests passed** after adding the three demo safeguard cases.
