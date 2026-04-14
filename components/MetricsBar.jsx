function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function fundingClass(ratePct) {
  if (ratePct < 0) return "text-green";
  if (ratePct <= 0.05) return "text-amber";
  return "text-red";
}

export default function MetricsBar({ asset, market }) {
  const ratePct = market.currentFundingRate * 100;
  const items = [
    { label: "Asset", value: asset },
    { label: "Price", value: formatCurrency(market.currentPrice) },
    {
      label: "Funding Rate",
      value: `${ratePct.toFixed(3)}%`,
      className: fundingClass(ratePct),
    },
    { label: "24h Volume", value: formatCompact(market.volume24h) },
    { label: "Open Interest", value: formatCompact(market.openInterest) },
  ];

  return (
    <div className="grid md:grid-cols-5">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`px-6 py-4 ${index < items.length - 1 ? "detail-grid-divider" : ""}`}
        >
          <p className="detail-title mb-2">{item.label}</p>
          <p className={`detail-mono text-2xl font-semibold md:text-[2rem] ${item.className || ""}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
