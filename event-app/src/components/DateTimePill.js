import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function pad(n) { return String(n).padStart(2, '0'); }

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function parseValue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    year: d.getFullYear(), month: d.getMonth(), day: d.getDate(),
    hour: d.getHours(), minute: d.getMinutes(),
  };
}

function formatDisplay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' \u2022 '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function toIso(year, month, day, hour, minute) {
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export default function DateTimePill({ label, value, onChange, min, error }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const parsed = parseValue(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year || now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());
  const [selDay, setSelDay] = useState(parsed?.day || null);
  const [hour, setHour] = useState(parsed?.hour ?? 20);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);

  useEffect(() => {
    if (!open) return;
    const p = parseValue(value);
    if (p) {
      setViewYear(p.year); setViewMonth(p.month);
      setSelDay(p.day); setHour(p.hour); setMinute(p.minute);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const emit = useCallback((y, m, d, h, mi) => {
    if (d) onChange(toIso(y, m, d, h, mi));
  }, [onChange]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleDayClick = (d) => {
    setSelDay(d);
    emit(viewYear, viewMonth, d, hour, minute);
  };

  const handleHour = (h) => { setHour(h); if (selDay) emit(viewYear, viewMonth, selDay, h, minute); };
  const handleMinute = (m) => { setMinute(m); if (selDay) emit(viewYear, viewMonth, selDay, hour, m); };

  const cells = getMonthDays(viewYear, viewMonth);
  const today = new Date();
  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const toggleAmPm = () => {
    const newH = hour < 12 ? hour + 12 : hour - 12;
    handleHour(newH);
  };

  return (
    <div className={`dt-pill ${error ? 'dt-pill--error' : ''}`} ref={ref}>
      <label className="dt-pill__label">{label}</label>
      <button
        type="button"
        className={`dt-pill__btn ${value ? 'dt-pill__btn--filled' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <Calendar size={16} />
        <span>{value ? formatDisplay(value) : 'Select date & time'}</span>
        <Clock size={14} className="dt-pill__clock" />
      </button>

      {open && (
        <div className="dtp-dropdown">
          <div className="dtp-content">
            {/* Calendar */}
            <div className="dtp-calendar">
              <div className="dtp-cal-header">
                <button type="button" className="dtp-nav-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
                <span className="dtp-cal-title">{MONTHS[viewMonth]} {viewYear}</span>
                <button type="button" className="dtp-nav-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
              </div>
              <div className="dtp-weekdays">
                {WEEKDAYS.map((wd) => <span key={wd} className="dtp-wd">{wd}</span>)}
              </div>
              <div className="dtp-days">
                {cells.map((d, i) => (
                  <button
                    type="button"
                    key={i}
                    className={
                      'dtp-day' +
                      (d === null ? ' dtp-day--empty' : '') +
                      (d === selDay && viewMonth === (parseValue(value)?.month) && viewYear === (parseValue(value)?.year) ? ' dtp-day--selected' : '') +
                      (isToday(d) ? ' dtp-day--today' : '')
                    }
                    disabled={!d}
                    onClick={() => d && handleDayClick(d)}
                  >
                    {d || ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Time */}
            <div className="dtp-time">
              <span className="dtp-time-label">Time</span>
              <div className="dtp-time-display">
                <span className="dtp-time-val">{pad(h12)}</span>
                <span className="dtp-time-sep">:</span>
                <span className="dtp-time-val">{pad(minute)}</span>
                <button type="button" className="dtp-ampm" onClick={toggleAmPm}>{ampm}</button>
              </div>
              <div className="dtp-time-controls">
                <div className="dtp-time-col">
                  <label className="dtp-time-col-label">Hour</label>
                  <div className="dtp-time-scroll">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <button
                        type="button"
                        key={h}
                        className={'dtp-time-opt' + (h === h12 ? ' dtp-time-opt--active' : '')}
                        onClick={() => handleHour(ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12))}
                      >
                        {pad(h)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="dtp-time-col">
                  <label className="dtp-time-col-label">Min</label>
                  <div className="dtp-time-scroll">
                    {[0,5,10,15,20,25,30,35,40,45,50,55].map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={'dtp-time-opt' + (m === minute ? ' dtp-time-opt--active' : '')}
                        onClick={() => handleMinute(m)}
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button type="button" className="dtp-done" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}

      {error && <p className="dt-pill__error">{error}</p>}
    </div>
  );
}
