const STEPS = [
  { icon: "⚡", label: "Fetching Pacifica market data..." },
  { icon: "📊", label: "Running funding rate analysis..." },
  { icon: "🌐", label: "Scanning recent news..." },
  { icon: "🤖", label: "Generating AI analysis..." },
];

export default function LoadingSequence({ activeStep }) {
  return (
    <div className="console-shell">
      <div className="kinetic-wireframe pointer-events-none absolute inset-0 z-0 opacity-20" />
      <div className="kinetic-scanline pointer-events-none absolute inset-0 z-0 opacity-25" />
      <div className="console-main flex min-h-screen max-w-5xl items-center justify-center">
        <div className="console-section w-full px-8 py-12 sm:px-12">
          <div className="mb-16">
            <p className="console-kicker mb-4">Live Workflow</p>
            <h2 className="console-display max-w-4xl text-left md:text-center">
              Building Signal_
            </h2>
            <p className="console-hanging mt-8 max-w-2xl text-base leading-8 text-[rgba(255,255,255,0.72)] md:mx-auto md:text-center md:[margin-left:0]">
              Pacifica market structure, funding context, external catalysts, and machine reasoning are being composed into a single trade read.
            </p>
          </div>

          <div className="console-subvoid">
          {STEPS.map((step, index) => {
            const status =
              activeStep > index ? "done" : activeStep === index ? "active" : "pending";

            return (
              <div
                key={step.label}
                className={`grid gap-4 bg-[rgba(19,19,19,0.72)] px-6 py-6 transition ${
                  status === "done"
                    ? "opacity-45"
                    : status === "active"
                      ? "console-overlay"
                      : "opacity-75"
                }`}
              >
                <div className="flex items-end justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <span
                      className={`text-2xl ${
                        status === "done"
                          ? "text-[#9cff93]"
                          : status === "active"
                            ? "text-[#00e3fd]"
                            : "text-[#777575]"
                      }`}
                    >
                      {status === "done" ? "✓" : step.icon}
                    </span>
                    <div>
                      <p className="console-kicker mb-2">
                        Stage {String(index + 1).padStart(2, "0")}
                      </p>
                      <span className="console-headline text-base text-textPrimary sm:text-xl">
                        {step.label}
                      </span>
                    </div>
                  </div>
                  <span className="console-monodata text-3xl text-[#777575]">
                    {status === "done" ? "100%" : status === "active" ? `${(index + 1) * 25}%` : "00%"}
                  </span>
                </div>

                <div className="console-hanging h-px bg-[rgba(73,72,71,0.35)]">
                  <div
                    className={`h-px ${
                      status === "done"
                        ? "w-full bg-[#9cff93]"
                        : status === "active"
                          ? "animate-status-bar bg-[#00e3fd]"
                          : "w-[18%] bg-[rgba(119,117,117,0.4)]"
                    }`}
                  />
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
