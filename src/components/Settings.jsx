import { useRef, useState } from 'react'
import { ACCENTS, GRADIENTS, LIBRARIES, SLATES, prepareBackgroundImage } from '../settings.js'
import Icon from './Icon.jsx'

function Row({ label, hint, children }) {
  return (
    <div className="srow">
      <div className="slabel">
        <span>{label}</span>
        {hint && <em>{hint}</em>}
      </div>
      <div className="scontrol">{children}</div>
    </div>
  )
}

function Segments({ value, options, onChange }) {
  return (
    <div className="seg" role="group">
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

function Swatches({ value, entries, onChange, kind }) {
  return (
    <div className="swatches">
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
          <span className="sr">{def.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function Settings({ open, onClose, settings, set, reset }) {
  const fileRef = useRef(null)
  const [imgError, setImgError] = useState(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <>
      <div className={open ? 'sheet-scrim on' : 'sheet-scrim'} onClick={onClose} />
      <aside className={open ? 'sheet open' : 'sheet'} aria-hidden={!open}>
        <header className="sheet-head">
          <h2>
            <Icon name="settings" size={17} />
            Settings
          </h2>
          <button className="iconbtn" onClick={onClose} title="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="sheet-body">
          <h3>Library</h3>
          <div className="libs">
            {Object.entries(LIBRARIES).map(([id, lib]) => (
              <button
                key={id}
                className={id === settings.library ? 'lib on' : 'lib'}
                onClick={() => set({ library: id })}
              >
                <span className="lib-main">
                  <strong>{lib.label}</strong>
                  {lib.count != null && <span className="lib-count">{lib.count}</span>}
                </span>
                <span className="lib-sub">
                  {lib.author ? `by ${lib.author}` : lib.note}
                </span>
              </button>
            ))}
          </div>

          {LIBRARIES[settings.library]?.credit && (
            <p className="snote">
              Games served by {LIBRARIES[settings.library].author}, linked straight from their
              host.{' '}
              <a href={LIBRARIES[settings.library].credit} target="_blank" rel="noreferrer">
                View the source
              </a>
            </p>
          )}

          {settings.library === 'local' && (
            <p className="snote">
              Most links here point at a host that no longer exists, so they open blank. Four are
              known to work. Kept only for reference.
            </p>
          )}

          <h3>Appearance</h3>
          <Row label="Mode">
            <Segments
              value={settings.theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: 'Dark', icon: 'moon' },
                { value: 'light', label: 'Light', icon: 'sun' },
              ]}
            />
          </Row>

          <Row label="Accent" hint="Buttons, highlights, card art">
            <Swatches
              kind="accent"
              value={settings.accent}
              entries={ACCENTS}
              onChange={(accent) => set({ accent })}
            />
          </Row>

          <Row label="Background">
            <Segments
              value={settings.bgKind}
              onChange={(bgKind) => set({ bgKind })}
              options={[
                { value: 'slate', label: 'Solid' },
                { value: 'gradient', label: 'Gradient' },
                { value: 'image', label: 'Image' },
              ]}
            />
          </Row>

          {settings.bgKind === 'slate' && (
            <Row label="Colour">
              <Swatches
                kind="slate"
                value={settings.bgSlate}
                entries={SLATES}
                onChange={(bgSlate) => set({ bgSlate })}
              />
            </Row>
          )}

          {settings.bgKind === 'gradient' && (
            <Row label="Gradient">
              <Swatches
                kind="gradient"
                value={settings.bgGradient}
                entries={GRADIENTS}
                onChange={(bgGradient) => set({ bgGradient })}
              />
            </Row>
          )}

          {settings.bgKind === 'image' && (
            <>
              <Row label="Your image" hint="Resized and stored on this device only">
                <div className="stack">
                  <button
                    className="btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                  >
                    <Icon name="image" size={15} />
                    {busy ? 'Working' : settings.bgImage ? 'Replace' : 'Upload'}
                  </button>
                  {settings.bgImage && (
                    <button className="btn" onClick={() => set({ bgImage: null, bgKind: 'slate' })}>
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
              </Row>

              {imgError && <p className="snote bad">{imgError}</p>}

              {settings.bgImage && (
                <Row label="Dim" hint="Keeps text readable over a busy photo">
                  <input
                    className="range"
                    type="range"
                    min="0"
                    max="90"
                    value={settings.bgDim}
                    onChange={(e) => set({ bgDim: Number(e.target.value) })}
                  />
                </Row>
              )}
            </>
          )}

          <h3>Cards</h3>
          <Row label="Shape">
            <Segments
              value={settings.cardShape}
              onChange={(cardShape) => set({ cardShape })}
              options={[
                { value: 'square', label: 'Square' },
                { value: 'portrait', label: 'Tall' },
                { value: 'landscape', label: 'Wide' },
              ]}
            />
          </Row>

          <Row label="Titles" hint="The bar under each icon">
            <Toggle
              label="Show titles"
              value={settings.showTitles}
              onChange={(showTitles) => set({ showTitles })}
            />
          </Row>

          <Row label="Idle shimmer" hint="One random card at a time">
            <Toggle
              label="Idle shimmer"
              value={settings.idleShimmer}
              onChange={(idleShimmer) => set({ idleShimmer })}
            />
          </Row>

          <h3>Sections</h3>
          <Row label="Coloured icons" hint="A distinct colour per category">
            <Toggle
              label="Coloured icons"
              value={settings.colorIcons}
              onChange={(colorIcons) => set({ colorIcons })}
            />
          </Row>

          <div className="sheet-foot">
            <button className="btn" onClick={reset}>
              Reset everything
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
