// Instância única do SDK Stripe.
// Env: STRIPE_SECRET_KEY (sk_test_... / sk_live_...)
const Stripe = require('stripe');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('[Stripe] STRIPE_SECRET_KEY não configurada — pagamentos desabilitados');
}

module.exports = stripe;
