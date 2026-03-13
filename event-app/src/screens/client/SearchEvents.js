import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { Search, MapPin, CalendarDays } from 'lucide-react';
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

const FILTERS = ['All', 'This Week', 'Near Me'];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const geocodeCache = {};

async function geocodeAddress(address) {
  if (!address) return null;
  if (geocodeCache[address]) return geocodeCache[address];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await res.json();
    if (data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache[address] = coords;
      return coords;
    }
  } catch (_) {}
  return null;
}

export default function SearchEvents() {
  const navigate = useNavigate();
  const { location } = useOutletContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [userLoc, setUserLoc] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [eventCoords, setEventCoords] = useState({});

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

  const requestLocation = () => {
    if (userLoc) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoLoading(false); },
      () => { setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (filter !== 'Near Me' || !userLoc || events.length === 0) return;

    const toGeocode = events.filter(
      (e) => !e.latitude && !e.longitude && !eventCoords[e.id] && (e.location_address || e.location_name)
    );
    if (toGeocode.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = {};
      for (const ev of toGeocode) {
        if (cancelled) break;
        const addr = ev.location_address || ev.location_name;
        const coords = await geocodeAddress(addr);
        if (coords) results[ev.id] = coords;
      }
      if (!cancelled) setEventCoords((prev) => ({ ...prev, ...results }));
    })();

    return () => { cancelled = true; };
  }, [filter, userLoc, events, eventCoords]);

  const handleFilter = (f) => {
    setFilter(f);
    if (f === 'Near Me') requestLocation();
  };

  const { now, endOfWeek } = useMemo(() => {
    const n = new Date();
    const eow = new Date(n);
    eow.setDate(eow.getDate() + 7);
    return { now: n, endOfWeek: eow };
  }, []);

  const filtered = useMemo(() => {
    let list = events.filter((e) => !isEventPast(e) && matchesLocation(e, location));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.location_name?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      );
    }

    if (filter === 'This Week') {
      list = list.filter((e) => {
        const d = new Date(e.start_datetime);
        return d >= now && d <= endOfWeek;
      });
    }

    if (filter === 'Near Me' && userLoc) {
      list = list.map((e) => {
        const lat = e.latitude || eventCoords[e.id]?.lat;
        const lng = e.longitude || eventCoords[e.id]?.lng;
        if (lat && lng) {
          return { ...e, _dist: haversineKm(userLoc.lat, userLoc.lng, lat, lng) };
        }
        return e;
      });
      const withDist = list.filter((e) => e._dist != null).sort((a, b) => a._dist - b._dist);
      const withoutDist = list.filter((e) => e._dist == null);
      list = [...withDist, ...withoutDist];
    }

    return list;
  }, [events, query, filter, userLoc, location, eventCoords, now, endOfWeek]);

  const getActiveWave = (waves) => {
    if (!waves || waves.length === 0) return null;
    return [...waves].sort((a, b) => a.wave_number - b.wave_number).find((w) => w.is_active) || null;
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatDist = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

  if (loading) {
    return <div className="bg-empty"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="bg-search-bar">
        <Search size={18} className="bg-search-icon" />
        <input
          className="bg-search-input"
          placeholder="Search events, venues..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="bg-chips">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`bg-chip ${filter === f ? 'bg-chip--active' : ''}`}
            onClick={() => handleFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {filter === 'Near Me' && geoLoading && (
        <div className="bg-search-label"><MapPin size={14} /> Getting your location...</div>
      )}

      <div className="bg-search-label">{filtered.length} event{filtered.length !== 1 ? 's' : ''} found</div>

      <div className="bg-search-grid">
        {filtered.map((ev) => {
          const active = getActiveWave(ev.ticket_waves);
          return (
            <div className="bg-card" key={ev.id} onClick={() => navigate(`/event/${ev.id}`)}>
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
                {ev._dist != null && (
                  <span className="bg-card-meta" style={{ color: '#FFD700' }}>{formatDist(ev._dist)} away</span>
                )}
                {active && <span className="bg-card-price">From ${Number(active.price).toFixed(2)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-empty-state"><p>No events match your search.</p></div>
      )}
    </div>
  );
}
