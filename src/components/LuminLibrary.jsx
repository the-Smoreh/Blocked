import { useEffect, useRef, useState } from 'react'

// Mounts the third party Lumin game library, which ships its own catalogue,
// icons and browsing UI. It replaces our local grid entirely when selected.
//
// Two things to know about this dependency:
//
//   1. The tag is @latest, so jsDelivr serves whatever the newest release is.
//      A new release runs on this page with full DOM access and nobody here
//      approves it. Pin a version or a commit hash when convenient.
//   2. The bundle is obfuscated and builds its request urls at runtime, so
//      what it talks to cannot be read off the source.
//
// The SDK defines a global `Lumin` whose methods queue until its real
// implementation boots, so `init` is safe to call the moment the tag loads.

// Both filenames in that repo are byte identical, same sha256. "fonts" is a
// decoy name, so a filter that blocks one by URL will usually let the other
// through. Try them in order rather than giving up on the first block.
const SOURCES = [
  'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js',
  'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/fonts.min.js',
]
const MOUNT_ID = 'lumin-games-root'
const LOAD_TIMEOUT = 20000
const INIT_TIMEOUT = 20000

let loader = null

function loadOne(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    const timer = setTimeout(() => {
      script.remove()
      reject(new Error('timeout'))
    }, LOAD_TIMEOUT)

    script.addEventListener('load', () => {
      clearTimeout(timer)
      script.dataset.loaded = 'true'
      // The global is installed by the bundle itself. If it is absent then
      // something loaded but it is not this SDK.
      if (window.Lumin) resolve(window.Lumin)
      else reject(new Error('loaded but did not register'))
    })

    script.addEventListener('error', () => {
      clearTimeout(timer)
      script.remove()
      reject(new Error('blocked or unreachable'))
    })

    script.src = src
    script.async = true
    script.dataset.luminSdk = 'true'
    document.body.appendChild(script)
  })
}

// One shared promise for the whole page. Toggling the library setting back and
// forth must not append the script tag again.
function ensureLuminLoaded() {
  if (loader) return loader

  loader = (async () => {
    if (window.Lumin) return window.Lumin

    const already = document.querySelector('script[data-lumin-sdk="true"][data-loaded="true"]')
    if (already && window.Lumin) return window.Lumin

    const failures = []
    for (const src of SOURCES) {
      try {
        return await loadOne(src)
      } catch (e) {
        failures.push(`${src.split('/').pop()}: ${e.message}`)
      }
    }
    throw new Error(`Could not load the game library. Tried ${failures.join(', ')}.`)
  })().catch((err) => {
    // Let a later attempt retry instead of caching the failure forever.
    loader = null
    throw err
  })

  return loader
}

export default function LuminLibrary({ theme, onUseLocal }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    const init = async () => {
      try {
        const lumin = await ensureLuminLoaded()
        if (!active || !containerRef.current) return

        if (!containerRef.current.id) containerRef.current.id = MOUNT_ID
        containerRef.current.innerHTML = ''

        // Every method on the SDK is a Proxy that queues the call until its
        // worker boots. When the worker cannot boot, and on localhost it
        // reports "domain fetch failed", those promises never settle at all,
        // so an unguarded await here leaves a spinner forever with no error.
        // Verified: Lumin.getGames() also hangs indefinitely.
        await Promise.race([
          lumin.init({
            container: `#${containerRef.current.id}`,
            theme,
            gamesPerPage: 1000,
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('The library did not finish starting up.')),
              INIT_TIMEOUT,
            ),
          ),
        ])

        if (!active) return

        // init can resolve having rendered nothing at all. Treat an empty
        // container as a failure rather than showing a blank page.
        if (!containerRef.current.children.length) {
          throw new Error('The library started but returned no games.')
        }

        setReady(true)
      } catch (e) {
        if (active) setError(e.message || 'Could not load the game library right now.')
      }
    }

    init()
    return () => {
      active = false
    }
    // App keys this component on `theme`, so a theme change remounts it and
    // re-runs init with clean state rather than resetting it here.
  }, [theme])

  return (
    <section className="lumin">
      <h2>
        <span className="secicon" data-tone="9" aria-hidden="true" />
        Game library
        <span className="rule" />
        {ready && <span className="count">loaded</span>}
      </h2>

      {error ? (
        <div className="lumin-error">
          <strong>{error}</strong>
          <p>
            This library is loaded from a third party CDN, and it checks the domain it runs on. It
            does not work from localhost, so this is expected until the site is deployed. A school
            network can also block it outright.
          </p>
          {onUseLocal && (
            <button className="btn" onClick={onUseLocal}>
              Use the built in list instead
            </button>
          )}
        </div>
      ) : (
        !ready && (
          <div className="lumin-loading">
            <span className="spinner" />
            <span>Loading the library</span>
          </div>
        )
      )}

      <div className="lumin-mount" ref={containerRef} id={MOUNT_ID} />
    </section>
  )
}
