const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
stripe.prices.retrieve(process.env.VITE_STRIPE_PRICE_ID).then(console.log).catch(e => console.error(e.message));
