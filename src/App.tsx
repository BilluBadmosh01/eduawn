import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/stores/auth";
import { useTheme, applyThemeClass } from "@/stores/theme";
import { AppLayout } from "@/layouts/AppLayout";
import IndexPage from "@/pages/Index";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Uploads from "@/pages/Uploads";
import Profile from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import AdminPage from "@/pages/Admin";
import GroupsList from "@/pages/Groups";
import GroupChat from "@/pages/GroupChat";
import NotFound from "@/pages/NotFound";

export default function App() {
  const theme = useTheme((s) => s.theme);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/uploads" element={<Uploads />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/groups" element={<GroupsList />} />
          <Route path="/groups/:groupId" element={<GroupChat />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  );
}