export default function SectionHeading({ index, eyebrow, title, body }: { index: string; eyebrow: string; title: [string, string]; body?: string }) {
  return (
    <div className="mb-14 grid gap-6 md:mb-20 md:grid-cols-[1fr_minmax(0,26rem)] md:items-end">
      <div>
        <p data-reveal className="eyebrow mb-5 flex items-center gap-3 text-ink/60">
          <span className="text-red">{index}</span>
          <span className="h-px w-10 bg-ink/30" />
          {eyebrow}
        </p>
        <h2 data-reveal className="display text-[clamp(2.6rem,6vw,5.5rem)]">
          {title[0]} <span className="text-red">{title[1]}</span>
        </h2>
      </div>
      {body && (
        <p data-reveal className="text-ink/65 md:text-lg">
          {body}
        </p>
      )}
    </div>
  );
}
