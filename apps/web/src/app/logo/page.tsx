import Logo, { BoltIcon } from "@/components/Logo";

export default function LogoPage() {
  return (
    <main className="min-h-screen py-20 px-8" style={{ background: "#F7F6F3" }}>
      <div className="max-w-3xl mx-auto space-y-16">

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black mb-1" style={{ color: "#1A1A1A" }}>
            DevSimulate Logo
          </h1>
          <p className="text-sm" style={{ color: "#6B6B6B" }}>All variants — copy the SVG or use the React component</p>
        </div>

        {/* ── Horizontal lockup ── */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#9CA3AF" }}>
            Horizontal (default — use in navbars)
          </p>
          <div className="grid gap-4">
            {/* Light bg */}
            <div className="rounded-2xl p-10 flex items-center gap-10 flex-wrap"
              style={{ background: "#FFFFFF", border: "1px solid #E4E2DD" }}>
              <Logo variant="horizontal" size={36} />
              <Logo variant="horizontal" size={44} />
              <Logo variant="horizontal" size={52} />
            </div>
            {/* Dark bg */}
            <div className="rounded-2xl p-10 flex items-center gap-10 flex-wrap"
              style={{ background: "#111111" }}>
              <div className="flex items-center gap-2.5">
                <BoltIcon size={36} />
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 900, fontSize: "18px", letterSpacing: "-0.03em", color: "#FFFFFF" }}>
                  DevSimulate
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <BoltIcon size={44} />
                <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 900, fontSize: "22px", letterSpacing: "-0.03em", color: "#FFFFFF" }}>
                  DevSimulate
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Icon only ── */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#9CA3AF" }}>
            Icon only (favicons, app icons, avatars)
          </p>
          <div className="rounded-2xl p-10 flex items-end gap-6 flex-wrap"
            style={{ background: "#FFFFFF", border: "1px solid #E4E2DD" }}>
            <BoltIcon size={16} />
            <BoltIcon size={24} />
            <BoltIcon size={32} />
            <BoltIcon size={40} />
            <BoltIcon size={48} />
            <BoltIcon size={64} />
            <BoltIcon size={80} />
            <BoltIcon size={96} />
          </div>
        </section>

        {/* ── Stacked ── */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#9CA3AF" }}>
            Stacked (splash screens, marketing cards)
          </p>
          <div className="rounded-2xl p-10 flex items-end gap-16 flex-wrap"
            style={{ background: "#FFFFFF", border: "1px solid #E4E2DD" }}>
            <Logo variant="stacked" size={48} />
            <Logo variant="stacked" size={64} />
            <Logo variant="stacked" size={80} />
          </div>
        </section>

        {/* ── Color variants ── */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#9CA3AF" }}>
            Solid colour variants
          </p>
          <div className="rounded-2xl p-10 flex items-center gap-8 flex-wrap"
            style={{ background: "#FFFFFF", border: "1px solid #E4E2DD" }}>
            <BoltIcon size={48} solidColor="#5B5BD6" />
            <BoltIcon size={48} solidColor="#0D9488" />
            <BoltIcon size={48} solidColor="#1A1A1A" />
            <BoltIcon size={48} solidColor="#111827" />
            <div className="rounded-xl p-3" style={{ background: "#5B5BD6" }}>
              <BoltIcon size={48} solidColor="#FFFFFF" />
            </div>
          </div>
        </section>

        {/* ── Raw SVG ── */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "#9CA3AF" }}>
            Raw SVG — copy and save as .svg file
          </p>
          <pre
            className="rounded-2xl p-6 text-xs overflow-auto leading-relaxed"
            style={{ background: "#1A1A1A", color: "#A3E635", fontFamily: "monospace" }}
          >
{`<svg width="40" height="40" viewBox="0 0 40 40"
     fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="40" y2="40"
                    gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#5B5BD6"/>
      <stop offset="100%" stop-color="#0D9488"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" rx="10" fill="url(#g)"/>
  <path d="M 23 5 L 11 23 L 20 23 L 16 35 L 30 17 L 21 17 Z"
        fill="white" fill-rule="evenodd"/>
</svg>`}
          </pre>
        </section>

      </div>
    </main>
  );
}
