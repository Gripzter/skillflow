import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MIN_WITHDRAWAL, WITHDRAWAL_FEE_PERCENT } from "@/lib/constants";

/**
 * Withdrawal request: deduct from wallet and create a pending transaction.
 * Admin processes payouts manually (Stripe Dashboard or Connect later).
 */
export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await req.json();
    const { amount, userId, withdrawalDetails } = body as {
      amount?: number;
      userId?: string;
      withdrawalDetails?: string;
    };

    const withdrawAmount = typeof amount === "number" ? amount : parseFloat(String(amount ?? 0));
    if (Number.isNaN(withdrawAmount) || withdrawAmount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `Minimum withdrawal is $${MIN_WITHDRAWAL}.00` },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const balance = Number(wallet.balance ?? 0);
    if (withdrawAmount > balance) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const processingFee = Math.round(withdrawAmount * WITHDRAWAL_FEE_PERCENT * 100) / 100;
    const playerReceives = Math.round((withdrawAmount - processingFee) * 100) / 100;
    const newBalance = balance - withdrawAmount;

    await supabaseAdmin
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", userId);

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "withdrawal",
      amount: -withdrawAmount,
      balance_after: newBalance,
      description: `Withdrawal: $${playerReceives.toFixed(2)} (fee: $${processingFee.toFixed(2)})`,
      status: "pending",
      withdrawal_details: typeof withdrawalDetails === "string" ? withdrawalDetails : null,
    });

    return NextResponse.json({
      success: true,
      amount: withdrawAmount,
      processingFee,
      playerReceives,
      newBalance,
    });
  } catch (err: unknown) {
    console.error("[create-payout]", err);
    return NextResponse.json(
      { error: "Failed to process withdrawal request" },
      { status: 500 }
    );
  }
}
