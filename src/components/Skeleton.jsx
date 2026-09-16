// Shown while games.json is in flight. A shimmering wall in the real card
// shape tells you what is coming, which a centred "Loading" does not.
export default function Skeleton() {
  return (
    <main>
      <div className="skel-hero" />
      <div className="grid">
        {Array.from({ length: 12 }, (_, i) => (
          <div className="skel-card" key={i} style={{ '--i': i }}>
            <div className="skel-thumb" />
            <div className="skel-line" />
            <div className="skel-line short" />
          </div>
        ))}
      </div>
    </main>
  )
}
