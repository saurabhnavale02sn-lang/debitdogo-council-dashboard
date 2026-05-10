import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import CouncilOverview from './pages/CouncilOverview';
import RunLogs from './pages/RunLogs';
import AuditLog from './pages/AuditLog';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RevenuePage from './pages/RevenuePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/council" replace />} />
            <Route path="council" element={<CouncilOverview />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:brandId" element={<ClientDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="revenue" element={<RevenuePage />} />
            <Route path="runs" element={<RunLogs />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/council" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#1A1A1A',
            color: '#fff',
            fontSize: '14px',
          },
        }}
      />
    </AuthProvider>
  );
}
