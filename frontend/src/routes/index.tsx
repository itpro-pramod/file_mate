import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { ExpenseAssistantPage } from '../pages/ExpenseAssistant/ExpenseAssistantPage';
import { ExpenseIntelligencePage } from '../pages/ExpenseIntelligence/ExpenseIntelligencePage';
import { ExpensePolicyPage } from '../pages/ExpensePolicy/ExpensePolicyPage';
import { FinanceAnalyticsPage } from '../pages/FinanceAnalytics/FinanceAnalyticsPage';
import { FinanceApprovalsPage } from '../pages/FinanceApprovals/FinanceApprovalsPage';
import { LoginPage } from '../pages/Login/LoginPage';
import { MyExpensesPage } from '../pages/MyExpenses/MyExpensesPage';
import { ExpenseReportDetailPage } from '../pages/MyExpenses/ExpenseReportDetailPage';
import { ProjectsPage } from '../pages/Projects/ProjectsPage';
import { ProjectDetailPage } from '../pages/Projects/ProjectDetailPage';
import { RecentRunsPage } from '../pages/RecentRuns/RecentRunsPage';
import { RunDetailsPage } from '../pages/RunDetails/RunDetailsPage';
import { RunLogsPage } from '../pages/RunLogs/RunLogsPage';
import { SettingsPage } from '../pages/Settings/SettingsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected App Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/intelligence" replace />} />
          <Route path="/intelligence" element={<ExpenseIntelligencePage />} />
          <Route path="/assistant" element={<ExpenseAssistantPage />} />
          <Route path="/expenses" element={<MyExpensesPage />} />
          <Route path="/expenses/:reportIdentifier" element={<ExpenseReportDetailPage />} />
          <Route path="/finance/approvals" element={<FinanceApprovalsPage />} />
          <Route path="/finance/analytics" element={<FinanceAnalyticsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectCode" element={<ProjectDetailPage />} />
          <Route path="/runs" element={<RecentRunsPage />} />
          <Route path="/runs/:traceId" element={<RunDetailsPage />} />
          <Route path="/logs" element={<RunLogsPage />} />
          <Route path="/policy" element={<ExpensePolicyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/assistant" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
