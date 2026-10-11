import { Resend } from "resend";
import { enquirySchema, fieldErrors, type Enquiry } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  // Honeypot filled: pretend success so bots learn nothing.
  if (typeof body?.website === "string" && body.website.length > 0) {
    return Response.json({ ok: true });
  }

  const limited = rateLimit(ip, LIMIT, WINDOW_MS);
  if (!limited.ok) {
    return Response.json(
      { ok: false, message: "Too many enquiries from this connection. Please try again in a few minutes, or call us directly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ENQUIRY_TO_EMAIL;
  const from = process.env.ENQUIRY_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    const missing = [!apiKey && "RESEND_API_KEY", !to && "ENQUIRY_TO_EMAIL", !from && "ENQUIRY_FROM_EMAIL"].filter(Boolean).join(", ");
    console.error(`[enquiry] Email is not configured. Missing environment variable(s): ${missing}. See .env.example.`);
    return Response.json(
      { ok: false, message: "Sorry, our enquiry form is temporarily unavailable. Please call or WhatsApp us directly." },
      { status: 503 },
    );
  }

  const data = parsed.data;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: to.split(",").map((s) => s.trim()),
      ...(data.email ? { replyTo: data.email } : {}),
      subject: `New trial enquiry: ${data.name} (${data.goal})`,
      text: toText(data),
      html: toHtml(data),
    });
    if (error) {
      console.error("[enquiry] Resend error:", error);
      return Response.json({ ok: false, message: "We couldn't send your enquiry right now. Please try again or call us." }, { status: 502 });
    }
  } catch (err) {
    console.error("[enquiry] Unexpected error sending email:", err);
    return Response.json({ ok: false, message: "We couldn't send your enquiry right now. Please try again or call us." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

const rows = (d: Enquiry): [string, string][] => [
  ["Name", d.name],
  ["Phone", d.phone],
  ["Email", d.email || "-"],
  ["Goal", d.goal],
  ["Preferred time", d.time || "-"],
];

function toText(d: Enquiry) {
  return `${rows(d).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nMessage:\n${d.message || "-"}`;
}

function toHtml(d: Enquiry) {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const tr = rows(d)
    .map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#DC293B;font-weight:600">${k}</td><td style="padding:6px 0">${esc(v)}</td></tr>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
  <h2 style="margin:0 0 16px">New free-trial enquiry</h2>
  <table style="border-collapse:collapse">${tr}</table>
  <h3 style="margin:24px 0 8px">Message</h3>
  <p style="white-space:pre-wrap;margin:0">${esc(d.message || "-")}</p>
</div>`;
}
