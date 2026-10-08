import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';

// Pages
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ClientsPage } from '../pages/ClientsPage';
import { ClientDetailPage } from '../pages/ClientDetailPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { ServersPage } from '../pages/ServersPage';
import { ServerDetailPage } from '../pages/ServerDetailPage';
import { AlertsPage } from '../pages/AlertsPage';
import { OperationsPage } from '../pages/OperationsPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { UsersPage } from '../pages/UsersPage';
import { CostsPage } from '../pages/CostsPage';
import { ResizeRequestsPage } from '../pages/ResizeRequestsPage';
import { IntegrationsPage } from '../pages/IntegrationsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage, UnauthorizedPage } from '../pages/NotFoundPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected Control Plane Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/servers/:id" element={<ServerDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/resize-requests" element={<ResizeRequestsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
