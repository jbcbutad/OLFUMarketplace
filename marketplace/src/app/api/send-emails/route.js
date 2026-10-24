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

function render(row) {
    const url = row.link?.startsWith("/") ? SITE + row.link : SITE + "/notifications";
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#171717">
<h2 style="margin:0 0 12px">${esc(row.subject)}</h2>
${row.body ? `<p style="margin:0 0 20px;line-height:1.5">${esc(row.body)}</p>` : ""}
<a href="${esc(url)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open OLFU Marketplace</a>
<p style="margin:24px 0 0;font-size:12px;color:#737373">You can turn these emails off on your Notifications page.</p>
</div>`;
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