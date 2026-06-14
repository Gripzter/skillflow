import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailPayload = {
  type: "application_received" | "approved";
  to: string;
  creatorName?: string;
  gameName?: string;
};

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0E0E12;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0E0E12;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#1A1A1F;border:1px solid #2A2A38;border-radius:12px;padding:32px;">
        <tr><td>
          <div style="font-size:20px;font-weight:700;color:#FFFF00;margin-bottom:24px;">SkillFlow</div>
          <h1 style="margin:0 0 16px;font-size:24px;color:#F0F0F4;font-weight:600;">${title}</h1>
          ${bodyHtml}
          <p style="margin:32px 0 0;font-size:12px;color:#7A7A8E;">SkillFlow · Xmas Group</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function applicationReceivedEmail(name?: string): { subject: string; html: string } {
  const greeting = name ? `hey ${name},` : "hey,";
  return {
    subject: "we got your application.",
    html: emailShell(
      "application received.",
      `<p style="color:#C8C8D4;font-size:15px;line-height:1.6;margin:0 0 16px;">${greeting}</p>
       <p style="color:#C8C8D4;font-size:15px;line-height:1.6;margin:0 0 16px;">
         thanks for applying to bring your game to SkillFlow. AX personally reviews every creator application — you'll hear back within 48 hours.
       </p>
       <p style="color:#C8C8D4;font-size:15px;line-height:1.6;margin:0;">
         no spam, no noise. just a straight answer when we've made a decision.
       </p>`
    ),
  };
}

function approvedEmail(gameName: string): { subject: string; html: string } {
  return {
    subject: "you're in.",
    html: emailShell(
      "you're in.",
      `<p style="color:#C8C8D4;font-size:15px;line-height:1.6;margin:0 0 16px;">
         your game <strong style="color:#FFFF00;">${gameName}</strong> has been approved on SkillFlow.
       </p>
       <p style="color:#C8C8D4;font-size:15px;line-height:1.6;margin:0 0 24px;">
         log in at <a href="https://skillflow.gg/login" style="color:#FFFF00;">skillflow.gg/login</a> and visit your creator dashboard to get your API key and integration guide.
       </p>
       <a href="https://skillflow.gg/creator" style="display:inline-block;background:#FFFF00;color:#0E0E12;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">open creator dashboard</a>`
    ),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("[send-creator-email] RESEND_API_KEY not configured");
    return json({ error: "Email service not configured" }, 503);
  }

  try {
    const body = (await req.json()) as EmailPayload;

    if (!body.to || !body.type) {
      return json({ error: "Missing to or type" }, 400);
    }

    let subject: string;
    let html: string;

    if (body.type === "application_received") {
      ({ subject, html } = applicationReceivedEmail(body.creatorName));
    } else if (body.type === "approved") {
      if (!body.gameName) {
        return json({ error: "gameName required for approved email" }, 400);
      }
      ({ subject, html } = approvedEmail(body.gameName));
    } else {
      return json({ error: "Invalid type" }, 400);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SkillFlow <noreply@skillflow.gg>",
        to: [body.to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[send-creator-email] Resend error:", errText);
      return json({ error: "Failed to send email" }, 500);
    }

    const data = await res.json();
    return json({ success: true, id: data.id }, 200);
  } catch (err) {
    console.error("[send-creator-email]", err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
