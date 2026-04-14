export default function MarketContext({ context, news, demoMode }) {
  return (
    <section className="detail-section">
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="detail-title">Market Context</p>
        {demoMode ? <div className="detail-title text-[#00e3fd]">Fallback Data Active</div> : null}
      </div>

      <p className="mb-10 max-w-5xl text-[1.02rem] leading-8 text-[rgba(255,255,255,0.72)]">
        {context}
      </p>

      <div className="space-y-5">
        {news.length ? (
          news.map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[1fr_auto] gap-6 transition hover:text-white"
            >
              <div className="min-w-0">
                <h4 className="mb-2 text-[1rem] leading-7 text-[rgba(255,255,255,0.66)]">{item.title}</h4>
              </div>
              <div className="detail-mono self-center text-right text-[rgba(255,255,255,0.32)]">
                {item.source}
              </div>
            </a>
          ))
        ) : (
          <div className="text-[#777575]">
            No Brave Search headlines were available for this run.
          </div>
        )}
      </div>
    </section>
  );
}
