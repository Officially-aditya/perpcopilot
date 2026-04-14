const ICONS = ["⚡", "💸", "📉"];

export default function RiskFactors({ items }) {
  return (
    <section className="detail-section h-full">
      <p className="detail-title mb-8">Risk Factors</p>
      <div className="space-y-8">
        {items.map((item, index) => (
          <div key={item} className="detail-divider pt-8 first:border-0 first:pt-0">
            <div className="flex items-start gap-4">
              <span className="mt-1 text-lg text-[rgba(255,255,255,0.8)]">{ICONS[index] || "•"}</span>
              <p className="max-w-xl text-[1.02rem] leading-8 text-[rgba(255,255,255,0.72)]">{item}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
