const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  mode: "subscription",
  line_items: [{ price: process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
  client_reference_id: "123",
  success_url: "http://localhost/success",
  cancel_url: "http://localhost/cancel",
  metadata: undefined
}).then(console.log).catch(e => console.error(e.message));
