type QueryInputProps = {
  query: string;
  asset: string;
  assets: string[];
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onAssetChange: (value: string) => void;
  onSubmit: (query: string) => void;
};

const EXAMPLE_PROMPTS = [
  "Should I long BTC right now?",
  "I have 0.001 BTC, should I sell?",
  "What is BTC?",
  "Explain funding rate in simple terms.",
];

export default function QueryInput({
  query,
  asset,
  assets,
  isLoading,
  onQueryChange,
  onAssetChange,
  onSubmit,
}: QueryInputProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0e0e0e] text-white selection:bg-[#9cff93] selection:text-[#0e0e0e]">
      <div className="kinetic-wireframe pointer-events-none absolute inset-0 z-0 opacity-30" />
      <div className="kinetic-scanline pointer-events-none absolute inset-0 z-0 opacity-30" />

      <header className="relative z-10 flex w-full flex-col justify-between gap-6 p-8 md:flex-row md:items-start md:p-12">
        <div className="flex flex-col gap-1">
          <div className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.1em] text-white md:text-2xl">
            PerpCopilot
          </div>
          <div className="text-xs uppercase tracking-[0.35em] text-[#777575]">
            v2.0.4 // KINETIC CORE
          </div>
        </div>

        <div className="flex flex-col gap-3 text-right font-['Space_Grotesk'] text-xs uppercase tracking-[0.28em] text-[#00e3fd] md:flex-row md:gap-8 md:text-left md:text-sm">
          <span>[STATUS: ONLINE]</span>
          <span>[FEED: PACIFICA]</span>
          <span>[MODE: ANALYSIS]</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-8 md:px-16">
        <div className="kinetic-glow pointer-events-none absolute inset-0" />

        <div className="relative z-10 flex w-full flex-col items-start md:items-center">
          <h1 className="mb-16 w-full text-left font-['Space_Grotesk'] text-4xl font-bold uppercase leading-none tracking-[0.05em] text-[#9cff93] md:text-center md:text-6xl lg:text-8xl">
            Execute Query &gt;<span className="animate-pulse">_</span>
          </h1>

          <div className="mb-10 flex w-full flex-col gap-4 text-left font-['Space_Grotesk'] text-xs uppercase tracking-[0.2em] text-[#777575] md:mb-16 md:text-center md:text-sm">
            <span className="text-[#00e3fd]">Suggested Vectors:</span>
            <p>
              ANALYZE BTC-PERP LIQUIDITY
              <span className="mx-2 text-[#494847]">::</span>
              BACKTEST VOLATILITY HEDGE
              <span className="mx-2 text-[#494847]">::</span>
              EXPLAIN FUNDING RATE SPIKE
            </p>
          </div>

          <div className="mb-8 flex w-full max-w-4xl flex-wrap gap-3">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onQueryChange(prompt)}
                className="border border-[#494847] bg-[rgba(19,19,19,0.55)] px-3 py-2 text-left font-['Space_Grotesk'] text-[11px] uppercase tracking-[0.22em] text-[#adaaaa] transition hover:border-[#9cff93] hover:text-[#9cff93]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="group relative w-full max-w-4xl"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(query);
            }}
          >
            <label className="sr-only" htmlFor="command-input">
              Enter Command
            </label>

            <div className="relative w-full">
              <span className="pointer-events-none absolute left-0 top-1/2 ml-2 -translate-y-1/2 font-['Space_Grotesk'] text-2xl text-[#9cff93] md:text-3xl">
                ~
              </span>
              <input
                id="command-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Enter command syntax..."
                className="w-full border-0 border-b-[3px] border-[#494847] bg-[rgba(19,19,19,0.2)] py-6 pl-12 pr-14 font-['Space_Grotesk'] text-2xl tracking-wide text-white placeholder:text-[#494847] backdrop-blur-sm transition-colors duration-300 focus:border-[#9cff93] focus:outline-none focus:ring-0 md:text-4xl"
              />
              <button
                type="submit"
                aria-label="Execute"
                disabled={isLoading || !query.trim()}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-4 text-[#777575] transition-colors hover:text-[#9cff93] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-3xl">keyboard_return</span>
              </button>
            </div>

            <div className="absolute bottom-0 left-0 h-[1px] w-full bg-[#9cff93] opacity-0 shadow-[0_0_15px_rgba(156,255,147,0.8)] transition-opacity duration-300 group-focus-within:opacity-100" />
          </form>

          <div className="mt-8 flex w-full max-w-4xl flex-col gap-5 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.22em] text-[#777575] md:flex-row md:items-center md:justify-between md:text-xs">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-ping bg-[#777575]" />
                Awaiting Input_
              </span>
              <div className="flex items-center gap-2 border border-[#494847] bg-[rgba(19,19,19,0.35)] p-1">
                {assets.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onAssetChange(item)}
                    className={`px-3 py-2 font-['Space_Grotesk'] text-[10px] uppercase tracking-[0.25em] transition md:text-xs ${
                      asset === item
                        ? "bg-[#9cff93] text-[#0e0e0e]"
                        : "text-[#adaaaa] hover:text-[#9cff93]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-right">
              SYS_MEM: 42% <span className="mx-2 text-[rgba(119,117,117,0.35)]">|</span> LATENCY: 12ms
            </span>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex h-2 w-full justify-between border-t border-[rgba(73,72,71,0.2)] bg-[#131313]">
        <div className="h-full w-1/4 bg-[rgba(156,255,147,0.2)]" />
        <div className="h-full w-1/12 bg-[rgba(0,227,253,0.2)]" />
      </footer>
    </div>
  );
}
