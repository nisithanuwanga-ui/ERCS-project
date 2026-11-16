import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./app/Auth";
import { ErrorBoundary, ErrorPage, Loading } from "./components/ui";
import { HomePage } from "./pages/HomePage";
import { InformationPage } from "./pages/InformationPage";
import { AuthPage } from "./pages/AuthPage";
import { AppLayout } from "./components/layout/AppLayout";
import { modules } from "./features/modules";
import "./styles/app.css";
import "./styles/management.css";
const Dashboard = lazy(() =>
  import("./features/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const RecordList = lazy(() =>
  import("./features/RecordList").then((m) => ({ default: m.RecordList })),
);
const IncidentsWorkspace = lazy(() =>
  import("./features/ManagementWorkspaces").then((m) => ({
    default: m.IncidentsWorkspace,
  })),
);
const InventoryWorkspace = lazy(() =>
  import("./features/ManagementWorkspaces").then((m) => ({
    default: m.InventoryWorkspace,
  })),
);
const RequestsWorkspace = lazy(() =>
  import("./features/ManagementWorkspaces").then((m) => ({
    default: m.RequestsWorkspace,
  })),
);
const AllocationsWorkspace = lazy(() =>
  import("./features/ManagementWorkspaces").then((m) => ({
    default: m.AllocationsWorkspace,
  })),
);
const TeamsWorkspace = lazy(() =>
  import("./features/ManagementWorkspaces").then((m) => ({
    default: m.TeamsWorkspace,
  })),
);
const workspaces: Record<string, React.ComponentType> = {
  incidents: IncidentsWorkspace,
  resources: InventoryWorkspace,
  "resource-requests": RequestsWorkspace,
  allocations: AllocationsWorkspace,
  teams: TeamsWorkspace,
};
const RecordEditor = lazy(() =>
  import("./features/RecordEditor").then((m) => ({ default: m.RecordEditor })),
);
const RecordDetails = lazy(() =>
  import("./features/RecordDetails").then((m) => ({
    default: m.RecordDetails,
  })),
);
const ProfilePage = lazy(() =>
  import("./features/Administration").then((m) => ({ default: m.ProfilePage })),
);
const RolesPage = lazy(() =>
  import("./features/Administration").then((m) => ({ default: m.RolesPage })),
);
const SettingsPage = lazy(() =>
  import("./features/Administration").then((m) => ({
    default: m.SettingsPage,
  })),
);
const ShortagesPage = lazy(() =>
  import("./features/Administration").then((m) => ({
    default: m.ShortagesPage,
  })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/privacy" element={<InformationPage kind="privacy" />} />
              <Route path="/security" element={<InformationPage kind="security" />} />
              <Route path="/support" element={<InformationPage kind="support" />} />
              <Route path="/login" element={<AuthPage key="login" />} />
              <Route path="/login/classic" element={<LoginPage />} />
              <Route
                path="/register"
                element={<AuthPage key="register" register />}
              />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                {Object.values(modules).map((config) => {
                  const Workspace = workspaces[config.key];
                  return (
                    <Route key={config.key}>
                      <Route
                        path={config.path}
                        element={
                          Workspace ? (
                            <Workspace />
                          ) : (
                            <RecordList config={config} />
                          )
                        }
                      />
                      {config.createPermission && (
                        <Route
                          path={`${config.path}/new`}
                          element={<RecordEditor config={config} />}
                        />
                      )}
                      <Route
                        path={`${config.path}/:id`}
                        element={<RecordDetails config={config} />}
                      />
                      {config.editPermission && (
                        <Route
                          path={`${config.path}/:id/edit`}
                          element={<RecordEditor config={config} edit />}
                        />
                      )}
                    </Route>
                  );
                })}
                <Route
                  path="/resource-requests/:id/review"
                  element={
                    <RecordDetails
                      config={modules["resource-requests"]}
                      review
                    />
                  }
                />
                <Route
                  path="/teams/:id/assignments"
                  element={<RecordDetails config={modules.teams} assignments />}
                />
                <Route path="/shortages" element={<ShortagesPage />} />
                <Route path="/admin/roles" element={<RolesPage />} />
                <Route
                  path="/profile"
                  element={<ProfilePage key="profile" />}
                />
                <Route
                  path="/profile/security"
                  element={<ProfilePage key="security" security />}
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route
                path="/403"
                element={
                  <ErrorPage
                    code="403"
                    title="Access restricted"
                    description="Your account does not have permission to access this workspace."
                  />
                }
              />
              <Route
                path="/session-expired"
                element={
                  <ErrorPage
                    code="401"
                    title="Your session has expired"
                    description="Sign in again to continue coordinating securely."
                  />
                }
              />
              <Route
                path="*"
                element={
                  <ErrorPage
                    code="404"
                    title="We couldn't find that page"
                    description="The page may have moved. Return home to find your way."
                  />
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
