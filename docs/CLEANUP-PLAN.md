# ERCS safe cleanup audit

Audit date: 2026-11-08. This plan covers the current working tree, including the application implemented in the preceding session. It does not authorize deletion of data, unknown user files, or generated directories. No file was deleted by this audit.

## Current application boundaries

- Frontend remains the root React/TypeScript/Vite application. `src/main.tsx` imports `App.tsx`; the active router uses `HomePage`, `AuthPage`, `AppLayout`, and lazy operational feature modules.
- Backend remains Express/TypeScript in `backend/src`. Domain modules cover authentication, administration, incidents, resources, requests, allocations, teams, read queries, dashboard and shortages.
- PostgreSQL schema lives in numbered `backend/migrations`; migration checksums must not be rewritten. `.local-db` contains actual development database state and credentials. `.test-db-*` contains isolated test clusters retained for investigation.
- Unit checks use Vitest, integration checks use isolated PostgreSQL, and Playwright covers public/authenticated workflows. Docker/Compose and GitHub Actions definitions exist, but no GitHub workflow execution or successful Docker runtime has been observed.
- A separate proposal document was not found in the supplied workspace or attachment directory. Functional policy still follows the detailed user specification and documented assumptions.

## Proposed source cleanup, stage 1

The following files are tracked by Git, allowing restoration from history. Root saved the current tracked changes to ignored `.local-db/pre-cleanup-tracked.patch` before removal. Reference searches were run across `src`, `public`, `index.html`, deployment, scripts and CI. Documentation mentions below describe historical files rather than runtime imports.

| Exact path | Evidence | Planned action |
|---|---|---|
| `src/pages/LoginPage.tsx` | No import from active `App.tsx` or another reachable entrypoint; only file using legacy auth components/styles | Remove unreachable duplicate login page after preserving content in active `AuthPage` |
| `src/components/auth/LoginForm.tsx` | Imported only by unreachable `LoginPage`; still contains simulated success timer rather than the real API | Remove abandoned demo authentication code; active `AuthPage` calls real backend |
| `src/components/auth/ERCSBrand.tsx` | Imported only by unreachable `LoginPage`; active UI uses `Brand` from `src/components/ui.tsx` | Remove duplicate brand component |
| `src/components/auth/EmergencyNetwork.tsx` | Imported only by unreachable `LoginPage` | Remove once dedicated active authentication artwork is implemented |
| `src/components/auth/SecurityNotice.tsx` | Imported only by unreachable `LoginPage`; active auth renders its own security note | Remove duplicate component |
| `src/components/auth/StatusIndicator.tsx` | Imported only by unreachable `LoginPage`; static legacy operational labels have no backing service | Remove unsupported demo indicators |
| `src/styles/auth.css` | Imported only by unreachable `LoginPage`; active public/auth routes import `app.css` | Remove redundant legacy theme/reset |
| `src/App.css` | Contains only an empty-file comment; no runtime import | Remove empty scaffolding |
| `src/index.css` | Contains only an empty-file comment; imported by `src/main.tsx` | Remove empty stylesheet and its single import together |
| `src/assets/hero.png` | No runtime reference or import; initial audit documentation only | Remove unused tracked historical asset after confirming replacement visuals |
| `src/assets/react.svg` | No references; unused React starter artwork | Remove unused starter asset |
| `src/assets/vite.svg` | No references; unused Vite starter artwork | Remove unused starter asset |
| `public/favicon.svg` | Not referenced by `index.html`, which uses `public/ercs-mark.svg`; no runtime references | Remove stale Vite favicon |
| `public/icons.svg` | No references/imports in source, HTML, deployment or scripts | Remove unused tracked icon sprite |

Run `npm run typecheck`, `npm run lint`, and `npm run build` after this stage. A failed check requires correction/restoration before more cleanup. Update architecture and asset documentation so historical descriptions are not mistaken for current source.

## Files and directories to preserve

| Path | Reason |
|---|---|
| Root `Dockerfile` | Untracked user-created file present before implementation. Its ownership/intent is ambiguous; preserve rather than replacing or deleting it. Supported new container definitions are in `deploy/`. |
| `.env`, `.env.*` except the public example | Local/secret environment configuration. Do not print, commit, delete or overwrite. |
| `.local-db/` | Actual development cluster, connection configuration, administrator credentials and local safety snapshots. Not disposable scaffolding. |
| `.test-db-*`, `test-results/`, `playwright-report/`, `coverage/` | Ignored generated test artifacts. Do not delete them as a substitute for correct ignores or to claim cleanup. |
| `node_modules/`, `dist/`, `backend/dist/` | Generated install/build output already ignored. Preserve during source cleanup. |
| All `backend/migrations/` | Required schema history and checksum integrity. |
| Existing generated `public/images/operations-center.png` | Untracked prior-session output; root will preserve it until unique replacements are written and references migrated. Do not blindly delete it. |
| Active feature files, shared domain rules, tests and documentation | Required workflows and verification. No duplicate frontend/backend source tree should be introduced solely for naming aesthetics. |

## Dependencies

No runtime dependency was identified as removable: React/DOM/router/icons/charts support active views; Express/pg/session/security/validation/hash/environment packages support the real API. Dev dependencies map to build/type/lint/format/unit/integration/browser/local-DB scripts. Avoid adding an animation framework solely for decorative effects; CSS/SVG provides the requested restrained motion without another runtime dependency.

## Visual differences to implement

| Surface | Distinct composition |
|---|---|
| Home | Editorial public introduction; cinematic emergency logistics artwork; vehicles, coordinated responders and communications; public CTAs and interactive workflow |
| Login | Compact enterprise authentication; dedicated abstract secure network/geographic visualization; no Home artwork, marketing hero headline layout or background media |
| Invitation activation | Separate invitation/team artwork and account activation context; no privileged role selector and no unrestricted signup |
| Dashboard | Authenticated operational shell with database-derived charts and accessible data alternatives; no public marketing hero composition |

No video generation capability or licensed video asset was supplied. Implement original lightweight CSS/SVG motion and do not reference nonexistent MP4/WebM files or claim generated video.

## DevOps observations

- `docker info` failed because the Docker Desktop Linux engine pipe is unavailable. Docker CLI presence does not verify image builds or Compose runtime.
- Compose is an explicit loopback HTTP development setup. Production requires HTTPS/trusted-ingress configuration and Secure cookies as documented.
- CI performs type/lint/unit/integration/browser/build checks and Docker builds. It currently has no build-artifact/test-report retention; add scoped failure artifacts if useful.
- The test server uses a disposable PostgreSQL directory and OS-assigned DB port, but its fixed API/frontend ports require a single browser-suite process. Failure during startup should still stop the database, and shutdown should have bounded cleanup rather than hanging indefinitely.
- No dependency removal or structural frontend/backend migration is justified by this audit.

## Execution record

Audit/reference inspection completed. Source removal is delegated to root after it reviews this plan. This document must be updated with the exact actual deletion list and verification results once cleanup is performed.

Focused DevOps changes and checks:

- `scripts/e2e-server.ts`: waits for API bind success, cleans up startup failures, bounds HTTP shutdown, and avoids an explicit process exit before asynchronous cleanup. It preserves disposable database directories.
- `.github/workflows/ci.yml`: retains browser failure traces/screenshots for seven days using a failure-only artifact upload.
- `npx tsc --ignoreConfig --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --strict scripts/e2e-server.ts`: passed. The first invocation without TypeScript 6's `--ignoreConfig` failed with TS5112; it was corrected, not counted as a pass.
- `docker compose config --quiet`: passed with temporary fictional validation values for required environment variables; no actual credentials were printed.
- Test-server smoke: initialized a new isolated PostgreSQL cluster, applied migrations 001 and 002, started API 3005 and frontend 5175, and printed readiness. Ctrl+C released both listening ports. No browser test was run by this audit agent.
- Docker image/runtime verification remains unavailable because the Docker Desktop engine is not running; no successful container test is claimed.
