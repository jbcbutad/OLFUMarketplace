import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://olfumarketplace.store";
const FROM =
    process.env.EMAIL_FROM || "OLFU Marketplace <notifications@olfumarketplace.store>";
const BATCH = 15;

const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );

function authorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const given = Buffer.from(req.headers.get("authorization") || "");
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function render(row) {
    const url = row.link?.startsWith("/") ? SITE + row.link : SITE + "/notifications";
    const year = new Date().getFullYear();
    const navLink = (label, path) =>
        `<a href="${SITE}${path}" style="color:#12301f;text-decoration:none;font-weight:600;">${label}</a>`;

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /></head>
<body style="margin:0;padding:0;background:#f4f6f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f4;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">

    <tr><td style="height:4px;line-height:4px;font-size:0;background:#E0A93B;border-radius:12px 12px 0 0;">&nbsp;</td></tr>

    <tr><td style="padding:32px 32px 8px;font-family:${FONT};font-size:22px;line-height:28px;font-weight:700;color:#12301f;">${esc(row.subject)}</td></tr>
    ${row.body ? `<tr><td style="padding:0 32px 24px;font-family:${FONT};font-size:16px;line-height:24px;color:#333333;">${esc(row.body)}</td></tr>` : `<tr><td style="padding:0 0 16px;">&nbsp;</td></tr>`}

    <tr><td align="center" style="padding:0 32px 32px;">
      <a href="${esc(url)}" style="display:inline-block;background:#12301f;color:#E0A93B;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;">Open OLFU Marketplace</a>
    </td></tr>

    <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e3e8e3;font-size:0;line-height:0;height:1px;">&nbsp;</div></td></tr>

    <tr><td align="center" style="padding:28px 32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="middle"><img src="${SITE}/email/logo.png" width="110" alt="OLFU Marketplace" style="display:block;border:0;height:auto;" /></td>
        <td valign="middle" style="padding-left:20px;"><img src="${SITE}/email/verified-badge.png" width="52" alt="" style="display:block;border:0;height:auto;" /></td>
        <td valign="middle" style="padding-left:8px;font-family:${FONT};font-size:12px;line-height:16px;color:#333333;">Verified <strong>OLFU</strong><br />Members</td>
      </tr></table>
    </td></tr>

    <tr><td align="center" style="padding:0 32px 16px;font-family:${FONT};font-size:14px;line-height:24px;">
      ${navLink("Buy now", "/marketplace")} &nbsp;|&nbsp; ${navLink("Sell your items", "/create-listing")} &nbsp;|&nbsp; ${navLink("My listings", "/mylistings")} &nbsp;|&nbsp; ${navLink("Rentals", "/rentals")} &nbsp;|&nbsp; ${navLink("Merchandise", "/merchandise")}
    </td></tr>

    <tr><td align="center" style="padding:0 32px 8px;font-family:${FONT};font-size:12px;line-height:18px;color:#777777;">You can turn these emails off on your Notifications page.</td></tr>

    <tr><td align="center" style="padding:0 32px 32px;font-family:${FONT};font-size:12px;line-height:18px;color:#777777;">
      <a href="${SITE}/terms" style="color:#777777;text-decoration:underline;">Terms of Service</a> | <a href="${SITE}/privacy" style="color:#777777;text-decoration:underline;">Privacy Policy</a><br />
      OLFU Marketplace © ${year}. All rights reserved.
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

    const text = `${row.subject}\n\n${row.body ? row.body + "\n\n" : ""}${url}\n\nYou can turn these emails off on your Notifications page.`;
    return { html, text };
}

async function sendOne(row) {
    const { html, text } = render(row);
    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `outbox-${row.id}`,
        },
        body: JSON.stringify({
            from: FROM,
            to: [row.to_email],
            subject: row.subject,
            html,
            text,
        }),
    });
    if (!res.ok) {
        throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
}

export async function POST(req) {
    if (!authorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );

    const { data: rows, error } = await admin.rpc("claim_email_batch", { p_limit: BATCH });
    if (error) {
        console.error("[send-emails] claim failed:", error.message);
        return NextResponse.json({ error: "Queue unavailable" }, { status: 500 });
    }

    let sent = 0;
    for (const row of rows ?? []) {
        try {
            await sendOne(row);
            await admin.rpc("mark_email_result", { p_id: row.id, p_ok: true, p_error: null });
            sent++;
        } catch (e) {
            console.error("[send-emails] failed:", row.id, e.message);
            await admin.rpc("mark_email_result", {
                p_id: row.id,
                p_ok: false,
                p_error: String(e.message),
            });
        }
    }

    return NextResponse.json({ claimed: rows?.length ?? 0, sent });
}