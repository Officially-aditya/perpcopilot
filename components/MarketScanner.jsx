"use client";

const TONE_STYLES = {
  bullish: "text-[#9cff93]",
  risk: "text-[#ff7351]",
  info: "text-[#00e3fd]",
  neutral: "text-[#d8d8d8]",
};

export default function MarketScanner({ items, onSelect }) {
  if (!items?.length) return null;

  return (
    <section className="mt-16 w-full max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="font-['Space_Grotesk'] text-xs uppercase tracking-[0.28em] text-[#00e3fd]">
          Pacifica Scanner
        </p>
        <p className="font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.22em] text-[#666666]">
          live structure highlights
        </p>
      </div>

      <div className="grid gap-px bg-[rgba(73,72,71,0.24)] md:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item)}
            className="group bg-[rgba(19,19,19,0.72)] px-4 py-4 text-left transition hover:bg-[rgba(26,26,26,0.92)]"
          >
            <p className="mb-3 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.24em] text-[#777575]">
              {item.label}
            </p>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="font-['Space_Grotesk'] text-xl font-semibold uppercase tracking-[0.08em] text-white">
                {item.asset}
              </span>
              <span className={`font-['Space_Grotesk'] text-lg font-semibold uppercase tracking-[0.08em] ${TONE_STYLES[item.tone] || TONE_STYLES.neutral}`}>
                {item.value}
              </span>
            </div>
            <p className="font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.18em] text-[#8d8d8d]">
              {item.detail}
            </p>
            <p className="mt-3 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.22em] text-[#494847] transition group-hover:text-[#9cff93]">
              Load prompt
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
