import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { LangType } from './types'

gsap.registerPlugin(SplitText)
import './App.scss'
import { useHeroScene } from './hooks/useHeroScene'
import { useCursorTrail } from './hooks/useCursorTrail'
import IntroLog from './components/IntroLog'

// Code-split: Works & Info are lazy-loaded on first visit
const Works = lazy(() => import('./components/Works'))
const Info = lazy(() => import('./components/Info'))

// ---------------------------------------------------------------------------
// Static timezone info — computed once at module load, never on re-render
// (setCurrentTime fires every second; keeping these here prevents repeated
//  Intl / Date API calls on each React re-render)
// ---------------------------------------------------------------------------
const _tzName = Intl.DateTimeFormat().resolvedOptions().timeZone
const _tzShort = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').at(-1) ?? _tzName
const _utcOffsetH = -new Date().getTimezoneOffset() / 60
const _utcLabel = `UTC${_utcOffsetH >= 0 ? '+' : ''}${String(_utcOffsetH).padStart(2, '0')}:00`

const VIEWPORT_GUARD_MAX_PX = 1000

function App() {
  const { i18n, t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const buttonWorksRef = useRef<HTMLButtonElement>(null)
  const buttonInfoRef = useRef<HTMLButtonElement>(null)
  const trailCanvasRef = useRef<HTMLCanvasElement>(null)
  const heroAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heroHintTweenRef = useRef<gsap.core.Tween | null>(null)

  const [language, setLanguage] = useState(i18n.language)
  const [loadProgress, setLoadProgress] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [locationStr, setLocationStr] = useState("37° 33' N ■ 126° 58' E")
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [view, setView] = useState<'hero' | 'transitioning' | 'works' | 'info'>('hero')
  const isHeroActiveRef = useRef(true)

  // Intro log: plays every page load; false after first run so hero-return skips it
  const [showIntro, setShowIntro] = useState(true)
  const heroContentRef = useRef<HTMLDivElement>(null)

  // Keep-alive: mount Works/Info on first visit, stay mounted to preserve state
  // Set at transition START (not on view change) to avoid Suspense flash
  const [hasShownWorks, setHasShownWorks] = useState(false)
  const [hasShownInfo, setHasShownInfo] = useState(false)

  const [isViewportGuardActive, setIsViewportGuardActive] = useState(false)

  const changeLanguage = (lang: LangType) => {
    i18n.changeLanguage(lang)
    setLanguage(lang)
  }

  useEffect(() => {
    document.body.classList.remove('ko', 'en')
    document.body.classList.add(language)
  }, [language])

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${VIEWPORT_GUARD_MAX_PX}px)`)
    const sync = () => setIsViewportGuardActive(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Loading progress handler
  const handleProgress = useCallback((progress: number) => {
    setLoadProgress(progress)
    if (progress >= 100) {
      // 폰트 로딩까지 대기 후, 100%가 화면에 렌더된 뒤 fade-out 시작
      document.fonts.ready.then(() => {
        setTimeout(() => setIsLoaded(true), 500)
      })
    }
  }, [])

  // Geolocation
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          const dLat = Math.floor(Math.abs(lat))
          const mLat = Math.floor((Math.abs(lat) - dLat) * 60)
          const dLng = Math.floor(Math.abs(lng))
          const mLng = Math.floor((Math.abs(lng) - dLng) * 60)

          const dirLat = lat >= 0 ? 'N' : 'S'
          const dirLng = lng >= 0 ? 'E' : 'W'

          setLocationStr(`${dLat}° ${mLat}' ${dirLat} ■ ${dLng}° ${mLng}' ${dirLng}`)
        },
        (error) => {
          console.error('Geolocation error:', error)
          setLocationStr("37° 33' N ■ 126° 58' E")
        },
      )
    } else {
      setLocationStr("37° 33' N ■ 126° 58' E")
    }
  }, [])

  // Live Clock
  useEffect(() => {
    const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const tick = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: true,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      setCurrentDate(`${y}.${m}.${d}  ${DAY[now.getDay()]}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  // Three.js Scene
  const { triggerWorksTransition, triggerInfoTransition, triggerHeroTransition, triggerAssembly } = useHeroScene(
    canvasRef,
    containerRef,
    buttonWorksRef,
    buttonInfoRef,
    handleProgress,
    isHeroActiveRef,
  )

  useCursorTrail(trailCanvasRef)

  useEffect(() => {
    isHeroActiveRef.current = view === 'hero'
  }, [view])

  const handleGoWorks = useCallback(() => {
    if (view !== 'hero') return
    setHasShownWorks(true)
    setView('transitioning')
    gsap.set('.hero', { opacity: 0 }) // immediately hide hero before camera zooms
    triggerWorksTransition(() => setView('works'))
  }, [view, triggerWorksTransition])

  const handleGoInfo = useCallback(() => {
    if (view !== 'hero') return
    setHasShownInfo(true)
    setView('transitioning')
    gsap.set('.hero', { opacity: 0 }) // immediately hide hero before camera zooms
    triggerInfoTransition(() => setView('info'))
  }, [view, triggerInfoTransition])

  const handleGoHero = useCallback(() => {
    if (view === 'hero' || view === 'transitioning') return
    setView('transitioning')

    // Fade hero in 0.5s before zoom-out completes (zoom duration = 1.5s)
    if (heroAnimTimerRef.current) clearTimeout(heroAnimTimerRef.current)
    heroAnimTimerRef.current = setTimeout(() => {
      gsap.to('.hero', { opacity: 1, duration: 0.5, ease: 'power2.out' })
    }, 1000)

    triggerHeroTransition(() => {
      setView('hero')
      // No clearProps — GSAP keeps managing .hero opacity to avoid CSS conflicts
    })
  }, [view, triggerHeroTransition])

  // 첫 진입 시에만 hero 애니메이션 실행
  // useEffect(() => {
  //   if (!isLoaded || view !== "hero") return;
  //   if (!isFirstHeroLoadRef.current) return; // 줌아웃 복귀 시 스킵
  //   runHeroAnimation();
  // }, [isLoaded, view, runHeroAnimation]);

  // // Cleanup on unmount
  // useEffect(() => {
  //   return () => {
  //     heroTlRef.current?.kill();
  //     heroSplitsRef.current.forEach((s) => s.revert());
  //     if (heroAnimTimerRef.current) clearTimeout(heroAnimTimerRef.current);
  //   };
  // }, []);

  // Btn hover — terminal typewriter effect via GSAP
  useEffect(() => {
    if (!isLoaded) return

    const btnRefs = [buttonWorksRef.current, buttonInfoRef.current]
    const cleanups: (() => void)[] = []

    btnRefs.forEach((btn) => {
      if (!btn) return

      const textEl = btn.querySelector<HTMLElement>('.btn-text')
      const textContent = btn.querySelector<HTMLElement>('.btn-text__text')
      const cursorEl = btn.querySelector<HTMLElement>('.btn-text__cursor')
      if (!textEl || !textContent) return

      gsap.set(textEl, { opacity: 0, x: 10 })
      cursorEl?.classList.remove('active')

      const split = new SplitText(textContent, { type: 'chars' })
      gsap.set(split.chars, { opacity: 0, display: 'inline-block' })
      gsap.set(textContent, { clearProps: 'opacity' })

      const CHAR_DELAY = 0.07 // gap between each char
      const HOLD = 0.05 // how long the active highlight stays

      const tl = gsap.timeline({
        paused: true,
        // cursor CSS animation starts only after all chars are done
        onComplete: () => cursorEl?.classList.add('active'),
      })

      // Slide wrapper in
      tl.to(textEl, { opacity: 1, x: 0, duration: 0.15, ease: 'power2.out' })

      // Per-char: active highlight (white bg + black text) → settled (transparent + white)
      split.chars.forEach((char, i) => {
        const t = 0.15 + i * CHAR_DELAY
        tl.set(char, { opacity: 1, backgroundColor: '#ffffff', color: '#000000' }, t)
        tl.to(char, { backgroundColor: 'transparent', color: '#ffffff', duration: HOLD }, t + HOLD)
      })

      const reset = () => {
        tl.pause(0)
        gsap.set(textEl, { opacity: 0, x: 10 })
        gsap.set(split.chars, {
          opacity: 0,
          backgroundColor: 'transparent',
          color: '#ffffff',
        })
        cursorEl?.classList.remove('active')
      }

      const onEnter = () => {
        cursorEl?.classList.remove('active')
        tl.restart()
      }
      const onLeave = () => reset()

      btn.addEventListener('mouseenter', onEnter)
      btn.addEventListener('mouseleave', onLeave)

      cleanups.push(() => {
        btn.removeEventListener('mouseenter', onEnter)
        btn.removeEventListener('mouseleave', onLeave)
        tl.kill()
        split.revert()
      })
    })

    return () => cleanups.forEach((fn) => fn())
  }, [isLoaded])

  const heroIntroMotion = () => {
    const split1 = new SplitText('.desc-text-1', { type: 'chars' })
    const split2 = new SplitText('.desc-text-2', { type: 'chars' })
    const split3 = new SplitText('.desc-text-3', { type: 'chars' })

    return (
      gsap
        .timeline()
        // 0. particles converge from scatter → star shape
        .call(() => triggerAssembly())
        // 1. fade in hero content
        .fromTo(heroContentRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'linear' })
        // 2. canvas brightness reveal
        .to('.webgl-canvas', { filter: 'brightness(1)', duration: 2, ease: 'circ.out' }, '<')
        // 3. title words: mask slide-up
        .from('.title-word', { y: '110%', duration: 1.2, stagger: 0.1, ease: 'circ.out' }, '<+0.15')
        // 4. desc-wrap slide + fade
        .from('.desc-wrap', { x: -10, stagger: 0.1, duration: 0.8, ease: 'circ.out' }, '<+0.1')
        .from('.desc-wrap', { opacity: 0, stagger: 0.1, duration: 0.2, ease: 'power1.out' }, '<')
        // 5. desc chars typewriter
        .from(split1.chars, { opacity: 0, duration: 0.01, stagger: 0.025, ease: 'none' }, '<')
        .from(split2.chars, { opacity: 0, duration: 0.01, stagger: 0.025, ease: 'none' }, '<0.1')
        .from(split3.chars, { opacity: 0, duration: 0.01, stagger: 0.025, ease: 'none' }, '<0.1')
        .from('.hero-hud-data__monitor', { opacity: 0, x: 50, duration: 0.8, ease: 'circ.out' }, '<')
        .from('.hero-hint', { opacity: 0, y: 50, duration: 0.8, ease: 'circ.out' }, '<')
        // 6. Cleanup: revert splits right after desc chars finish
        //    Removes char <div>s from DOM and releases GSAP tracking on 100+ elements
        .call(() => {
          split1.revert()
          split2.revert()
          split3.revert()
        })
        // 7. After timeline completes, start hint float as an INDEPENDENT tween
        //    (keeps it out of this timeline so the tl can finish and GSAP frees all tracked tweens)
        .call(() => {
          heroHintTweenRef.current?.kill()
          heroHintTweenRef.current = gsap.to('.hero-hint', {
            y: 7,
            duration: 1,
            repeat: -1,
            yoyo: true,
            ease: 'linear',
          })
        })
    )
  }
  return (
    <div
      className="app-container"
      ref={containerRef}
    >
      <canvas
        className="webgl-canvas"
        ref={canvasRef}
      />
      <canvas
        className="trail-canvas"
        ref={trailCanvasRef}
      />

      {/* ── IntroLog: mounts immediately, acts as loading screen + intro ── */}
      {showIntro && (
        <IntroLog
          loadProgress={loadProgress}
          isLoaded={isLoaded}
          onComplete={() => {
            setShowIntro(false)
            // Prefetch Works & Info chunks in the background after intro
            // so they're ready before the user clicks a nav button
            import('./components/Works')
            import('./components/Info')
            heroIntroMotion()
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
            onClick={handleGoHero}
          >
            <div className="title">ChaewonIm</div>
            <div className="title-sub">Archive v1.0</div>
          </div>

          <div className="header-right">
            <span className="menu-lang-label">&gt; LAN</span>
            <div className="menu-lang">
              <button
                className={language === 'ko' ? 'btn-lang on' : 'btn-lang'}
                onClick={() => changeLanguage('ko')}
              >
                KO
              </button>
              <span className="divider"></span>
              <button
                className={language === 'en' ? 'btn-lang on' : 'btn-lang'}
                onClick={() => changeLanguage('en')}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        <section className={`hero${view !== 'hero' ? ' hidden' : ''}`}>
          <div className="hero-main-text">
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
              </p>
            </div>
          </div>

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
          </div>

          <div className="hero-hint">
            <span className="hero-hint__mouse">
              <span className="hero-hint__wheel" />
            </span>
            <span className="hero-hint__label">
              Touch STARS
              <br />
              TO EXPLORE
            </span>
          </div>

          <div className="hero-actions">
            <button
              ref={buttonWorksRef}
              className="btn-hud btn-hud--works"
              onClick={handleGoWorks}
            >
              <span className="btn-text">
                &gt; <span className="btn-text__text">works</span>
                <span className="btn-text__cursor"></span>
              </span>
            </button>
            <button
              ref={buttonInfoRef}
              className="btn-hud btn-hud--info"
              onClick={handleGoInfo}
            >
              <span className="btn-text">
                &gt; <span className="btn-text__text">info</span>
                <span className="btn-text__cursor"></span>
              </span>
            </button>
          </div>
        </section>

        {/* Works — lazy-loaded on first visit, kept mounted after */}
        {hasShownWorks && (
          <Suspense fallback={null}>
            <section className={`page-sub works${view === 'works' ? ' visible' : ''}`}>
              <Works isActive={view === 'works'} />
            </section>
          </Suspense>
        )}

        {/* Info — lazy-loaded on first visit, kept mounted after */}
        {hasShownInfo && (
          <Suspense fallback={null}>
            <section className={`page-sub info${view === 'info' ? ' visible' : ''}`}>
              <Info isActive={view === 'info'} />
            </section>
          </Suspense>
        )}
      </div>

      {isViewportGuardActive && (
        <div
          className="viewport-guard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="viewport-guard-title"
        >
          <div className="viewport-guard__panel">
            <p
              id="viewport-guard-title"
              className="viewport-guard__title"
            >
              {t('viewportGuard.title')}
            </p>
            <p className="viewport-guard__body text-body">{t('viewportGuard.body')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
