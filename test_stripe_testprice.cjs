const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  mode: "subscription",
  line_items: [{ price: "price_1QxXXXX", quantity: 1 }],
  client_reference_id: "123",
  success_url: "http://localhost/success",
  cancel_url: "http://localhost/cancel"
}).then(console.log).catch(e => console.error(e.message));
