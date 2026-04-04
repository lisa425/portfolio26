import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { LangType } from './types'

gsap.registerPlugin(SplitText)
import './App.scss'
import { useHeroScene } from './hooks/useHeroScene'
import { useCursorTrail } from './hooks/useCursorTrail'
import Works from './components/Works'
import Info from './components/Info'

function App() {
  const { i18n } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLHeadingElement>(null)
  const buttonWorksRef = useRef<HTMLButtonElement>(null)
  const buttonInfoRef = useRef<HTMLButtonElement>(null)
  const heroTlRef = useRef<gsap.core.Timeline | null>(null)
  const heroSplitsRef = useRef<InstanceType<typeof SplitText>[]>([])
  const trailCanvasRef = useRef<HTMLCanvasElement>(null)
  const heroAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstHeroLoadRef = useRef(true)

  const [language, setLanguage] = useState(i18n.language)
  const [loadProgress, setLoadProgress] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [locationStr, setLocationStr] = useState("37° 33' N ■ 126° 58' E")
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [view, setView] = useState<'hero' | 'transitioning' | 'works' | 'info'>('hero')
  const isHeroActiveRef = useRef(true)

  const changeLanguage = (lang: LangType) => {
    i18n.changeLanguage(lang)
    setLanguage(lang)
  }

  useEffect(() => {
    document.body.classList.remove('ko', 'en')
    document.body.classList.add(language)
  }, [language])

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

  // Timezone info (static — computed once)
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone
  const tzShort = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').at(-1) ?? tzName
  const utcOffsetMin = -new Date().getTimezoneOffset()
  const utcOffsetH = utcOffsetMin / 60
  const utcLabel = `UTC${utcOffsetH >= 0 ? '+' : ''}${String(utcOffsetH).padStart(2, '0')}:00`

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
  const { triggerWorksTransition, triggerInfoTransition, triggerHeroTransition } = useHeroScene(
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

  const runHeroAnimation = useCallback(() => {
    heroTlRef.current?.kill()
    heroSplitsRef.current.forEach((s) => s.revert())
    heroSplitsRef.current = []
    isFirstHeroLoadRef.current = false

    const CHAR_DELAY = 0.05
    const HOLD = 0.04

    const splitLocation = new SplitText('.hero-hud-data__location .title, .hero-hud-data__location .desc', {
      type: 'chars',
    })
    heroSplitsRef.current = [splitLocation]

    gsap.set(splitLocation.chars, { opacity: 0, display: 'inline-block' })

    const tl = gsap.timeline()
    heroTlRef.current = tl

    tl.fromTo(
      '.technical-list .list-item .num',
      { opacity: 0, x: -50 },
      { opacity: 1, x: 0, duration: 1, ease: 'circ.out' },
      '1',
    ).fromTo(
      '.technical-list .list-item .list-item__info',
      { opacity: 0, x: -50 },
      { opacity: 1, x: 0, duration: 1, ease: 'circ.out' },
      '<0.1',
    )

    splitLocation.chars.forEach((char, i) => {
      const t = i * CHAR_DELAY
      tl.set(char, { opacity: 1, backgroundColor: '#ffffff', color: '#000000' }, t)
      tl.to(char, { backgroundColor: 'transparent', color: '#ffffff', duration: HOLD }, t + HOLD)
    })

    tl.call(
      () => {
        gsap.set(splitLocation.chars, { clearProps: 'backgroundColor,color' })
      },
      [],
      splitLocation.chars.length * CHAR_DELAY + HOLD,
    )
  }, [])

  const handleGoWorks = useCallback(() => {
    if (view !== 'hero') return
    setView('transitioning')
    triggerWorksTransition(() => setView('works'))
  }, [view, triggerWorksTransition])

  const handleGoInfo = useCallback(() => {
    if (view !== 'hero') return
    setView('transitioning')
    triggerInfoTransition(() => setView('info'))
  }, [view, triggerInfoTransition])

  const handleGoHero = useCallback(() => {
    if (view === 'hero' || view === 'transitioning') return
    setView('transitioning')

    // 줌아웃 종료 1초 전에 hero 섹션을 미리 페이드인 (zoom duration = 1.5s)
    if (heroAnimTimerRef.current) clearTimeout(heroAnimTimerRef.current)
    heroAnimTimerRef.current = setTimeout(() => {
      gsap.to('.hero', { opacity: 1, duration: 0.5, ease: 'power2.out' })
    }, 500)

    triggerHeroTransition(() => {
      setView('hero')
      gsap.set('.hero', { clearProps: 'opacity' })
    })
  }, [view, triggerHeroTransition])

  // 첫 진입 시에만 hero 애니메이션 실행
  useEffect(() => {
    if (!isLoaded || view !== 'hero') return
    if (!isFirstHeroLoadRef.current) return // 줌아웃 복귀 시 스킵
    runHeroAnimation()
  }, [isLoaded, view, runHeroAnimation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      heroTlRef.current?.kill()
      heroSplitsRef.current.forEach((s) => s.revert())
      if (heroAnimTimerRef.current) clearTimeout(heroAnimTimerRef.current)
    }
  }, [])

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
        gsap.set(split.chars, { opacity: 0, backgroundColor: 'transparent', color: '#ffffff' })
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

  // GSAP Animation
  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(textRef.current, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.5, ease: 'power3.out' })
    }
  }, [language])

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

      {/* Loading Overlay */}
      <div className={`loading-overlay${isLoaded ? ' loaded' : ''}`}>
        <div className="loading-inner">
          <span className="loading-text">{Math.round(loadProgress)}%</span>
          <div className="loading-bar">
            <div
              className="loading-bar-fill"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="content">
        <header className="header">
          <div
            className="header-left"
            onClick={handleGoHero}
          >
            <div className="title">ChaewonIm</div>
            <div className="title-sub">Archive v1.0.0</div>
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
          <div className="hero-hud-data hero-hud-data__location">
            <div className="title">◼ Location</div>
            <div className="desc">Seoul,South Korea</div>
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
                    {tzShort} — {utcLabel}
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

          <div className="keyword-container technical-list">
            <div className="list-items">
              <div className="list-item">
                <span className="num">[01] —</span>
                <div className="list-item__info">
                  <p className="hud-sub">Interactive Web</p>
                  <span className="val">3D GRAPHICS · EXPERIENCES</span>
                </div>
              </div>
              <div className="list-item">
                <span className="num">[02] —</span>
                <div className="list-item__info">
                  <p className="hud-sub">Frontend Dev</p>
                  <span className="val">ARCHITECTURE · LOGIC</span>
                </div>
              </div>
              <div className="list-item">
                <span className="num">[03] —</span>
                <div className="list-item__info">
                  <p className="hud-sub">AI Support</p>
                  <span className="val">STRATEGY · COLLABORATION</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-hint">
            <span className="hero-hint__mouse">
              <span className="hero-hint__wheel" />
            </span>
            <span className="hero-hint__label">touch stars</span>
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

        <section className={`page-sub works${view === 'works' ? ' visible' : ''}`}>
          <Works isActive={view === 'works'} />
        </section>

        <section className={`page-sub info${view === 'info' ? ' visible' : ''}`}>
          <Info isActive={view === 'info'} />
        </section>
      </div>
    </div>
  )
}

export default App
