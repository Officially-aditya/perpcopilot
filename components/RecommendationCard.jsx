const PILL_STYLES = {
  BUY: "border-[#1e5c36] bg-[rgba(0,255,65,0.14)] text-[#6ef08d]",
  LONG: "border-[#1e5c36] bg-[rgba(0,255,65,0.14)] text-[#6ef08d]",
  REDUCE: "border-[rgba(255,171,0,0.22)] bg-[rgba(255,171,0,0.12)] text-[#ffbf47]",
  SELL: "border-[rgba(255,115,81,0.24)] bg-[rgba(255,115,81,0.14)] text-[#ff7351]",
  SHORT: "border-[rgba(255,115,81,0.2)] bg-[rgba(255,115,81,0.12)] text-[#ff7351]",
  AVOID: "border-[#1e5c36] bg-[rgba(0,255,65,0.12)] text-[#6ef08d]",
  HOLD: "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] text-white",
};

const CONFIDENCE_BARS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export default function RecommendationCard({ recommendation }) {
  return (
    <section className="detail-section md:grid md:grid-cols-[180px_1fr] md:gap-10">
      <div className="mb-6 md:mb-0">
        <div
          className={`detail-mono inline-flex min-w-[164px] items-center justify-center border px-8 py-5 text-4xl font-semibold uppercase tracking-[0.16em] ${PILL_STYLES[recommendation.recommendation] || PILL_STYLES.HOLD}`}
        >
          {recommendation.recommendation}
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="detail-title">Confidence</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`h-3 w-3 ${
                  index < CONFIDENCE_BARS[recommendation.confidence]
                    ? "bg-[#6ef08d]"
                    : "bg-[rgba(255,255,255,0.12)]"
                }`}
              />
            ))}
          </div>
          <span className="detail-title text-[rgba(255,255,255,0.38)]">
            {recommendation.confidence}
          </span>
        </div>

        <p className="max-w-4xl text-[1.05rem] leading-10 text-[rgba(255,255,255,0.72)]">
          {recommendation.summary}
        </p>
      </div>
    </section>
  );
}
