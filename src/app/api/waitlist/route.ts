import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey);
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function getWaitlistPosition(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<number | null> {
  const { data: row, error: rowError } = await supabase
    .from("waitlist_emails")
    .select("created_at")
    .eq("email", email)
    .maybeSingle();

  if (rowError || !row?.created_at) return null;

  const { count, error: countError } = await supabase
    .from("waitlist_emails")
    .select("id", { count: "exact", head: true })
    .lte("created_at", row.created_at);

  if (countError || typeof count !== "number") return null;
  return count;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Waitlist is not configured." }, { status: 503 });
    }
    const resend = getResendClient();
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    const { error } = await supabase.from("waitlist_emails").insert({
      email,
      source: "launch_v3",
      ip_address: ipAddress,
    });

    if (error) {
      if (error.code === "23505") {
        // Existing emails are considered successful signups in UX.
        if (resend && audienceId) {
          void resend.contacts
            .create({
              email,
              audienceId,
              unsubscribed: false,
            })
            .catch((resendError) => {
              console.error("[waitlist] Resend sync failed for duplicate signup", resendError);
            });
        }
        const position = await getWaitlistPosition(supabase, email);
        return NextResponse.json({ success: true, position });
      }
      console.error("[waitlist] Supabase insert error", error);
      return NextResponse.json({ error: "Could not save your email right now." }, { status: 500 });
    }

    if (resend && audienceId) {
      void resend.contacts
        .create({
          email,
          audienceId,
          unsubscribed: false,
        })
        .catch((resendError) => {
          console.error("[waitlist] Resend sync failed", resendError);
        });
    } else {
      console.warn("[waitlist] Resend not configured; skipped audience sync");
    }

    const position = await getWaitlistPosition(supabase, email);
    return NextResponse.json({ success: true, position });
  } catch (error) {
    console.error("[waitlist] Unexpected API error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
