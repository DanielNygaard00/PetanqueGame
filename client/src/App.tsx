// client/src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { RequireAuth } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MatchesPage } from "./pages/MatchesPage";
import { MatchFormPage } from "./pages/MatchFormPage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { LiveMatchPage } from "./pages/LiveMatchPage";
import { RivalryPage } from "./pages/RivalryPage";
import { AwardsPage } from "./pages/AwardsPage";
import { RankingsPage } from "./pages/RankingsPage";
import { RosterPage } from "./pages/RosterPage";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/matches/new" element={<MatchFormPage />} />
              <Route path="/live" element={<LiveMatchPage />} />
              <Route path="/matches/:id" element={<MatchDetailPage />} />
              <Route path="/matches/:id/edit" element={<MatchFormPage />} />
              <Route path="/rankings" element={<RankingsPage />} />
              <Route path="/awards" element={<AwardsPage />} />
              <Route path="/rivalry/:a/:b" element={<RivalryPage />} />
              <Route path="/roster" element={<RosterPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
