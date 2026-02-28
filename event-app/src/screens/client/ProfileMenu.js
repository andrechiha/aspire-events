import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Ticket, LogOut } from 'lucide-react';
import './client.css';

export default function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="bg-profile">
      <div className="bg-profile-avatar">
        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div className="bg-profile-name">{profile?.full_name || 'User'}</div>
      <div className="bg-profile-role">{profile?.role?.replace('_', ' ') || 'client'}</div>

      <div className="bg-profile-menu">
        <button className="bg-profile-item" onClick={() => navigate('/my-tickets')}>
          <Ticket size={20} /> My Tickets
        </button>
        <button className="bg-profile-item" onClick={() => navigate('/settings')}>
          <User size={20} /> Account
        </button>
        <button className="bg-profile-item bg-profile-item--danger" onClick={handleSignOut}>
          <LogOut size={20} /> Sign Out
        </button>
      </div>
    </div>
  );
}
