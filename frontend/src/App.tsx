import { Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { LoginPage, RegisterPage } from "@/pages/Auth";
import OnboardingPage from "@/pages/Onboarding";
import DashboardPage from "@/pages/Dashboard";
import LibraryPage from "@/pages/Library";
import GameDetailPage from "@/pages/GameDetail";
import NewsCenterPage from "@/pages/NewsCenter";
import UpdatesPage from "@/pages/Updates";
import CalendarPage from "@/pages/Calendar";
import ExplorePage from "@/pages/Explore";
import SavedPage from "@/pages/Saved";
import NotificationsPage from "@/pages/Notifications";
import SettingsPage from "@/pages/Settings";
import NotFoundPage from "@/pages/NotFound";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/game/:gameId" element={<GameDetailPage />} />
        <Route path="/news" element={<NewsCenterPage />} />
        <Route path="/updates" element={<UpdatesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
