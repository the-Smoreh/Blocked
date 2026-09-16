import { useRef, useState } from 'react'
import { ACCENTS, GRADIENTS, LIBRARIES, SLATES, prepareBackgroundImage } from '../settings.js'
import { artFor } from '../art.js'
import Icon from './Icon.jsx'

const TABS = [
  { id: 'library', label: 'Library', icon: 'all' },
  { id: 'look', label: 'Look', icon: 'image' },
  { id: 'cards', label: 'Cards', icon: 'arcade' },
]

// A group is a titled card. Grouping controls into panels is most of what
// stops the sheet reading as a raw form.
function Group({ title, hint, children }) {
  return (
    <section className="sgroup">
      {(title || hint) && (
        <header>
          {title && <h4>{title}</h4>}
          {hint && <p>{hint}</p>}
        </header>
      )}
      <div className="sgroup-body">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="sfield">
      <div className="sfield-label">
        <span>{label}</span>
        {hint && <em>{hint}</em>}
      </div>
      <div className="sfield-control">{children}</div>
    </div>
  )
}

function Segments({ value, options, onChange, wide }) {
  return (
    <div className={wide ? 'seg wide' : 'seg'} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          title={o.hint || o.label}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      className={value ? 'switch on' : 'switch'}
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
    >
      <span />
    </button>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Swatches({ value, entries, onChange, kind }) {
  return (
    <div className={`swatches ${kind}`}>
      {Object.entries(entries).map(([id, def]) => (
        <button
          key={id}
          className={id === value ? 'swatch on' : 'swatch'}
          title={def.label}
          onClick={() => onChange(id)}
          style={
            kind === 'accent'
              ? { background: `linear-gradient(135deg, ${def.a}, ${def.b})` }
              : kind === 'slate'
                ? { background: def.bg }
                : { background: def.css }
          }
        >
          {id === value && <Tick />}
          <span className="sr">{def.label}</span>
        </button>
      ))}
    </div>
  )
}

// Three miniature cards built exactly the way the real ones are. Because
// options are applied to the root element, this updates itself the moment
// anything changes, which beats describing a setting in words.
const PREVIEW = [
  ['Slope', 'Platformer'],
  ['Drift Hunters', 'Racing'],
  ['2048', 'Puzzle'],
]

function Preview() {
  return (
    <div className="spreview" aria-hidden="true">
      {PREVIEW.map(([title, category]) => {
        const art = artFor(title, category)
        return (
          <div className="card" key={title} style={art.style} data-pattern={art.pattern}>
            <div className="thumb">
              <span className="art" />
              <span className="art-initials">{art.initials}</span>
            </div>
            <div className="meta">
              <h3>{title}</h3>
              <span className="tag">{category}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Settings({ open, onClose, settings, set, reset }) {
  const fileRef = useRef(null)
  const [imgError, setImgError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('library')

  // Mode and background are separate settings, but a dark slate under light
  // text is unreadable. Switching mode moves a mismatched solid or gradient
  // to its counterpart, and leaves a deliberate choice alone.
  const setTheme = (theme) => {
    const patch = { theme }
    const goingLight = theme === 'light'
    if (settings.bgKind === 'slate') {
      if (goingLight && settings.bgSlate !== 'bone') patch.bgSlate = 'bone'
      if (!goingLight && settings.bgSlate === 'bone') patch.bgSlate = 'ink'
    }
    if (settings.bgKind === 'gradient') {
      if (goingLight && settings.bgGradient !== 'paper') patch.bgGradient = 'paper'
      if (!goingLight && settings.bgGradient === 'paper') patch.bgGradient = 'emberfade'
    }
    set(patch)
  }

  const pickImage = async (file) => {
    if (!file) return
    setImgError(null)
    setBusy(true)
    try {
      const { dataUrl } = await prepareBackgroundImage(file)
      set({ bgImage: dataUrl, bgKind: 'image' })
    } catch (e) {
      setImgError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const active = LIBRARIES[settings.library]
  // Only the credited community libraries count. Including the built in list
  // would add 451 games that are known dead, and Lumin has no count at all.
  const credited = Object.values(LIBRARIES).filter((l) => l.credit)
  const totalGames = credited.reduce((n, l) => n + (l.count || 0), 0)
  const libCount = credited.length

  return (
    <>
      <div className={open ? 'sheet-scrim on' : 'sheet-scrim'} onClick={onClose} />
      <aside className={open ? 'sheet open' : 'sheet'} aria-hidden={!open}>
        <header className="sheet-head">
          <div className="sheet-title">
            <span className="sheet-glyph">
              <Icon name="settings" size={16} />
            </span>
            <span className="sheet-titletext">
              <strong>Settings</strong>
              <em>
                {totalGames.toLocaleString()} games, {libCount} credited libraries
              </em>
            </span>
          </div>
          <button className="iconbtn" onClick={onClose} title="Close">
            <Icon name="close" />
          </button>
        </header>

        <nav className="stabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? 'stab on' : 'stab'}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="sheet-body">
          {tab === 'library' && (
            <Group hint="Every library is hosted by the people who built it. Picking one links straight to their host.">
              <div className="libs">
                {Object.entries(LIBRARIES).map(([id, lib]) => {
                  const on = id === settings.library
                  return (
                    <div className={on ? 'lib on' : 'lib'} key={id}>
                      <button className="lib-pick" onClick={() => set({ library: id })}>
                        <span className="lib-badge">{lib.label.charAt(0)}</span>
                        <span className="lib-text">
                          <strong>{lib.label}</strong>
                          <em>{lib.author ? `by ${lib.author}` : lib.note}</em>
                        </span>
                        {lib.count != null && <span className="lib-count">{lib.count}</span>}
                        {on && (
                          <span className="lib-tick">
                            <Tick />
                          </span>
                        )}
                      </button>
                      {lib.credit && (
                        <a
                          className="lib-link"
                          href={lib.credit}
                          target="_blank"
                          rel="noreferrer"
                          title={`Open ${lib.author} on GitHub`}
                        >
                          <Icon name="external" size={15} />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>

              {settings.library === 'local' && (
                <p className="snote bad">
                  Most links here point at a host that no longer exists, so they open blank. Kept
                  for reference only.
                </p>
              )}
              {settings.library === 'lumin' && (
                <p className="snote">
                  Loaded from a third party CDN, and it checks the domain it runs on, so it does not
                  work from localhost.
                </p>
              )}
            </Group>
          )}

          {tab === 'look' && (
            <>
              <Group title="Mode">
                <Segments
                  wide
                  value={settings.theme}
                  onChange={setTheme}
                  options={[
                    { value: 'dark', label: 'Dark', icon: 'moon' },
                    { value: 'light', label: 'Light', icon: 'sun' },
                  ]}
                />
              </Group>

              <Group title="Accent" hint="Drives buttons, highlights and the generated cover art.">
                <Swatches
                  kind="accent"
                  value={settings.accent}
                  entries={ACCENTS}
                  onChange={(accent) => set({ accent })}
                />
                <Preview />
              </Group>

              <Group title="Background">
                <Segments
                  wide
                  value={settings.bgKind}
                  onChange={(bgKind) => set({ bgKind })}
                  options={[
                    { value: 'slate', label: 'Solid' },
                    { value: 'gradient', label: 'Gradient' },
                    { value: 'image', label: 'Image' },
                  ]}
                />

                {settings.bgKind === 'slate' && (
                  <Swatches
                    kind="slate"
                    value={settings.bgSlate}
                    entries={SLATES}
                    onChange={(bgSlate) => set({ bgSlate })}
                  />
                )}

                {settings.bgKind === 'gradient' && (
                  <Swatches
                    kind="gradient"
                    value={settings.bgGradient}
                    entries={GRADIENTS}
                    onChange={(bgGradient) => set({ bgGradient })}
                  />
                )}

                {settings.bgKind === 'image' && (
                  <>
                    <div className="stack">
                      <button
                        className="btn primary"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                      >
                        <Icon name="image" size={15} />
                        {busy ? 'Working' : settings.bgImage ? 'Replace image' : 'Upload an image'}
                      </button>
                      {settings.bgImage && (
                        <button
                          className="btn"
                          onClick={() => set({ bgImage: null, bgKind: 'slate' })}
                        >
                          Remove
                        </button>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          pickImage(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </div>

                    {settings.bgImage && (
                      <>
                        <div
                          className="sthumb"
                          style={{ backgroundImage: `url("${settings.bgImage}")` }}
                        />
                        <Field label="Dim" hint="Keeps text readable over a busy photo">
                          <span className="rangewrap">
                            <input
                              className="range"
                              type="range"
                              min="0"
                              max="90"
                              value={settings.bgDim}
                              onChange={(e) => set({ bgDim: Number(e.target.value) })}
                            />
                            <b>{settings.bgDim}%</b>
                          </span>
                        </Field>
                      </>
                    )}

                    {imgError && <p className="snote bad">{imgError}</p>}
                    {!settings.bgImage && !imgError && (
                      <p className="snote">
                        Resized to 1920px and kept on this device only. Nothing is uploaded
                        anywhere.
                      </p>
                    )}
                  </>
                )}
              </Group>
            </>
          )}

          {tab === 'cards' && (
            <>
              <Group title="Shape" hint="Applies to every tile on the wall.">
                <Segments
                  wide
                  value={settings.cardShape}
                  onChange={(cardShape) => set({ cardShape })}
                  options={[
                    { value: 'square', label: 'Square' },
                    { value: 'portrait', label: 'Tall' },
                    { value: 'landscape', label: 'Wide' },
                  ]}
                />
                <Preview />
              </Group>

              <Group title="Details">
                <Field label="Titles" hint="The bar under each icon">
                  <Toggle
                    label="Show titles"
                    value={settings.showTitles}
                    onChange={(showTitles) => set({ showTitles })}
                  />
                </Field>
                <Field label="Idle shimmer" hint="One random card at a time">
                  <Toggle
                    label="Idle shimmer"
                    value={settings.idleShimmer}
                    onChange={(idleShimmer) => set({ idleShimmer })}
                  />
                </Field>
                <Field label="Coloured icons" hint="A distinct colour per category">
                  <Toggle
                    label="Coloured icons"
                    value={settings.colorIcons}
                    onChange={(colorIcons) => set({ colorIcons })}
                  />
                </Field>
              </Group>
            </>
          )}

          <div className="sheet-foot">
            <button className="btn" onClick={reset}>
              Reset everything
            </button>
            {active?.credit && (
              <span className="sheet-credit">
                Showing{' '}
                <a href={active.credit} target="_blank" rel="noreferrer">
                  {active.label}
                </a>
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
