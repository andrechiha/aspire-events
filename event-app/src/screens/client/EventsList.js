import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { MapPin, CalendarDays, ChevronRight } from 'lucide-react';
import './client.css';

function matchesLocation(ev, location) {
  if (!location || location === 'Anywhere') return true;
  const loc = location.toLowerCase();
  return (
    (ev.location_address || '').toLowerCase().includes(loc) ||
    (ev.location_name || '').toLowerCase().includes(loc) ||
    (ev.location_city || '').toLowerCase().includes(loc) ||
    (ev.location_country || '').toLowerCase().includes(loc)
  );
}

function isEventPast(ev) {
  const end = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
  return end < new Date();
}

export default function EventsList() {
  const navigate = useNavigate();
  const { location } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_waves(*)')
      .eq('status', 'approved')
      .order('start_datetime', { ascending: true });
    if (!error) setEvents(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const locFiltered = useMemo(() => events.filter((e) => matchesLocation(e, location)), [events, location]);

  const { startOfToday, endOfWeek } = useMemo(() => {
    const n = new Date();
    const sot = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const eow = new Date(sot);
    eow.setDate(eow.getDate() + 7);
    return { startOfToday: sot, endOfWeek: eow };
  }, []);

  const thisWeek = useMemo(() =>
    locFiltered.filter((e) => {
      const d = new Date(e.start_datetime);
      return d >= startOfToday && d <= endOfWeek;
    }),
  [locFiltered, startOfToday, endOfWeek]);

  const upcoming = useMemo(() =>
    locFiltered.filter((e) => new Date(e.start_datetime) > endOfWeek),
  [locFiltered, endOfWeek]);

  const past = useMemo(() =>
    locFiltered
      .filter(isEventPast)
      .sort((a, b) => new Date(b.end_datetime || b.start_datetime) - new Date(a.end_datetime || a.start_datetime)),
  [locFiltered]);

  const heroEvents = locFiltered.filter((e) => !isEventPast(e)).slice(0, 8);
  const [heroIdx, setHeroIdx] = useState(0);
  const heroTimer = useRef(null);
  const touchStart = useRef(null);
  const touchDelta = useRef(0);

  const resetTimer = useCallback(() => {
    if (heroTimer.current) clearInterval(heroTimer.current);
    if (heroEvents.length <= 1) return;
    heroTimer.current = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % heroEvents.length);
    }, 3000);
  }, [heroEvents.length]);

  useEffect(() => {
    resetTimer();
    return () => clearInterval(heroTimer.current);
  }, [resetTimer]);

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };

  const onTouchMove = (e) => {
    if (touchStart.current == null) return;
    touchDelta.current = e.touches[0].clientX - touchStart.current;
  };

  const onTouchEnd = () => {
    if (Math.abs(touchDelta.current) > 50) {
      if (touchDelta.current < 0) {
        setHeroIdx((prev) => (prev + 1) % heroEvents.length);
      } else {
        setHeroIdx((prev) => (prev - 1 + heroEvents.length) % heroEvents.length);
      }
      resetTimer();
    }
    touchStart.current = null;
    touchDelta.current = 0;
  };

  const getActiveWave = (waves) => {
    if (!waves || waves.length === 0) return null;
    return [...waves].sort((a, b) => a.wave_number - b.wave_number).find((w) => w.is_active) || null;
  };

  const isSoldOut = (waves) => {
    if (!waves || waves.length === 0) return true;
    return waves.every((w) => w.remaining === 0);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatDateTime = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return <div className="bg-empty"><div className="spinner" /></div>;
  }

  return (
    <div className="bg-home">
      {heroEvents.length > 0 && (
        <div
          className="bg-hero"
          onClick={() => navigate(`/event/${heroEvents[heroIdx].id}`)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="bg-hero-track" style={{ transform: `translateX(-${heroIdx * 100}%)` }}>
            {heroEvents.map((ev) => (
              <div className="bg-hero-slide" key={ev.id}>
                {ev.logo_url ? (
                  <img src={ev.logo_url} alt="" className="bg-hero-img" />
                ) : (
                  <div className="bg-hero-img bg-hero-placeholder" />
                )}
              </div>
            ))}
          </div>
          <div className="bg-hero-overlay">
            <h2 className="bg-hero-title">{heroEvents[heroIdx].title}</h2>
            <div className="bg-hero-meta">
              <span><CalendarDays size={14} /> {formatDate(heroEvents[heroIdx].start_datetime)}</span>
              {heroEvents[heroIdx].location_name && <span><MapPin size={14} /> {heroEvents[heroIdx].location_name}</span>}
            </div>
          </div>
          {heroEvents.length > 1 && (
            <div className="bg-hero-dots">
              {heroEvents.map((_, i) => (
                <button
                  key={i}
                  className={`bg-hero-dot ${i === heroIdx ? 'bg-hero-dot--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setHeroIdx(i); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {thisWeek.length > 0 && (
        <Section title="This Week" onSeeAll={() => navigate('/search')}>
          <div className="bg-hscroll">
            {thisWeek.map((ev) => (
              <EventCard key={ev.id} ev={ev} navigate={navigate} formatDate={formatDate} getActiveWave={getActiveWave} />
            ))}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming" onSeeAll={() => navigate('/search')}>
          <div className="bg-hscroll">
            {upcoming.slice(0, 10).map((ev) => (
              <EventCard key={ev.id} ev={ev} navigate={navigate} formatDate={formatDate} getActiveWave={getActiveWave} />
            ))}
          </div>
        </Section>
      )}

      {past.length > 0 && (
        <Section title="Past Events" onSeeAll={() => navigate('/search', { state: { filter: 'Past' } })}>
          <div className="bg-hscroll">
            {past.slice(0, 10).map((ev) => (
              <EventCard key={ev.id} ev={ev} navigate={navigate} formatDate={formatDate} getActiveWave={getActiveWave} isPast />
            ))}
          </div>
        </Section>
      )}

      {locFiltered.length > 0 && (
        <Section title="All Events" onSeeAll={() => navigate('/search')}>
          <div className="bg-list">
            {locFiltered.map((ev) => {
              const active = getActiveWave(ev.ticket_waves);
              const soldOut = isSoldOut(ev.ticket_waves);
              return (
                <div className="bg-list-row" key={ev.id} onClick={() => navigate(`/event/${ev.id}`)}>
                  {ev.logo_url ? (
                    <img src={ev.logo_url} alt="" className="bg-list-thumb" />
                  ) : (
                    <div className="bg-list-thumb bg-list-thumb--empty" />
                  )}
                  <div className="bg-list-info">
                    <span className="bg-list-title">{ev.title}</span>
                    <span className="bg-list-sub">
                      {ev.location_name && <><MapPin size={12} /> {ev.location_name} · </>}
                      {formatDateTime(ev.start_datetime)}
                    </span>
                    {active && !soldOut && (
                      <span className="bg-list-price">From ${Number(active.price).toFixed(2)}</span>
                    )}
                  </div>
                  <button className="bg-buynow" onClick={(e) => { e.stopPropagation(); navigate(`/event/${ev.id}`); }}>
                    BUY NOW
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {locFiltered.length === 0 && (
        <div className="bg-empty-state">
          <p>{location && location !== 'Anywhere' ? `No events found in ${location}.` : 'No events available right now.'}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, onSeeAll, children }) {
  return (
    <div className="bg-section">
      <div className="bg-section-header">
        <h3 className="bg-section-title">{title}</h3>
        {onSeeAll && (
          <button className="bg-see-all" onClick={onSeeAll}>
            SEE ALL <ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function EventCard({ ev, navigate, formatDate, getActiveWave, isPast }) {
  const active = getActiveWave(ev.ticket_waves);
  return (
    <div className={`bg-card ${isPast ? 'bg-card--past' : ''}`} onClick={() => navigate(`/event/${ev.id}`)}>
      {ev.logo_url ? (
        <img src={ev.logo_url} alt="" className="bg-card-img" />
      ) : (
        <div className="bg-card-img bg-card-img--empty" />
      )}
      <div className="bg-card-body">
        <span className="bg-card-title">{ev.title}</span>
        {ev.location_name && (
          <span className="bg-card-meta"><MapPin size={11} /> {ev.location_name}</span>
        )}
        <span className="bg-card-meta"><CalendarDays size={11} /> {formatDate(ev.start_datetime)}</span>
        {isPast ? <span className="bg-card-past">Ended</span> : active && <span className="bg-card-price">From ${Number(active.price).toFixed(2)}</span>}
      </div>
    </div>
  );
}
