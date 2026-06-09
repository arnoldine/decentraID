import React, { useState } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [adminToken, setAdminToken] = useState<string | null>(
    () => sessionStorage.getItem('adminToken')
  );

  function handleLogin(token: string) {
    sessionStorage.setItem('adminToken', token);
    setAdminToken(token);
  }

  function handleLogout() {
    sessionStorage.removeItem('adminToken');
    setAdminToken(null);
  }

  if (!adminToken) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard token={adminToken} onLogout={handleLogout} />;
}
