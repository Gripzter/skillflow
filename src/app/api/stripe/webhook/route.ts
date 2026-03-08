import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Stripe } from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    console.error("[Stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error("[Stripe webhook] Supabase not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session & {
      metadata?: { userId?: string; amount?: string };
      payment_intent?: string;
    };

    const userId = session.metadata?.userId;
    // Credit FULL amount from metadata (player chose e.g. $25 → credit $25). We absorb Stripe fees.
    const amount = parseFloat(session.metadata?.amount ?? "0");
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent ?? null;

    if (!userId || amount <= 0) {
      console.error("[Stripe webhook] Invalid metadata", { userId, amount });
      return NextResponse.json({ received: true });
    }

    if (paymentIntentId) {
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("stripe_payment_id", paymentIntentId)
        .maybeSingle();

      if (existingTx) {
        console.log("[Stripe webhook] Payment already processed:", paymentIntentId);
        return NextResponse.json({ received: true });
      }

      const { data: wallet } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single();

      const newBalance = (Number(wallet?.balance ?? 0)) + amount;

      if (wallet) {
        await supabaseAdmin
          .from("wallets")
          .update({ balance: newBalance })
          .eq("user_id", userId);
      } else {
        await supabaseAdmin
          .from("wallets")
          .insert({ user_id: userId, balance: amount });
      }

      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        type: "deposit",
        amount,
        balance_after: newBalance,
        description: `Deposited $${amount.toFixed(2)}`,
        stripe_payment_id: paymentIntentId,
        status: "completed",
      });

      const { recordDeposit } = await import("@/lib/responsible-gaming");
      await recordDeposit(supabaseAdmin, userId, amount);

      const { completeReferral } = await import("@/lib/referrals");
      await completeReferral(supabaseAdmin, userId, amount);

      console.log("[Stripe webhook] Wallet updated for user:", userId);
    }
  }

  return NextResponse.json({ received: true });
}
