"use client";

import { useState } from "react";
import { goals, times } from "@/config/content";
import { site } from "@/config/site";
import { enquirySchema, fieldErrors, type EnquiryErrors } from "@/lib/validation";

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string };

export default function Enquiry() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<EnquiryErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = enquirySchema.safeParse(data);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus({ kind: "error", message: "Please check the highlighted fields." });
      return;
    }
    setErrors({});
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus({ kind: "sent" });
        e.currentTarget?.reset();
      } else {
        if (json.errors) setErrors(json.errors);
        setStatus({ kind: "error", message: json.message || "Something went wrong. Please try again." });
      }
    } catch {
      setStatus({ kind: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  const wa = `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent("Hi Play Smart! I'd like to book a free trial session.")}`;

  return (
    <section id="enquiry" className="relative overflow-hidden px-5 py-28 md:px-12 md:py-40 lg:px-20">
      <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 h-[38rem] w-[38rem] rounded-full bg-red/15 blur-[140px]" />
      <div className="relative grid gap-16 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-24">
        <div>
          <p data-reveal className="eyebrow mb-5 flex items-center gap-3 text-ink/60">
            <span className="text-red">06</span>
            <span className="h-px w-10 bg-ink/30" />
            Free trial
          </p>
          <h2 data-reveal className="display text-[clamp(2.8rem,6.5vw,6rem)]">
            Your first session <span className="text-red">is on us.</span>
          </h2>
          <p data-reveal className="mt-6 max-w-md text-ink/65 md:text-lg">
            Tell us your goal and when you like to train. A coach will call you within a day to book your free assessment and session.
          </p>

          <dl data-reveal className="mt-14 grid gap-8 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow mb-3 text-[0.62rem] text-red">Call / WhatsApp</dt>
              <dd>
                <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="text-lg hover:text-red">
                  {site.contact.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="eyebrow mb-3 text-[0.62rem] text-red">Visit</dt>
              <dd className="text-ink/75">
                {site.contact.address.street}
                <br />
                {site.contact.address.city}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="eyebrow mb-3 text-[0.62rem] text-red">Hours</dt>
              {site.hours.map((h) => (
                <dd key={h.days} className="flex max-w-xs justify-between border-t border-ink/10 py-2 text-ink/75">
                  <span>{h.days}</span>
                  <span>{h.time}</span>
                </dd>
              ))}
            </div>
          </dl>
          <a data-reveal href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-10">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
            </svg>
            Chat on WhatsApp
          </a>
        </div>

        <form data-reveal onSubmit={onSubmit} noValidate className="relative border border-ink/10 bg-white p-6 backdrop-blur md:p-10">
          {status.kind === "sent" ? (
            <div role="status" className="flex min-h-[28rem] flex-col justify-center">
              <span className="mb-6 block h-3 w-3 rotate-45 bg-red" />
              <h3 className="display text-4xl">You&apos;re in.</h3>
              <p className="mt-4 text-ink/65">Thanks! A Play Smart coach will call you shortly to book your free session.</p>
              <button type="button" onClick={() => setStatus({ kind: "idle" })} className="btn-ghost mt-8 self-start">
                Send another
              </button>
            </div>
          ) : (
            <div className="grid gap-5">
              <Field label="Full name" name="name" error={errors.name} autoComplete="name" required />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Phone / WhatsApp" name="phone" type="tel" error={errors.phone} autoComplete="tel" required />
                <Field label="Email (optional)" name="email" type="email" error={errors.email} autoComplete="email" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Select label="Your goal" name="goal" options={goals} error={errors.goal} required />
                <Select label="Preferred time" name="time" options={times} error={errors.time} />
              </div>
              <label className="grid gap-2">
                <span className="eyebrow text-[0.6rem] text-ink/60">Anything we should know? (optional)</span>
                <textarea name="message" rows={4} className="field resize-none" placeholder="Injuries, experience, sport you play…" />
              </label>
              {/* Honeypot */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden />
              <button type="submit" disabled={status.kind === "sending"} className="btn-primary mt-2 justify-center disabled:opacity-60">
                {status.kind === "sending" ? "Sending…" : "Book my free trial"}
              </button>
              <p role="alert" aria-live="polite" className="min-h-5 text-sm text-red-hot">
                {status.kind === "error" ? status.message : ""}
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function Field({ label, name, error, ...rest }: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${name}`;
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="eyebrow text-[0.6rem] text-ink/60">{label}</span>
      <input id={id} name={name} className="field" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error && (
        <span id={`${id}-err`} className="text-xs text-red-hot">
          {error}
        </span>
      )}
    </label>
  );
}

function Select({ label, name, options, error, required }: { label: string; name: string; options: string[]; error?: string; required?: boolean }) {
  const id = `f-${name}`;
  return (
    <label htmlFor={id} className="grid gap-2">
      <span className="eyebrow text-[0.6rem] text-ink/60">{label}</span>
      <select id={id} name={name} defaultValue="" required={required} className="field" aria-invalid={!!error}>
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {error && <span className="text-xs text-red-hot">{error}</span>}
    </label>
  );
}
