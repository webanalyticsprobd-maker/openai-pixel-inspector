/**
 * OpenAI Ads Pixel Inspector - Formatting Utilities
 */

export function formatTimestamp(timestamp) {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  return date.toTimeString().split(' ')[0] + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function truncateString(str, maxLen = 30) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    if (unsafe === null || unsafe === undefined) return '';
    unsafe = String(unsafe);
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrency(amount, currency = 'USD') {
  if (typeof amount !== 'number') return `${amount} ${currency}`;
  // Amount in OpenAI Pixel is often in minor units (cents)
  const formatted = (amount / 100).toFixed(2);
  return `${formatted} ${currency}`;
}

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'evt_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}
