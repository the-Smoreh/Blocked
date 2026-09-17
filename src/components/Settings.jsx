import { useRef, useState } from 'react'
import {
  ACCENTS,
  GRADIENTS,
  LIBRARIES,
  SLATES,
  prepareBackgroundImage,
} from '../settings.js'
import { artFor } from '../art.js'
import Icon from './Icon.jsx'

const TABS = [
  { id: 'library', label: 'Library', icon: 'all' },
  { id: 'look', label: 'Look', icon: 'image' },
  { id: 'interface', label: 'Interface', icon: 'arcade' },
]

// A titled panel. `value` puts the current setting in the header, so glancing
// down the sheet tells you what is set without reading every control.
function Group({ title, value, hint, children }) {
  return (
    <section className="sgroup">
      {(title || hint) && (
        <header>
          {title && <h4>{title}</h4>}
          {value && <span className="svalue">{value}</span>}
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

function Swatches({ value, entries, onChange }) {
  return (
    <div className="swatches">
      {Object.entries(entries).map(([id, def]) => (
        <button
          key={id}
          className={id === value ? 'swatch on' : 'swatch'}
          title={def.label}
          onClick={() => onChange(id)}
          style={{ background: `linear-gradient(135deg, ${def.a}, ${def.b})` }}
        >
          {id === value && <Tick />}
          <span className="sr">{def.label}</span>
        </button>
      ))}
    </div>
  )
}

// Backgrounds get real tiles rather than swatches. Thirty gradients in 28px
// squares all looked like the same dark or light square, which is most of why
// picking one felt like guessing.
function Tiles({ ids, entries, value, onChange, swatch, theme }) {
  return (
    <div className="bgpick">
      {ids.map((id) => {
        const def = entries[id]
        return (
          <button
            key={id}
            className={id === value ? 'bgtile on' : 'bgtile'}
            onClick={() => onChange(id)}
            title={def.label}
          >
            <i style={{ background: swatch(def) }} />
            <b>
              {def.label}
              {def.tone !== theme && <small>{def.tone === 'light' ? 'LIGHT' : 'DARK'}</small>}
            </b>
            {id === value && (
              <span className="tick">
                <Tick />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Split by which mode each preset belongs to, the current one first.
//
// A preset is only readable under the text colour of its own mode, so picking
// one from the other group switches mode with it. That used to happen
// silently and left near white text on a near white page. Grouping says it
// once for the whole set, and each mismatched tile still carries a DARK or
// LIGHT marker for when the heading has been scrolled past.
function BgTiles({ value, entries, onChange, theme, swatch }) {
  const ids = Object.keys(entries)
  const mine = ids.filter((id) => entries[id].tone === theme)
  const other = ids.filter((id) => entries[id].tone !== theme)
  const pass = { entries, value, onChange, swatch, theme }

  if (!mine.length || !other.length) return <Tiles ids={ids} {...pass} />

  const otherTone = entries[other[0]].tone

  return (
    <>
      <Tiles ids={mine} {...pass} />
      <p className="bgsub">
        <span>These switch to {otherTone} mode</span>
      </p>
      <Tiles ids={other} {...pass} />
    </>
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

const SHAPE_LABEL = { square: 'Square', portrait: 'Tall', landscape: 'Wide' }

export default function Settings({ open, onClose, settings, set, reset }) {
  const fileRef = useRef(null)
  const [imgError, setImgError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [tab, setTab] = useState('library')

  // Mode and background have to agree or the site is unreadable, so both
  // directions are driven off the same `tone` that each option carries.
  const setTheme = (theme) => {
    const patch = { theme }
    if (settings.bgKind === 'slate' && SLATES[settings.bgSlate]?.tone !== theme) {
      patch.bgSlate = theme === 'light' ? 'bone' : 'ink'
    }
    if (settings.bgKind === 'gradient' && GRADIENTS[settings.bgGradient]?.tone !== theme) {
      patch.bgGradient = theme === 'light' ? 'sloshlight' : 'slosh'
    }
    set(patch)
  }

  const pickSlate = (bgSlate) => {
    const tone = SLATES[bgSlate]?.tone
    set({
      bgSlate,
      bgKind: 'slate',
      ...(tone && tone !== settings.theme ? { theme: tone } : null),
    })
  }

  const pickGradient = (bgGradient) => {
    const tone = GRADIENTS[bgGradient]?.tone
    set({
      bgGradient,
      bgKind: 'gradient',
      ...(tone && tone !== settings.theme ? { theme: tone } : null),
    })
  }

  // Choosing Image with nothing uploaded used to commit to a background that
  // renders as a flat dim veil over nothing. It opens the picker instead.
  const pickKind = (bgKind) => {
    if (bgKind === 'image' && !settings.bgImage) {
      fileRef.current?.click()
      return
    }
    set({ bgKind })
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
  // Only the credited community libraries count towards the total, because
  // Lumin has no count of its own that can be verified against a file.
  const credited = Object.values(LIBRARIES).filter((l) => l.credit)
  const totalGames = credited.reduce((n, l) => n + (l.count || 0), 0)

  const bgValue =
    settings.bgKind === 'slate'
      ? SLATES[settings.bgSlate]?.label
      : settings.bgKind === 'gradient'
        ? GRADIENTS[settings.bgGradient]?.label
        : settings.bgImage
          ? 'Your image'
          : 'None yet'

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
                {totalGames.toLocaleString()} games across {credited.length} libraries
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
              title={t.label}
            >
              <Icon name={t.icon} size={15} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sheet-body">
          {tab === 'library' && (
            <>
              <Group
                title="Source"
                value={active?.label}
                hint="Every library is hosted by the people who built it. Picking one links straight to their host."
              >
                <div className="libs">
                  {Object.entries(LIBRARIES).map(([id, lib]) => {
                    const on = id === settings.library
                    return (
                      <div className={`lib${on ? ' on' : ''}`} key={id}>
                        <button className="lib-pick" onClick={() => set({ library: id })}>
                          <span className="lib-badge">{lib.label.charAt(0)}</span>
                          <span className="lib-text">
                            <strong>{lib.label}</strong>
                            <em>{lib.author ? `by ${lib.author}` : lib.note}</em>
                            {lib.author && lib.note && <small>{lib.note}</small>}
                          </span>
                          {lib.count != null && (
                            <span className="lib-count">{lib.count.toLocaleString()}</span>
                          )}
                          {on && (
                            <span className="lib-tick">
                              <Tick />
                            </span>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {settings.library === 'lumin' && (
                  <p className="snote">
                    Loaded from a third party CDN. A school network can block it outright.
                  </p>
                )}
              </Group>

              <Group title="Cover art">
                <Field
                  label="Borrow missing covers"
                  hint="Fills blank tiles from the other libraries"
                >
                  <Toggle
                    label="Borrow missing covers"
                    value={settings.borrowCovers}
                    onChange={(borrowCovers) => set({ borrowCovers })}
                  />
                </Field>
                <p className="snote">
                  The same game turns up in several libraries, so one that ships no cover
                  can use another one&apos;s. Selenite fills 79 of its 105 blanks this way.
                </p>
              </Group>
            </>
          )}

          {tab === 'look' && (
            <>
              <Group title="Mode" value={settings.theme === 'light' ? 'Light' : 'Dark'}>
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

              <Group
                title="Accent"
                value={ACCENTS[settings.accent]?.label}
                hint="Drives buttons, highlights and the generated cover art."
              >
                <Swatches
                  value={settings.accent}
                  entries={ACCENTS}
                  onChange={(accent) => set({ accent })}
                />
                <Preview />
              </Group>

              <Group title="Background" value={bgValue}>
                <Segments
                  wide
                  value={settings.bgKind}
                  onChange={pickKind}
                  options={[
                    { value: 'slate', label: 'Solid' },
                    { value: 'gradient', label: 'Gradient' },
                    { value: 'image', label: 'Image' },
                  ]}
                />

                {settings.bgKind === 'slate' && (
                  <BgTiles
                    value={settings.bgSlate}
                    entries={SLATES}
                    onChange={pickSlate}
                    theme={settings.theme}
                    swatch={(def) => def.bg}
                  />
                )}

                {settings.bgKind === 'gradient' && (
                  <BgTiles
                    value={settings.bgGradient}
                    entries={GRADIENTS}
                    onChange={pickGradient}
                    theme={settings.theme}
                    swatch={(def) => def.css}
                  />
                )}

                {settings.bgKind === 'image' && (
                  <>
                    {settings.bgImage ? (
                      <>
                        <div
                          className="sthumb"
                          style={{ backgroundImage: `url("${settings.bgImage}")` }}
                        />
                        <div className="stack">
                          <button
                            className="btn"
                            onClick={() => fileRef.current?.click()}
                            disabled={busy}
                          >
                            <Icon name="image" size={15} />
                            {busy ? 'Working' : 'Replace'}
                          </button>
                          <button
                            className="btn"
                            onClick={() => set({ bgImage: null, bgKind: 'gradient' })}
                          >
                            Remove
                          </button>
                        </div>
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
                    ) : (
                      <button
                        className={over ? 'sdrop over' : 'sdrop'}
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setOver(true)
                        }}
                        onDragLeave={() => setOver(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setOver(false)
                          pickImage(e.dataTransfer.files?.[0])
                        }}
                      >
                        <Icon name="image" size={22} />
                        <strong>{busy ? 'Working' : 'Choose an image'}</strong>
                        or drop one here
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

                    {imgError && <p className="snote bad">{imgError}</p>}
                    {!settings.bgImage && !imgError && (
                      <p className="snote">
                        Resized to 1920px and kept on this device only. Nothing is
                        uploaded anywhere.
                      </p>
                    )}
                  </>
                )}

                <Field label="Moving background" hint="The accent drifts behind the wall">
                  <Toggle
                    label="Moving background"
                    value={settings.bgAnimated}
                    onChange={(bgAnimated) => set({ bgAnimated })}
                  />
                </Field>
              </Group>
            </>
          )}

          {tab === 'interface' && (
            <>
              <Group title="Card shape" value={SHAPE_LABEL[settings.cardShape]}>
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
                <Field label="Titles" hint="The bar under each cover">
                  <Toggle
                    label="Show titles"
                    value={settings.showTitles}
                    onChange={(showTitles) => set({ showTitles })}
                  />
                </Field>
                <Field label="Coloured icons" hint="A distinct colour per category">
                  <Toggle
                    label="Coloured icons"
                    value={settings.colorIcons}
                    onChange={(colorIcons) => set({ colorIcons })}
                  />
                </Field>
                <Field label="Idle shimmer" hint="One random card at a time">
                  <Toggle
                    label="Idle shimmer"
                    value={settings.idleShimmer}
                    onChange={(idleShimmer) => set({ idleShimmer })}
                  />
                </Field>
              </Group>

              <Group title="Player">
                <Field label="Frame counter" hint="Shown in the bar while a game is open">
                  <Toggle
                    label="Frame counter"
                    value={settings.showFps}
                    onChange={(showFps) => set({ showFps })}
                  />
                </Field>
                <p className="snote">
                  This is the frame rate of the page, not of the game. A game the browser
                  has put in its own process can stutter while this still reads 60.
                </p>
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
