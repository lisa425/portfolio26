import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import type { LangType } from './types'
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

  const [language, setLanguage] = useState(i18n.language)
  const [loadProgress, setLoadProgress] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const [locationStr, setLocationStr] = useState('Chaewon Im')
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

          const formatCoord = (coord: number) => {
            const [int, dec] = Math.abs(coord).toFixed(6).split('.')
            const formattedInt = String(int).padStart(2, '0')
            return `${formattedInt}.${dec.slice(0, 3)}.${dec.slice(3)}`
          }

          const dirLat = lat >= 0 ? 'N' : 'S'
          const dirLng = lng >= 0 ? 'E' : 'W'

          setLocationStr(`[${formatCoord(lat)}${dirLat} ${formatCoord(lng)}${dirLng}]`)
        },
        (error) => {
          console.error('Geolocation error:', error)
          setLocationStr('[ 37.566.535N 126.977.969E ]')
        },
      )
    } else {
      setLocationStr('[ 37.566.535N 126.977.969E ]')
    }
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
        <div
          className="hud-corners"
          style={{ display: 'none' }}
        ></div>
        <header className="header">
          {/* <div className="title">Singularity:The Center of Creation</div> */}
          <div
            className="title"
            onClick={handleGoHero}
          >
            ChaewonIm
          </div>
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
        </header>

        <section className={`hero${view !== 'hero' ? ' hidden' : ''}`}>
          <div className="keyword-container">
            {/* <p className="keyword kw-1">Interactive Web Experiences</p>
            <p className="keyword kw-2">Frontend Engineering</p>
            <p className="keyword kw-3">UX/UI Collaboration</p> */}
            <div className="location-str">{locationStr}</div>
          </div>
          <button
            ref={buttonWorksRef}
            className="btn-star btn-go-works"
            onClick={handleGoWorks}
          >
            <span className="text">View Works</span>
          </button>
          <button
            ref={buttonInfoRef}
            className="btn-star btn-go-info"
            onClick={handleGoInfo}
          >
            <span className="text">View Info</span>
          </button>
        </section>

        <section className={`page-sub works${view === 'works' ? ' visible' : ''}`}>
          <Works
            isActive={view === 'works'}
            onBack={handleGoHero}
          />
        </section>

        <section className={`page-sub info${view === 'info' ? ' visible' : ''}`}>
          <Info
            isActive={view === 'info'}
            onBack={handleGoHero}
          />
        </section>
      </div>
    </div>
  )
}

export default App
