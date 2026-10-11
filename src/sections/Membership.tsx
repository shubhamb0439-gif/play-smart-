import { plans } from "@/config/content";
import SectionHeading from "@/components/SectionHeading";

export default function Membership() {
  return (
    <section id="membership" className="relative px-5 py-28 md:px-12 md:py-40 lg:px-20">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red/60 to-transparent" />
      <SectionHeading index="05" eyebrow="Membership" title={["Pick your", "plan."]} body="Simple plans, no joining-fee surprises. Every membership starts with a free coached trial session." />

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((p) => (
          <article
            key={p.name}
            data-reveal
            className={`relative flex flex-col p-8 md:p-10 ${p.featured ? "bg-red text-white" : "border border-white/12 bg-coal"}`}
          >
            {p.featured && <span className="eyebrow absolute top-0 right-8 -translate-y-1/2 bg-white px-3 py-1.5 text-[0.56rem] text-ink">Best value</span>}
            <h3 className="eyebrow text-[0.72rem]">{p.name}</h3>
            <p className="mt-8 flex items-baseline gap-2">
              <span className="display text-6xl">{p.price}</span>
              <span className={p.featured ? "text-white/80" : "text-white/50"}>{p.period}</span>
            </p>
            <ul className="mt-10 mb-12 space-y-4">
              {p.features.map((f) => (
                <li key={f} className={`flex items-center gap-3 border-t pt-4 text-sm ${p.featured ? "border-white/25" : "border-white/10 text-white/75"}`}>
                  <span className={`h-1.5 w-1.5 rotate-45 ${p.featured ? "bg-white" : "bg-red"}`} />
                  {f}
                </li>
              ))}
            </ul>
            <a href="#enquiry" className={`mt-auto self-start ${p.featured ? "btn-ghost !bg-ink hover:!bg-white" : "btn-primary"}`}>
              Start with a free trial
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
