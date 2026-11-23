/** Shown the instant someone taps through, while the page's information loads. */
export default function PageLoading({ cards = 3 }: { cards?: number }) {
  return (
    <main className="page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skel skel-title" />
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="card pad">
          <div className="skel skel-line" style={{ width: "40%" }} />
          <div className="skel skel-line" style={{ width: "85%" }} />
          <div className="skel skel-line" style={{ width: i % 2 ? "60%" : "72%" }} />
        </div>
      ))}
    </main>
  );
}
