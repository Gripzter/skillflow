import Stripe from "stripe";

/**
 * Server-side Stripe instance — use in API routes only.
 * Never expose STRIPE_SECRET_KEY to the client.
 */
export const stripe =
  typeof process.env.STRIPE_SECRET_KEY === "string" && process.env.STRIPE_SECRET_KEY.length > 0
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      })
    : null;

/** Client-side publishable key for Stripe.js (optional, e.g. for Elements). */
export const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
