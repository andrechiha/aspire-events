import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Calendar, Ticket, Info, Trash2 } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './client.css';

const ICON_MAP = {
  event: Calendar,
  ticket: Ticket,
  reminder: Bell,
  info: Info,
};

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!profile?.id) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotif = async (id) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="bg-notif">
      <div className="bg-notif-top">
        <button className="bg-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        {unreadCount > 0 && (
          <button className="bg-notif-mark" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <h2 className="bg-notif-title">Notifications</h2>

      {loading ? (
        <div className="bg-notif-empty">
          <div className="bg-spinner" />
          <p>Loading...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-notif-empty">
          <Bell size={40} />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="bg-notif-list">
          {notifications.map((n) => {
            const Icon = ICON_MAP[n.type] || Bell;
            return (
              <div key={n.id} className={`bg-notif-card ${!n.read ? 'bg-notif-card--unread' : ''}`}>
                <div className={`bg-notif-icon bg-notif-icon--${n.type}`}>
                  <Icon size={18} />
                </div>
                <div className="bg-notif-body">
                  <div className="bg-notif-card-title">{n.title}</div>
                  <div className="bg-notif-msg">{n.message}</div>
                  <div className="bg-notif-time">{formatTime(n.created_at)}</div>
                </div>
                <button className="bg-notif-delete" onClick={() => removeNotif(n.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
