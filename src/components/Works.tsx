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

// ─── 3D Configuration ───
const DEG = Math.PI / 180
const INITIAL_ROT = { x: -70, y: 30 }
const AUTO_ROTATE_SPEED = 0.06
const DRAG_SENSITIVITY = 0.35
const MOMENTUM_DECAY = 0.94

// Orbital rings with unique 3D rotations — Middle-ground chaotic tilts, sized to keep nodes visible
const ORBITAL_RINGS = [
  // ── Node Rings (kept within bounds) ──
  { w: 300, h: 300, rx: 75, ry: 15, rz: -10, op: 0.15, angle: -45 }, // 0: Top Right
  { w: 550, h: 550, rx: 60, ry: -20, rz: 15, op: 0.12, angle: 160 }, // 1: Far Left
  { w: 800, h: 800, rx: 68, ry: 25, rz: -5, op: 0.1, angle: 80 }, // 2: Bottom Center
  { w: 1050, h: 1050, rx: 55, ry: -10, rz: 30, op: 0.08, angle: -140 }, // 3: Top Left
  { w: 1300, h: 1300, rx: 70, ry: 18, rz: -20, op: 0.06, angle: 10 }, // 4: Far Right

  // ── Decorative Outer Rings (expansive, allowed off-screen) ──
  { w: 1650, h: 1650, rx: 62, ry: -25, rz: 18, op: 0.05, angle: 0 },
  { w: 2000, h: 2000, rx: 74, ry: 10, rz: -35, op: 0.04, angle: 0 },
  { w: 2400, h: 2400, rx: 58, ry: -5, rz: 25, op: 0.03, angle: 0 },
]

function getPointOnRing(ringIndex: number, angleDeg: number) {
  const ring = ORBITAL_RINGS[ringIndex]
  if (!ring) return { x: 0, y: 0, z: 0 }
  const rad = angleDeg * DEG
  const lx = (ring.w / 2) * Math.cos(rad)
  const ly = (ring.h / 2) * Math.sin(rad)
  // CSS transform order: rotateX(rx) rotateY(ry) rotateZ(rz) is M = Rx * Ry * Rz
  const rz = ring.rz * DEG
  const x1 = lx * Math.cos(rz) - ly * Math.sin(rz)
  const y1 = lx * Math.sin(rz) + ly * Math.cos(rz)

  const ry = ring.ry * DEG
  const x2 = x1 * Math.cos(ry)
  const y2 = y1
  const z2 = -x1 * Math.sin(ry)

  const rx = ring.rx * DEG
  const x3 = x2
  const y3 = y2 * Math.cos(rx) - z2 * Math.sin(rx)
  const z3 = y2 * Math.sin(rx) + z2 * Math.cos(rx)

  return { x: x3, y: y3, z: z3 }
}

// Node positions explicitly mapped strictly to the inner 5 rings to ensure they are always visible
const NODE_3D = ORBITAL_RINGS.slice(0, 5).map((ring, i) => getPointOnRing(i, ring.angle))

// ─── Component ───
function Works({ onBack, isActive }: WorksProps) {
  const { t } = useTranslation()
  const works = t('works.items', { returnObjects: true }) as WorkType[]

  const [activeWork, setActiveWork] = useState<WorkType | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const hoveredIndexRef = useRef<number | null>(null) // sync for animation loop
  const [isOpen, setIsOpen] = useState(false)

  // DOM refs
  const sceneRef = useRef<HTMLDivElement>(null)
  const scene3dRef = useRef<HTMLDivElement>(null)
  const ringEls = useRef<(HTMLDivElement | null)[]>([])
  const ringHighlightEls = useRef<(HTMLDivElement | null)[]>([])
  const telemetryRef = useRef<HTMLDivElement>(null)

  // Animation state (refs for perf — no re-renders during drag)
  const rotRef = useRef({ ...INITIAL_ROT })
  const isDragRef = useRef(false)
  const dragStartRef = useRef({ mx: 0, my: 0, rx: 0, ry: 0 })
  const velRef = useRef({ x: 0, y: 0 })
  const prevMouseRef = useRef({ x: 0, y: 0 })
  const isActiveRef = useRef(false)
  const entryDoneRef = useRef(false)
  const entryTlRef = useRef<gsap.core.Timeline | null>(null)

  // Line animation states
  const ringHighlightSweeps = useRef<number[]>([0, 0, 0, 0, 0])
  const rafRef = useRef(0)
  const telemetryIntervalRef = useRef(0)

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // ─── Main animation loop ───
  useEffect(() => {
    let running = true

    const loop = () => {
      if (!running) return

      if (isActiveRef.current && entryDoneRef.current) {
        // Momentum / auto-rotate
        if (!isDragRef.current) {
          if (Math.abs(velRef.current.x) > 0.001 || Math.abs(velRef.current.y) > 0.001) {
            const nextRx = rotRef.current.x + velRef.current.x
            rotRef.current.x = Math.max(-90, Math.min(-50, nextRx))
            rotRef.current.y += velRef.current.y
            velRef.current.x *= MOMENTUM_DECAY
            velRef.current.y *= MOMENTUM_DECAY
          } else if (hoveredIndexRef.current === null) {
            rotRef.current.y += AUTO_ROTATE_SPEED
          }
        }

        // Update 3D container transform and CSS vars for billboard
        if (scene3dRef.current) {
          scene3dRef.current.style.transform = `rotateX(${rotRef.current.x}deg) rotateY(${rotRef.current.y}deg)`
          scene3dRef.current.style.setProperty('--rx', `${rotRef.current.x}deg`)
          scene3dRef.current.style.setProperty('--ry', `${rotRef.current.y}deg`)
        }

        // Update Ring Highlights (lerp sweep)
        ringHighlightSweeps.current.forEach((val, i) => {
          const target = hoveredIndexRef.current === i ? 360 : 0
          ringHighlightSweeps.current[i] += (target - val) * 0.15
          if (ringHighlightEls.current[i]) {
            ringHighlightEls.current[i]!.style.setProperty('--draw-sweep', `${ringHighlightSweeps.current[i]}deg`)
          }
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ─── Telemetry update (500ms interval) ───
  useEffect(() => {
    const update = () => {
      if (!telemetryRef.current) return
      const rx = rotRef.current.x
      const ry = ((rotRef.current.y % 360) + 360) % 360
      const rz = (velRef.current.x + velRef.current.y) * 8
      const vel = Math.sqrt(velRef.current.x ** 2 + velRef.current.y ** 2)
      telemetryRef.current.innerHTML =
        `<span class="telemetry__title">&gt; ORBITAL TELEMETRY</span>` +
        `<span class="telemetry__row"><span class="telemetry__label">RX</span> <span class="telemetry__val">${rx.toFixed(2).padStart(8)}\u00B0</span></span>` +
        `<span class="telemetry__row"><span class="telemetry__label">RY</span> <span class="telemetry__val">${ry.toFixed(2).padStart(8)}\u00B0</span></span>` +
        `<span class="telemetry__row"><span class="telemetry__label">RZ</span> <span class="telemetry__val">${rz.toFixed(2).padStart(8)}\u00B0</span></span>` +
        `<span class="telemetry__row telemetry__row--vel"><span class="telemetry__label">VEL</span> <span class="telemetry__val">${vel.toFixed(4)}</span></span>`
    }
    update()
    telemetryIntervalRef.current = window.setInterval(update, 500)
    return () => clearInterval(telemetryIntervalRef.current)
  }, [])

  // ─── Drag handlers ───
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag on interactive node children
    if ((e.target as HTMLElement).closest('.constellation-node')) return
    isDragRef.current = true
    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      rx: rotRef.current.x,
      ry: rotRef.current.y,
    }
    velRef.current = { x: 0, y: 0 }
    prevMouseRef.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragRef.current) return
    const dx = e.clientX - dragStartRef.current.mx
    const dy = e.clientY - dragStartRef.current.my
    const newRx = dragStartRef.current.rx + dy * DRAG_SENSITIVITY
    const clampedRx = Math.max(-90, Math.min(-50, newRx))
    const newRy = dragStartRef.current.ry + dx * DRAG_SENSITIVITY
    velRef.current = {
      x: (clampedRx - rotRef.current.x) * 0.6,
      y: (newRy - rotRef.current.y) * 0.6,
    }
    rotRef.current.x = clampedRx
    rotRef.current.y = newRy
    prevMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragRef.current = false
  }, [])

  // ─── Hover states ───
  const handleNodeHover = useCallback((idx: number | null) => {
    setHoveredIndex(idx)
    hoveredIndexRef.current = idx
  }, [])

  // ─── Entry / exit animations ───
  useEffect(() => {
    if (isActive) {
      // StrictMode guard: skip if entry animation is already playing
      if (entryTlRef.current?.isActive()) return;

      entryTlRef.current?.kill();
      rotRef.current = { ...INITIAL_ROT };
      velRef.current = { x: 0, y: 0 };
      entryDoneRef.current = false;

      if (scene3dRef.current) {
        scene3dRef.current.style.transform = `rotateX(${INITIAL_ROT.x}deg) rotateY(${INITIAL_ROT.y}deg)`;
        scene3dRef.current.style.setProperty('--rx', `${INITIAL_ROT.x}deg`);
        scene3dRef.current.style.setProperty('--ry', `${INITIAL_ROT.y}deg`);
      }

      const tl = gsap.timeline({
        onComplete: () => { entryDoneRef.current = true; },
      });
      entryTlRef.current = tl;

      ORBITAL_RINGS.forEach((_, i) => {
        if (ringEls.current[i]) {
          ringEls.current[i]!.style.setProperty('--sweep', '360deg');
        }
      });

      tl.fromTo(
        '.scene-center',
        { scale: 0, opacity: 0.6 },
        { scale: 1, opacity: 1, duration: 1.6, ease: 'power3.out' },
        0,
      );

      tl.fromTo(
        '.orbital-ring',
        { scale: 0 },
        { scale: 1, duration: 1.2, stagger: 0.06, ease: 'power2.out' },
        0.1,
      );

      tl.add(() => {
        ORBITAL_RINGS.forEach((_, i) => {
          if (ringEls.current[i]) {
            ringEls.current[i]!.style.setProperty('--sweep', '0deg');
          }
        });
      }, 0.8);

      const sweeps = ORBITAL_RINGS.map(() => ({ val: 0 }));
      tl.to(sweeps, {
        val: 360,
        duration: 1.8,
        stagger: 0.06,
        ease: 'power2.out',
        onUpdate() {
          sweeps.forEach((sw, i) => {
            if (ringEls.current[i]) {
              ringEls.current[i]!.style.setProperty('--sweep', `${sw.val}deg`);
            }
          });
        },
      }, 0.8);

      tl.fromTo(
        '.constellation-node',
        { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'back.out(1.5)' },
        1.0,
      );

      tl.fromTo('.works-telemetry', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.6 }, 1.2);
      tl.fromTo('.works-progress', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6 }, 1.3);
    } else {
      entryTlRef.current?.kill();
      entryTlRef.current = null;
      entryDoneRef.current = false;

      gsap.set('.orbital-ring', { scale: 0 });
      gsap.set('.scene-center', { scale: 0, opacity: 0 });
      gsap.set('.constellation-node', {
        xPercent: -50, yPercent: -50, scale: 0, opacity: 0,
      });
      gsap.set('.works-progress', { opacity: 0 });
      gsap.set('.works-telemetry', { opacity: 0 });

      ORBITAL_RINGS.forEach((_, i) => {
        if (ringEls.current[i]) {
          ringEls.current[i]!.style.setProperty('--sweep', '0deg');
        }
      });
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
      {/* <BtnBack onClick={onBack} /> */}

      {/* Terminal Progress Bar */}
      <div className="works-progress">
        <span className="works-progress__label">&gt; WORK LIST ───</span>
        <span className="works-progress__bar">
          [{works.map((_, i) => (hoveredIndex !== null && i <= hoveredIndex ? '█' : '░')).join('')}]
        </span>
        <span className="works-progress__info text-body">
          {hoveredIndex !== null
            ? `${String(hoveredIndex + 1).padStart(2, '0')}/${String(works.length).padStart(2, '0')} ─── ${works[hoveredIndex].game}`
            : `00/${String(works.length).padStart(2, '0')} ─── SELECT TARGET`}
        </span>
      </div>

      {/* Telemetry Panel */}
      <div
        className="works-telemetry"
        ref={telemetryRef}
      />

      {/* 3D Scene Container */}
      <div
        className="constellation-scene"
        ref={sceneRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Fixed overlays (not affected by drag rotation) */}
        <div className="works-bloom pulsing" />
        <div className="scene-center" />

        {/* 3D world */}
        <div
          className="scene-3d"
          ref={scene3dRef}
        >
          {/* Base Rings */}
          {ORBITAL_RINGS.map((ring, i) => (
            <div
              key={`base-${i}`}
              ref={(el) => {
                ringEls.current[i] = el
              }}
              className="orbital-ring"
              style={
                {
                  width: ring.w,
                  height: ring.h,
                  transform: `translate(-50%, -50%) rotateX(${ring.rx}deg) rotateY(${ring.ry}deg) rotateZ(${ring.rz}deg)`,
                  '--ring-opacity': ring.op,
                } as React.CSSProperties
              }
            />
          ))}

          {/* Highlight Rings (on hover comet tail), only mapped to node rings */}
          {ORBITAL_RINGS.slice(0, 5).map((ring, i) => (
            <div
              key={`highlight-${i}`}
              ref={(el) => {
                ringHighlightEls.current[i] = el
              }}
              className={`orbital-ring-highlight ${hoveredIndex === i ? 'active' : ''}`}
              style={
                {
                  width: ring.w,
                  height: ring.h,
                  transform: `translate(-50%, -50%) rotateX(${ring.rx}deg) rotateY(${ring.ry}deg) rotateZ(${ring.rz}deg)`,
                  '--start-angle': `${ring.angle! + 90}deg`,
                  '--draw-sweep': '0deg',
                } as React.CSSProperties
              }
            />
          ))}

          {/* Nodes */}
          {works.map((work, idx) => {
            const pos = NODE_3D[idx]
            if (!pos) return null
            return (
              <div
                key={`wrapper-${work.id}`}
                className="node-positioner"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 0,
                  height: 0,
                  transformStyle: 'preserve-3d',
                  transform: `translate3d(${pos.x}px, ${pos.y}px, ${pos.z}px) rotateY(calc(-1 * var(--ry, 30deg))) rotateX(calc(-1 * var(--rx, -18deg)))`,
                }}
              >
                <div
                  className={`constellation-node ${hoveredIndex === idx ? 'hovered' : ''}`}
                  onMouseEnter={() => handleNodeHover(idx)}
                  onMouseLeave={() => handleNodeHover(null)}
                  onClick={() => handleWorkClick(work)}
                >
                  <span className="constellation-node__index">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="constellation-node__point" />
                  <div className="constellation-node__info">
                    <span className="constellation-node__game">{work.game}</span>
                    <span className="constellation-node__title text-body">{work.title}</span>
                    <span className="constellation-node__stack text-body">{work.stack}</span>
                    <div className="constellation-node__thumb">
                      <img
                        src={work.img}
                        alt={work.title}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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
