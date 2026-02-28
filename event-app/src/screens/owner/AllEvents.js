import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import {
  Calendar, MapPin, User, Ticket, DollarSign,
  ShoppingCart, ChevronDown, ChevronUp, Award, BarChart3,
  Search, Wallet, PiggyBank, QrCode,
  UserCheck, HelpCircle, XCircle,
} from 'lucide-react';
import OrderQRModal from '../../components/OrderQRModal';
import AIReportPanel from '../../components/AIReportPanel';
import './owner.css';

const SERVICE_FEE = 3.00;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function AllEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState(null);
  const [salesData, setSalesData] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [buyerNames, setBuyerNames] = useState({});
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState('');
  const [rsvpData, setRsvpData] = useState({});

  const fetchAll = useCallback(async () => {
    setFetchError('');

    const { data, error } = await supabase
      .from('events')
      .select('*, ticket_waves(*)')
      .order('created_at', { ascending: false });

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

    const { data: orders } = await supabase
      .from('ticket_orders')
      .select('*, ticket_waves(label)')
      .order('created_at', { ascending: false });

    const sales = {};
    const ordersArr = orders || [];
    setAllOrders(ordersArr);

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

    const evIds = (data || []).map((e) => e.id);
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

    setEvents((data || []).map((e) => ({ ...e, creator_name: profiles[e.created_by] || 'Unknown' })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const changeStatus = async (eventId, newStatus) => {
    setUpdating(eventId);
    const { error } = await supabase
      .from('events')
      .update({ status: newStatus })
      .eq('id', eventId);

    if (error) {
      alert(error.message);
    } else {
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: newStatus } : e))
      );
    }
    setUpdating(null);
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatShortDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getWaveSummary = (waves) => {
    if (!waves || waves.length === 0) return null;
    const sorted = [...waves].sort((a, b) => a.wave_number - b.wave_number);
    const totalCap = sorted.reduce((s, w) => s + w.capacity, 0);
    const totalRemaining = sorted.reduce((s, w) => s + w.remaining, 0);
    return { totalCap, totalRemaining, count: sorted.length, waves: sorted };
  };

  const totalTicketsSold = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.tickets, 0), [salesData]);
  const totalRevenue = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.revenue, 0), [salesData]);
  const totalFees = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.fees, 0), [salesData]);
  const totalOrders = useMemo(() => Object.values(salesData).reduce((s, d) => s + d.orders, 0), [salesData]);
  const totalGross = totalRevenue + totalFees;
  const avgOrderValue = totalOrders > 0 ? totalGross / totalOrders : 0;

  const filtered = useMemo(() => {
    let list = filter === 'all' ? events : events.filter((e) => e.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) =>
        e.title?.toLowerCase().includes(q) ||
        e.location_name?.toLowerCase().includes(q) ||
        e.creator_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, filter, searchQuery]);

  const counts = {
    all: events.length,
    pending: events.filter((e) => e.status === 'pending').length,
    approved: events.filter((e) => e.status === 'approved').length,
    rejected: events.filter((e) => e.status === 'rejected').length,
  };

  const topSellers = useMemo(() =>
    events
      .filter((e) => salesData[e.id]?.tickets > 0)
      .sort((a, b) => (salesData[b.id]?.tickets || 0) - (salesData[a.id]?.tickets || 0))
      .slice(0, 5),
    [events, salesData]
  );

  if (loading) {
    return <div className="ow-empty"><p>Loading...</p></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>All Events</h1>
        <p>View and manage every event in the system</p>
      </div>

      {/* Money summary */}
      <div className="ow-money-banner">
        <div className="ow-money-main">
          <Wallet size={22} />
          <div>
            <span className="ow-money-total">${totalGross.toFixed(2)}</span>
            <span className="ow-money-label">Total Money Collected</span>
          </div>
        </div>
        <div className="ow-money-breakdown">
          <div className="ow-money-item">
            <span className="ow-money-item-val">${totalRevenue.toFixed(2)}</span>
            <span className="ow-money-item-lbl">Event Revenue</span>
          </div>
          <div className="ow-money-divider" />
          <div className="ow-money-item ow-money-item--accent">
            <span className="ow-money-item-val">${totalFees.toFixed(2)}</span>
            <span className="ow-money-item-lbl">Your Earnings (${SERVICE_FEE}/ticket)</span>
          </div>
          <div className="ow-money-divider" />
          <div className="ow-money-item">
            <span className="ow-money-item-val">${avgOrderValue.toFixed(2)}</span>
            <span className="ow-money-item-lbl">Avg Order Value</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="ow-stats-row">
        <div className="ow-stat-card">
          <Ticket size={20} className="ow-stat-icon" />
          <div className="ow-stat-info">
            <span className="ow-stat-value">{totalTicketsSold}</span>
            <span className="ow-stat-label">Tickets Sold</span>
          </div>
        </div>
        <div className="ow-stat-card">
          <ShoppingCart size={20} className="ow-stat-icon" />
          <div className="ow-stat-info">
            <span className="ow-stat-value">{totalOrders}</span>
            <span className="ow-stat-label">Total Orders</span>
          </div>
        </div>
        <div className="ow-stat-card">
          <DollarSign size={20} className="ow-stat-icon" />
          <div className="ow-stat-info">
            <span className="ow-stat-value">${totalRevenue.toFixed(2)}</span>
            <span className="ow-stat-label">Event Revenue</span>
          </div>
        </div>
        <div className="ow-stat-card ow-stat-card--accent">
          <PiggyBank size={20} className="ow-stat-icon" />
          <div className="ow-stat-info">
            <span className="ow-stat-value">${totalFees.toFixed(2)}</span>
            <span className="ow-stat-label">Your Earnings</span>
          </div>
        </div>
      </div>

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <div className="ow-top-sellers">
          <h3 className="ow-section-title"><Award size={16} /> Top Selling Events</h3>
          <div className="ow-top-list">
            {topSellers.map((ev, idx) => {
              const s = salesData[ev.id];
              const ws = getWaveSummary(ev.ticket_waves);
              const pct = ws ? Math.round(((ws.totalCap - ws.totalRemaining) / ws.totalCap) * 100) : 0;
              return (
                <div className="ow-top-item" key={ev.id}>
                  <span className="ow-top-rank">#{idx + 1}</span>
                  {ev.logo_url && <img src={ev.logo_url} alt="" className="ow-top-thumb" />}
                  <div className="ow-top-info">
                    <span className="ow-top-name">{ev.title}</span>
                    <div className="ow-top-bar-wrap">
                      <div className="ow-top-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="ow-top-nums">
                    <span className="ow-top-tickets">{s.tickets} sold</span>
                    <span className="ow-top-revenue">${s.revenue.toFixed(2)}</span>
                    <span className="ow-top-fee">${s.fees.toFixed(2)} fees</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fetchError && <div className="ow-error">Error: {fetchError}</div>}

      {/* Search bar */}
      <div className="ow-search-bar">
        <Search size={16} className="ow-search-icon" />
        <input
          className="ow-search-input"
          placeholder="Search events by name, venue, or creator..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div className="ow-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`ow-filter-tab ${filter === f.key ? 'ow-filter-tab--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ow-filter-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Events grid */}
      {filtered.length === 0 ? (
        <div className="ow-empty">
          <p>{searchQuery.trim() ? 'No events match your search.' : 'No events found.'}</p>
        </div>
      ) : (
        <div className="ow-events-grid">
          {filtered.map((ev) => {
            const ws = getWaveSummary(ev.ticket_waves);
            const isUpdating = updating === ev.id;
            const evSales = salesData[ev.id] || { tickets: 0, revenue: 0, fees: 0, orders: 0 };
            const isExpanded = expandedEvent === ev.id;
            const eventOrders = allOrders.filter((o) => o.event_id === ev.id);
            const soldPct = ws ? Math.round(((ws.totalCap - ws.totalRemaining) / ws.totalCap) * 100) : 0;
            const evGross = evSales.revenue + evSales.fees;

            return (
              <div className="ow-event-card" key={ev.id}>
                <div className="ow-event-top">
                  {ev.logo_url && <img src={ev.logo_url} alt="" className="ow-event-logo" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ow-event-title-row">
                      <h3 className="ow-event-title">{ev.title}</h3>
                      <span className={`status-badge status-${ev.status}`}>{ev.status}</span>
                    </div>
                    <div className="ow-event-creator"><User size={12} /> {ev.creator_name}</div>
                  </div>
                </div>

                <div className="ow-event-meta">
                  <span><Calendar size={13} /> {formatDate(ev.start_datetime)}</span>
                  {ev.location_name && <span><MapPin size={13} /> {ev.location_name}</span>}
                  {ws && (
                    <span><Ticket size={13} /> {ws.totalRemaining}/{ws.totalCap} left · {ws.count} wave{ws.count !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Sales summary */}
                <div className="ow-event-sales">
                  <div className="ow-event-sales-item">
                    <span className="ow-event-sales-val">{evSales.tickets}</span>
                    <span className="ow-event-sales-lbl">sold</span>
                  </div>
                  <div className="ow-event-sales-item">
                    <span className="ow-event-sales-val">{evSales.orders}</span>
                    <span className="ow-event-sales-lbl">orders</span>
                  </div>
                  <div className="ow-event-sales-item">
                    <span className="ow-event-sales-val">${evSales.revenue.toFixed(2)}</span>
                    <span className="ow-event-sales-lbl">revenue</span>
                  </div>
                  <div className="ow-event-sales-item ow-event-sales-item--accent">
                    <span className="ow-event-sales-val">${evSales.fees.toFixed(2)}</span>
                    <span className="ow-event-sales-lbl">fees</span>
                  </div>
                  <div className="ow-event-sales-item ow-event-sales-item--total">
                    <span className="ow-event-sales-val">${evGross.toFixed(2)}</span>
                    <span className="ow-event-sales-lbl">total</span>
                  </div>
                </div>

                {/* Progress bar */}
                {ws && (
                  <div className="ow-progress-wrap">
                    <div className="ow-progress-bar">
                      <div className="ow-progress-fill" style={{ width: `${soldPct}%` }} />
                    </div>
                    <span className="ow-progress-label">{soldPct}% sold</span>
                  </div>
                )}

                {/* Expand toggle */}
                {(evSales.orders > 0 || rsvpData[ev.id]) && (
                  <button
                    className="ow-expand-btn"
                    onClick={() => setExpandedEvent(isExpanded ? null : ev.id)}
                  >
                    <BarChart3 size={14} />
                    {isExpanded ? 'Hide' : 'View'} Details
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="ow-event-detail-panel">
                    {/* Wave breakdown */}
                    {ws && ws.waves.length > 0 && (
                      <div className="ow-detail-section">
                        <h4 className="ow-detail-title">Wave Breakdown</h4>
                        {ws.waves.map((w) => {
                          const wSold = w.capacity - w.remaining;
                          const wPct = Math.round((wSold / w.capacity) * 100);
                          return (
                            <div className="ow-wave-row" key={w.id}>
                              <div className="ow-wave-info">
                                <span className="ow-wave-name">{w.label}</span>
                                <span className="ow-wave-price">${Number(w.price).toFixed(2)}</span>
                              </div>
                              <div className="ow-wave-bar-wrap">
                                <div className="ow-wave-bar" style={{ width: `${wPct}%` }} />
                              </div>
                              <span className="ow-wave-stats">{wSold}/{w.capacity} ({wPct}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* RSVP Counts */}
                    {rsvpData[ev.id] && (
                      <div className="ow-detail-section">
                        <h4 className="ow-detail-title">RSVP Responses</h4>
                        <div className="ow-rsvp-row">
                          <div className="ow-rsvp-item ow-rsvp-item--going">
                            <UserCheck size={15} />
                            <span className="ow-rsvp-count">{rsvpData[ev.id].attending}</span>
                            <span className="ow-rsvp-label">Going</span>
                          </div>
                          <div className="ow-rsvp-item ow-rsvp-item--maybe">
                            <HelpCircle size={15} />
                            <span className="ow-rsvp-count">{rsvpData[ev.id].maybe}</span>
                            <span className="ow-rsvp-label">Maybe</span>
                          </div>
                          <div className="ow-rsvp-item ow-rsvp-item--no">
                            <XCircle size={15} />
                            <span className="ow-rsvp-count">{rsvpData[ev.id].not_going}</span>
                            <span className="ow-rsvp-label">Can't Go</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* All orders */}
                    <div className="ow-detail-section">
                      <h4 className="ow-detail-title">All Orders ({eventOrders.length})</h4>
                      <div className="ow-orders-list">
                        {eventOrders.map((o) => (
                          <div className="ow-order-row" key={o.id}>
                            <div className="ow-order-info">
                              <span className="ow-order-buyer">
                                {buyerNames[o.user_id] || 'Unknown'}
                                {o.is_gift && <span className="ow-gift-badge">GIFT</span>}
                              </span>
                              <span className="ow-order-nums">
                                {o.order_number && <span className="ow-order-tag">{o.order_number}</span>}
                                {o.ticket_number && <span className="ow-order-tag ow-order-tag--tkt">{o.ticket_number}</span>}
                              </span>
                              <span className="ow-order-meta">
                                {o.ticket_waves?.label || '—'} · x{o.quantity} · {formatShortDate(o.created_at)}
                              </span>
                              {o.is_gift && o.recipient_name && (
                                <span className="ow-order-recipient">Gift for: {o.recipient_name}</span>
                              )}
                              {Array.isArray(o.holder_names) && o.holder_names.length > 0 && (
                                <div className="ow-holder-names">
                                  {o.holder_names.map((name, i) => (
                                    <span key={i} className="ow-holder-tag">{name}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="ow-order-right">
                              <span className="ow-order-amount">${Number(o.total_price).toFixed(2)}</span>
                              <span className="ow-order-fee">+${Number(o.service_fee || 0).toFixed(2)} fee</span>
                              <button
                                type="button"
                                className="ow-qr-btn"
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

                <div className="ow-event-status-ctrl">
                  <label className="ow-status-label">Status:</label>
                  <select
                    className="ow-status-select"
                    value={ev.status}
                    onChange={(e) => changeStatus(ev.id, e.target.value)}
                    disabled={isUpdating}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
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
