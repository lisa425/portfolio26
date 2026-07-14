import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { savePreferredLang } from './utils/routing'

import './App.scss'
import { useHeroScene } from './hooks/useHeroScene'
import { useViewRouter } from './hooks/useViewRouter'
import { useCursorTrail } from './hooks/useCursorTrail'
import IntroLog from './components/IntroLog'
import Seo from './components/Seo'

// Code-split: Works & About are lazy-loaded on first visit
const Works = lazy(() => import('./components/Works'))
const About = lazy(() => import('./components/About'))

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const DEFAULT_TIME_ZONE = 'Asia/Seoul'

/** Max wait for `document.fonts.ready` before continuing intro (avoids hanging on slow/broken fonts). */
const FONTS_READY_MAX_WAIT_MS = 2500

function App() {
  const { i18n } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const heroStatementRef = useRef<HTMLDivElement>(null)
  const trailCanvasRef = useRef<HTMLCanvasElement>(null)

  const [loadProgress, setLoadProgress] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [headerClock, setHeaderClock] = useState('')
  const [displayTimeZone, setDisplayTimeZone] = useState(DEFAULT_TIME_ZONE)
  const isHeroActiveRef = useRef(true)

  // Intro log: plays every page load; false after first run so hero-return skips it
  const [showIntro, setShowIntro] = useState(true)
  const heroContentRef = useRef<HTMLDivElement>(null)

  // WebGL init reports 100 in the same tick as scene setup; the intro still waits on
  // `document.fonts.ready` + delay. Without tying the counter to that, (100/100) looked
  // "stuck" while fonts were still loading. Cap at 99 until fonts resolve (or timeout).

  const handleProgress = useCallback((progress: number) => {
    if (progress < 100) {
      setLoadProgress(progress)
      return
    }
    setLoadProgress(99)
    Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => {
        setTimeout(resolve, FONTS_READY_MAX_WAIT_MS)
      }),
    ]).then(() => {
      setLoadProgress(100)
      // Brief hold so 100/100 is readable before line cycling starts
      setTimeout(() => setIsLoaded(true), 500)
    })
  }, [])

  // Keep Seoul as the immediate fallback while location permission is pending or denied.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      () => setDisplayTimeZone(LOCAL_TIME_ZONE),
      () => setDisplayTimeZone(DEFAULT_TIME_ZONE),
      { timeout: 5000, maximumAge: 300000 },
    )
  }, [])

  // Live Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: displayTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
      }).formatToParts(now)
      const getPart = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? ''
      setHeaderClock(
        `${getPart('year')}-${getPart('month')}-${getPart('day')}(${getPart('weekday').toUpperCase()}) ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`,
      )
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [displayTimeZone])

  // Three.js Scene
  const { triggerWorksTransition, triggerAboutTransition, triggerHeroTransition, triggerAssembly, applyViewInstant } =
    useHeroScene(canvasRef, containerRef, heroStatementRef, handleProgress, isHeroActiveRef)

  useCursorTrail(trailCanvasRef)

  // URL-first routing: button clicks and browser back/forward all change the
  // URL, and the hook runs the same camera-transition pipeline for every source
  const { view, urlView, activeSection, lang, hasShownWorks, hasShownAbout, goWorks, goAbout, goHero, switchLang } =
    useViewRouter({
      triggerWorksTransition,
      triggerAboutTransition,
      triggerHeroTransition,
      applyViewInstant,
      isHeroActiveRef,
      isReady: !showIntro,
    })

  // URL lang → i18next / <html> lang / <body> class / persisted preference
  // (one-way sync; the reverse direction is switchLang, which navigates)
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang)
    savePreferredLang(lang)
    document.documentElement.lang = lang
    document.body.classList.remove('ko', 'en')
    document.body.classList.add(lang)
  }, [lang, i18n])

  const heroIntroMotion = () => {
    const tl = gsap
      .timeline()
      .call(() => triggerAssembly())
      .fromTo(heroContentRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'linear' })
      .to('.webgl-canvas', { filter: 'brightness(1)', duration: 1.8, ease: 'circ.out' }, '<')

    return tl
  }

  return (
    <div
      className="app-container"
      ref={containerRef}
    >
      <Seo />
      <canvas
        className="webgl-canvas"
        ref={canvasRef}
      />
      <canvas
        className="trail-canvas"
        ref={trailCanvasRef}
      />

      {/* ── IntroLog: mounts immediately, acts as loading screen + intro ── */}
      {/* Deep link (view !== hero): log acts as loading gate only — no line
          cycling, and the scene snaps to the zoomed-in state instead of
          playing the hero intro motion */}
      {showIntro && (
        <IntroLog
          loadProgress={loadProgress}
          isLoaded={isLoaded}
          instant={view !== 'hero'}
          onComplete={() => {
            setShowIntro(false)
            // Prefetch Works & About chunks in the background after intro
            // so they're ready before the user clicks a nav button
            import('./components/Works')
            import('./components/About')
            if (view === 'hero') {
              heroIntroMotion()
            } else {
              applyViewInstant(view === 'about' ? 'about' : 'works')
              gsap.set('.webgl-canvas', { filter: 'brightness(1)' })
              gsap.fromTo(heroContentRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'linear' })
            }
          }}
        />
      )}

      <div
        className="content"
        ref={heroContentRef}
        style={{
          opacity: showIntro ? 0 : 1,
          pointerEvents: showIntro ? 'none' : 'auto',
        }}
      >
        <header className="header">
          <div
            className="header-left"
            onClick={goHero}
          >
            <div className="title">ImChaewon</div>
            <div
              className={`header-sub-flip${view !== 'hero' ? ' is-sub' : ''}`}
              aria-label={view !== 'hero' ? 'go main' : 'frontend developer'}
            >
              <span className="header-sub-flip__front">frontend developer</span>
              <span className="header-sub-flip__back">← back</span>
            </div>
          </div>

          <div
            className="header-clock"
            aria-label={`Recording ${headerClock}`}
          >
            <span className="header-clock__status">
              REC<span className="header-clock__status__dot"></span>
            </span>
            <span className="header-clock__time">{headerClock}</span>
          </div>

          <div className="header-right">
            <div className="lang-container">
              <span className="menu-lang-label">LAN</span>
              <button
                className="menu-lang-flip"
                onClick={() => switchLang(lang === 'ko' ? 'en' : 'ko')}
                aria-label={`Switch language to ${lang === 'ko' ? 'English' : 'Korean'}`}
              >
                <span className="menu-lang-flip__front">{lang.toUpperCase()}</span>
                <span className="menu-lang-flip__back">{lang === 'ko' ? 'EN' : 'KO'}</span>
              </button>
              <span className="arr">▾</span>
            </div>

            <nav
              className="section-nav-fixed"
              aria-label="Section navigation"
            >
              <button
                className={`btn-nav${urlView === 'works' ? ' on' : ''}`}
                onClick={goWorks}
                aria-current={urlView === 'works' ? 'page' : undefined}
              >
                WORKS
              </button>
              <button
                className={`btn-nav${urlView === 'about' ? ' on' : ''}`}
                onClick={goAbout}
                aria-current={urlView === 'about' ? 'page' : undefined}
              >
                ABOUT
              </button>
            </nav>
          </div>
        </header>

        <section className={`hero${view === 'works' || view === 'about' ? ' hidden' : ''}`}>
          {/* <div className="hero-main-text">
            <div className="hero-main-text__title">
              <span className="title-mask">
                <span className="title-word">INTERACTIVE</span>
              </span>
              <br />
              <span className="title-mask">
                <span className="title-word">WEB_FRONTEND</span>
              </span>
              <br />
              <span className="title-mask">
                <span className="title-word">DEVELOPER</span>
              </span>
            </div>
            <div className="hero-sub-text">
              <p className="hero-sub-text__desc">
                <span className="desc-wrap">
                  <span className="desc-prompt">&gt;</span>
                  <span className="desc-text desc-text-1">designing interactive web experiences</span>
                </span>
                <span className="desc-wrap">
                  <span className="desc-prompt">&gt;</span>
                  <span className="desc-text desc-text-2">focusing on structure and motion</span>
                </span>
                <span className="desc-wrap">
                  <span className="desc-prompt">&gt;</span>
                  <span className="desc-text desc-text-3">optimizing workflows and systems</span>
                </span>
                {isMobile && (
                  <>
                    <span className="desc-separator">. . .</span>
                    <span className="desc-wrap desc-wrap-location">
                      <span className="desc-prompt">&gt;</span>
                      <span className="desc-text desc-location">based in South_korea/Australia</span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {!isMobile && (
            <div className="hero-hud-data hero-hud-data__location">
              <div className="title title-mask">
                <span className="title-word">Based_in</span>
              </div>
              <div className="desc title-mask">
                <span className="title-word">
                  South Korea | Australia | Worldwide
                  <span className="emoji">🌏</span>
                </span>
              </div>
            </div>
          )} */}
          {/*
          <div className="hero-hud-data hero-hud-data__monitor">
            <div className="hero-panel">
              <div className="hero-panel__header">
                <span className="hero-panel__label">◼ SYS.MONITOR</span>
                <span className="hero-panel__id">// 01</span>
              </div>
              <div className="hero-panel__body">
                <div className="hero-panel__row">
                  <span className="hero-panel__key">TIME</span>
                  <span className="hero-panel__val">{currentTime}</span>
                </div>
                <div className="hero-panel__row">
                  <span className="hero-panel__key">DATE</span>
                  <span className="hero-panel__val">{currentDate}</span>
                </div>
                <div className="hero-panel__row">
                  <span className="hero-panel__key">ZONE</span>
                  <span className="hero-panel__val">
                    {_tzShort} — {_utcLabel}
                  </span>
                </div>
                <div className="hero-panel__row">
                  <span className="hero-panel__key">GEO</span>
                  <span className="hero-panel__val">{locationStr}</span>
                </div>
              </div>
              <div className="hero-panel__footer">
                <span className="hero-panel__dot" />
                <span className="hero-panel__status">ONLINE</span>
              </div>
            </div>
          </div> */}

          <div className="hero-copy">
            <div className="hero-copy__center">
              <div
                ref={heroStatementRef}
                className="hero-statement"
              >
                <p className="hero-statement__base">
                  Frontend developer crafting both sides of the screen — interactions users see, and environments
                  developers feel. Having studied both design and engineering, I care about craft on screen and the
                  systems behind it.
                </p>
                <p
                  className="hero-statement__light"
                  aria-hidden="true"
                >
                  Frontend developer crafting both sides of the screen — interactions users see, and environments
                  developers feel. Having studied both design and engineering, I care about craft on screen and the
                  systems behind it.
                </p>
              </div>
              <button
                className="hero-primary-cta"
                type="button"
                onClick={goWorks}
              >
                VIEW SELECTED WORK
              </button>
            </div>

            <footer className="hero-footer">
              <p className="copy">© 2026 ChaeWon Im. All rights reserved.</p>
            </footer>
            {/* <div
              className="hero-spectrum-axis"
              aria-hidden="true"
            >
              <span>SURFACE</span>
              <span>BEHIND THE SCREEN</span>
              <span>SYSTEM</span>
            </div> */}
          </div>
        </section>

        {/* Works — lazy-loaded on first visit, kept mounted after */}
        {hasShownWorks && (
          <Suspense fallback={null}>
            <section className={`page-sub works${view === 'works' ? ' visible' : ''}`}>
              <Works isActive={activeSection === 'works'} />
            </section>
          </Suspense>
        )}

        {/* About — lazy-loaded on first visit, kept mounted after */}
        {hasShownAbout && (
          <Suspense fallback={null}>
            <section className={`page-sub about${view === 'about' ? ' visible' : ''}`}>
              <About isActive={activeSection === 'about'} />
            </section>
          </Suspense>
        )}
      </div>

      {/* Child routes render nothing visible; the catch-all redirect lives here */}
      <Outlet />
    </div>
  )
}

export default App
