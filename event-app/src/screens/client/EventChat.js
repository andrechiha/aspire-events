import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft, Send, Users, Paperclip, Mic, Image, Film,
  Pin, X, Play, Pause, MoreVertical, BarChart3, LogOut,
  Check, UserX, Shield, Reply, Trash2,
} from 'lucide-react';
import './client.css';

function VoicePlayer({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => setProgress(a.currentTime);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, [url]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const fmtTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="ec-voice-player">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button className="ec-voice-play-btn" onClick={toggle}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="ec-voice-bar">
        <div className="ec-voice-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="ec-voice-dur">{fmtTime(playing ? progress : duration)}</span>
    </div>
  );
}

function PollCard({ poll, votes, userId, onVote }) {
  const myVote = votes.find((v) => v.user_id === userId);
  const totalVotes = votes.length;
  const options = poll.options || [];

  const countFor = (optId) => votes.filter((v) => v.option_id === optId).length;

  return (
    <div className="ec-poll-card">
      <div className="ec-poll-header">
        <BarChart3 size={14} />
        <span className="ec-poll-question">{poll.question}</span>
      </div>
      <div className="ec-poll-options">
        {options.map((opt) => {
          const c = countFor(opt.id);
          const pct = totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
          const selected = myVote?.option_id === opt.id;
          return (
            <button
              key={opt.id}
              className={`ec-poll-opt ${selected ? 'ec-poll-opt--selected' : ''} ${myVote ? 'ec-poll-opt--voted' : ''}`}
              onClick={() => !myVote && onVote(poll.id, opt.id)}
              disabled={!!myVote}
            >
              <div className="ec-poll-opt-bar" style={{ width: myVote ? `${pct}%` : '0%' }} />
              <span className="ec-poll-opt-label">
                {selected && <Check size={12} />} {opt.label}
              </span>
              {myVote && <span className="ec-poll-opt-pct">{pct}%</span>}
            </button>
          );
        })}
      </div>
      <div className="ec-poll-footer">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</div>
    </div>
  );
}

function PollCreateModal({ onClose, onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const addOption = () => { if (options.length < 5) setOptions([...options, '']); };
  const updateOption = (i, v) => setOptions(options.map((o, idx) => idx === i ? v : o));
  const removeOption = (i) => { if (options.length > 2) setOptions(options.filter((_, idx) => idx !== i)); };

  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;

  const handleCreate = () => {
    if (!valid) return;
    const opts = options.filter((o) => o.trim()).map((o, i) => ({ id: `opt_${i}`, label: o.trim() }));
    onCreate(question.trim(), opts);
  };

  return (
    <div className="ec-modal-overlay" onClick={onClose}>
      <div className="ec-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ec-modal-header">
          <h3>Create Poll</h3>
          <button className="ec-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ec-modal-body">
          <input
            className="ec-modal-input"
            placeholder="Ask a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          {options.map((opt, i) => (
            <div key={i} className="ec-modal-opt-row">
              <input
                className="ec-modal-input"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
              />
              {options.length > 2 && (
                <button className="ec-modal-opt-rm" onClick={() => removeOption(i)}><X size={14} /></button>
              )}
            </div>
          ))}
          {options.length < 5 && (
            <button className="ec-modal-add-opt" onClick={addOption}>+ Add Option</button>
          )}
        </div>
        <button className="ec-modal-submit" onClick={handleCreate} disabled={!valid}>
          Create Poll
        </button>
      </div>
    </div>
  );
}

function ImageViewer({ url, onClose }) {
  return (
    <div className="ec-img-viewer" onClick={onClose}>
      <button className="ec-img-viewer-close" onClick={onClose}><X size={24} /></button>
      <img src={url} alt="" className="ec-img-viewer-img" />
    </div>
  );
}

export default function EventChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [event, setEvent] = useState(null);
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isAttendee, setIsAttendee] = useState(false);
  const [hasLeft, setHasLeft] = useState(false);

  const [polls, setPolls] = useState([]);
  const [pollVotes, setPollVotes] = useState({});
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [pinnedMsgs, setPinnedMsgs] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerImg, setViewerImg] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [kickingUser, setKickingUser] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [activeAction, setActiveAction] = useState(null);

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const initialScrollDone = useRef(false);

  const isCreator = event?.created_by === profile?.id;

  const scrollToBottom = useCallback((instant) => {
    bottomRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
  }, []);

  const fetchInitial = useCallback(async () => {
    const { data: ev } = await supabase
      .from('events')
      .select('id, title, start_datetime, end_datetime, logo_url, chat_description, chat_enabled, created_by')
      .eq('id', id)
      .single();
    if (!ev) { setLoading(false); return; }
    if (ev.chat_enabled === false) { setEvent(ev); setLoading(false); return; }
    setEvent(ev);

    const { data: allAttendees } = await supabase
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', id);
    const { data: leftUsers } = await supabase
      .from('chat_left_users')
      .select('user_id')
      .eq('event_id', id);
    const leftIds = new Set((leftUsers || []).map((l) => l.user_id));
    const activeMembers = (allAttendees || []).filter((a) => !leftIds.has(a.user_id));
    const creatorIncluded = activeMembers.some((a) => a.user_id === ev.created_by);
    setAttendeeCount(activeMembers.length + (creatorIncluded ? 0 : 1));

    const { data: att } = await supabase
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();
    setIsAttendee(!!att || ev.created_by === profile.id);

    const { data: leftRow } = await supabase
      .from('chat_left_users')
      .select('event_id')
      .eq('event_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();
    setHasLeft(!!leftRow);

    const { data: msgs } = await supabase
      .from('event_messages')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    const allMsgs = msgs || [];
    setMessages(allMsgs);
    setPinnedMsgs(allMsgs.filter((m) => m.is_pinned));

    const userIds = [...new Set(allMsgs.map((m) => m.user_id))];
    const map = { [profile.id]: profile.full_name };
    if (userIds.length > 0) {
      const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      if (pData) pData.forEach((p) => { if (p.full_name) map[p.id] = p.full_name; });
    }
    setProfiles(map);

    const { data: pollsData } = await supabase
      .from('chat_polls')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });
    setPolls(pollsData || []);

    if (pollsData && pollsData.length > 0) {
      const pollIds = pollsData.map((p) => p.id);
      const { data: votesData } = await supabase
        .from('chat_poll_votes')
        .select('*')
        .in('poll_id', pollIds);
      const vMap = {};
      (votesData || []).forEach((v) => {
        if (!vMap[v.poll_id]) vMap[v.poll_id] = [];
        vMap[v.poll_id].push(v);
      });
      setPollVotes(vMap);
    }

    setLoading(false);
  }, [id, profile.id, profile.full_name]);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  useEffect(() => {
    if (!isAttendee || hasLeft) return;

    const channel = supabase
      .channel(`event-chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${id}` },
        async (payload) => {
          const msg = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev.filter((m) => !m._optimistic || m._tempKey !== msg.message), msg];
          });

          if (!profiles[msg.user_id]) {
            const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', msg.user_id).single();
            if (p) setProfiles((prev) => ({ ...prev, [p.id]: p.full_name }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_messages', filter: `event_id=eq.${id}` },
        (payload) => {
          const updated = payload.new;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
          if (updated.is_pinned) {
            setPinnedMsgs((prev) => prev.some((m) => m.id === updated.id) ? prev : [...prev, updated]);
          } else {
            setPinnedMsgs((prev) => prev.filter((m) => m.id !== updated.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_messages', filter: `event_id=eq.${id}` },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            setPinnedMsgs((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, isAttendee, hasLeft, profiles]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (!initialScrollDone.current) {
      setTimeout(() => {
        scrollToBottom(true);
        initialScrollDone.current = true;
      }, 100);
    } else {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  const ensureProfile = (userId) => {
    if (!profiles[userId] && userId === profile.id) {
      setProfiles((prev) => ({ ...prev, [profile.id]: profile.full_name }));
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    const currentReply = replyTo;
    setReplyTo(null);

    const optimistic = {
      id: `temp_${Date.now()}`,
      event_id: id,
      user_id: profile.id,
      message: text,
      message_type: 'text',
      media_url: null,
      is_pinned: false,
      reply_to: currentReply?.id || null,
      created_at: new Date().toISOString(),
      _optimistic: true,
      _tempKey: text,
    };
    setMessages((prev) => [...prev, optimistic]);
    ensureProfile(profile.id);

    await supabase.from('event_messages').insert({
      event_id: id,
      user_id: profile.id,
      message: text,
      message_type: 'text',
      reply_to: currentReply?.id || null,
    });

    setSending(false);
  };

  const handleMediaUpload = async (file, type) => {
    if (!file) return;
    setUploading(true);
    setShowAttach(false);

    const ext = file.name?.split('.').pop() || (type === 'voice' ? 'webm' : 'bin');
    const path = `chat/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage.from('event-media').upload(path, file);
    if (upErr) { setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('event-media').getPublicUrl(path);
    const mediaUrl = urlData.publicUrl;

    const label = type === 'image' ? 'Photo' : type === 'video' ? 'Video' : 'Voice note';

    const optimistic = {
      id: `temp_${Date.now()}`,
      event_id: id,
      user_id: profile.id,
      message: label,
      message_type: type,
      media_url: mediaUrl,
      is_pinned: false,
      created_at: new Date().toISOString(),
      _optimistic: true,
      _tempKey: mediaUrl,
    };
    setMessages((prev) => [...prev, optimistic]);
    ensureProfile(profile.id);

    await supabase.from('event_messages').insert({
      event_id: id,
      user_id: profile.id,
      message: label,
      message_type: type,
      media_url: mediaUrl,
    });

    setUploading(false);
  };

  const handleFileSelect = (accept) => {
    if (accept === 'image') {
      fileRef.current?.click();
    } else {
      videoRef.current?.click();
    }
    setShowAttach(false);
  };

  const onFileChosen = (e, type) => {
    const file = e.target.files?.[0];
    if (file) handleMediaUpload(file, type);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        handleMediaUpload(file, 'voice');
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const handlePin = async (msgId, pinned) => {
    await supabase.from('event_messages').update({
      is_pinned: !pinned,
      pinned_by: !pinned ? profile.id : null,
    }).eq('id', msgId);
  };

  const handleDelete = async (msgId) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    setPinnedMsgs((prev) => prev.filter((m) => m.id !== msgId));
    setActiveAction(null);
    await supabase.from('event_messages').delete().eq('id', msgId);
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    setActiveAction(null);
  };

  const handleCreatePoll = async (question, options) => {
    const { data, error } = await supabase.from('chat_polls').insert({
      event_id: id,
      created_by: profile.id,
      question,
      options,
    }).select().single();
    if (error) { console.error('Poll creation error:', error); }
    if (data) {
      setPolls((prev) => [...prev, data]);
      setPollVotes((prev) => ({ ...prev, [data.id]: [] }));
    }
    setShowPollCreate(false);
  };

  const handleVote = async (pollId, optionId) => {
    const { data } = await supabase.from('chat_poll_votes').insert({
      poll_id: pollId,
      user_id: profile.id,
      option_id: optionId,
    }).select().single();
    if (data) {
      setPollVotes((prev) => ({
        ...prev,
        [pollId]: [...(prev[pollId] || []), data],
      }));
    }
  };

  const handleLeave = async () => {
    await supabase.from('chat_left_users').insert({ event_id: id, user_id: profile.id });
    navigate(-1);
  };

  const handleRejoin = async () => {
    await supabase.from('chat_left_users').delete().eq('event_id', id).eq('user_id', profile.id);
    setHasLeft(false);
  };

  const fetchMembers = async () => {
    const { data: att } = await supabase
      .from('event_attendees')
      .select('user_id')
      .eq('event_id', id);
    const uids = (att || []).map((a) => a.user_id);
    if (uids.length === 0) { setMembers([]); return; }

    const { data: leftData } = await supabase
      .from('chat_left_users')
      .select('user_id')
      .eq('event_id', id);
    const leftSet = new Set((leftData || []).map((l) => l.user_id));

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', uids);

    setMembers(
      (profs || []).map((p) => ({
        ...p,
        hasLeft: leftSet.has(p.id),
        isCreator: p.id === event?.created_by,
      }))
    );
  };

  const handleKick = async (userId) => {
    setKickingUser(userId);
    await supabase.from('chat_left_users').upsert(
      { event_id: id, user_id: userId },
      { onConflict: 'event_id,user_id' }
    );
    setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, hasLeft: true } : m));
    setKickingUser(null);
  };

  const handleUnkick = async (userId) => {
    setKickingUser(userId);
    await supabase.from('chat_left_users').delete().eq('event_id', id).eq('user_id', userId);
    setMembers((prev) => prev.map((m) => m.id === userId ? { ...m, hasLeft: false } : m));
    setKickingUser(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dt) =>
    new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const formatDateLabel = (dt) =>
    new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const fmtRecTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (loading) {
    return <div className="bg-empty"><div className="spinner" /></div>;
  }

  if (!event) {
    return (
      <div className="ec-page">
        <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Event not found.</p>
      </div>
    );
  }

  if (event?.chat_enabled === false) {
    return (
      <div className="ec-page">
        <div className="ec-header">
          <button className="ec-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <span className="ec-header-title">{event.title}</span>
        </div>
        <div style={{ color: '#888', textAlign: 'center', padding: 60 }}>
          <p>Chat is not enabled for this event.</p>
        </div>
      </div>
    );
  }

  if (!isAttendee) {
    return (
      <div className="ec-page">
        <div className="ec-header">
          <button className="ec-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <span className="ec-header-title">{event.title}</span>
        </div>
        <div style={{ color: '#888', textAlign: 'center', padding: 60 }}>
          <p>You need a ticket to join this chat.</p>
          <button className="ec-buy-link" onClick={() => navigate(`/event/${id}`)}>Go to Event</button>
        </div>
      </div>
    );
  }

  if (hasLeft) {
    return (
      <div className="ec-page">
        <div className="ec-header">
          <button className="ec-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <span className="ec-header-title">{event.title}</span>
        </div>
        <div className="ec-left-state">
          <p>You left this chat.</p>
          <button className="ec-rejoin-btn" onClick={handleRejoin}>Rejoin Chat</button>
        </div>
      </div>
    );
  }

  let lastDateLabel = '';

  const renderBubbleContent = (msg) => {
    const type = msg.message_type;

    if (type === 'image' && msg.media_url) {
      return (
        <div className="ec-media-bubble" onClick={() => setViewerImg(msg.media_url)}>
          <img src={msg.media_url} alt="" className="ec-media-img" />
        </div>
      );
    }
    if (type === 'video' && msg.media_url) {
      return (
        <div className="ec-media-bubble">
          <video src={msg.media_url} controls className="ec-media-video" />
        </div>
      );
    }
    if (type === 'voice' && msg.media_url) {
      return <VoicePlayer url={msg.media_url} />;
    }
    return <span className="ec-msg-text">{msg.message}</span>;
  };

  return (
    <div className="ec-page">
      {/* Hidden file inputs */}
      <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => onFileChosen(e, 'image')} />
      <input type="file" ref={videoRef} accept="video/*" style={{ display: 'none' }} onChange={(e) => onFileChosen(e, 'video')} />

      {/* Header */}
      <div className="ec-header">
        <button className="ec-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div className="ec-header-info" onClick={() => setShowGroupInfo(!showGroupInfo)}>
          {event.logo_url && <img src={event.logo_url} alt="" className="ec-header-logo" />}
          <div>
            <span className="ec-header-title">{event.title}</span>
            <span className="ec-header-sub"><Users size={12} /> {attendeeCount} members</span>
          </div>
        </div>
        <div className="ec-header-actions">
          {isCreator && (
            <button className="ec-header-act-btn" onClick={() => setShowPollCreate(true)} title="Create Poll">
              <BarChart3 size={18} />
            </button>
          )}
          <div className="ec-menu-wrap">
            <button className="ec-header-act-btn" onClick={() => setShowMenu(!showMenu)}>
              <MoreVertical size={18} />
            </button>
            {showMenu && (
              <div className="ec-dropdown">
                {isCreator && (
                  <button className="ec-dropdown-item" onClick={() => { fetchMembers(); setShowMembers(true); setShowMenu(false); }}>
                    <Users size={14} /> Members
                  </button>
                )}
                {pinnedMsgs.length > 0 && (
                  <button className="ec-dropdown-item" onClick={() => { setShowPinned(!showPinned); setShowMenu(false); }}>
                    <Pin size={14} /> Pinned ({pinnedMsgs.length})
                  </button>
                )}
                {!isCreator && (
                  <button className="ec-dropdown-item ec-dropdown-item--danger" onClick={() => {
                    setShowMenu(false);
                    setShowLeaveConfirm(true);
                  }}>
                    <LogOut size={14} /> Leave Chat
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Group info panel (WhatsApp-style, tap header to show) */}
      {showGroupInfo && (
        <div className="ec-group-info">
          {event.chat_description && (
            <p className="ec-group-info-desc">{event.chat_description}</p>
          )}
          {!event.chat_description && (
            <p className="ec-group-info-desc ec-group-info-desc--empty">No description</p>
          )}
          <div className="ec-group-info-meta">
            <span>Created {new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>{attendeeCount} members</span>
          </div>
        </div>
      )}

      {/* Pinned banner */}
      {showPinned && pinnedMsgs.length > 0 && (
        <div className="ec-pinned-banner">
          <div className="ec-pinned-header">
            <Pin size={14} /> <span>Pinned Messages</span>
            <button className="ec-pinned-close" onClick={() => setShowPinned(false)}><X size={14} /></button>
          </div>
          {pinnedMsgs.map((pm) => (
            <div className="ec-pinned-item" key={pm.id}>
              <span className="ec-pinned-sender">{profiles[pm.user_id] || 'Unknown'}</span>
              <span className="ec-pinned-text">{pm.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="ec-messages" ref={listRef} onClick={(e) => { if (e.target === e.currentTarget) setActiveAction(null); }}>
        {messages.length === 0 && polls.length === 0 && (
          <div className="ec-empty-chat"><p>No messages yet. Say hi!</p></div>
        )}

        {(() => {
          const timeline = [
            ...messages.map((m) => ({ ...m, _type: 'message' })),
            ...polls.map((p) => ({ ...p, _type: 'poll' })),
          ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          return timeline;
        })().map((item, idx, timeline) => {
          if (item._type === 'poll') {
            const poll = item;
            const dateLabel = formatDateLabel(poll.created_at);
            let showDate = false;
            if (dateLabel !== lastDateLabel) { showDate = true; lastDateLabel = dateLabel; }
            const creatorName = profiles[poll.created_by] || 'Unknown';
            const isPollMine = poll.created_by === profile.id;
            return (
              <React.Fragment key={`poll-${poll.id}`}>
                {showDate && <div className="ec-date-divider"><span>{dateLabel}</span></div>}
                <div className={`ec-msg ${isPollMine ? 'ec-msg--me' : ''}`}>
                  {!isPollMine && <div className="ec-msg-avatar">{getInitials(creatorName)}</div>}
                  <div className="ec-msg-body">
                    {!isPollMine && <span className="ec-msg-sender">{creatorName}</span>}
                    <PollCard poll={poll} votes={pollVotes[poll.id] || []} userId={profile.id} onVote={handleVote} />
                  </div>
                </div>
              </React.Fragment>
            );
          }

          const msg = item;
          const isMe = msg.user_id === profile.id;
          const senderName = profiles[msg.user_id] || 'Unknown';
          const dateLabel = formatDateLabel(msg.created_at);
          let showDate = false;
          if (dateLabel !== lastDateLabel) { showDate = true; lastDateLabel = dateLabel; }
          const prevItem = timeline[idx - 1];
          const isConsecutive = prevItem && prevItem._type === 'message' && prevItem.user_id === msg.user_id && !showDate;

          const repliedMsg = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null;
          const repliedSender = repliedMsg ? (profiles[repliedMsg.user_id] || 'Unknown') : null;
          const showActions = activeAction === msg.id;

          return (
            <React.Fragment key={msg.id}>
              {showDate && <div className="ec-date-divider"><span>{dateLabel}</span></div>}
              <div className={`ec-msg ${isMe ? 'ec-msg--me' : ''} ${isConsecutive ? 'ec-msg--consecutive' : ''}`}>
                {!isMe && !isConsecutive && <div className="ec-msg-avatar">{getInitials(senderName)}</div>}
                {!isMe && isConsecutive && <div className="ec-msg-avatar-spacer" />}
                <div className="ec-msg-body">
                  {!isMe && !isConsecutive && <span className="ec-msg-sender">{senderName}</span>}

                  {repliedMsg && (
                    <div className="ec-reply-ref">
                      <div className="ec-reply-ref-bar" />
                      <div className="ec-reply-ref-content">
                        <span className="ec-reply-ref-name">{repliedSender}</span>
                        <span className="ec-reply-ref-text">
                          {repliedMsg.message_type !== 'text' ? repliedMsg.message_type : repliedMsg.message}
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                    className={`ec-msg-bubble ${msg.message_type !== 'text' ? 'ec-msg-bubble--media' : ''}`}
                    onClick={() => !msg._optimistic && setActiveAction(showActions ? null : msg.id)}
                  >
                    {renderBubbleContent(msg)}
                    <span className="ec-msg-time">
                      {msg.is_pinned && <Pin size={9} />}
                      {formatTime(msg.created_at)}
                    </span>
                  </div>

                  {showActions && !msg._optimistic && (
                    <div className="ec-msg-actions">
                      <button className="ec-msg-action-btn" onClick={() => handleReply(msg)}>
                        <Reply size={13} /> Reply
                      </button>
                      {isCreator && (
                        <button className="ec-msg-action-btn" onClick={() => handlePin(msg.id, msg.is_pinned)}>
                          <Pin size={13} /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      {isMe && (
                        <button className="ec-msg-action-btn ec-msg-action-btn--danger" onClick={() => handleDelete(msg.id)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="ec-reply-bar">
          <div className="ec-reply-bar-accent" />
          <div className="ec-reply-bar-content">
            <span className="ec-reply-bar-name">{profiles[replyTo.user_id] || 'Unknown'}</span>
            <span className="ec-reply-bar-text">
              {replyTo.message_type !== 'text' ? replyTo.message_type : replyTo.message}
            </span>
          </div>
          <button className="ec-reply-bar-close" onClick={() => setReplyTo(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input bar */}
      {recording ? (
        <div className="ec-recording-bar">
          <button className="ec-rec-cancel" onClick={cancelRecording}><X size={18} /></button>
          <div className="ec-rec-indicator">
            <span className="ec-rec-dot" />
            <span className="ec-rec-time">{fmtRecTime(recordingTime)}</span>
          </div>
          <button className="ec-rec-send" onClick={stopRecording}><Send size={18} /></button>
        </div>
      ) : (
        <div className="ec-input-bar">
          <div className="ec-attach-wrap">
            <button className="ec-attach-btn" onClick={() => setShowAttach(!showAttach)} disabled={uploading}>
              <Paperclip size={18} />
            </button>
            {showAttach && (
              <div className="ec-attach-menu">
                <button className="ec-attach-opt" onClick={() => handleFileSelect('image')}>
                  <Image size={16} /> Photo
                </button>
                <button className="ec-attach-opt" onClick={() => handleFileSelect('video')}>
                  <Film size={16} /> Video
                </button>
              </div>
            )}
          </div>
          <button className="ec-mic-btn" onClick={startRecording} disabled={uploading} title="Voice note">
            <Mic size={18} />
          </button>
          <input
            className="ec-input"
            placeholder={uploading ? 'Uploading...' : 'Type a message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || uploading}
          />
          <button
            className="ec-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || sending || uploading}
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {showPollCreate && <PollCreateModal onClose={() => setShowPollCreate(false)} onCreate={handleCreatePoll} />}
      {viewerImg && <ImageViewer url={viewerImg} onClose={() => setViewerImg(null)} />}

      {showLeaveConfirm && (
        <div className="ec-modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="ec-leave-card" onClick={(e) => e.stopPropagation()}>
            <LogOut size={28} className="ec-leave-icon" />
            <h3 className="ec-leave-title">Leave Chat?</h3>
            <p className="ec-leave-text">You can rejoin anytime from the event page. Your ticket won't be affected.</p>
            <div className="ec-leave-actions">
              <button className="ec-leave-btn ec-leave-btn--cancel" onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
              <button className="ec-leave-btn ec-leave-btn--confirm" onClick={() => { setShowLeaveConfirm(false); handleLeave(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {showMembers && (
        <div className="ec-modal-overlay" onClick={() => setShowMembers(false)}>
          <div className="ec-members-panel" onClick={(e) => e.stopPropagation()}>
            <div className="ec-members-header">
              <h3>Members ({members.length})</h3>
              <button className="ec-members-close" onClick={() => setShowMembers(false)}><X size={18} /></button>
            </div>
            <div className="ec-members-list">
              {members.map((m) => (
                <div className={`ec-member ${m.hasLeft ? 'ec-member--left' : ''}`} key={m.id}>
                  <div className="ec-member-avatar">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt="" className="ec-member-avatar-img" />
                      : <span>{(m.full_name || '?').charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="ec-member-info">
                    <span className="ec-member-name">
                      {m.full_name || 'Unknown'}
                      {m.isCreator && <Shield size={12} className="ec-member-badge" />}
                    </span>
                    {m.hasLeft && <span className="ec-member-status">Removed</span>}
                  </div>
                  {isCreator && !m.isCreator && (
                    <button
                      className={`ec-kick-btn ${m.hasLeft ? 'ec-kick-btn--unkick' : ''}`}
                      onClick={() => m.hasLeft ? handleUnkick(m.id) : handleKick(m.id)}
                      disabled={kickingUser === m.id}
                    >
                      {m.hasLeft ? 'Restore' : <><UserX size={13} /> Kick</>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
