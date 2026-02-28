import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

function loadImageAsDataURL(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function rr(doc, x, y, w, h, r, style) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

async function renderPage(doc, {
  isGift, inviterName, personName, personIndex, totalPeople,
  eventTitle, startDatetime, endDatetime, locationName, locationAddress,
  logoUrl, imgData, orderNumber, ticketNumber, waveLabel, grandTotal,
  formatDateRange,
}) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 16;
  const cardX = margin;
  const cardW = pw - margin * 2;

  // ── Background ──
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pw, ph, 'F');

  // Gold corner accents
  doc.setDrawColor(255, 215, 0);
  doc.setLineWidth(0.6);
  doc.line(12, 12, 30, 12); doc.line(12, 12, 12, 30);
  doc.line(pw - 12, 12, pw - 30, 12); doc.line(pw - 12, 12, pw - 12, 30);
  doc.line(12, ph - 12, 30, ph - 12); doc.line(12, ph - 12, 12, ph - 30);
  doc.line(pw - 12, ph - 12, pw - 30, ph - 12); doc.line(pw - 12, ph - 12, pw - 12, ph - 30);

  let y = 18;

  // ── Event Banner Image ──
  if (imgData) {
    try {
      const imgW = cardW;
      const imgH = 55;
      doc.saveGraphicsState();
      doc.setFillColor(20, 20, 20);
      rr(doc, cardX, y, imgW, imgH, 4, 'F');
      doc.addImage(imgData, 'JPEG', cardX, y, imgW, imgH);
      for (let i = 0; i < 20; i++) {
        const alpha = (i / 20) * 0.8;
        doc.setFillColor(10, 10, 10);
        doc.setGState(new doc.GState({ opacity: alpha }));
        doc.rect(cardX, y + imgH - 20 + i, imgW, 1, 'F');
      }
      doc.setGState(new doc.GState({ opacity: 1 }));
      doc.restoreGraphicsState();
      y += imgH + 4;
    } catch (_) { y += 4; }
  }

  // ── Header text ──
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(11);
  if (isGift) {
    doc.text('---  YOU ARE INVITED  ---', pw / 2, y + 6, { align: 'center' });
  } else {
    doc.text('---  YOUR TICKET  ---', pw / 2, y + 6, { align: 'center' });
  }
  y += 14;

  // ── Event Title ──
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(eventTitle || 'Event', cardW - 20);
  doc.text(titleLines, pw / 2, y, { align: 'center' });
  y += titleLines.length * 10 + 4;

  // ── Subtitle line ──
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(10);
  if (isGift) {
    doc.text(`Invited by ${inviterName || 'A Friend'}`, pw / 2, y, { align: 'center' });
  } else {
    doc.text(personName || '', pw / 2, y, { align: 'center' });
  }
  y += 10;

  // ── Gold divider ──
  doc.setDrawColor(255, 215, 0);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - 40, y, pw / 2 + 40, y);
  y += 10;

  // ── Event Details Card ──
  const hasAddress = !!locationAddress;
  const detailRows = 3 + (hasAddress ? 1 : 0);
  const detailCardH = detailRows * 10 + 12;
  const detailCardY = y;
  doc.setFillColor(18, 18, 18);
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  rr(doc, cardX, detailCardY, cardW, detailCardH, 4, 'FD');

  y = detailCardY + 10;
  doc.setFontSize(10);

  const detailRow = (label, value) => {
    if (!value) return;
    doc.setFillColor(255, 215, 0);
    doc.circle(cardX + 12, y - 1.2, 1.5, 'F');
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(label, cardX + 18, y);
    doc.setTextColor(220, 220, 220);
    doc.setFont('helvetica', 'bold');
    const maxW = cardW - 68;
    const lines = doc.splitTextToSize(String(value), maxW);
    doc.text(lines[0], cardX + cardW - 10, y, { align: 'right' });
    y += 10;
  };

  const dateStr = formatDateRange(startDatetime, endDatetime);
  detailRow('Date', dateStr);
  detailRow('Venue', locationName);
  if (locationAddress) detailRow('Address', locationAddress);
  detailRow(isGift ? 'Guest' : 'Holder', personName);

  y = detailCardY + detailCardH + 4;

  // ── Tear Line (dashed) ──
  doc.setDrawColor(60, 60, 60);
  doc.setLineDashPattern([2, 2], 0);
  doc.setLineWidth(0.3);
  doc.line(cardX + 8, y, cardX + cardW - 8, y);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(10, 10, 10);
  doc.circle(cardX, y, 4, 'F');
  doc.circle(cardX + cardW, y, 4, 'F');
  y += 8;

  // ── Ticket Details + QR Side by Side ──
  const ticketCardY = y;
  doc.setFillColor(18, 18, 18);
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);
  rr(doc, cardX, ticketCardY, cardW, 74, 4, 'FD');

  const leftX = cardX + 12;
  y = ticketCardY + 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 215, 0);
  const ticketLabel = totalPeople > 1
    ? `TICKET ${personIndex + 1} OF ${totalPeople}`
    : 'TICKET DETAILS';
  doc.text(ticketLabel, leftX, y);
  y += 8;

  const ticketField = (label, value) => {
    if (!value) return;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(label, leftX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(9);
    doc.text(String(value), leftX + 32, y);
    y += 8;
  };

  ticketField('Order', orderNumber);
  ticketField('Ticket', ticketNumber);
  ticketField('Qty', totalPeople > 1 ? '1' : String(totalPeople));
  ticketField('Wave', waveLabel);

  if (!isGift) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('Total', leftX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 215, 0);
    doc.setFontSize(12);
    const perPerson = totalPeople > 1 ? Number(grandTotal) / totalPeople : Number(grandTotal);
    doc.text(`$${perPerson.toFixed(2)}`, leftX + 32, y + 1);
  }

  // QR code
  const qrPayload = {
    order: orderNumber,
    ticket: ticketNumber,
    event: eventTitle,
    holder: personName,
    index: personIndex + 1,
  };

  try {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 600, margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const qrSize = 52;
    const qrX = cardX + cardW - qrSize - 14;
    const qrY = ticketCardY + 8;

    doc.setFillColor(255, 255, 255);
    rr(doc, qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 3, 'F');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('SCAN AT ENTRANCE', qrX + qrSize / 2, qrY + qrSize + 8, { align: 'center' });
  } catch (e) {
    console.error('QR generation failed:', e);
  }

  y = ticketCardY + 80;

  // ── Footer ──
  doc.setDrawColor(255, 215, 0);
  doc.setLineWidth(0.2);
  doc.line(pw / 2 - 30, y, pw / 2 + 30, y);
  y += 8;

  doc.setTextColor(70, 70, 70);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Present this ticket at the event entrance.', pw / 2, y, { align: 'center' });
  y += 5;
  doc.text(`Generated by Aspire Events  |  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });
}

export async function generateTicketPDF({
  isGift = false,
  inviterName,
  recipientName,
  holderName,
  holderNames = [],
  eventTitle,
  startDatetime,
  endDatetime,
  locationName,
  locationAddress,
  logoUrl,
  orderNumber,
  ticketNumber,
  quantity,
  waveLabel,
  grandTotal,
  formatDateRange,
}) {
  // Build the list of people (one page each)
  let people;
  if (holderNames.length > 1) {
    people = holderNames;
  } else if (holderNames.length === 1) {
    people = holderNames;
  } else {
    people = [isGift ? recipientName : (holderName || '')];
  }

  // Pre-load event image once
  let imgData = null;
  if (logoUrl) {
    try { imgData = await loadImageAsDataURL(logoUrl); } catch (_) {}
  }

  const doc = new jsPDF();

  for (let i = 0; i < people.length; i++) {
    if (i > 0) doc.addPage();

    await renderPage(doc, {
      isGift,
      inviterName,
      personName: people[i],
      personIndex: i,
      totalPeople: people.length,
      eventTitle,
      startDatetime,
      endDatetime,
      locationName,
      locationAddress,
      logoUrl,
      imgData,
      orderNumber,
      ticketNumber,
      waveLabel,
      grandTotal,
      formatDateRange,
    });
  }

  const prefix = isGift ? 'invitation' : 'ticket';
  doc.save(`${prefix}-${orderNumber}.pdf`);
}

export const generateInvitationPDF = (opts) => generateTicketPDF({ ...opts, isGift: true });
