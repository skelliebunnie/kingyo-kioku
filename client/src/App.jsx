import { Route, Routes } from "react-router";

import SettingsProvider from "./context/SettingsProvider";
import { useSettings } from "./context/SettingsContext";

import SiteHeader from "./components/SiteHeader";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthProvider from "./context/AuthProvider";

// GENERAL PAGES
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";

// SIGNED-IN PAGES
import UserInfoPage from "./pages/UserInfoPage";

// FLASHCARD PAGES
import StudyPage from "./pages/StudyPage";
import SiteFooter from "./components/SiteFooter";

const AppShell = () => {
  const { wrapperClasses } = useSettings();   // e.g. "dark jp-handwritten"

  return (
    <div className={`page-wrapper ${wrapperClasses}`}>
      <SiteHeader />
      <main className="site-content">
      <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage />} />

            {/* Everything inside here requires a signed-in user */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<UserInfoPage />} />
              <Route path="/study" element={<StudyPage />} />
            </Route>
          </Routes>
      </main>
      <SiteFooter />
    </div>
  );
};

const App = () => {

  return (
    <SettingsProvider>
      <AuthProvider>
      <AppShell />
    </AuthProvider>
    </SettingsProvider>
  );
};

export default App;
