import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { CalendarDays, MapPin, ChevronRight, Ticket, X, Gift, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { generateTicketPDF } from '../../utils/pdfInvitation';
import './client.css';

function TicketModal({ order, onClose }) {
  if (!order) return null;
  const ev = order.events;
  const wave = order.ticket_waves;
  const ticketNum = order.ticket_number || 'N/A';
  const orderNum = order.order_number || 'N/A';
  const serviceFee = Number(order.service_fee || 0);
  const totalPrice = Number(order.total_price || 0);

  const qrData = JSON.stringify({
    order: orderNum,
    ticket: ticketNum,
    event: ev?.title,
    qty: order.quantity,
    id: order.id,
  });

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatDateRange = (start, end) => {
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    let str = s.toLocaleDateString('en-GB', opts);
    if (e) str += ` - ${e.toLocaleDateString('en-GB', opts)}`;
    return str;
  };

  const handleDownloadPDF = () => {
    generateTicketPDF({
      isGift: !!order.is_gift,
      inviterName: order.profiles?.full_name || 'A Friend',
      recipientName: order.recipient_name,
      holderName: order.profiles?.full_name,
      holderNames: order.holder_names || [],
      eventTitle: ev?.title,
      startDatetime: ev?.start_datetime,
      endDatetime: ev?.end_datetime,
      locationName: ev?.location_name,
      locationAddress: ev?.location_address,
      logoUrl: ev?.logo_url,
      orderNumber: orderNum,
      ticketNumber: ticketNum,
      quantity: order.quantity,
      waveLabel: wave?.label,
      grandTotal: totalPrice + serviceFee,
      formatDateRange,
    });
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pm-close tm-close" onClick={onClose}><X size={20} /></button>

        <div className="tm-qr-wrap">
          <QRCodeSVG
            value={qrData}
            size={180}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            includeMargin
          />
        </div>

        <h3 className="tm-event-title">{ev?.title}</h3>

        {order.is_gift && (
          <div className="tm-gift-badge">
            <Gift size={14} /> Gift for {order.recipient_name}
          </div>
        )}

        <div className="tm-details">
          <div className="tm-detail-row">
            <span className="tm-detail-label">Order</span>
            <span className="tm-detail-value tm-mono">{orderNum}</span>
          </div>
          <div className="tm-detail-row">
            <span className="tm-detail-label">Ticket</span>
            <span className="tm-detail-value tm-mono">{ticketNum}</span>
          </div>
          <div className="tm-detail-row">
            <span className="tm-detail-label">Qty</span>
            <span className="tm-detail-value">{order.quantity}</span>
          </div>
          {wave && (
            <div className="tm-detail-row">
              <span className="tm-detail-label">Wave</span>
              <span className="tm-detail-value">{wave.label}</span>
            </div>
          )}
          <div className="tm-detail-row">
            <span className="tm-detail-label">Date</span>
            <span className="tm-detail-value">{ev?.start_datetime ? formatDate(ev.start_datetime) : '—'}</span>
          </div>
          {ev?.location_name && (
            <div className="tm-detail-row">
              <span className="tm-detail-label">Venue</span>
              <span className="tm-detail-value">{ev.location_name}</span>
            </div>
          )}
          <div className="tm-detail-row tm-detail-total">
            <span className="tm-detail-label">Tickets</span>
            <span className="tm-detail-value">${totalPrice.toFixed(2)}</span>
          </div>
          {serviceFee > 0 && (
            <div className="tm-detail-row">
              <span className="tm-detail-label">Service fee</span>
              <span className="tm-detail-value">${serviceFee.toFixed(2)}</span>
            </div>
          )}
          <div className="tm-detail-row tm-detail-grand">
            <span className="tm-detail-label">Total Paid</span>
            <span className="tm-detail-value">${(totalPrice + serviceFee).toFixed(2)}</span>
          </div>
        </div>

        <button className="tm-pdf-btn" onClick={handleDownloadPDF}>
          <Download size={16} /> {order.is_gift ? 'Download Invitation PDF' : 'Download Ticket PDF'}
        </button>
      </div>
    </div>
  );
}

export default function MyTickets() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('ticket_orders')
      .select('*, events(*), ticket_waves(*), profiles!ticket_orders_user_id_fkey(full_name)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error) setOrders(data || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const now = new Date();

  const myTickets = orders.filter((o) => !o.is_gift);
  const giftTickets = orders.filter((o) => o.is_gift);

  const active = myTickets.filter((o) => o.events && new Date(o.events.end_datetime) >= now);
  const past = myTickets.filter((o) => o.events && new Date(o.events.end_datetime) < now);

  const listMap = {
    active,
    past,
    invitations: giftTickets,
  };
  const list = listMap[tab] || [];

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return <div className="bg-empty"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="bg-tabs">
        <button
          className={`bg-tab ${tab === 'active' ? 'bg-tab--active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active <span className="bg-tab-count">{active.length}</span>
        </button>
        <button
          className={`bg-tab ${tab === 'past' ? 'bg-tab--active' : ''}`}
          onClick={() => setTab('past')}
        >
          Past <span className="bg-tab-count">{past.length}</span>
        </button>
        <button
          className={`bg-tab ${tab === 'invitations' ? 'bg-tab--active' : ''}`}
          onClick={() => setTab('invitations')}
        >
          <Gift size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />
          Sent <span className="bg-tab-count">{giftTickets.length}</span>
        </button>
      </div>

      {list.length === 0 && (
        <div className="bg-empty-tickets">
          <span className="bg-empty-icon">
            {tab === 'active' ? '🎫' : tab === 'invitations' ? '🎁' : '📦'}
          </span>
          <p>
            {tab === 'active' && 'No active tickets yet.'}
            {tab === 'past' && 'No past tickets.'}
            {tab === 'invitations' && 'No invitations sent yet.'}
          </p>
          {tab === 'active' && (
            <button className="bg-cta-btn" onClick={() => navigate('/')}>Browse Events</button>
          )}
          {tab === 'invitations' && (
            <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
              Buy tickets for friends from any event page!
            </p>
          )}
        </div>
      )}

      <div className="bg-ticket-list">
        {list.map((order) => {
          const ev = order.events;
          const wave = order.ticket_waves;
          if (!ev) return null;
          return (
            <div
              className={`bg-ticket-card ${tab === 'past' ? 'bg-ticket-card--past' : ''}`}
              key={order.id}
              onClick={() => setSelectedOrder(order)}
            >
              {ev.logo_url ? (
                <img src={ev.logo_url} alt="" className="bg-ticket-logo" />
              ) : (
                <div className="bg-ticket-logo bg-ticket-logo--empty">
                  <Ticket size={20} />
                </div>
              )}
              <div className="bg-ticket-body">
                <div className="bg-ticket-title">{ev.title}</div>
                <div className="bg-ticket-meta">
                  <span><CalendarDays size={12} /> {formatDate(ev.start_datetime)}</span>
                  {ev.location_name && <span><MapPin size={12} /> {ev.location_name}</span>}
                </div>
                <div className="bg-ticket-details">
                  <span className="bg-ticket-qty">×{order.quantity}</span>
                  {wave && <span className="bg-ticket-wave">{wave.label}</span>}
                  <span className="bg-ticket-price">${Number(order.total_price).toFixed(2)}</span>
                </div>
                {order.is_gift && (
                  <div className="bg-ticket-gift-tag">
                    <Gift size={11} /> For {order.recipient_name}
                  </div>
                )}
                {order.order_number && (
                  <div className="bg-ticket-order-num">{order.order_number}</div>
                )}
              </div>
              <ChevronRight size={18} className="bg-ticket-arrow" />
            </div>
          );
        })}
      </div>

      <TicketModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
    </div>
  );
}
