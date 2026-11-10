import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./app/Auth";
import { ErrorBoundary, ErrorPage, Loading } from "./components/ui";
import { HomePage } from "./pages/HomePage";
import { AuthPage } from "./pages/AuthPage";
import { AppLayout } from "./components/layout/AppLayout";
import { modules } from "./features/modules";
import "./styles/app.css";
const Dashboard = lazy(() =>
  import("./features/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const RecordList = lazy(() =>
  import("./features/RecordList").then((m) => ({ default: m.RecordList })),
);
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

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<AuthPage key="login" />} />
              <Route
                path="/register"
                element={<AuthPage key="register" register />}
              />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                {Object.values(modules).map((config) => (
                  <Route key={config.key}>
                    <Route
                      path={config.path}
                      element={<RecordList config={config} />}
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
                ))}
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
