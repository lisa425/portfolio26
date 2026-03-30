import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { createPortal } from 'react-dom'
import BtnBack from './BtnBack'

interface WorksProps {
  onBack: () => void
  isActive: boolean
}

type WorkType = {
  id: number
  game: string
  title: string
  date: string
  description: string
  stack: string
  img: string
  url: string
}

// Spread vertically across 250vh tall map
const CONSTELLATION_POSITIONS = [
  { x: 30, y: 9.7 },
  { x: 68, y: 26.7 },
  { x: 22, y: 45.7 },
  { x: 72, y: 63.7 },
  { x: 35, y: 81.7 },
]

const CONSTELLATION_LINES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [1, 3],
  [2, 3],
  [3, 4],
]

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  rotation: number
  rotSpeed: number
}

function createParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2
  const speed = 0.4 + Math.random() * 1.5
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0,
    maxLife: 30 + Math.random() * 40,
    size: 1 + Math.random() * 3,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.1,
  }
}

function Works({ onBack, isActive }: WorksProps) {
  const { t } = useTranslation()
  const works = t('works.items', { returnObjects: true }) as WorkType[]

  const [activeWork, setActiveWork] = useState<WorkType | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef<number>(0)
  const frameRef = useRef(0)

  // Canvas particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = map.scrollWidth
      const h = map.scrollHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      const w = map.scrollWidth
      const h = map.scrollHeight
      ctx.clearRect(0, 0, w, h)

      if (hoverPosRef.current) {
        frameRef.current++
        if (frameRef.current % 2 === 0) {
          particlesRef.current.push(createParticle(hoverPosRef.current.x, hoverPosRef.current.y))
        }
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.98
        p.vy *= 0.98
        p.rotation += p.rotSpeed
        p.life++

        if (p.life >= p.maxLife) return false

        const alpha = (1 - p.life / p.maxLife) * 0.7
        const half = p.size

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.shadowBlur = 12
        ctx.shadowColor = `rgba(0, 255, 106, ${alpha})`
        ctx.fillStyle = `rgba(0, 255, 106, ${alpha})`
        ctx.fillRect(-half, -half, half * 2, half * 2)
        ctx.restore()
        return true
      })

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleNodeHover = useCallback((idx: number | null) => {
    setHoveredIndex(idx)
    if (idx !== null && mapRef.current) {
      const w = mapRef.current.scrollWidth
      const h = mapRef.current.scrollHeight
      hoverPosRef.current = {
        x: (CONSTELLATION_POSITIONS[idx].x / 100) * w,
        y: (CONSTELLATION_POSITIONS[idx].y / 100) * h,
      }
    } else {
      hoverPosRef.current = null
    }
  }, [])

  // Entry / exit animation
  useEffect(() => {
    if (isActive) {
      gsap.fromTo(
        '.constellation-line',
        { strokeDashoffset: 2000 },
        {
          strokeDashoffset: 0,
          duration: 1.8,
          stagger: 0.12,
          ease: 'power2.inOut',
          delay: 0.3,
        },
      )
      gsap.fromTo(
        '.constellation-node',
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: 'back.out(2)',
          delay: 0.6,
        },
      )
      gsap.fromTo('.works-progress', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.8, delay: 1.0 })
      gsap.fromTo('.constellation-grid-label', { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.2 })
    } else {
      gsap.set('.constellation-node', { scale: 0, opacity: 0 })
      gsap.set('.constellation-line', { strokeDashoffset: 2000 })
      gsap.set('.works-progress', { opacity: 0 })
      gsap.set('.constellation-grid-label', { opacity: 0 })
      particlesRef.current = []
    }
  }, [isActive])

  const handleWorkClick = (work: WorkType) => {
    setActiveWork(work)
    setIsOpen(true)
  }

  const closeDetail = () => {
    setIsOpen(false)
  }

  return (
    <div className="inner works__inner">
      <BtnBack onClick={onBack} />

      {/* Terminal Progress Bar — sticky at top */}
      <div className="works-progress">
        <span className="works-progress__label">&gt; MISSION LOG ───</span>
        <span className="works-progress__bar">
          [{works.map((_, i) => (hoveredIndex !== null && i <= hoveredIndex ? '█' : '░')).join('')}]
        </span>
        <span className="works-progress__info text-body">
          {hoveredIndex !== null
            ? `${String(hoveredIndex + 1).padStart(2, '0')}/${String(works.length).padStart(2, '0')} ─── ${works[hoveredIndex].game}`
            : `──/${String(works.length).padStart(2, '0')} ─── SELECT TARGET`}
        </span>
      </div>

      {/* Constellation Map — tall scrollable area */}
      <div
        className="constellation-map"
        ref={mapRef}
      >
        {/* Canvas for hover particles */}
        <canvas
          ref={canvasRef}
          className="constellation-canvas"
        />

        {/* Grid coordinate labels */}
        <span className="constellation-grid-label top-left">[X: 0.00 Y: 0.00]</span>
        <span className="constellation-grid-label top-right">[X: 1.00 Y: 0.00]</span>
        <span className="constellation-grid-label bottom-left">[X: 0.00 Y: 1.00]</span>
        <span className="constellation-grid-label bottom-right">[X: 1.00 Y: 1.00]</span>

        {/* SVG constellation lines */}
        <svg
          className="constellation-svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {CONSTELLATION_LINES.map(([from, to], i) => (
            <line
              key={i}
              className={`constellation-line ${hoveredIndex === from || hoveredIndex === to ? 'active' : ''}`}
              x1={CONSTELLATION_POSITIONS[from].x}
              y1={CONSTELLATION_POSITIONS[from].y}
              x2={CONSTELLATION_POSITIONS[to].x}
              y2={CONSTELLATION_POSITIONS[to].y}
              strokeDasharray="2000"
            />
          ))}
        </svg>

        {/* Constellation nodes */}
        {works.map((work, idx) => (
          <div
            key={work.id}
            className={`constellation-node ${hoveredIndex === idx ? 'hovered' : ''}`}
            style={{
              left: `${CONSTELLATION_POSITIONS[idx]?.x ?? 50}%`,
              top: `${CONSTELLATION_POSITIONS[idx]?.y ?? 50}%`,
            }}
            onMouseEnter={() => handleNodeHover(idx)}
            onMouseLeave={() => handleNodeHover(null)}
            onClick={() => handleWorkClick(work)}
          >
            <div className="constellation-node__point" />
            <div className="constellation-node__info">
              <span className="constellation-node__index">{String(idx + 1).padStart(2, '0')}</span>
              <span className="constellation-node__game">{work.game}</span>
              <span className="constellation-node__title text-body">{work.title}</span>
              <span className="constellation-node__stack text-body">{work.stack}</span>
              {/* Thumbnail preview on hover */}
              <div className="constellation-node__thumb">
                <img
                  src={work.img}
                  alt={work.title}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {createPortal(
        <div className={`works__detail ${isOpen ? 'active' : ''}`}>
          <button
            className="btn-close-detail"
            onClick={closeDetail}
          >
            ✕
          </button>
          {activeWork && (
            <div
              className="work-detail__content"
              key={activeWork.id}
            >
              <div className="work-detail__title">{activeWork.title}</div>
              <div className="work-detail__date text-body">{activeWork.date}</div>
              <div className="work-detail__description text-body">{activeWork.description}</div>
              <div className="work-detail__stack">{activeWork.stack}</div>
              {activeWork.url && (
                <a
                  className="work-detail__link"
                  href={activeWork.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit Site →
                </a>
              )}
              <div className="work-detail__images">
                {activeWork.img && (
                  <img
                    src={activeWork.img}
                    alt="thumbnail"
                  />
                )}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default Works
