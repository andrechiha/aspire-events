import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  Pencil, Trash2, Ticket, DollarSign, ShoppingCart, TrendingUp,
  Search, Calendar, MapPin, ChevronDown, ChevronUp, BarChart3, Wallet, QrCode,
  UserCheck, HelpCircle, XCircle,
} from 'lucide-react';
import OrderQRModal from '../../components/OrderQRModal';
import AIReportPanel from '../../components/AIReportPanel';
import './manager.css';

const SERVICE_FEE = 3.00;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function MyEvents() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [salesData, setSalesData] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [buyerNames, setBuyerNames] = useState({});
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState('');
  const [rsvpData, setRsvpData] = useState({});

  const fetchMyEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_waves(*)')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false });

    if (error) { setLoading(false); return; }

    const evIds = (data || []).map((e) => e.id);

    let ordersArr = [];
    if (evIds.length > 0) {
      const { data: orders } = await supabase
        .from('ticket_orders')
        .select('*, ticket_waves(label)')
        .in('event_id', evIds)
        .order('created_at', { ascending: false });
      ordersArr = orders || [];
    }
    setAllOrders(ordersArr);

    const sales = {};
    ordersArr.forEach((o) => {
      if (!sales[o.event_id]) sales[o.event_id] = { tickets: 0, revenue: 0, fees: 0, orders: 0 };
      sales[o.event_id].tickets += o.quantity;
      sales[o.event_id].revenue += Number(o.total_price);
      sales[o.event_id].fees += Number(o.service_fee || 0);
      sales[o.event_id].orders += 1;
    });
    setSalesData(sales);

    const buyerIds = [...new Set(ordersArr.map((o) => o.user_id))];
    if (buyerIds.length > 0) {
      const { data: bData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', buyerIds);
      const names = {};
      if (bData) bData.forEach((p) => { names[p.id] = p.full_name; });
      setBuyerNames(names);
    }

    if (evIds.length > 0) {
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select('event_id, status')
        .in('event_id', evIds);
      const rMap = {};
      (rsvps || []).forEach((r) => {
        if (!rMap[r.event_id]) rMap[r.event_id] = { attending: 0, maybe: 0, not_going: 0 };
        if (rMap[r.event_id][r.status] !== undefined) rMap[r.event_id][r.status] += 1;
      });
      setRsvpData(rMap);
    }

    setEvents(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { fetchMyEvents(); }, [fetchMyEvents]);

  const handleDelete = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    setDeleting(ev.id);
    const { error } = await supabase.from('events').delete().eq('id', ev.id);
    if (error) {
      alert(error.message);
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    }
    setDeleting(null);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatShortDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getWaveSummary = (waves) => {
    if (!waves || waves.length === 0) return null;
    const sorted = [...waves].sort((a, b) => a.wave_number - b.wave_number);
    const active = sorted.find((w) => w.is_active);
    const totalCap = sorted.reduce((s, w) => s + w.capacity, 0);
    const totalRemaining = sorted.reduce((s, w) => s + w.remaining, 0);
    return { active, totalCap, totalRemaining, count: sorted.length, waves: sorted };
  };

  const totalTicketsSold = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.tickets, 0), [salesData]);
  const totalRevenue = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.revenue, 0), [salesData]);
  const totalFees = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.fees, 0), [salesData]);
  const totalOrders = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.orders, 0), [salesData]);
  const totalGross = totalRevenue + totalFees;

  const counts = useMemo(() => ({
    all: events.length,
    pending: events.filter((e) => e.status === 'pending').length,
    approved: events.filter((e) => e.status === 'approved').length,
    rejected: events.filter((e) => e.status === 'rejected').length,
  }), [events]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? events : events.filter((e) => e.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) =>
        e.title?.toLowerCase().includes(q) ||
        e.location_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, filter, searchQuery]);

  if (loading) return <div className="empty-state"><p>Loading...</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Events</h1>
        <p>Manage events you've created</p>
      </div>

      {/* Money banner */}
      {totalOrders > 0 && (
        <div className="mg-money-banner">
          <div className="mg-money-main">
            <Wallet size={22} />
            <div>
              <span className="mg-money-total">${totalGross.toFixed(2)}</span>
              <span className="mg-money-label">Total Money From Your Events</span>
            </div>
          </div>
          <div className="mg-money-breakdown">
            <div className="mg-money-item">
              <span className="mg-money-item-val">${totalRevenue.toFixed(2)}</span>
              <span className="mg-money-item-lbl">Your Revenue</span>
            </div>
            <div className="mg-money-divider" />
            <div className="mg-money-item mg-money-item--muted">
              <span className="mg-money-item-val">${totalFees.toFixed(2)}</span>
              <span className="mg-money-item-lbl">Platform Fees (${SERVICE_FEE}/order)</span>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="mg-stats-row">
        <div className="mg-stat-card">
          <Ticket size={18} className="mg-stat-icon" />
          <div className="mg-stat-info">
            <span className="mg-stat-value">{totalTicketsSold}</span>
            <span className="mg-stat-label">Tickets Sold</span>
          </div>
        </div>
        <div className="mg-stat-card">
          <ShoppingCart size={18} className="mg-stat-icon" />
          <div className="mg-stat-info">
            <span className="mg-stat-value">{totalOrders}</span>
            <span className="mg-stat-label">Orders</span>
          </div>
        </div>
        <div className="mg-stat-card">
          <DollarSign size={18} className="mg-stat-icon" />
          <div className="mg-stat-info">
            <span className="mg-stat-value">${totalRevenue.toFixed(2)}</span>
            <span className="mg-stat-label">Revenue</span>
          </div>
        </div>
        <div className="mg-stat-card mg-stat-card--accent">
          <TrendingUp size={18} className="mg-stat-icon" />
          <div className="mg-stat-info">
            <span className="mg-stat-value">{events.length}</span>
            <span className="mg-stat-label">Events</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mg-search-bar">
        <Search size={16} className="mg-search-icon" />
        <input
          className="mg-search-input"
          placeholder="Search your events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="mg-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`mg-filter-tab ${filter === f.key ? 'mg-filter-tab--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="mg-filter-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Events */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery.trim() ? 'No events match your search.' : 'You haven\'t created any events yet.'}</p>
        </div>
      ) : (
        <div className="events-grid">
          {filtered.map((ev) => {
            const ws = getWaveSummary(ev.ticket_waves);
            const evSales = salesData[ev.id] || { tickets: 0, revenue: 0, fees: 0, orders: 0 };
            const isExpanded = expandedEvent === ev.id;
            const eventOrders = allOrders.filter((o) => o.event_id === ev.id);
            const soldPct = ws ? Math.round(((ws.totalCap - ws.totalRemaining) / ws.totalCap) * 100) : 0;

            return (
              <div className="event-card" key={ev.id}>
                <div className="event-card-top">
                  {ev.logo_url && <img src={ev.logo_url} alt="" className="event-card-logo" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                      <h3>{ev.title}</h3>
                      <span className={`status-badge status-${ev.status}`}>{ev.status}</span>
                    </div>
                    {ev.description && (
                      <p style={{ color: '#666', fontSize: 13, margin: '4px 0 0' }}>
                        {ev.description.length > 80 ? ev.description.slice(0, 80) + '...' : ev.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="event-card-meta">
                  <span><Calendar size={12} /> {formatDate(ev.start_datetime)}</span>
                </div>
                {ev.location_name && (
                  <div className="event-card-meta">
                    <span><MapPin size={12} /> {ev.location_name}</span>
                  </div>
                )}

                {ws && (
                  <>
                    <div className="event-card-waves">
                      <span><Ticket size={12} /> {ws.totalRemaining}/{ws.totalCap} tickets left</span>
                      <span className="wave-count-badge">{ws.count} wave{ws.count !== 1 ? 's' : ''}</span>
                    </div>
                    {ws.active && (
                      <div className="event-card-active-wave">
                        Active: <strong>{ws.active.label}</strong> — ${Number(ws.active.price).toFixed(2)}
                        <span className="active-wave-remaining">({ws.active.remaining} left)</span>
                      </div>
                    )}
                  </>
                )}

                {/* Sales summary */}
                <div className="mg-event-sales">
                  <div className="mg-event-sales-item">
                    <span className="mg-event-sales-val">{evSales.tickets}</span>
                    <span className="mg-event-sales-lbl">sold</span>
                  </div>
                  <div className="mg-event-sales-item">
                    <span className="mg-event-sales-val">{evSales.orders}</span>
                    <span className="mg-event-sales-lbl">orders</span>
                  </div>
                  <div className="mg-event-sales-item">
                    <span className="mg-event-sales-val">${evSales.revenue.toFixed(2)}</span>
                    <span className="mg-event-sales-lbl">revenue</span>
                  </div>
                  <div className="mg-event-sales-item mg-event-sales-item--accent">
                    <span className="mg-event-sales-val">${(evSales.revenue + evSales.fees).toFixed(2)}</span>
                    <span className="mg-event-sales-lbl">total</span>
                  </div>
                </div>

                {/* Progress bar */}
                {ws && (
                  <div className="mg-progress-wrap">
                    <div className="mg-progress-bar">
                      <div className="mg-progress-fill" style={{ width: `${soldPct}%` }} />
                    </div>
                    <span className="mg-progress-label">{soldPct}% sold</span>
                  </div>
                )}

                {/* Expand details */}
                {(evSales.orders > 0 || rsvpData[ev.id]) && (
                  <button
                    className="mg-expand-btn"
                    onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}
                  >
                    <BarChart3 size={14} />
                    {isExpanded ? 'Hide' : 'View'} Details
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="mg-detail-panel">
                    {ws && ws.waves.length > 0 && (
                      <div className="mg-detail-section">
                        <h4 className="mg-detail-title">Wave Breakdown</h4>
                        {ws.waves.map((w) => {
                          const wSold = w.capacity - w.remaining;
                          const wPct = Math.round((wSold / w.capacity) * 100);
                          return (
                            <div className="mg-wave-row" key={w.id}>
                              <div className="mg-wave-info">
                                <span className="mg-wave-name">{w.label}</span>
                                <span className="mg-wave-price">${Number(w.price).toFixed(2)}</span>
                              </div>
                              <div className="mg-wave-bar-wrap">
                                <div className="mg-wave-bar" style={{ width: `${wPct}%` }} />
                              </div>
                              <span className="mg-wave-stats">{wSold}/{w.capacity} ({wPct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* RSVP Counts */}
                    {rsvpData[ev.id] && (
                      <div className="mg-detail-section">
                        <h4 className="mg-detail-title">RSVP Responses</h4>
                        <div className="mg-rsvp-row">
                          <div className="mg-rsvp-item mg-rsvp-item--going">
                            <UserCheck size={15} />
                            <span className="mg-rsvp-count">{rsvpData[ev.id].attending}</span>
                            <span className="mg-rsvp-label">Going</span>
                          </div>
                          <div className="mg-rsvp-item mg-rsvp-item--maybe">
                            <HelpCircle size={15} />
                            <span className="mg-rsvp-count">{rsvpData[ev.id].maybe}</span>
                            <span className="mg-rsvp-label">Maybe</span>
                          </div>
                          <div className="mg-rsvp-item mg-rsvp-item--no">
                            <XCircle size={15} />
                            <span className="mg-rsvp-count">{rsvpData[ev.id].not_going}</span>
                            <span className="mg-rsvp-label">Can't Go</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mg-detail-section">
                      <h4 className="mg-detail-title">All Orders ({eventOrders.length})</h4>
                      <div className="mg-orders-list">
                        {eventOrders.map((o) => (
                          <div className="mg-order-row" key={o.id}>
                            <div className="mg-order-info">
                              <span className="mg-order-buyer">
                                {buyerNames[o.user_id] || 'Unknown'}
                                {o.is_gift && <span className="mg-gift-badge">GIFT</span>}
                              </span>
                              <span className="mg-order-nums">
                                {o.order_number && <span className="mg-order-tag">{o.order_number}</span>}
                                {o.ticket_number && <span className="mg-order-tag mg-order-tag--tkt">{o.ticket_number}</span>}
                              </span>
                              <span className="mg-order-meta">
                                {o.ticket_waves?.label || '—'} · x{o.quantity} · {formatShortDate(o.created_at)}
                              </span>
                              {o.is_gift && o.recipient_name && (
                                <span className="mg-order-recipient">Gift for: {o.recipient_name}</span>
                              )}
                              {Array.isArray(o.holder_names) && o.holder_names.length > 0 && (
                                <div className="mg-holder-names">
                                  {o.holder_names.map((name, i) => (
                                    <span key={i} className="mg-holder-tag">{name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="mg-order-right">
                              <span className="mg-order-amount">${Number(o.total_price).toFixed(2)}</span>
                              <span className="mg-order-fee">+${Number(o.service_fee || 0).toFixed(2)} fee</span>
                              <button
                                type="button"
                                className="mg-qr-btn"
                                onClick={() => { setSelectedOrder(o); setSelectedEventTitle(ev.title); }}
                              >
                                <QrCode size={14} /> QR
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <AIReportPanel
                      eventId={ev.id}
                      eventEnded={ev.end_datetime ? new Date(ev.end_datetime) < new Date() : new Date(ev.start_datetime) < new Date()}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="event-card-actions">
                  <button
                    className="ec-action-btn ec-action-btn--edit"
                    onClick={() => navigate(`/edit-event/${ev.id}`)}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  {ev.status === 'pending' && (
                    <button
                      className="ec-action-btn ec-action-btn--delete"
                      onClick={() => handleDelete(ev)}
                      disabled={deleting === ev.id}
                    >
                      <Trash2 size={14} /> {deleting === ev.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderQRModal
          order={selectedOrder}
          buyerName={buyerNames[selectedOrder.user_id]}
          eventTitle={selectedEventTitle}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
