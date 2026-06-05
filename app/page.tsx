import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="brand-mark" />
          Audio Signal Lab
        </Link>
        <div className="nav-links">
          <Link className="pill" href="/upload">Upload spectrogram</Link>
          <Link className="pill" href="/gallery">Synced gallery</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="panel copy">
          <span className="kicker">Next.js prototype</span>
          <h1>Sound lessons that react while you listen.</h1>
          <p>
            This prototype validates the upgraded stack with two focused experiences: uploaded audio
            spectrograms computed through an API endpoint, and a gallery where generated sound and
            visual motion share the same playback clock.
          </p>
          <div className="actions">
            <Link className="button" href="/upload">Try upload spectrogram</Link>
            <Link className="button secondary" href="/gallery">Open synced gallery</Link>
          </div>
        </div>

        <div className="panel stage-card">
          <div className="stage-inner">
            <span className="kicker">What changed</span>
            <div style={{ marginTop: "auto" }}>
              <h2>Dynamic first, tutorial second.</h2>
              <p style={{ color: "rgba(237,246,255,.72)" }}>
                Page 7 moves from a browser-only analyser to a real upload pipeline. Page 9 moves from
                decorative patterns to visuals that are revealed by playback time.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
