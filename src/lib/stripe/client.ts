import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripeClient() {
  if (stripe) return stripe;

  const apiKey = process.env.STRIPE_RESTRICTED_KEY;
  if (!apiKey) throw new Error("STRIPE_RESTRICTED_KEY is not set");

  stripe = new Stripe(apiKey, {
    apiVersion: "2026-06-24.dahlia",
  });

  return stripe;
}
