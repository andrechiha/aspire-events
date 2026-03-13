import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import {
  ArrowLeft, RefreshCw, ThumbsUp, ThumbsDown,
  Lightbulb, Hash, AlertCircle, TrendingUp, MessageCircle,
  Calendar, Sparkles, Star, HelpCircle, Zap,
} from 'lucide-react';
import './manager.css';

const OPENAI_KEY = process.env.REACT_APP_OPENAI_KEY;

export default function AIReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expectations');
  const [msgStats, setMsgStats] = useState({ total: 0, before: 0, during: 0, after: 0 });
  const [allMessages, setAllMessages] = useState([]);

  const [expData, setExpData] = useState(null);
  const [expLoading, setExpLoading] = useState(false);
  const [expError, setExpError] = useState('');

  const [fbData, setFbData] = useState(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState('');

  const fetchData = useCallback(async () => {
    const { data: ev } = await supabase
      .from('events')
      .select('id, title, logo_url, start_datetime, end_datetime, created_by')
      .eq('id', id)
      .single();
    setEvent(ev);

    const { data: rep } = await supabase
      .from('ai_event_reports')
      .select('*')
      .eq('event_id', id)
      .maybeSingle();

    if (rep) {
      const cachedExp = rep.expectations_data || null;
      if (cachedExp) {
        setExpData(cachedExp);
      } else if (rep.expectations_summary && rep.expectations_summary !== 'No messages to analyze.') {
        setExpData({ expectations_summary: rep.expectations_summary, top_topics: rep.top_topics });
      }
      const cachedFb = rep.feedback_data || null;
      if (cachedFb) {
        setFbData(cachedFb);
      } else if (rep.feedback_summary && rep.feedback_summary !== 'No messages to analyze.') {
        setFbData({
          feedback_summary: rep.feedback_summary,
          sentiment_score: rep.sentiment_score,
          positives: rep.positives,
          negatives: rep.negatives,
          suggestions: rep.suggestions,
          top_topics: rep.top_topics,
        });
      }
    }

    const { data: msgs } = await supabase
      .from('event_messages')
      .select('message, message_type, created_at')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    const textMsgs = (msgs || []).filter((m) => m.message && m.message.trim().length >= 2 && m.message_type === 'text');
    setAllMessages(textMsgs);

    if (textMsgs.length > 0 && ev) {
      const start = new Date(ev.start_datetime);
      const end = ev.end_datetime ? new Date(ev.end_datetime) : start;
      let before = 0, during = 0, after = 0;
      textMsgs.forEach((m) => {
        const t = new Date(m.created_at);
        if (t < start) before++;
        else if (t > end) after++;
        else during++;
      });
      setMsgStats({ total: textMsgs.length, before, during, after });
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const callOpenAI = async (systemPrompt, userContent) => {
    if (!OPENAI_KEY || OPENAI_KEY === 'paste_your_key_here') throw new Error('OpenAI API key not configured. Add it to .env file as REACT_APP_OPENAI_KEY');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI error: HTTP ${res.status}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');
    return JSON.parse(content);
  };

  const sample = (arr, max) =>
    arr.length <= max ? arr : arr.filter((_, i) => i % Math.ceil(arr.length / max) === 0).slice(0, max);

  const generateExpectations = async () => {
    setExpLoading(true);
    setExpError('');
    try {
      if (!event) throw new Error('Event not loaded');
      const start = new Date(event.start_datetime);
      const preMsgs = allMessages.filter((m) => new Date(m.created_at) < start).map((m) => m.message);
      if (preMsgs.length === 0) throw new Error('No pre-event messages found. Messages sent before ' + start.toLocaleDateString() + ' will appear here.');

      const sampled = sample(preMsgs, 300);
      const systemPrompt = `You are an expert event analyst. Analyze the pre-event chat messages from attendees and produce a JSON report about their EXPECTATIONS.

The event: "${event.title}"
Event date: ${event.start_datetime}

Produce this exact JSON:
{
  "expectations_summary": "3-5 sentence detailed summary of what attendees are expecting, hoping for, and excited about",
  "excitement_level": <integer 0-100>,
  "top_expectations": ["expectation 1", "expectation 2", ...],
  "concerns": ["concern 1", "concern 2", ...],
  "questions_asked": ["question 1", "question 2", ...],
  "top_topics": [{"topic": "name", "count": <mentions>}, ...]
}

Rules:
- Keep each list to 3-7 items
- top_topics should have 3-5 entries sorted by count desc
- Be insightful and detailed in the summary`;

      const parsed = await callOpenAI(systemPrompt, `=== PRE-EVENT MESSAGES (${preMsgs.length} total) ===\n${sampled.join('\n')}`);
      parsed.message_count = preMsgs.length;
      setExpData(parsed);

      await supabase.from('ai_event_reports').upsert({
        event_id: id,
        expectations_summary: parsed.expectations_summary || '',
        expectations_data: parsed,
        message_count: allMessages.length,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'event_id' });

    } catch (e) { setExpError(e.message); }
    setExpLoading(false);
  };

  const generateFeedback = async (useDuringEvent = false) => {
    setFbLoading(true);
    setFbError('');
    try {
      if (!event) throw new Error('Event not loaded');
      const start = new Date(event.start_datetime);
      const end = event.end_datetime ? new Date(event.end_datetime) : start;
      let targetMsgs;
      let label;
      if (useDuringEvent) {
        targetMsgs = allMessages.filter((m) => {
          const t = new Date(m.created_at);
          return t >= start && t <= end;
        }).map((m) => m.message);
        label = 'during-event';
        if (targetMsgs.length === 0) throw new Error('No during-event messages found.');
      } else {
        targetMsgs = allMessages.filter((m) => new Date(m.created_at) > end).map((m) => m.message);
        label = 'post-event';
        if (targetMsgs.length === 0) throw new Error('No post-event feedback messages found yet.');
      }

      const sampled = sample(targetMsgs, 300);
      const isDuring = label === 'during-event';
      const systemPrompt = `You are an expert event feedback analyst. Analyze the ${isDuring ? 'during-event' : 'post-event'} chat messages from attendees and produce a JSON report about their FEEDBACK${isDuring ? ' and reactions during the event' : ''}.

The event: "${event.title}"
Event date: ${event.start_datetime} to ${event.end_datetime || event.start_datetime}

Produce this exact JSON:
{
  "feedback_summary": "3-5 sentence detailed summary of attendee feedback${isDuring ? ' and reactions during the event' : ' after the event'}",
  "sentiment_score": <integer 0-100, 0=very negative, 50=neutral, 100=very positive>,
  "positives": ["positive point 1", "positive point 2", ...],
  "negatives": ["negative point 1", "negative point 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "top_topics": [{"topic": "name", "count": <mentions>}, ...]
}

Rules:
- Keep each list to 3-7 items
- top_topics should have 3-5 entries sorted by count desc
- Be insightful and detailed`;

      const parsed = await callOpenAI(systemPrompt, `=== ${isDuring ? 'DURING-EVENT' : 'POST-EVENT'} FEEDBACK (${targetMsgs.length} total) ===\n${sampled.join('\n')}`);
      parsed.message_count = targetMsgs.length;
      setFbData(parsed);

      await supabase.from('ai_event_reports').upsert({
        event_id: id,
        feedback_summary: parsed.feedback_summary || '',
        feedback_data: parsed,
        sentiment_score: Math.min(100, Math.max(0, parseInt(parsed.sentiment_score) || 50)),
        positives: parsed.positives || [],
        negatives: parsed.negatives || [],
        suggestions: parsed.suggestions || [],
        top_topics: parsed.top_topics || [],
        message_count: allMessages.length,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'event_id' });

    } catch (e) { setFbError(e.message); }
    setFbLoading(false);
  };

  const eventEnded = event?.end_datetime
    ? new Date(event.end_datetime) < new Date()
    : event?.start_datetime ? new Date(event.start_datetime) < new Date() : false;

  const sentimentColor = (s) => s >= 70 ? '#22c55e' : s >= 40 ? '#eab308' : '#ef4444';
  const sentimentLabel = (s) => {
    if (s >= 80) return 'Very Positive';
    if (s >= 60) return 'Positive';
    if (s >= 40) return 'Neutral';
    if (s >= 20) return 'Negative';
    return 'Very Negative';
  };

  if (loading) return <div className="empty-state" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}><div className="spinner" /></div>;
  if (!event) return <div className="empty-state"><p>Event not found</p></div>;

  return (
    <div className="air-page">
      <button className="air-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Back
      </button>

      <div className="air-event-banner">
        {event.logo_url && <img src={event.logo_url} alt="" className="air-event-img" />}
        <div className="air-event-info">
          <h1 className="air-event-title">{event.title}</h1>
          <div className="air-event-meta">
            <span><Calendar size={13} /> {new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className={`air-event-status ${eventEnded ? 'air-event-status--ended' : ''}`}>
              {eventEnded ? 'Ended' : 'Upcoming'}
            </span>
          </div>
        </div>
      </div>

      <div className="air-stats">
        <div className="air-stat">
          <MessageCircle size={16} />
          <div>
            <span className="air-stat-val">{msgStats.total}</span>
            <span className="air-stat-lbl">Total</span>
          </div>
        </div>
        <div className="air-stat">
          <TrendingUp size={16} />
          <div>
            <span className="air-stat-val">{msgStats.before}</span>
            <span className="air-stat-lbl">Pre-Event</span>
          </div>
        </div>
        <div className="air-stat">
          <Star size={16} />
          <div>
            <span className="air-stat-val">{msgStats.after}</span>
            <span className="air-stat-lbl">Post-Event</span>
          </div>
        </div>
      </div>

      <div className="air-tabs">
        <button
          className={`air-tab ${activeTab === 'expectations' ? 'air-tab--active' : ''}`}
          onClick={() => setActiveTab('expectations')}
        >
          <Sparkles size={15} /> Expectations
        </button>
        <button
          className={`air-tab ${activeTab === 'feedback' ? 'air-tab--active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          <MessageCircle size={15} /> Feedback
        </button>
      </div>

      {activeTab === 'expectations' && (
        <div className="air-tab-content">
          <div className="air-gen-section">
            <div className="air-gen-header">
              <Sparkles size={20} className="air-brain" />
              <div>
                <h2 className="air-gen-title">Expectations Analysis</h2>
                <p className="air-gen-sub">
                  {expData ? `Based on ${expData.message_count || msgStats.before} pre-event messages` : msgStats.before > 0 ? `${msgStats.before} pre-event messages available` : 'No pre-event messages yet'}
                </p>
              </div>
            </div>
            <button className="air-gen-btn" onClick={generateExpectations} disabled={expLoading}>
              <RefreshCw size={14} className={expLoading ? 'ai-spin' : ''} />
              {expLoading ? 'Analyzing...' : expData ? 'Regenerate' : 'Generate'}
            </button>
          </div>

          {expError && <div className="air-error"><AlertCircle size={14} /> {expError}</div>}

          {expData && (
            <div className="air-report">
              {expData.expectations_summary && (
                <div className="air-card air-card--exp">
                  <h3 className="air-card-title"><Sparkles size={16} /> What Attendees Expect</h3>
                  <p className="air-card-text">{expData.expectations_summary}</p>
                </div>
              )}

              {expData.excitement_level != null && (
                <div className="air-excitement">
                  <span className="air-excitement-label">Excitement Level</span>
                  <div className="air-excitement-bar">
                    <div className="air-excitement-fill" style={{ width: `${expData.excitement_level}%` }} />
                  </div>
                  <span className="air-excitement-val">{expData.excitement_level}%</span>
                </div>
              )}

              {expData.top_expectations?.length > 0 && (
                <div className="air-card">
                  <h3 className="air-card-title"><Star size={16} /> Top Expectations</h3>
                  <ul className="air-list">
                    {expData.top_expectations.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {expData.concerns?.length > 0 && (
                <div className="air-card air-card--neg">
                  <h3 className="air-card-title"><AlertCircle size={16} /> Concerns</h3>
                  <ul className="air-list">
                    {expData.concerns.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}

              {expData.questions_asked?.length > 0 && (
                <div className="air-card">
                  <h3 className="air-card-title"><HelpCircle size={16} /> Questions Asked</h3>
                  <ul className="air-list">
                    {expData.questions_asked.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}

              {expData.top_topics?.length > 0 && (
                <div className="air-card">
                  <h3 className="air-card-title"><Hash size={16} /> Most Discussed</h3>
                  <div className="air-topics">
                    {expData.top_topics.map((t, i) => (
                      <span className="air-topic" key={i}>
                        {t.topic} <span className="air-topic-count">{t.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="air-tab-content">
          <div className="air-gen-section">
            <div className="air-gen-header">
              <Zap size={20} className="air-brain" style={{ color: '#22c55e' }} />
              <div>
                <h2 className="air-gen-title">Feedback Analysis</h2>
                <p className="air-gen-sub">
                  {!eventEnded
                    ? 'Available after the event ends'
                    : fbData ? `Based on ${fbData.message_count || msgStats.after} post-event messages` : msgStats.after > 0 ? `${msgStats.after} post-event messages available` : 'No post-event messages yet'}
                </p>
              </div>
            </div>
            {eventEnded && (
              <div className="air-gen-btns">
                <button className="air-gen-btn air-gen-btn--fb" onClick={() => generateFeedback(false)} disabled={fbLoading}>
                  <RefreshCw size={14} className={fbLoading ? 'ai-spin' : ''} />
                  {fbLoading ? 'Analyzing...' : fbData ? 'Regenerate' : 'Generate'}
                </button>
                {msgStats.after === 0 && msgStats.during > 0 && (
                  <button className="air-gen-btn air-gen-btn--during" onClick={() => generateFeedback(true)} disabled={fbLoading} title="Use messages sent during the event">
                    <RefreshCw size={14} className={fbLoading ? 'ai-spin' : ''} />
                    Use during-event ({msgStats.during})
                  </button>
                )}
              </div>
            )}
          </div>

          {!eventEnded && (
            <div className="air-locked">
              <Zap size={32} />
              <p>Feedback analysis will be available after the event ends.</p>
              <span>Attendees will share their experience in the group chat after the event.</span>
            </div>
          )}

          {eventEnded && msgStats.after === 0 && !fbData && (
            <div className="air-empty-feedback">
              <MessageCircle size={28} className="air-empty-feedback-icon" />
              <h3 className="air-empty-feedback-title">No post-event feedback yet</h3>
              <p className="air-empty-feedback-text">
                Feedback is generated from messages sent in the <strong>event chat after the event end time</strong>.
                Right now there are no messages from after the event.
              </p>
              <p className="air-empty-feedback-hint">
                Encourage attendees to open the event page and tap <strong>Join Event Chat</strong> to share how it went.
                New messages they send will count as post-event feedback and you can generate the report here.
              </p>
              {msgStats.during > 0 && (
                <p className="air-empty-feedback-fallback">
                  You have <strong>{msgStats.during} during-event</strong> messages. You can generate a feedback-style report from those below.
                </p>
              )}
            </div>
          )}

          {fbError && <div className="air-error"><AlertCircle size={14} /> {fbError}</div>}

          {fbData && eventEnded && (
            <div className="air-report">
              {fbData.sentiment_score != null && (
                <div className="air-sentiment">
                  <div className="air-sentiment-ring" style={{ '--color': sentimentColor(fbData.sentiment_score) }}>
                    <svg viewBox="0 0 100 100" className="air-ring-svg">
                      <circle cx="50" cy="50" r="42" className="air-ring-bg" />
                      <circle cx="50" cy="50" r="42" className="air-ring-fill"
                        strokeDasharray={`${(fbData.sentiment_score / 100) * 264} 264`}
                      />
                    </svg>
                    <span className="air-ring-score">{fbData.sentiment_score}</span>
                  </div>
                  <div className="air-sentiment-text">
                    <span className="air-sentiment-label" style={{ color: sentimentColor(fbData.sentiment_score) }}>
                      {sentimentLabel(fbData.sentiment_score)}
                    </span>
                    <span className="air-sentiment-sub">Overall sentiment</span>
                  </div>
                </div>
              )}

              {fbData.feedback_summary && (
                <div className="air-card">
                  <h3 className="air-card-title"><MessageCircle size={16} /> Feedback Summary</h3>
                  <p className="air-card-text">{fbData.feedback_summary}</p>
                </div>
              )}

              {fbData.positives?.length > 0 && (
                <div className="air-card air-card--pos">
                  <h3 className="air-card-title"><ThumbsUp size={16} /> What Went Well</h3>
                  <ul className="air-list">
                    {fbData.positives.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}

              {fbData.negatives?.length > 0 && (
                <div className="air-card air-card--neg">
                  <h3 className="air-card-title"><ThumbsDown size={16} /> Areas of Concern</h3>
                  <ul className="air-list">
                    {fbData.negatives.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              {fbData.suggestions?.length > 0 && (
                <div className="air-card air-card--sug">
                  <h3 className="air-card-title"><Lightbulb size={16} /> Suggestions</h3>
                  <ul className="air-list">
                    {fbData.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {fbData.top_topics?.length > 0 && (
                <div className="air-card">
                  <h3 className="air-card-title"><Hash size={16} /> Most Discussed</h3>
                  <div className="air-topics">
                    {fbData.top_topics.map((t, i) => (
                      <span className="air-topic" key={i}>
                        {t.topic} <span className="air-topic-count">{t.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
