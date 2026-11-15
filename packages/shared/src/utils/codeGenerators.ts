/**
 * Generator format kode resmi sesuai BRD §3 & PRD §1.2:
 * - Invoice: PWL/INV/YYYYMMDD/XXXX
 * - Ticket QR: PWL-TIX-XXXXXXXX
 */
export function generateInvoiceNumber(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `PWL/INV/${y}${m}${d}/${rand}`;
}

export function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PWL-TIX-${suffix}`;
}

export function generateMockSignatureHash(
  ticketCode: string,
  venueId: string,
  bookingDate: string,
): string {
  const raw = `${ticketCode}:${venueId}:${bookingDate}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `hmac_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}
