import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "No session ID" });
  }

  if (!stripe) {
    return NextResponse.json({ success: false, error: "Stripe not configured" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ success: false, error: "Payment not completed" });
    }

    const userId = session.metadata?.userId;
    // Credit FULL amount from metadata (player chose e.g. $25 → credit $25). We absorb Stripe fees.
    const amount = parseFloat(session.metadata?.amount ?? "0");
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    if (!userId || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid session metadata" });
    }

    if (paymentIntentId) {
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("stripe_payment_id", paymentIntentId)
        .maybeSingle();

      if (!existingTx) {
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
      }
    }

    return NextResponse.json({ success: true, amount });
  } catch (err: unknown) {
    console.error("[Stripe verify-session]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Verification failed" }
    );
  }
}
