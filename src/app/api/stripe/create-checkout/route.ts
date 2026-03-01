import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { MIN_DEPOSIT, MAX_DEPOSIT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { amount, userId, userEmail } = body as {
      amount?: number;
      userId?: string;
      userEmail?: string;
    };

    const depositAmount = typeof amount === "number" ? amount : parseFloat(String(amount ?? 0));
    if (Number.isNaN(depositAmount) || depositAmount < MIN_DEPOSIT || depositAmount > MAX_DEPOSIT) {
      return NextResponse.json(
        { error: `Invalid amount. Minimum $${MIN_DEPOSIT}, maximum $${MAX_DEPOSIT}.` },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(depositAmount * 100);
    const origin = req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: typeof userEmail === "string" ? userEmail : undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "SkillFlow Wallet Deposit",
              description: `Add $${depositAmount.toFixed(2)} to your SkillFlow wallet`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        type: "deposit",
        amount: depositAmount.toString(),
      },
      success_url: `${origin}/wallet/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/wallet/deposit/cancel`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("[Stripe create-checkout]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
