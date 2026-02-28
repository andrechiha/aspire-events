import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { MessageCircle, Users, ChevronRight, Brain } from 'lucide-react';
import './manager.css';

export default function ManagerChats() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, logo_url, start_datetime, chat_enabled, chat_description')
      .eq('created_by', profile.id)
      .eq('chat_enabled', true)
      .order('start_datetime', { ascending: false });

    const evs = data || [];
    const evIds = evs.map((e) => e.id);

    if (evIds.length === 0) { setEvents([]); setLoading(false); return; }

    const { data: counts } = await supabase
      .from('event_attendees')
      .select('event_id')
      .in('event_id', evIds);
    const memberMap = {};
    (counts || []).forEach((c) => { memberMap[c.event_id] = (memberMap[c.event_id] || 0) + 1; });

    const { data: msgData } = await supabase
      .from('event_messages')
      .select('event_id, message, message_type, created_at')
      .in('event_id', evIds)
      .order('created_at', { ascending: false });
    const lastMsgMap = {};
    (msgData || []).forEach((m) => { if (!lastMsgMap[m.event_id]) lastMsgMap[m.event_id] = m; });

    const { data: reports } = await supabase
      .from('ai_event_reports')
      .select('event_id, sentiment_score')
      .in('event_id', evIds);
    const reportMap = {};
    (reports || []).forEach((r) => { reportMap[r.event_id] = r; });

    setEvents(evs.map((ev) => ({
      ...ev,
      members: memberMap[ev.id] || 0,
      lastMsg: lastMsgMap[ev.id] || null,
      report: reportMap[ev.id] || null,
    })));
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fmtPreview = (msg) => {
    if (!msg) return null;
    if (msg.message_type === 'image') return '📷 Photo';
    if (msg.message_type === 'video') return '🎥 Video';
    if (msg.message_type === 'voice') return '🎤 Voice note';
    return msg.message?.length > 45 ? msg.message.slice(0, 45) + '...' : msg.message;
  };

  const fmtTime = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    const now = new Date();
    const mins = Math.floor((now - d) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Event Chats</h1>
        <p>Manage your event group chats and view AI insights</p>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <MessageCircle size={40} style={{ color: '#333' }} />
          <p>No event chats yet</p>
          <span style={{ color: '#555', fontSize: 13 }}>Enable group chat when creating an event</span>
        </div>
      ) : (
        <div className="mc-list">
          {events.map((ev) => (
            <div className="mc-card" key={ev.id}>
              <div className="mc-card-main" onClick={() => navigate(`/event-chat/${ev.id}`)}>
                <div className="mc-avatar">
                  {ev.logo_url ? (
                    <img src={ev.logo_url} alt="" className="mc-avatar-img" />
                  ) : (
                    <div className="mc-avatar-placeholder">{ev.title?.charAt(0)?.toUpperCase()}</div>
                  )}
                </div>
                <div className="mc-info">
                  <div className="mc-top-row">
                    <span className="mc-name">{ev.title}</span>
                    {ev.lastMsg && <span className="mc-time">{fmtTime(ev.lastMsg.created_at)}</span>}
                  </div>
                  <div className="mc-bottom-row">
                    <span className="mc-preview">
                      {fmtPreview(ev.lastMsg) || <em>No messages yet</em>}
                    </span>
                    <span className="mc-members"><Users size={12} /> {ev.members}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="mc-arrow" />
              </div>
              <div className="mc-actions">
                <button className="mc-action-btn" onClick={() => navigate(`/event-chat/${ev.id}`)}>
                  <MessageCircle size={14} /> Open Chat
                </button>
                <button className="mc-action-btn mc-action-btn--ai" onClick={() => navigate(`/ai-report/${ev.id}`)}>
                  <Brain size={14} /> AI Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
