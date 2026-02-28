import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { MessageCircle, Users, ChevronRight } from 'lucide-react';
import './client.css';

export default function ChatsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    const { data: attended } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', profile.id);

    if (!attended || attended.length === 0) {
      setLoading(false);
      return;
    }

    const allEventIds = attended.map((a) => a.event_id);

    const { data: leftChats } = await supabase
      .from('chat_left_users')
      .select('event_id')
      .eq('user_id', profile.id);
    const leftIds = new Set((leftChats || []).map((l) => l.event_id));
    const eventIds = allEventIds.filter((eid) => !leftIds.has(eid));

    if (eventIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: events } = await supabase
      .from('events')
      .select('id, title, logo_url, start_datetime, location_name, chat_enabled')
      .in('id', eventIds)
      .neq('chat_enabled', false)
      .order('start_datetime', { ascending: false });

    const { data: counts } = await supabase
      .from('event_attendees')
      .select('event_id')
      .in('event_id', eventIds);

    const memberCounts = {};
    (counts || []).forEach((c) => {
      memberCounts[c.event_id] = (memberCounts[c.event_id] || 0) + 1;
    });

    const { data: lastMessages } = await supabase
      .from('event_messages')
      .select('event_id, message, message_type, created_at')
      .in('event_id', eventIds)
      .order('created_at', { ascending: false });

    const lastMsgMap = {};
    (lastMessages || []).forEach((m) => {
      if (!lastMsgMap[m.event_id]) lastMsgMap[m.event_id] = m;
    });

    const chatList = (events || []).map((ev) => ({
      ...ev,
      members: memberCounts[ev.id] || 0,
      lastMessage: lastMsgMap[ev.id]
        ? (lastMsgMap[ev.id].message_type === 'image' ? '📷 Photo'
          : lastMsgMap[ev.id].message_type === 'video' ? '🎥 Video'
          : lastMsgMap[ev.id].message_type === 'voice' ? '🎤 Voice note'
          : lastMsgMap[ev.id].message)
        : null,
      lastMessageTime: lastMsgMap[ev.id]?.created_at || null,
    }));

    chatList.sort((a, b) => {
      const tA = a.lastMessageTime ? new Date(a.lastMessageTime) : new Date(0);
      const tB = b.lastMessageTime ? new Date(b.lastMessageTime) : new Date(0);
      return tB - tA;
    });

    setChats(chatList);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const formatTime = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="bg-empty"><div className="spinner" /></div>;
  }

  return (
    <div className="cl-chats-page">
      <div className="cl-chats-header">
        <h1 className="cl-chats-title">Event Chats</h1>
        <p className="cl-chats-sub">Chat with other attendees</p>
      </div>

      {chats.length === 0 ? (
        <div className="cl-chats-empty">
          <MessageCircle size={40} />
          <p>No chats yet</p>
          <span>Buy a ticket to an event to join its chat</span>
        </div>
      ) : (
        <div className="cl-chats-list">
          {chats.map((chat) => (
            <div
              className="cl-chat-row"
              key={chat.id}
              onClick={() => navigate(`/event/${chat.id}/chat`)}
            >
              <div className="cl-chat-avatar">
                {chat.logo_url ? (
                  <img src={chat.logo_url} alt="" className="cl-chat-avatar-img" />
                ) : (
                  <div className="cl-chat-avatar-placeholder">
                    {chat.title?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="cl-chat-info">
                <div className="cl-chat-top-row">
                  <span className="cl-chat-name">{chat.title}</span>
                  {chat.lastMessageTime && (
                    <span className="cl-chat-time">{formatTime(chat.lastMessageTime)}</span>
                  )}
                </div>
                <div className="cl-chat-bottom-row">
                  {chat.lastMessage ? (
                    <span className="cl-chat-preview">
                      {chat.lastMessage.length > 50 ? chat.lastMessage.slice(0, 50) + '...' : chat.lastMessage}
                    </span>
                  ) : (
                    <span className="cl-chat-preview cl-chat-preview--empty">No messages yet</span>
                  )}
                  <span className="cl-chat-members"><Users size={12} /> {chat.members}</span>
                </div>
              </div>
              <ChevronRight size={16} className="cl-chat-arrow" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
