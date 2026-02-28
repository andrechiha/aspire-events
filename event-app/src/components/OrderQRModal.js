import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Ticket, User, Hash, Calendar, CreditCard } from 'lucide-react';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function OrderQRModal({ order, buyerName, eventTitle, onClose }) {
  if (!order) return null;

  const qrData = JSON.stringify({
    order_number: order.order_number,
    ticket_number: order.ticket_number,
    event: eventTitle,
    buyer: buyerName,
    quantity: order.quantity,
    wave: order.ticket_waves?.label,
  });

  return (
    <div className="oqm-overlay" onClick={onClose}>
      <div className="oqm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="oqm-close" onClick={onClose}><X size={20} /></button>

        <div className="oqm-qr-section">
          <div className="oqm-qr-wrap">
            <QRCodeSVG
              value={qrData}
              size={180}
              bgColor="transparent"
              fgColor="#FFD700"
              level="M"
            />
          </div>
          <p className="oqm-scan-hint">Scan to validate ticket</p>
        </div>

        <div className="oqm-info">
          <h3 className="oqm-event-title">{eventTitle}</h3>

          <div className="oqm-details">
            <div className="oqm-detail-row">
              <User size={14} className="oqm-detail-icon" />
              <div>
                <span className="oqm-detail-label">Buyer</span>
                <span className="oqm-detail-value">{buyerName || 'Unknown'}</span>
              </div>
            </div>

            <div className="oqm-detail-row">
              <Hash size={14} className="oqm-detail-icon" />
              <div>
                <span className="oqm-detail-label">Order Number</span>
                <span className="oqm-detail-value">{order.order_number || '—'}</span>
              </div>
            </div>

            <div className="oqm-detail-row">
              <Ticket size={14} className="oqm-detail-icon" />
              <div>
                <span className="oqm-detail-label">Ticket Number</span>
                <span className="oqm-detail-value">{order.ticket_number || '—'}</span>
              </div>
            </div>

            <div className="oqm-detail-row">
              <CreditCard size={14} className="oqm-detail-icon" />
              <div>
                <span className="oqm-detail-label">Wave / Qty / Price</span>
                <span className="oqm-detail-value">
                  {order.ticket_waves?.label || '—'} · x{order.quantity} · ${Number(order.total_price).toFixed(2)}
                  {Number(order.service_fee) > 0 && <span className="oqm-fee"> +${Number(order.service_fee).toFixed(2)} fee</span>}
                </span>
              </div>
            </div>

            <div className="oqm-detail-row">
              <Calendar size={14} className="oqm-detail-icon" />
              <div>
                <span className="oqm-detail-label">Purchased</span>
                <span className="oqm-detail-value">{formatDate(order.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
