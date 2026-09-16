export default function Header({
  query,
  onQuery,
  categories,
  category,
  onCategory,
  theme,
  onTheme,
}) {
  return (
    <header>
      <div className="bar">
        <a className="brand" href="#/">
          Blocked
        </a>
        <input
          className="search"
          type="search"
          value={query}
          placeholder="Search games"
          onChange={(e) => onQuery(e.target.value)}
        />
        <button
          className="theme"
          onClick={onTheme}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </div>
      <nav className="cats">
        {categories.map((c) => (
          <button
            key={c}
            className={c === category ? 'cat on' : 'cat'}
            onClick={() => onCategory(c)}
          >
            {c}
          </button>
        ))}
      </nav>
    </header>
  )
}
