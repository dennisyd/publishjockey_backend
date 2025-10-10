// Simple promo configuration for backend enforcement using dates only
// Edit endDate (and optionally startDate) to control promo window. No env vars needed.

const PROMO_CONFIG = {
  // Format: 'YYYY-MM-DD HH:mm:ss' in server local time
  startDate: '2025-10-13 00:00:00', // e.g., '2025-11-01 00:00:00'
  endDate: '2025-12-31 23:59:59'
};

function isPromoActiveNow() {
  const now = new Date();
  const end = new Date(PROMO_CONFIG.endDate);
  const start = PROMO_CONFIG.startDate ? new Date(PROMO_CONFIG.startDate) : null;
  if (Number.isNaN(end.getTime())) return false;
  if (start && Number.isNaN(start.getTime())) return false;
  const afterStart = start ? now >= start : true;
  return afterStart && now < end;
}

module.exports = {
  PROMO_CONFIG,
  isPromoActiveNow
};


