import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Check, X, MapPin, Calendar, User, Ticket } from 'lucide-react';
import './owner.css';

export default function PendingEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [acting, setActing] = useState(null);

  const fetchPending = useCallback(async () => {
    setFetchError('');

    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_waves(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      setFetchError(error.message);
      setLoading(false);
      return;
    }

    const creatorIds = [...new Set((data || []).map((e) => e.created_by))];
    let profiles = {};
    if (creatorIds.length > 0) {
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);
      if (pData) pData.forEach((p) => { profiles[p.id] = p.full_name; });
    }

    setEvents((data || []).map((e) => ({ ...e, creator_name: profiles[e.created_by] || 'Unknown' })));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (eventId, newStatus) => {
    setActing(eventId);
    const { error } = await supabase
      .from('events')
      .update({ status: newStatus })
      .eq('id', eventId);

    if (error) {
      alert(error.message);
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
    setActing(null);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getWaveSummary = (waves) => {
    if (!waves || waves.length === 0) return null;
    const sorted = [...waves].sort((a, b) => a.wave_number - b.wave_number);
    const totalCap = sorted.reduce((s, w) => s + w.capacity, 0);
    const priceRange =
      sorted.length === 1
        ? `$${Number(sorted[0].price).toFixed(2)}`
        : `$${Number(sorted[0].price).toFixed(2)} – $${Number(sorted[sorted.length - 1].price).toFixed(2)}`;
    return { totalCap, priceRange, count: sorted.length };
  };

  if (loading) {
    return <div className="ow-empty"><p>Loading...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pending Events</h1>
        <p>Review and approve or reject submitted events</p>
      </div>

      {fetchError && (
        <div className="ow-error">Error: {fetchError}</div>
      )}

      {events.length === 0 && !fetchError ? (
        <div className="ow-empty">
          <p>No pending events — you're all caught up!</p>
        </div>
      ) : (
        <div className="ow-pending-list">
          {events.map((ev) => {
            const ws = getWaveSummary(ev.ticket_waves);
            const isActing = acting === ev.id;

            return (
              <div className="ow-review-card" key={ev.id}>
                <div className="ow-review-top">
                  {ev.logo_url && (
                    <img src={ev.logo_url} alt="" className="ow-review-logo" />
                  )}
                  <div className="ow-review-info">
                    <h3 className="ow-review-title">{ev.title}</h3>
                    <div className="ow-review-creator">
                      <User size={13} /> {ev.creator_name}
                    </div>
                  </div>
                </div>

                {ev.description && (
                  <p className="ow-review-desc">{ev.description}</p>
                )}

                <div className="ow-review-details">
                  <span><Calendar size={14} /> {formatDate(ev.start_datetime)} — {formatDate(ev.end_datetime)}</span>
                  {ev.location_name && (
                    <span><MapPin size={14} /> {ev.location_name}</span>
                  )}
                  {ws && (
                    <span>
                      <Ticket size={14} /> {ws.totalCap} tickets · {ws.count} wave{ws.count !== 1 ? 's' : ''} · {ws.priceRange}
                    </span>
                  )}
                </div>

                {ev.location_link && (
                  <a
                    href={ev.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ow-review-link"
                  >
                    View location →
                  </a>
                )}

                <div className="ow-review-actions">
                  <button
                    className="ow-btn ow-btn--approve"
                    onClick={() => handleAction(ev.id, 'approved')}
                    disabled={isActing}
                  >
                    <Check size={16} /> {isActing ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    className="ow-btn ow-btn--reject"
                    onClick={() => handleAction(ev.id, 'rejected')}
                    disabled={isActing}
                  >
                    <X size={16} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
