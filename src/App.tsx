import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import type { LangType } from './types'

gsap.registerPlugin(SplitText)
import './App.scss'
import { useHeroScene } from './hooks/useHeroScene'
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
        now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

  useEffect(() => {
    isHeroActiveRef.current = view === 'hero'
  }, [view])

  const runHeroAnimation = useCallback(() => {
    // Kill previous and revert all splits for clean re-run
    heroTlRef.current?.kill()
    heroSplitsRef.current.forEach((s) => s.revert())
    heroSplitsRef.current = []

    // Split only static (non-React-state) elements
    const splitTitle = new SplitText('.title', { type: 'chars' })
    const splitHudTitle = new SplitText('.hud-title', { type: 'chars' })
    const splitHudDesc = new SplitText('.hud-desc', { type: 'chars' })
    const splitPanelStatic = new SplitText(
      '.hero-panel__label, .hero-panel__id, .hero-panel__key, .hero-panel__status',
      { type: 'chars' },
    )
    const splitNums = new SplitText('.num', { type: 'chars' })
    const splitHudSub = new SplitText('.hud-sub', { type: 'chars' })

    heroSplitsRef.current = [splitTitle, splitHudTitle, splitHudDesc, splitPanelStatic, splitNums, splitHudSub]

    const tl = gsap.timeline()
    heroTlRef.current = tl

    // .title chars — first to appear
    tl.fromTo(splitTitle.chars, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.1 }, 0)
    // hud title
    tl.fromTo(splitHudTitle.chars, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.02 }, 0.4)
    // hud description words
    tl.fromTo(splitHudDesc.chars, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.02 }, 0.6)
    // sys monitor panel slides in
    // panel static text chars
    // tl.fromTo(splitPanelStatic.chars, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.05 }, 0.68)
    // panel dynamic value rows fade in
    // tl.fromTo('.hero-panel__val', { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: 0.1 }, 0.85)
    // technical list numbers
    // tl.fromTo(splitNums.chars, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.04 }, 0.95)
    // subtitles
    // tl.fromTo(splitHudSub.chars, { opacity: 0 }, { opacity: 1, duration: 0.001, stagger: 0.018 }, 1.05)
    // description vals fade
    // tl.fromTo('.val', { opacity: 0 }, { opacity: 1, duration: 0.02, stagger: 0.1 }, 1.15)
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
    triggerHeroTransition(() => setView('hero'))
  }, [view, triggerHeroTransition])

  // Hero text entry animation — triggers on initial load and each time user returns to hero
  useEffect(() => {
    if (!isLoaded || view !== 'hero') return
    runHeroAnimation()
  }, [isLoaded, view, runHeroAnimation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      heroTlRef.current?.kill()
      heroSplitsRef.current.forEach((s) => s.revert())
    }
  }, [])

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
          <div className="header-left">
            <div
              className="title"
              onClick={handleGoHero}
            >
              ChaewonIm
            </div>
          </div>

          <div className="header-right">
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
          <div className="hero-hud-data left-data">
            <p className="hud-title">PORTFOLIO.VISUALIZATION —</p>
            <p className="hud-desc text-body">
              VISUAL OBJECT LOCALIZED CAN BE DESCRIBED BY
              <br />
              MANY PHYSICAL AND TECHNICAL PROPERTIES WITH
              <br />
              INTERACTIVE INTERFACES.
            </p>
          </div>

          <div className="hero-hud-data right-data">
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
                  <span className="hero-panel__key">LOC</span>
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
            <div className="timeline-line"></div>
            <div className="list-items">
              <div className="list-item">
                <span className="num">001</span>
                <p className="hud-sub">Interactive Web —</p>
                <span className="val text-body">3D GRAPHICS & EXPERIENCES</span>
              </div>
              <div className="list-item">
                <span className="num">002</span>
                <p className="hud-sub">Frontend Dev —</p>
                <span className="val text-body">ARCHITECTURE & LOGIC</span>
              </div>
              <div className="list-item">
                <span className="num">003</span>
                <p className="hud-sub">UX/UI Design —</p>
                <span className="val text-body">STRATEGY & COLLABORATION</span>
              </div>
            </div>
          </div>

          <div className="hero-actions">
            <button
              ref={buttonWorksRef}
              className="btn-hud btn-hud--works"
              onClick={handleGoWorks}
            >
              <span className="btn-text">+ view works +</span>
            </button>
            <button
              ref={buttonInfoRef}
              className="btn-hud btn-hud--info"
              onClick={handleGoInfo}
            >
              <span className="btn-text">+ view info +</span>
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
