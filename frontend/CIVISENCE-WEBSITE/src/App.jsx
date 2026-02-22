import { AnimatePresence } from "framer-motion";
import { Building2, Home, LayoutDashboard, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicOnlyRoute from "./components/auth/PublicOnlyRoute";
import BootLoader from "./components/common/BootLoader";
import PageTransition from "./components/common/PageTransition";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import MainAdminDashboard from "./pages/admin/MainAdminDashboard";
import CitizenDashboard from "./pages/citizen/CitizenDashboard";
import CitizenProfilePage from "./pages/citizen/CitizenProfilePage";
import MunicipalDashboard from "./pages/municipal/MunicipalDashboard";
import { USER_ROLES } from "./services/roleConfig";

const adminNav = [{ label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard }];

const municipalNav = [{ label: "Assigned Issues", to: "/municipal/dashboard", icon: Building2 }];

const citizenNav = [
  { label: "My Dashboard", to: "/citizen/dashboard", icon: Home },
  { label: "Profile", to: "/citizen/profile", icon: UserRound },
];

function AdminPage() {
  return (
    <DashboardLayout
      title="Main Admin Dashboard"
      subtitle="City-wide command center with analytics, map intelligence, and office controls."
      navItems={adminNav}
    >
      <PageTransition>
        <MainAdminDashboard />
      </PageTransition>
    </DashboardLayout>
  );
}

function MunicipalPage() {
  return (
    <DashboardLayout
      title="Municipal Office Dashboard"
      subtitle="Manage assigned complaints, resolution timelines, and area-level performance."
      navItems={municipalNav}
    >
      <PageTransition>
        <MunicipalDashboard />
      </PageTransition>
    </DashboardLayout>
  );
}

function CitizenDashboardPage() {
  return (
    <DashboardLayout
      title="Citizen Dashboard"
      subtitle="Track complaints, manage pending reports, and monitor live progress timelines."
      navItems={citizenNav}
    >
      <PageTransition>
        <CitizenDashboard />
      </PageTransition>
    </DashboardLayout>
  );
}

function CitizenProfileRoutePage() {
  return (
    <DashboardLayout
      title="Citizen Profile"
      subtitle="Manage personal details and profile photo for your civic identity."
      navItems={citizenNav}
    >
      <PageTransition>
        <CitizenProfilePage />
      </PageTransition>
    </DashboardLayout>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={[USER_ROLES.ADMIN]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="/municipal" element={<Navigate to="/municipal/dashboard" replace />} />
        <Route
          path="/municipal/dashboard"
          element={
            <ProtectedRoute allowedRoles={[USER_ROLES.MUNICIPAL]}>
              <MunicipalPage />
            </ProtectedRoute>
          }
        />

        <Route path="/citizen" element={<Navigate to="/citizen/dashboard" replace />} />
        <Route
          path="/citizen/dashboard"
          element={
            <ProtectedRoute allowedRoles={[USER_ROLES.CITIZEN]}>
              <CitizenDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/profile"
          element={
            <ProtectedRoute allowedRoles={[USER_ROLES.CITIZEN]}>
              <CitizenProfileRoutePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsBooting(false);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, []);

  if (isBooting) {
    return <BootLoader text="Syncing civic intelligence..." />;
  }

  return <AppRoutes />;
}

export default App;
