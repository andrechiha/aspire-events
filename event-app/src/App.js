import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './screens/auth/LoginScreen';
import SignupScreen from './screens/auth/SignupScreen';
import ResetPassword from './screens/auth/ResetPassword';
import Layout from './components/Layout';

import EventsList from './screens/client/EventsList';
import EventDetail from './screens/client/EventDetail';
import SearchEvents from './screens/client/SearchEvents';
import CalendarView from './screens/client/CalendarView';
import MyTickets from './screens/client/MyTickets';
import ProfileMenu from './screens/client/ProfileMenu';
import CommunitiesList from './screens/client/CommunitiesList';
import NotificationsScreen from './screens/client/NotificationsScreen';
import AccountSettings from './screens/client/AccountSettings';
import EventChat from './screens/client/EventChat';
import ChatsList from './screens/client/ChatsList';

import MyEvents from './screens/manager/MyEvents';
import CreateEvent from './screens/manager/CreateEvent';
import EditEvent from './screens/manager/EditEvent';
import ManagerChats from './screens/manager/ManagerChats';
import AIReport from './screens/manager/AIReport';

import PendingEvents from './screens/owner/PendingEvents';
import UsersList from './screens/owner/UsersList';
import AllEvents from './screens/owner/AllEvents';

import './App.css';

function ClientRoutes() {
  return (
    <Route element={<Layout />}>
      <Route index element={<EventsList />} />
      <Route path="search" element={<SearchEvents />} />
      <Route path="calendar" element={<CalendarView />} />
      <Route path="event/:id" element={<EventDetail />} />
      <Route path="event/:id/chat" element={<EventChat />} />
      <Route path="chats" element={<ChatsList />} />
      <Route path="my-tickets" element={<MyTickets />} />
      <Route path="profile" element={<ProfileMenu />} />
      <Route path="notifications" element={<NotificationsScreen />} />
      <Route path="settings" element={<AccountSettings />} />
      <Route path="communities" element={<CommunitiesList />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  );
}

function ManagerRoutes() {
  return (
    <Route element={<Layout />}>
      <Route index element={<MyEvents />} />
      <Route path="create-event" element={<CreateEvent />} />
      <Route path="edit-event/:id" element={<EditEvent />} />
      <Route path="event-chats" element={<ManagerChats />} />
      <Route path="event-chat/:id" element={<EventChat />} />
      <Route path="ai-report/:id" element={<AIReport />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  );
}

function OwnerRoutes() {
  return (
    <Route element={<Layout />}>
      <Route index element={<PendingEvents />} />
      <Route path="users" element={<UsersList />} />
      <Route path="all-events" element={<AllEvents />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  );
}

function RoleRoutes({ role }) {
  if (role === 'owner') return OwnerRoutes();
  if (role === 'event_manager') return ManagerRoutes();
  return ClientRoutes();
}

function AppRoutes() {
  const { session, profile, loading, isBanned } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="center-screen">
        <div className="banned-card">
          <span className="banned-icon">🚫</span>
          <h2>Account Suspended</h2>
          <p>Your account has been banned. Contact support for help.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      {RoleRoutes({ role: profile?.role })}
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
