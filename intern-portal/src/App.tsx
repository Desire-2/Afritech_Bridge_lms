/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { useRouter } from './lib/router';
import { DashboardLayout } from './components/layout/DashboardLayout';

// View Screens imports
import { WelcomeView } from './components/views/WelcomeView';
import { LoginView } from './components/views/LoginView';
import { ForgotPasswordView } from './components/views/ForgotPasswordView';
import { ChangePasswordView } from './components/views/ChangePasswordView';
import { DashboardView } from './components/views/DashboardView';
import { TasksView } from './components/views/TasksView';
import { TaskDetailView } from './components/views/TaskDetailView';
import { GradesView } from './components/views/GradesView';
import { CohortView } from './components/views/CohortView';
import { OfferView } from './components/views/OfferView';
import { ProfileView } from './components/views/ProfileView';

import { Loader2 } from 'lucide-react';

function ProtectedRoutesGate() {
  const { user, token, loading } = useAuth();
  const { path, params, navigate } = useRouter();

  // 1. Loading splash screen while parsing localStorage JWT caches
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 font-sans">
        <Loader2 className="h-10 w-10 text-teal-400 animate-spin" />
        <span className="text-xs text-slate-500 font-mono">Synthesizing Intern Portal...</span>
      </div>
    );
  }

  const authenticated = !!user && !!token;

  // 2. Redirect Guard for Authenticated but with must_change_password flag active
  if (authenticated && user?.must_change_password && path !== '/intern/change-password') {
    // Force transition to Change Password screen
    navigate('/intern/change-password');
    return <ChangePasswordView onNavigate={navigate} />;
  }

  // 3. ROUTE DISPATCHER
  const renderView = () => {
    switch (path) {
      // --- PUBLIC VIEWS (Unauthenticated) ---
      case '/intern':
        if (authenticated) {
          navigate('/intern/dashboard');
          return <DashboardView onNavigate={navigate} />;
        }
        return <WelcomeView onNavigate={navigate} />;

      case '/auth/login':
        if (authenticated) {
          navigate('/intern/dashboard');
          return <DashboardView onNavigate={navigate} />;
        }
        return <LoginView onNavigate={navigate} />;

      case '/auth/forgot-password':
        if (authenticated) {
          navigate('/intern/dashboard');
          return <DashboardView onNavigate={navigate} />;
        }
        return <ForgotPasswordView onNavigate={navigate} />;

      // --- PROTECTED VIEWS (Authenticated) ---
      case '/intern/change-password':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return <ChangePasswordView onNavigate={navigate} />;

      case '/intern/dashboard':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return (
          <DashboardLayout currentPath={path} onNavigate={navigate}>
            <DashboardView onNavigate={navigate} />
          </DashboardLayout>
        );

      case '/intern/tasks':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return (
          <DashboardLayout currentPath={path} onNavigate={navigate}>
            <TasksView onNavigate={navigate} />
          </DashboardLayout>
        );

      case '/intern/grades':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return (
          <DashboardLayout currentPath={path} onNavigate={navigate}>
            <GradesView onNavigate={navigate} />
          </DashboardLayout>
        );

      case '/intern/cohort':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return (
          <DashboardLayout currentPath={path} onNavigate={navigate}>
            <CohortView />
          </DashboardLayout>
        );

      case '/intern/offer':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return (
          <DashboardLayout currentPath={path} onNavigate={navigate}>
            <OfferView />
          </DashboardLayout>
        );

      case '/intern/profile':
        if (!authenticated) {
          navigate('/auth/login');
          return <LoginView onNavigate={navigate} />;
        }
        return (
          <DashboardLayout currentPath={path} onNavigate={navigate}>
            <ProfileView onNavigate={navigate} />
          </DashboardLayout>
        );

      default:
        // Nested parameterized path match: e.g. /intern/tasks/:assignment_id
        if (path.startsWith('/intern/tasks/') && params.assignment_id) {
          if (!authenticated) {
            navigate('/auth/login');
            return <LoginView onNavigate={navigate} />;
          }
          return (
            <DashboardLayout currentPath="/intern/tasks" onNavigate={navigate}>
              <TaskDetailView assignmentId={params.assignment_id} onNavigate={navigate} />
            </DashboardLayout>
          );
        }

        // Default unmatched URL path routing: fallback to Welcome status checking
        if (authenticated) {
          navigate('/intern/dashboard');
          return (
            <DashboardLayout currentPath="/intern/dashboard" onNavigate={navigate}>
              <DashboardView onNavigate={navigate} />
            </DashboardLayout>
          );
        } else {
          navigate('/intern');
          return <WelcomeView onNavigate={navigate} />;
        }
    }
  };

  return <div className="min-h-screen bg-slate-950 font-sans selection:bg-teal-500 selection:text-white">{renderView()}</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoutesGate />
    </AuthProvider>
  );
}
