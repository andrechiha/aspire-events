import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { MapPin, CalendarDays, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
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

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  return cells;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarView() {
  const navigate = useNavigate();
  const { location } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }, []);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today);

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

  const locEvents = useMemo(() => events.filter((e) => matchesLocation(e, location)), [events, location]);

  const eventDatesMap = useMemo(() => {
    const map = {};
    locEvents.forEach((e) => {
      const k = dateKey(new Date(e.start_datetime));
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [locEvents]);

  const filtered = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    end.setDate(end.getDate() + 1);
    return locEvents.filter((e) => {
      const d = new Date(e.start_datetime);
      return d >= start && d < end;
    });
  }, [locEvents, selectedDate]);

  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const goToday = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setSelectedDate(today);
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  };

  const isSameDay = (a, b) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  const getActiveWave = (waves) => {
    if (!waves || waves.length === 0) return null;
    return [...waves].sort((a, b) => a.wave_number - b.wave_number).find((w) => w.is_active) || null;
  };

  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="bg-empty"><div className="spinner" /></div>;
  }

  return (
    <div>
      {/* Month nav */}
      <div className="cal-month-nav">
        <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={20} /></button>
        <button className="cal-month-label" onClick={goToday}>{monthLabel}</button>
        <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={20} /></button>
      </div>

      {/* Weekday headers */}
      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((w) => <span key={w} className="cal-weekday">{w}</span>)}
      </div>

      {/* Day cells */}
      <div className="cal-grid cal-days">
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} className="cal-cell cal-cell--empty" />;
          const cellDate = new Date(viewYear, viewMonth, day);
          const isToday = isSameDay(cellDate, today);
          const isSelected = isSameDay(cellDate, selectedDate);
          const key = dateKey(cellDate);
          const count = eventDatesMap[key] || 0;

          return (
            <button
              key={i}
              className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${isSelected ? 'cal-cell--selected' : ''} ${count > 0 ? 'cal-cell--has-events' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              <span className="cal-cell-num">{day}</span>
              {count > 0 && <span className="cal-cell-dot" />}
            </button>
          );
        })}
      </div>

      {/* Selected date label */}
      <div className="cal-selected-label">
        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        <span className="cal-selected-count">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Events list */}
      {filtered.length === 0 && (
        <div className="bg-empty-state"><p>No events on this date.</p></div>
      )}

      {filtered.map((ev) => {
        const active = getActiveWave(ev.ticket_waves);
        return (
          <div className="bg-cal-row" key={ev.id} onClick={() => navigate(`/event/${ev.id}`)}>
            {ev.logo_url ? (
              <img src={ev.logo_url} alt="" className="bg-cal-thumb" />
            ) : (
              <div className="bg-cal-thumb bg-cal-thumb--empty" />
            )}
            <div className="bg-cal-info">
              <span className="bg-cal-title">{ev.title}</span>
              {ev.location_name && (
                <span className="bg-cal-sub"><MapPin size={12} /> {ev.location_name}</span>
              )}
              <span className="bg-cal-sub">
                <CalendarDays size={12} /> {formatTime(ev.start_datetime)}
              </span>
              {active && (
                <span className="bg-cal-price"><Ticket size={12} /> From ${Number(active.price).toFixed(2)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
