import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import api from '../../services/api';

export const DashboardLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/alerts?status=active');
        if (res.data?.success) {
          setActiveAlerts(res.data.data || []);
        }
      } catch (err) {
        // Soft fail
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#0a0c10] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {/* Desktop Sticky Sidebar */}
      <div className="hidden lg:block h-full shrink-0">
        <Sidebar activeAlertsCount={activeAlerts.length} />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex">
            <Sidebar
              isMobile
              activeAlertsCount={activeAlerts.length}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          activeAlerts={activeAlerts}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
