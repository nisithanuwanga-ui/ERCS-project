# Verification results

Verified on 16 November 2026. Scope: frontend and Docker/DevOps contribution on `samhi-frontend-docker`.

| Check | Result |
|---|---|
| Frontend locked dependency installation (`npm ci`) | Passed |
| Frontend TypeScript (`npm run typecheck`, also included in production build) | Passed |
| Frontend production build | Passed |
| Frontend unit tests | 16 passed across 3 files |
| Frontend lint | Passed with one pre-existing `react(set-state-in-effect)` warning in `EmergencyNetwork.tsx` |
| Backend locked dependency installation | Passed; source and lockfile unchanged |
| Teammate backend TypeScript and production build | Passed |
| Real PostgreSQL integration | Passed against isolated temporary PostgreSQL 18.6; teammate migration and actual backend used |
| Incident API | Health, DB health, validation, list, create, read, update, delete and post-delete 404 passed |
| Browser tests | 21 passed using installed Chrome; no fabricated authentication or API interception |
| Browser scope | Home, artwork, mobile layout/password controls, activation and both login failure flows, informational links, and 13 protected-route guards |
| Original frontend preservation | All 44 source files present; all original CSS and 8 public/source assets preserved byte-for-byte; additive mobile CSS only |
| Backend integrity | All 9 SHA-256 hashes match the pre-transfer baseline |
| Local and external Compose configuration parsing | Both passed with disposable placeholder environment values |
| Conflict markers / common credential patterns | No findings across 99 repository/contribution files; generated and secret paths verified ignored |
| Source backup | All 58 transferred source/configuration/utility files still match their recorded original hashes |
| GitHub Actions YAML syntax | Both workflows parsed successfully with PyYAML |
| Docker image builds / Compose container startup | Not run locally: Docker Desktop Linux engine is stopped; named pipe is unavailable |
| Authenticated Dashboard and management operations | Blocked by missing teammate APIs; not reported as passed |

The first browser attempt could not launch because the matching Chromium download failed with ECONNRESET. Browser checks subsequently passed with installed Chrome through `PLAYWRIGHT_CHANNEL=chrome`. The original failure is not counted as a successful test.

The real API integration used new temporary local database directories, fresh loopback ports and the teammate's compiled migration/server. It did not use the old backend or alter an existing team database. Temporary services were stopped. Generated dependencies, builds, browser traces and database files are excluded from the contribution.

The backend's existing `npm test` script is a deliberate failure placeholder. No backend unit test suite was claimed. Instead, unchanged backend typechecking/build and real disposable incident integration were exercised.

Public example incidents, resource quantities and response teams remain interactive illustrations, clearly labelled as sample data. Operational status labels use actual API/database responses. The classic login no longer simulates a successful sign-in, and missing notification data is not presented as an all-clear.

Container build/startup and real Nginx routing validation are configured in CI for a Docker-capable runner. The separate GHCR publication workflow is manual and was not triggered. No runtime deployment target was specified or configured.

Exact remaining API dependencies are in [API-REQUIREMENTS.md](API-REQUIREMENTS.md). The complete pre-commit file list is in [CHANGED-FILES.md](CHANGED-FILES.md).

The backend hash snapshot is enforced in CI only for the frontend contribution branch. It does not prevent the backend teammate from making legitimate changes on other branches after handoff.

Local backend verification uses the original exact-byte SHA-256 hashes. CI uses the additional canonical LF hashes to account for normal Windows/Linux Git checkout line endings; those hashes were also checked against all nine unchanged original Git blobs.
