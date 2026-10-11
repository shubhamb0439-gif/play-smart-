import { features, programmes } from "@/config/content";
import SectionHeading from "@/components/SectionHeading";

export default function Programmes() {
  return (
    <section id="programmes" className="relative px-5 py-28 md:px-12 md:py-40 lg:px-20">
      <SectionHeading
        index="04"
        eyebrow="Programmes"
        title={["Train with", "purpose."]}
        body="Every programme starts with an assessment and runs in structured blocks, so you always know what you're training for and why."
      />

      <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {programmes.map((p, i) => (
          <article
            key={p.title}
            data-reveal
            className="group relative flex min-h-[22rem] flex-col justify-between overflow-hidden bg-ink p-8 transition-colors duration-500 hover:bg-coal"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-red transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100" />
            <div className="flex items-start justify-between">
              <span className="display text-6xl text-white/10 transition-colors duration-500 group-hover:text-red">0{i + 1}</span>
              {p.tag && <span className="eyebrow bg-red px-2.5 py-1.5 text-[0.56rem] text-white">{p.tag}</span>}
            </div>
            <div>
              <h3 className="display mb-4 text-2xl leading-none">{p.title}</h3>
              <p className="text-sm leading-relaxed text-white/60">{p.body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-28 grid gap-12 md:mt-36 md:grid-cols-4 md:gap-8">
        {features.map((f) => (
          <div key={f.title} data-reveal className="border-t border-white/15 pt-6">
            <span className="mb-6 block h-2 w-2 rotate-45 bg-red" />
            <h3 className="eyebrow mb-3 text-[0.72rem] text-white">{f.title}</h3>
            <p className="text-sm leading-relaxed text-white/55">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
