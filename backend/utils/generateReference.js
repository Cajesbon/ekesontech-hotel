// Generates a human-friendly, unique-enough booking reference like
// HTL-2026-8F92K. Uniqueness is still enforced at the database level
// via a unique index, with a retry loop in the controller.
function generateBookingReference() {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `HTL-${year}-${suffix}`;
}

function generatePaymentReference() {
  return `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

module.exports = { generateBookingReference, generatePaymentReference };
