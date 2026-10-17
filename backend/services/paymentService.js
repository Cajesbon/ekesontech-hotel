const crypto = require('crypto');
const AppError = require('../utils/AppError');

// Thin abstraction over Paystack / Flutterwave so controllers don't care
// which gateway is active. Both use fetch (Node 18+ has it built in).

const PROVIDER = (process.env.PAYMENT_PROVIDER || 'paystack').toLowerCase();

async function initializePaystack({ email, amountKobo, reference, callbackUrl, metadata }) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
      metadata
    })
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new AppError(data.message || 'Unable to initialize payment.', 502);
  }
  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference
  };
}

async function verifyPaystack(reference) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new AppError(data.message || 'Unable to verify payment.', 502);
  }
  const tx = data.data;
  return {
    success: tx.status === 'success',
    amount: tx.amount / 100,
    currency: tx.currency,
    channel: tx.channel,
    paidAt: tx.paid_at,
    raw: tx
  };
}

function verifyPaystackWebhookSignature(rawBody, signatureHeader) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
    .update(rawBody)
    .digest('hex');
  return hash === signatureHeader;
}

async function initializeFlutterwave({ email, amount, reference, callbackUrl, metadata, currency }) {
  const res = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tx_ref: reference,
      amount,
      currency: currency || 'NGN',
      redirect_url: callbackUrl,
      customer: { email },
      meta: metadata
    })
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') {
    throw new AppError(data.message || 'Unable to initialize payment.', 502);
  }
  return { authorizationUrl: data.data.link, reference };
}

async function verifyFlutterwave(transactionId) {
  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') {
    throw new AppError(data.message || 'Unable to verify payment.', 502);
  }
  const tx = data.data;
  return {
    success: tx.status === 'successful',
    amount: tx.amount,
    currency: tx.currency,
    channel: tx.payment_type,
    paidAt: tx.created_at,
    raw: tx
  };
}

/**
 * Initializes a payment with whichever provider is configured.
 * amount is in the hotel's base currency unit (e.g. Naira, not kobo).
 */
async function initializePayment({ provider = PROVIDER, email, amount, reference, callbackUrl, metadata, currency = 'NGN' }) {
  if (provider === 'flutterwave') {
    return initializeFlutterwave({ email, amount, reference, callbackUrl, metadata, currency });
  }
  return initializePaystack({
    email,
    amountKobo: Math.round(amount * 100),
    reference,
    callbackUrl,
    metadata
  });
}

/**
 * Verifies a payment server-side. NEVER trust a client-supplied "paid" flag.
 */
async function verifyPayment({ provider = PROVIDER, reference, transactionId }) {
  if (provider === 'flutterwave') {
    return verifyFlutterwave(transactionId || reference);
  }
  return verifyPaystack(reference);
}

module.exports = {
  PROVIDER,
  initializePayment,
  verifyPayment,
  verifyPaystackWebhookSignature
};
