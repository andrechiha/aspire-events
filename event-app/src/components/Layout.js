import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home, Search, CalendarDays, Ticket, Menu,
  ClipboardList, PlusCircle, MessageCircle,
  Shield, Users, Calendar, LogOut,
  Bell, MapPin, ChevronDown, Globe, Building2, MapPinned, X, MessagesSquare,
} from 'lucide-react';
import './Layout.css';

const CLIENT_TABS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/chats', icon: MessageCircle, label: 'Chats' },
  { to: '/my-tickets', icon: Ticket, label: 'Tickets' },
  { to: '/profile', icon: Menu, label: 'Menu' },
];

const SIDEBAR_ITEMS = {
  event_manager: [
    { to: '/', icon: ClipboardList, label: 'My Events' },
    { to: '/create-event', icon: PlusCircle, label: 'Create Event' },
    { to: '/event-chats', icon: MessagesSquare, label: 'Event Chats' },
  ],
  owner: [
    { to: '/', icon: Shield, label: 'Pending Events' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/all-events', icon: Calendar, label: 'All Events' },
  ],
};

const API_URL = 'https://countriesnow.space/api/v0.1/countries';
let _countriesCache = null;

async function fetchCountriesData() {
  if (_countriesCache) return _countriesCache;
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    if (!json.error && json.data) {
      _countriesCache = json.data;
      return _countriesCache;
    }
  } catch (_) { /* fallback below */ }
  _countriesCache = [
    { country: 'Lebanon', cities: ['Beirut','Tripoli','Sidon','Byblos','Jounieh','Batroun','Zahle','Baalbek','Tyre','Aley','Beit Mery','Broummana','Ehden','Bcharre','Jbeil','Dbayeh','Antelias','Kaslik','Hamra','Achrafieh','Mar Mikhael','Gemmayze'] },
    { country: 'Turkey', cities: ['Istanbul','Ankara','Izmir','Antalya','Bursa','Bodrum','Cappadocia'] },
    { country: 'United States', cities: ['New York','Los Angeles','Chicago','Miami','San Francisco','Las Vegas','Austin'] },
    { country: 'United Kingdom', cities: ['London','Manchester','Birmingham','Edinburgh','Liverpool','Bristol'] },
    { country: 'Germany', cities: ['Berlin','Munich','Hamburg','Frankfurt','Cologne','Stuttgart'] },
    { country: 'France', cities: ['Paris','Lyon','Marseille','Nice','Bordeaux','Toulouse'] },
    { country: 'Spain', cities: ['Madrid','Barcelona','Valencia','Seville','Bilbao','Malaga'] },
    { country: 'Italy', cities: ['Rome','Milan','Florence','Naples','Venice','Turin'] },
    { country: 'Canada', cities: ['Toronto','Montreal','Vancouver','Ottawa','Calgary'] },
    { country: 'Australia', cities: ['Sydney','Melbourne','Brisbane','Perth','Adelaide'] },
    { country: 'Brazil', cities: ['São Paulo','Rio de Janeiro','Brasília','Salvador','Curitiba'] },
    { country: 'Japan', cities: ['Tokyo','Osaka','Kyoto','Yokohama','Nagoya'] },
    { country: 'South Korea', cities: ['Seoul','Busan','Incheon','Daegu','Jeju'] },
    { country: 'India', cities: ['Mumbai','Delhi','Bangalore','Chennai','Kolkata','Hyderabad'] },
    { country: 'Mexico', cities: ['Mexico City','Cancún','Guadalajara','Monterrey','Playa del Carmen'] },
    { country: 'Netherlands', cities: ['Amsterdam','Rotterdam','The Hague','Utrecht','Eindhoven'] },
    { country: 'United Arab Emirates', cities: ['Dubai','Abu Dhabi','Sharjah','Ajman'] },
  ];
  return _countriesCache;
}

function LocationPicker({ isOpen, onClose, onSelect, currentLocation }) {
  const [mode, setMode] = useState('main');
  const [searchVal, setSearchVal] = useState('');
  const [countriesData, setCountriesData] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && countriesData.length === 0) {
      setApiLoading(true);
      fetchCountriesData().then((data) => {
        setCountriesData(data);
        setApiLoading(false);
      });
    }
  }, [isOpen, countriesData.length]);

  if (!isOpen) return null;

  const countryNames = countriesData.map((c) => c.country).sort();
  const cities = selectedCountry
    ? (countriesData.find((c) => c.country === selectedCountry)?.cities || []).sort()
    : [];

  const list = mode === 'country' ? countryNames : cities;
  const filtered = list.filter((i) =>
    i.toLowerCase().includes(searchVal.toLowerCase())
  );

  const goBack = () => {
    if (mode === 'cities') {
      setMode('city');
      setSelectedCountry(null);
      setSearchVal('');
    } else {
      setMode('main');
      setSearchVal('');
    }
  };

  const modeLabel = mode === 'country' ? 'Country' : mode === 'city' ? 'Country' : 'City';

  return (
    <div className="cl-loc-dropdown" ref={ref}>
      {mode === 'main' ? (
        <>
          <div className="cl-loc-header">
            <span>Select Location</span>
            <button className="cl-loc-close" onClick={onClose}><X size={16} /></button>
          </div>
          <button
            className={`cl-loc-option ${currentLocation === 'Anywhere' ? 'cl-loc-option--active' : ''}`}
            onClick={() => { onSelect('Anywhere'); onClose(); }}
          >
            <Globe size={18} /> Anywhere
          </button>
          <button className="cl-loc-option" onClick={() => { setMode('country'); setSearchVal(''); }}>
            <Building2 size={18} /> Select Country <ChevronDown size={14} className="cl-loc-arrow" />
          </button>
          <button className="cl-loc-option" onClick={() => { setMode('city'); setSearchVal(''); setSelectedCountry(null); }}>
            <MapPinned size={18} /> Select City <ChevronDown size={14} className="cl-loc-arrow" />
          </button>
        </>
      ) : mode === 'city' && !selectedCountry ? (
        <>
          <div className="cl-loc-header">
            <button className="cl-loc-back" onClick={() => { setMode('main'); setSearchVal(''); }}>
              ← Pick a country first
            </button>
            <button className="cl-loc-close" onClick={onClose}><X size={16} /></button>
          </div>
          <input
            className="cl-loc-search"
            placeholder="Search country..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            autoFocus
          />
          <div className="cl-loc-list">
            {apiLoading && <div className="cl-loc-empty">Loading countries...</div>}
            {!apiLoading && countryNames
              .filter((c) => c.toLowerCase().includes(searchVal.toLowerCase()))
              .map((c) => (
                <button
                  key={c}
                  className="cl-loc-item"
                  onClick={() => { setSelectedCountry(c); setMode('cities'); setSearchVal(''); }}
                >
                  {c} <ChevronDown size={12} className="cl-loc-arrow" />
                </button>
              ))}
            {!apiLoading && countryNames.filter((c) => c.toLowerCase().includes(searchVal.toLowerCase())).length === 0 && (
              <div className="cl-loc-empty">No countries found</div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="cl-loc-header">
            <button className="cl-loc-back" onClick={goBack}>
              ← {mode === 'cities' ? selectedCountry : modeLabel}
            </button>
            <button className="cl-loc-close" onClick={onClose}><X size={16} /></button>
          </div>
          <input
            className="cl-loc-search"
            placeholder={`Search ${mode === 'country' ? 'country' : 'city'}...`}
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            autoFocus
          />
          <div className="cl-loc-list">
            {apiLoading && <div className="cl-loc-empty">Loading...</div>}
            {!apiLoading && filtered.map((item) => (
              <button
                key={item}
                className={`cl-loc-item ${currentLocation === item ? 'cl-loc-item--active' : ''}`}
                onClick={() => { onSelect(item); onClose(); setMode('main'); setSelectedCountry(null); }}
              >
                {item}
              </button>
            ))}
            {!apiLoading && filtered.length === 0 && (
              <div className="cl-loc-empty">No results found</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const role = profile?.role || 'client';
  const isClient = role === 'client';
  const [locOpen, setLocOpen] = useState(false);
  const [location, setLocation] = useState('Anywhere');

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).join('').toLowerCase().slice(0, 2)
    : '?';

  if (isClient) {
    return (
      <div className="cl-layout">
        <header className="cl-topbar">
          <div className="cl-topbar-logo" onClick={() => navigate('/')}>ASPIRE EVENTS</div>
          <div className="cl-topbar-actions">
            <button className="cl-topbar-btn" onClick={() => navigate('/notifications')} title="Notifications">
              <Bell size={20} />
            </button>
            <div className="cl-loc-wrapper">
              <button className="cl-topbar-btn" onClick={() => setLocOpen(!locOpen)} title="Location">
                <MapPin size={20} />
              </button>
              <LocationPicker
                isOpen={locOpen}
                onClose={() => setLocOpen(false)}
                onSelect={setLocation}
                currentLocation={location}
              />
            </div>
            <button className="cl-topbar-avatar" onClick={() => navigate('/settings')} title="My Account">
              {initials}
            </button>
          </div>
        </header>
        <main className="cl-main">
          <Outlet context={{ location }} />
        </main>
        <nav className="cl-tab-bar">
          {CLIENT_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `cl-tab ${isActive ? 'cl-tab--active' : ''}`
              }
            >
              <tab.icon size={22} />
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  const items = SIDEBAR_ITEMS[role] || [];

  return (
    <div className="adm-layout">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-header">
          <span className="adm-logo">🎫</span>
          <span className="adm-title">Aspire Events</span>
        </div>

        <nav className="adm-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `adm-nav-item ${isActive ? 'adm-nav-item--active' : ''}`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="adm-footer">
          <div className="adm-user">
            <div className="adm-avatar">
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="adm-user-info">
              <span className="adm-name">{profile?.full_name}</span>
              <span className="adm-role">{role.replace('_', ' ')}</span>
            </div>
          </div>
          <button className="adm-logout" onClick={handleSignOut}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}
