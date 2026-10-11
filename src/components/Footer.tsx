import { nav } from "@/config/content";
import { site } from "@/config/site";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 px-5 pt-20 pb-10 md:px-12 lg:px-20">
      <p aria-hidden className="display pointer-events-none mb-16 text-[clamp(3.5rem,15vw,15rem)] leading-[0.8] text-white/[0.04] select-none">
        Play Smart
      </p>
      <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt={site.name} width={1140} height={450} className="h-14 w-auto" loading="lazy" />
          <p className="mt-6 max-w-xs text-sm text-white/50">Coach-led strength, conditioning and athletic performance training.</p>
        </div>
        <div>
          <h3 className="eyebrow mb-5 text-[0.62rem] text-red">Explore</h3>
          <ul className="space-y-3 text-sm text-white/70">
            {nav.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:text-white">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-5 text-[0.62rem] text-red">Contact</h3>
          <ul className="space-y-3 text-sm text-white/70">
            <li>
              <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="hover:text-white">
                {site.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.contact.email}`} className="hover:text-white">
                {site.contact.email}
              </a>
            </li>
            <li>
              <a href={site.contact.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {site.contact.address.street}, {site.contact.address.city}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="eyebrow mb-5 text-[0.62rem] text-red">Follow</h3>
          <ul className="space-y-3 text-sm text-white/70">
            {site.social.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-20 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 md:flex-row md:justify-between">
        <p>
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
        <p>Train smart. Play hard.</p>
      </div>
    </footer>
  );
}
