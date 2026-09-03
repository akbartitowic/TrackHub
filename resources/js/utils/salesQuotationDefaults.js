export const QUOTATION_DEFAULT_DETAIL =
  "Based on the agile nature of the client's needs for this project, where requirements and demands are still highly dynamic, we propose a retainer package based on a man-hour quota. This quota can be utilized for various needs within the application project, with requests aligned to the capabilities that MyActivity can provide. The services we offer under this man-hour quota include:\n- Design\n- Mobile development\n- Backend development";

export const QUOTATION_DEFAULT_NOTES =
  'Additional expenses that come from 3rd parties (if any), are not included in this quotation such as infrastructure cost, 3rd party subscription, etc.\nProduction will be started after Purchase Order Received.';

export const QUOTATION_DEFAULT_PAYMENT =
  'Payment 1: 50% Down Payment at the time the proposal is approved.\nPayment 2: 50% 1 month after proposal approved.';

export const QUOTATION_DEFAULT_CANCELLATION =
  'If the project is canceled after more than 50% completion, the client will be charged a 100% penalty based on the overall project progress.\nIf the project is canceled before 50% completion, the client will be charged a 70% penalty based on the overall project progress.\nThe initial costs to run the project must be paid.';

/** Satu baris line item kosong (untuk form baru per project). */
export function emptyLineItem() {
  return {
    service: '',
    detail: '',
    rate: '',
    qty: '',
    unit: 'Hours',
  };
}

/** Form quotation kosong — dipakai saat proposal_sent belum punya data tersimpan. */
export function emptyQuotation() {
  return {
    quote_no: '',
    quote_date: '',
    valid_until: '',
    client_address: '',
    section_title: '',
    line_items: [emptyLineItem()],
    discount_type: 'fixed',
    discount_value: '',
    notes: '',
    payment_terms: '',
    cancellation_penalty: '',
    signature_left: '',
    signature_right: '',
  };
}

function hasSavedQuotationData(data) {
  if (!data || typeof data !== 'object') return false;
  const keys = Object.keys(data).filter((k) => k !== 'negotiation_regenerate_quote');
  if (keys.length === 0) return false;
  if (data.quote_no) return true;
  if (data.section_title) return true;
  if (data.client_address) return true;
  if (data.notes || data.payment_terms || data.cancellation_penalty) return true;
  if (Number(data.discount_value || 0) > 0) return true;
  if (Array.isArray(data.line_items) && data.line_items.some((row) => {
    if (!row || typeof row !== 'object') return false;
    return Boolean(
      String(row.service ?? '').trim()
        || String(row.detail ?? '').trim()
        || Number(row.rate) > 0
        || Number(row.qty) > 0,
    );
  })) {
    return true;
  }
  return false;
}

export function buildQuotationFromPitch(pitch, defaults = {}) {
  if (!hasSavedQuotationData(defaults)) {
    return emptyQuotation();
  }

  return {
    quote_no: defaults.quote_no || '',
    quote_date: defaults.quote_date || '',
    valid_until: defaults.valid_until || '',
    client_address: defaults.client_address || '',
    section_title: defaults.section_title || pitch?.title || pitch?.prospect_name || '',
    line_items: defaults.line_items?.length
      ? defaults.line_items.map((row) => ({
          service: row.service ?? '',
          detail: row.detail ?? '',
          rate: row.rate != null ? String(row.rate) : '',
          qty: row.qty != null ? String(row.qty) : '',
          unit: row.unit ?? 'Hours',
        }))
      : [emptyLineItem()],
    discount_type: defaults.discount_type === 'percent' ? 'percent' : 'fixed',
    discount_value: defaults.discount_value != null ? String(defaults.discount_value) : '',
    notes: defaults.notes ?? '',
    payment_terms: defaults.payment_terms ?? '',
    cancellation_penalty: defaults.cancellation_penalty ?? '',
    signature_left: defaults.signature_left ?? '',
    signature_right: defaults.signature_right ?? pitch?.company_name ?? '',
  };
}

export function quotationPayloadForApi(quotation, negotiationRegenerateQuote = null) {
  const payload = {
    quote_no: quotation.quote_no,
    quote_date: quotation.quote_date,
    valid_until: quotation.valid_until,
    client_address: quotation.client_address,
    section_title: quotation.section_title,
    discount_type: quotation.discount_type === 'percent' ? 'percent' : 'fixed',
    discount_value: quotation.discount_value !== '' ? Number(quotation.discount_value) : 0,
    notes: quotation.notes,
    payment_terms: quotation.payment_terms,
    cancellation_penalty: quotation.cancellation_penalty,
    signature_left: quotation.signature_left,
    signature_right: quotation.signature_right,
    line_items: (quotation.line_items || []).map((row) => ({
      service: row.service,
      detail: row.detail,
      rate: row.rate !== '' ? Number(row.rate) : 0,
      qty: row.qty !== '' ? Number(row.qty) : 0,
      unit: row.unit || 'Hours',
    })),
  };
  if (negotiationRegenerateQuote === 'yes' || negotiationRegenerateQuote === 'no') {
    payload.negotiation_regenerate_quote = negotiationRegenerateQuote;
  }
  return payload;
}

export function lineItemAmount(row) {
  const rate = Number(row.rate || 0);
  const qty = Number(row.qty || 0);
  return rate * qty;
}

export function quotationTotal(quotation) {
  const subtotal = quotationSubtotal(quotation);
  const discount = quotationDiscountAmount(quotation);
  return Math.max(0, subtotal - discount);
}

export function quotationSubtotal(quotation) {
  return (quotation?.line_items || []).reduce((sum, row) => sum + lineItemAmount(row), 0);
}

export function quotationDiscountAmount(quotation) {
  const subtotal = quotationSubtotal(quotation);
  if (subtotal <= 0) return 0;
  const raw = Number(quotation?.discount_value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (quotation?.discount_type === 'percent') {
    const pct = Math.min(100, Math.max(0, raw));
    return (subtotal * pct) / 100;
  }
  return Math.min(subtotal, Math.max(0, raw));
}

/** Nilai final deal (IDR) mengikuti total quotation terbaru. */
export function finalDealValueFromQuotation(quotation) {
  const total = quotationTotal(quotation);
  if (total <= 0) return '';
  return String(Math.round(total));
}

export function formatIdr(amount) {
  return `Rp${Number(amount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}
