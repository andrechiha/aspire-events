import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft, Calendar, MapPin, Minus, Plus,
  ChevronDown, Share2, CreditCard, Lock, X, CheckCircle, MessageCircle,
  Gift, UserCheck, HelpCircle, XCircle, Download,
} from 'lucide-react';
import { generateTicketPDF } from '../../utils/pdfInvitation';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './client.css';

const SERVICE_FEE = 3.00;

function PaymentModal({ isOpen, onClose, onConfirm, qty, unitPrice, waveLabel, purchasing, purchaseResult, isGift, recipientName, onDownloadPDF }) {
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' });

  if (!isOpen) return null;

  const subtotal = unitPrice * qty;
  const total = subtotal + SERVICE_FEE;

  const formatCardNumber = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const isValid = card.number.replace(/\s/g, '').length >= 16 && card.expiry.length >= 5 && card.cvc.length >= 3 && card.name.trim().length > 0;

  if (purchaseResult?.success) {
    return (
      <div className="pm-overlay" onClick={onClose}>
        <div className="pm-modal pm-modal--success" onClick={(e) => e.stopPropagation()}>
          <CheckCircle size={48} className="pm-success-icon" />
          <h3 className="pm-success-title">
            {purchaseResult.is_gift ? 'Gift Sent!' : 'Payment Successful!'}
          </h3>
          <p className="pm-success-text">
            {purchaseResult.quantity} ticket{purchaseResult.quantity > 1 ? 's' : ''} purchased
            {purchaseResult.is_gift && <> for <strong>{purchaseResult.recipient_name}</strong></>}
          </p>
          <div className="pm-success-details">
            <div className="pm-success-row">
              <span>Order</span><span>{purchaseResult.order_number}</span>
            </div>
            <div className="pm-success-row">
              <span>Ticket</span><span>{purchaseResult.ticket_number}</span>
            </div>
            {purchaseResult.is_gift && (
              <div className="pm-success-row">
                <span>For</span><span style={{ fontFamily: 'inherit' }}>{purchaseResult.recipient_name}</span>
              </div>
            )}
            <div className="pm-success-row">
              <span>Total Charged</span><span>${Number(purchaseResult.grand_total || (Number(purchaseResult.total_price) + SERVICE_FEE)).toFixed(2)}</span>
            </div>
          </div>
          {onDownloadPDF && (
            <button className="pm-pdf-btn" onClick={() => onDownloadPDF(purchaseResult)}>
              <Download size={16} /> {purchaseResult.is_gift ? 'Download Invitation PDF' : 'Download Ticket PDF'}
            </button>
          )}
          <button className="pm-done-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <h3 className="pm-title">Payment</h3>
          <button className="pm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="pm-summary">
          {isGift && recipientName && (
            <div className="pm-summary-row pm-summary-gift">
              <span>🎁 Gift for</span>
              <span>{recipientName}</span>
            </div>
          )}
          <div className="pm-summary-row">
            <span>{qty}× {waveLabel}</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="pm-summary-row pm-summary-fee">
            <span>Service fee</span>
            <span>${SERVICE_FEE.toFixed(2)}</span>
          </div>
          <div className="pm-summary-row pm-summary-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="pm-form">
          <label className="pm-label">Cardholder Name</label>
          <input
            className="pm-input"
            placeholder="John Doe"
            value={card.name}
            onChange={(e) => setCard({ ...card, name: e.target.value })}
          />

          <label className="pm-label">Card Number</label>
          <div className="pm-input-wrap">
            <CreditCard size={16} className="pm-input-icon" />
            <input
              className="pm-input pm-input--icon"
              placeholder="1234 5678 9012 3456"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
              inputMode="numeric"
            />
          </div>

          <div className="pm-row">
            <div className="pm-field">
              <label className="pm-label">Expiry</label>
              <input
                className="pm-input"
                placeholder="MM/YY"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                inputMode="numeric"
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">CVC</label>
              <input
                className="pm-input"
                placeholder="123"
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                inputMode="numeric"
                type="password"
              />
            </div>
          </div>
        </div>

        {purchaseResult && !purchaseResult.success && (
          <div className="bg-msg bg-msg--err" style={{ marginBottom: 12 }}>{purchaseResult.error}</div>
        )}

        <button
          className="pm-pay-btn"
          onClick={onConfirm}
          disabled={!isValid || purchasing}
        >
          <Lock size={16} />
          {purchasing ? 'Processing...' : `Pay $${total.toFixed(2)}`}
        </button>

        <p className="pm-disclaimer">
          <Lock size={11} /> This is a demo — no real charges will be made.
        </p>
      </div>
    </div>
  );
}

const goldPinIcon = L.divIcon({
  className: 'ed-map-pin-icon',
  html: `<div style="
    width:44px;height:44px;border-radius:50%;
    background:rgba(0,0,0,0.7);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,0.4);
  "><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
});

const SocialIcon = ({ type, size = 18 }) => {
  const icons = {
    spotify: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    ),
    youtube: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
    soundcloud: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.057-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.057 0 .089-.035.104-.094l.2-1.282-.2-1.332c-.015-.057-.047-.094-.104-.094m1.832-1.473c-.074 0-.121.062-.133.124l-.218 2.775.218 2.656c.012.063.059.124.133.124.074 0 .121-.061.132-.124l.247-2.656-.247-2.775c-.011-.062-.058-.124-.132-.124m.895-.384c-.089 0-.149.076-.157.149l-.205 3.159.205 2.868c.008.074.068.149.157.149.087 0 .147-.075.158-.149l.229-2.868-.229-3.159c-.011-.073-.071-.149-.158-.149m.898-.172c-.104 0-.176.09-.185.175l-.191 3.331.191 3.025c.009.085.081.175.185.175.103 0 .175-.09.186-.175l.215-3.025-.215-3.331c-.011-.085-.083-.175-.186-.175m.928-.288c-.12 0-.199.104-.209.199l-.178 3.619.178 3.13c.01.096.089.199.209.199.118 0 .198-.103.21-.199l.2-3.13-.2-3.619c-.012-.095-.092-.199-.21-.199m.932-.247c-.135 0-.221.118-.229.224l-.165 3.866.165 3.166c.008.106.094.224.229.224.135 0 .221-.118.231-.224l.185-3.166-.185-3.866c-.01-.106-.096-.224-.231-.224m.947-.119c-.15 0-.242.132-.249.249l-.151 3.985.151 3.193c.007.118.1.249.249.249.15 0 .242-.131.252-.249l.17-3.193-.17-3.985c-.01-.117-.102-.249-.252-.249m.953-.033c-.166 0-.263.146-.271.274L7.22 14.48l.137 3.205c.008.128.105.274.271.274.163 0 .262-.146.273-.274l.154-3.205-.154-4.138c-.011-.128-.11-.274-.273-.274m.924.099c-.18 0-.284.16-.291.299l-.123 3.839.123 3.197c.007.14.111.299.291.299.176 0 .282-.159.294-.299l.138-3.197-.138-3.839c-.012-.139-.118-.299-.294-.299m.956-.174c-.196 0-.305.174-.311.324l-.11 4.013.11 3.189c.006.15.115.324.311.324.193 0 .304-.174.313-.324l.124-3.189-.124-4.013c-.009-.15-.12-.324-.313-.324m2.848-.474c-.1 0-.188.04-.26.107-.073.068-.117.165-.117.27v.001l-.088 4.287.088 3.14c0 .106.044.201.117.27.072.067.16.106.26.106.1 0 .189-.039.262-.106.073-.069.117-.164.117-.27l.001-.025.098-3.115-.098-4.263v-.001c0-.105-.044-.202-.117-.27-.073-.067-.162-.107-.263-.107m.948-.165c-.238 0-.434.191-.443.424l-.076 4.452.076 3.118c.009.233.205.424.443.424.236 0 .432-.191.443-.424l.086-3.118-.086-4.452c-.011-.233-.207-.424-.443-.424m4.454 1.426c-.238 0-.456.04-.66.115-.137-1.546-1.441-2.755-3.029-2.755-.406 0-.794.084-1.148.232-.148.062-.188.126-.19.248v8.636c.002.129.101.236.228.249h4.799c1.32 0 2.389-1.079 2.389-2.412 0-1.332-1.069-2.313-2.389-2.313"/>
      </svg>
    ),
    instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  };
  return icons[type] || null;
};

export default function EventDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [waves, setWaves] = useState([]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [aboutOpen, setAboutOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const [qty, setQty] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [mapCoords, setMapCoords] = useState(null);
  const [isAttendee, setIsAttendee] = useState(false);

  const [rsvp, setRsvp] = useState(null);
  const [rsvpCounts, setRsvpCounts] = useState({ attending: 0, maybe: 0, not_going: 0 });
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const [giftMode, setGiftMode] = useState(false);
  const [giftName, setGiftName] = useState('');
  const [giftEmail, setGiftEmail] = useState('');
  const [holderNames, setHolderNames] = useState([]);

  const fetchEvent = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('events')
      .select('*, ticket_waves(*), event_media(*)')
      .eq('id', id)
      .single();

    if (err || !data) {
      setError('Event not found');
    } else {
      setEvent(data);
      setWaves([...(data.ticket_waves || [])].sort((a, b) => a.wave_number - b.wave_number));
      setMedia(data.event_media || []);

      if (data.latitude && data.longitude) {
        setMapCoords([data.latitude, data.longitude]);
      } else if (data.location_address || data.location_name) {
        try {
          const q = data.location_address || data.location_name;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`
          );
          const results = await res.json();
          if (results.length > 0) {
            setMapCoords([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
          }
        } catch (_) { /* geocoding failed silently */ }
      }
    }
    if (profile?.id) {
      const { data: att } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_id', id)
        .eq('user_id', profile.id)
        .maybeSingle();
      setIsAttendee(!!att);

      const { data: myRsvp } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', id)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (myRsvp) setRsvp(myRsvp.status);
    }

    const { data: allRsvps } = await supabase
      .from('event_rsvps')
      .select('status')
      .eq('event_id', id);
    if (allRsvps) {
      const counts = { attending: 0, maybe: 0, not_going: 0 };
      allRsvps.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
      setRsvpCounts(counts);
    }

    setLoading(false);
  }, [id, profile?.id]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const activeWave = waves.find((w) => w.is_active) || null;
  const soldOut = waves.length > 0 && waves.every((w) => w.remaining === 0);
  const eventEnded = event
    ? (event.end_datetime ? new Date(event.end_datetime) : new Date(event.start_datetime)) < new Date()
    : false;

  const getNames = () => {
    if (qty === 1) return [giftMode ? giftName.trim() : (profile?.full_name || '')];
    return holderNames.map((n) => n.trim()).filter(Boolean);
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    setPurchaseResult(null);

    const { data, error: rpcErr } = await supabase.rpc('purchase_tickets', {
      p_event_id: id,
      p_quantity: qty,
    });

    if (rpcErr) {
      setPurchaseResult({ success: false, error: rpcErr.message });
    } else if (data && !data.success) {
      setPurchaseResult(data);
    } else {
      const names = getNames();
      if (data.order_id && names.length > 0) {
        await supabase.from('ticket_orders').update({ holder_names: names }).eq('id', data.order_id);
      }
      setPurchaseResult({ ...data, holder_names: names });
      setQty(1);
      setHolderNames([]);
      fetchEvent();
    }
    setPurchasing(false);
  };

  const handleRsvp = async (status) => {
    if (!profile) return;
    setRsvpLoading(true);
    if (rsvp === status) {
      await supabase.from('event_rsvps').delete().eq('event_id', id).eq('user_id', profile.id);
      setRsvp(null);
      setRsvpCounts((c) => ({ ...c, [status]: Math.max(0, c[status] - 1) }));
    } else {
      const old = rsvp;
      await supabase.from('event_rsvps').upsert({ event_id: id, user_id: profile.id, status }, { onConflict: 'event_id,user_id' });
      setRsvp(status);
      setRsvpCounts((c) => ({
        ...c,
        [status]: c[status] + 1,
        ...(old ? { [old]: Math.max(0, c[old] - 1) } : {}),
      }));
    }
    setRsvpLoading(false);
  };

  const handleGiftPurchase = async () => {
    if (!giftName.trim()) return;
    setPurchasing(true);
    setPurchaseResult(null);
    const { data, error: rpcErr } = await supabase.rpc('purchase_gift_tickets', {
      p_event_id: id,
      p_quantity: qty,
      p_recipient_name: giftName.trim(),
      p_recipient_email: giftEmail.trim() || null,
    });
    if (rpcErr) {
      setPurchaseResult({ success: false, error: rpcErr.message });
    } else if (data && !data.success) {
      setPurchaseResult(data);
    } else {
      const names = getNames();
      if (data.order_id && names.length > 0) {
        await supabase.from('ticket_orders').update({ holder_names: names }).eq('id', data.order_id);
      }
      setPurchaseResult({ ...data, is_gift: true, recipient_name: giftName.trim(), holder_names: names });
      setQty(1);
      setHolderNames([]);
      fetchEvent();
    }
    setPurchasing(false);
  };

  const handleDownloadPDF = (result) => {
    generateTicketPDF({
      isGift: !!result.is_gift,
      inviterName: profile?.full_name,
      recipientName: result.recipient_name,
      holderName: profile?.full_name,
      holderNames: result.holder_names || [],
      eventTitle: event.title,
      startDatetime: event.start_datetime,
      endDatetime: event.end_datetime,
      locationName: event.location_name,
      locationAddress: event.location_address,
      logoUrl: event.logo_url,
      orderNumber: result.order_number,
      ticketNumber: result.ticket_number,
      quantity: result.quantity,
      waveLabel: result.wave_label,
      grandTotal: result.grand_total,
      formatDateRange,
    });
  };

  const formatDateRange = (start, end) => {
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const opts = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    let str = s.toLocaleDateString('en-GB', opts);
    if (e) str += ` - ${e.toLocaleDateString('en-GB', opts)}`;
    return str;
  };

  const lineup = event?.lineup || [];

  if (loading) return <div className="bg-empty"><div className="spinner" /></div>;
  if (error) return <div className="bg-empty"><p style={{ color: '#f87171' }}>{error}</p></div>;
  if (!event) return null;

  return (
    <div className="ed-page">
      {/* Banner */}
      <div className="ed-banner-wrap">
        {event.logo_url ? (
          <img src={event.logo_url} alt="" className="ed-banner" />
        ) : (
          <div className="ed-banner ed-banner--empty"><Calendar size={48} /></div>
        )}
        <div className="ed-banner-overlay">
          <button className="ed-banner-btn ed-banner-btn--left" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <button className="ed-banner-btn ed-banner-btn--right" onClick={() => {
            if (navigator.share) navigator.share({ title: event.title, url: window.location.href });
          }}>
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Title & Meta */}
      <div className="ed-content">
        <h1 className="ed-title">{event.title}</h1>

        <div className="ed-meta-row">
          <Calendar size={16} className="ed-meta-icon" />
          <span>{formatDateRange(event.start_datetime, event.end_datetime)}</span>
        </div>

        {event.location_name && (
          <div className="ed-meta-row">
            <MapPin size={16} className="ed-meta-icon" />
            <span>{event.location_name}</span>
          </div>
        )}

        {/* About */}
        {event.description && (
          <div className="ed-section">
            <h2 className="ed-section-title">About</h2>
            <div className="ed-about-wrap">
              <p className={`ed-about-text ${aboutOpen ? 'ed-about-text--open' : ''}`}>
                {event.description}
              </p>
              {!aboutOpen && event.description.length > 100 && <div className="ed-about-fade" />}
            </div>
            {event.description.length > 100 && (
              <button className="ed-expand-btn" onClick={() => setAboutOpen(!aboutOpen)}>
                {aboutOpen ? 'Show Less' : 'Read More'}
                <ChevronDown size={16} className={aboutOpen ? 'ed-expand-icon--open' : ''} />
              </button>
            )}
          </div>
        )}

        {/* Rules */}
        {event.rules && (
          <div className="ed-section">
            <h2 className="ed-section-title">Rules</h2>
            <div className="ed-about-wrap">
              <p className={`ed-about-text ${rulesOpen ? 'ed-about-text--open' : ''}`}>
                {event.rules}
              </p>
              {!rulesOpen && event.rules.length > 80 && <div className="ed-about-fade" />}
            </div>
            {event.rules.length > 80 && (
              <button className="ed-expand-btn" onClick={() => setRulesOpen(!rulesOpen)}>
                {rulesOpen ? 'Show Less' : 'Read More'}
                <ChevronDown size={16} className={rulesOpen ? 'ed-expand-icon--open' : ''} />
              </button>
            )}
          </div>
        )}

        {/* Promoter */}
        {event.promoter_name && (
          <div className="ed-section">
            <h2 className="ed-section-title">Promoter</h2>
            <div className="ed-promoter">
              {event.promoter_logo_url ? (
                <img src={event.promoter_logo_url} alt="" className="ed-promoter-logo" />
              ) : (
                <div className="ed-promoter-logo ed-promoter-logo--empty">
                  {event.promoter_name.charAt(0)}
                </div>
              )}
              <div className="ed-promoter-info">
                <span className="ed-promoter-name">{event.promoter_name}</span>
                {event.promoter_instagram && (
                  <a
                    href={event.promoter_instagram.startsWith('http') ? event.promoter_instagram : `https://instagram.com/${event.promoter_instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ed-social-link"
                  >
                    <SocialIcon type="instagram" size={16} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Line-Up */}
        {lineup.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">Line-Up</h2>
            <div className="ed-lineup-list">
              {lineup.map((artist, i) => (
                <div className="ed-artist" key={i}>
                  {artist.photo_url ? (
                    <img src={artist.photo_url} alt="" className="ed-artist-photo" />
                  ) : (
                    <div className="ed-artist-photo ed-artist-photo--empty">
                      {artist.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="ed-artist-info">
                    <span className="ed-artist-name">{artist.name}</span>
                    <div className="ed-artist-socials">
                      {artist.spotify_url && (
                        <a href={artist.spotify_url} target="_blank" rel="noopener noreferrer" className="ed-social-link ed-social--spotify">
                          <SocialIcon type="spotify" size={18} />
                        </a>
                      )}
                      {artist.youtube_url && (
                        <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className="ed-social-link ed-social--youtube">
                          <SocialIcon type="youtube" size={18} />
                        </a>
                      )}
                      {artist.soundcloud_url && (
                        <a href={artist.soundcloud_url} target="_blank" rel="noopener noreferrer" className="ed-social-link ed-social--soundcloud">
                          <SocialIcon type="soundcloud" size={18} />
                        </a>
                      )}
                      {artist.instagram_url && (
                        <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="ed-social-link ed-social--instagram">
                          <SocialIcon type="instagram" size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {event.location_name && (
          <div className="ed-section">
            <h2 className="ed-section-title">Location</h2>
            <div className="ed-location-card">
              <div className="ed-location-header">
                {event.promoter_logo_url ? (
                  <img src={event.promoter_logo_url} alt="" className="ed-location-venue-logo" />
                ) : (
                  <div className="ed-location-venue-logo ed-location-venue-logo--empty">
                    {event.location_name.charAt(0)}
                  </div>
                )}
                <div className="ed-location-info">
                  <span className="ed-location-name">{event.location_name}</span>
                  {event.location_address && (
                    <span className="ed-location-address">{event.location_address}</span>
                  )}
                </div>
              </div>

              {mapCoords ? (
                <a
                  href={event.location_link || `https://www.google.com/maps?q=${mapCoords[0]},${mapCoords[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ed-map-container-link"
                >
                  <MapContainer
                    center={mapCoords}
                    zoom={15}
                    scrollWheelZoom={false}
                    dragging={false}
                    zoomControl={false}
                    attributionControl={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                    className="ed-leaflet-map"
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <Marker position={mapCoords} icon={goldPinIcon} />
                  </MapContainer>
                </a>
              ) : event.location_link ? (
                <a href={event.location_link} target="_blank" rel="noopener noreferrer" className="ed-location-map-link">
                  <MapPin size={28} className="ed-location-map-pin" />
                  <span>Open in Maps</span>
                </a>
              ) : null}
            </div>
          </div>
        )}

        {/* Photos & Videos */}
        {media.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">Photos & Videos</h2>
            <div className="bg-media-grid">
              {media.map((m) => (
                <div className="bg-media-item" key={m.id}>
                  {m.media_type === 'video' ? (
                    <video src={m.storage_path} controls />
                  ) : (
                    <img src={m.storage_path} alt="" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RSVP Poll */}
        {profile?.role === 'client' && (
          <div className="ed-section">
            <h2 className="ed-section-title">Are you going?</h2>
            <div className="ed-rsvp-row">
              {[
                { key: 'attending', label: 'Going', icon: <UserCheck size={16} />, color: '#4ade80' },
                { key: 'maybe', label: 'Maybe', icon: <HelpCircle size={16} />, color: '#FFD700' },
                { key: 'not_going', label: 'Can\'t Go', icon: <XCircle size={16} />, color: '#f87171' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  className={`ed-rsvp-btn ${rsvp === opt.key ? 'ed-rsvp-btn--active' : ''}`}
                  style={rsvp === opt.key ? { borderColor: opt.color, color: opt.color } : {}}
                  onClick={() => handleRsvp(opt.key)}
                  disabled={rsvpLoading}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                  <span className="ed-rsvp-count">{rsvpCounts[opt.key]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ticket bar with +/- — only for upcoming events */}
        {eventEnded && (
          <div className="ed-section">
            <div className="ed-ended-bar">
              <XCircle size={24} className="ed-ended-icon" />
              <div>
                <p className="ed-ended-title">This event has ended</p>
                <p className="ed-ended-text">Tickets are no longer available. View your past tickets in My Tickets.</p>
                <button type="button" className="ed-ended-link" onClick={() => navigate('/my-tickets')}>
                  My Tickets
                </button>
              </div>
            </div>
          </div>
        )}
        {profile?.role === 'client' && !eventEnded && !soldOut && activeWave && (
          <div className="ed-section">
            <div className="ed-ticket-bar-inline">
              <div className="ed-ticket-bar-left">
                <span className="ed-ticket-bar-wave">{activeWave.label}</span>
                <span className="ed-ticket-bar-price">${Number(activeWave.price).toFixed(2)} / ticket</span>
              </div>
              <div className="ed-ticket-bar-controls">
                <button
                  className="ed-ticket-bar-qty-btn"
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                >
                  <Minus size={16} />
                </button>
                <span className="ed-ticket-bar-qty">{qty}</span>
                <button
                  className="ed-ticket-bar-qty-btn"
                  type="button"
                  onClick={() => setQty((q) => Math.min(activeWave.remaining, q + 1))}
                  disabled={qty >= activeWave.remaining}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Gift toggle */}
            <button
              className={`ed-gift-toggle ${giftMode ? 'ed-gift-toggle--active' : ''}`}
              onClick={() => setGiftMode(!giftMode)}
            >
              <Gift size={16} />
              {giftMode ? 'Buying for myself' : 'Buy for a friend'}
            </button>

            {giftMode && (
              <div className="ed-gift-form">
                <input
                  className="ed-gift-input"
                  placeholder="Friend's full name *"
                  value={giftName}
                  onChange={(e) => setGiftName(e.target.value)}
                />
                <input
                  className="ed-gift-input"
                  placeholder="Friend's email (optional)"
                  type="email"
                  value={giftEmail}
                  onChange={(e) => setGiftEmail(e.target.value)}
                />
              </div>
            )}

            {/* Holder names for multiple tickets */}
            {qty > 1 && (
              <div className="ed-holders">
                <p className="ed-holders-label">
                  {giftMode ? 'Guest names for each ticket' : 'Ticket holder names'}
                </p>
                {Array.from({ length: qty }).map((_, i) => (
                  <input
                    key={i}
                    className="ed-gift-input"
                    placeholder={`${giftMode ? 'Guest' : 'Holder'} ${i + 1} — Full name`}
                    value={holderNames[i] || ''}
                    onChange={(e) => {
                      const updated = [...holderNames];
                      updated[i] = e.target.value;
                      setHolderNames(updated);
                    }}
                  />
                ))}
              </div>
            )}

            <button
              className="ed-ticket-buy-btn"
              onClick={() => {
                setPurchaseResult(null);
                if (giftMode && !giftName.trim()) return;
                if (qty > 1 && holderNames.filter((n) => n?.trim()).length < qty) return;
                setShowPayment(true);
              }}
              disabled={
                (giftMode && !giftName.trim()) ||
                (qty > 1 && holderNames.filter((n) => n?.trim()).length < qty)
              }
            >
              {giftMode ? (
                <>
                  <Gift size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Gift {qty} Ticket{qty > 1 ? 's' : ''} — ${(activeWave.price * qty + SERVICE_FEE).toFixed(2)}
                </>
              ) : (
                <>Buy {qty} Ticket{qty > 1 ? 's' : ''} — ${(activeWave.price * qty + SERVICE_FEE).toFixed(2)}</>
              )}
            </button>
            <p className="ed-ticket-fee-note">Includes ${SERVICE_FEE.toFixed(2)} service fee</p>
          </div>
        )}

        {isAttendee && event?.chat_enabled !== false && (
          <div className="ed-section">
            <button
              className="ed-chat-btn"
              onClick={() => navigate(`/event/${id}/chat`)}
            >
              <MessageCircle size={18} />
              Join Event Chat
            </button>
          </div>
        )}

        {!eventEnded && soldOut && (
          <div className="bg-soldout" style={{ marginTop: 20 }}>This event is sold out.</div>
        )}
      </div>

      {activeWave && !eventEnded && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => {
            setShowPayment(false);
            if (purchaseResult?.success) { setPurchaseResult(null); setQty(1); setGiftMode(false); setGiftName(''); setGiftEmail(''); }
          }}
          onConfirm={giftMode ? handleGiftPurchase : handlePurchase}
          qty={qty}
          unitPrice={Number(activeWave.price)}
          waveLabel={activeWave.label}
          purchasing={purchasing}
          purchaseResult={purchaseResult}
          isGift={giftMode}
          recipientName={giftName}
          onDownloadPDF={handleDownloadPDF}
        />
      )}
    </div>
  );
}
