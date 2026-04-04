import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { createPortal } from 'react-dom'

gsap.registerPlugin(SplitText)

interface WorksProps {
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
const INITIAL_ROT = { x: -50, y: 43 }
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

const SCENE_PERSPECTIVE = 2000 // matches CSS perspective: 2000px
const HOVER_RADIUS = 60 // screen-space px threshold

// Project a 3D node position through scene rotation to 2D screen coords (origin = scene center)
// scene-3d transform: rotateX(rx) rotateY(ry) → matrix = Rx * Ry → applied as Rx(Ry(p))
function projectToScreen(
  pos: { x: number; y: number; z: number },
  rxDeg: number,
  ryDeg: number,
): { sx: number; sy: number } {
  const rx = rxDeg * DEG
  const ry = ryDeg * DEG
  const x1 = pos.x * Math.cos(ry) + pos.z * Math.sin(ry)
  const y1 = pos.y
  const z1 = -pos.x * Math.sin(ry) + pos.z * Math.cos(ry)
  const x2 = x1
  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx)
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx)
  const scale = SCENE_PERSPECTIVE / (SCENE_PERSPECTIVE - z2)
  return { sx: x2 * scale, sy: y2 * scale }
}

// ─── Component ───
function Works({ isActive }: WorksProps) {
  const { t } = useTranslation()
  const works = t('works.items', { returnObjects: true }) as WorkType[]

  const [activeWork, setActiveWork] = useState<WorkType | null>(null)
  const hoveredIndexRef = useRef<number | null>(null) // no state — direct DOM for zero re-renders
  const [previewIndex, setPreviewIndex] = useState<number>(0) // progress bar display
  const [isOpen, setIsOpen] = useState(false)

  // DOM refs
  const sceneRef = useRef<HTMLDivElement>(null)
  const scene3dRef = useRef<HTMLDivElement>(null)
  const ringEls = useRef<(HTMLDivElement | null)[]>([])
  const ringHighlightEls = useRef<(HTMLDivElement | null)[]>([])
  const telemetryRef = useRef<HTMLDivElement>(null)
  // One ref per work panel — show/hide managed via direct DOM (no React re-render)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const activePanelIdxRef = useRef<number | null>(null)
  // Direct DOM refs for hover classes — eliminates React re-renders on hover
  const nodeEls = useRef<(HTMLDivElement | null)[]>([])

  // Animation state (refs for perf — no re-renders during drag)
  const rotRef = useRef({ ...INITIAL_ROT })
  const isDragRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const dragStartRef = useRef({ mx: 0, my: 0, rx: 0, ry: 0 })
  const velRef = useRef({ x: 0, y: 0 })
  const isActiveRef = useRef(false)
  const worksRef = useRef<WorkType[]>([])
  worksRef.current = works
  const entryDoneRef = useRef(false)
  const entryTlRef = useRef<gsap.core.Timeline | null>(null)
  const indexSplitRef = useRef<InstanceType<typeof SplitText> | null>(null)

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

  // ─── Hover states ───
  // All visual effects via direct DOM — zero React re-renders on hover.
  const handleNodeHover = useCallback((idx: number | null) => {
    const prev = hoveredIndexRef.current
    hoveredIndexRef.current = idx

    // Progress bar: only update state when switching to a real node
    if (idx !== null && idx !== prev) setPreviewIndex(idx)

    // Toggle .hovered on constellation-node elements directly
    nodeEls.current.forEach((el, i) => el?.classList.toggle('hovered', i === idx))

    // Toggle .active on ring highlight elements directly
    ringHighlightEls.current.forEach((el, i) => el?.classList.toggle('active', i === idx))
  }, [])

  const handleWorkClick = useCallback((work: WorkType) => {
    setActiveWork(work)
    setIsOpen(true)
  }, [])

  // ─── Projected hover detection ───
  // Uses 3D→2D projection to find the hovered node, then directly manipulates
  // the mapped panel DOM element — zero React re-renders for panel show/hide.
  const calculateHover = useCallback(
    (clientX: number, clientY: number) => {
      const scene = sceneRef.current
      if (!scene) return
      const rect = scene.getBoundingClientRect()
      const mx = clientX - rect.left - rect.width / 2
      const my = clientY - rect.top - rect.height / 2

      const candidates: { idx: number; dist: number; sx: number; sy: number }[] = []
      NODE_3D.forEach((pos, idx) => {
        const { sx, sy } = projectToScreen(pos, rotRef.current.x, rotRef.current.y)
        const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2)
        if (dist <= HOVER_RADIUS) candidates.push({ idx, dist, sx, sy })
      })

      let bestIdx: number | null = null
      if (candidates.length > 0) {
        candidates.sort((a, b) => (Math.abs(a.dist - b.dist) < 20 ? a.idx - b.idx : a.dist - b.dist))
        bestIdx = candidates[0].idx

        const nodeScreenX = rect.left + rect.width / 2 + candidates[0].sx
        const nodeScreenY = rect.top + rect.height / 2 + candidates[0].sy
        const GAP = 30
        const preferredSide = nodeScreenX < window.innerWidth / 2 ? 'left' : 'right'

        // Hide previous panel if switching nodes
        if (activePanelIdxRef.current !== null && activePanelIdxRef.current !== bestIdx) {
          panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
        }
        // Position and show new panel — flip side / clamp vertically if it would overflow
        const panel = panelRefs.current[bestIdx]
        if (panel) {
          const panelW = panel.offsetWidth || 220
          const panelH = panel.offsetHeight || 300

          // ── horizontal: flip side if panel would leave viewport ──
          let side = preferredSide
          if (side === 'left' && nodeScreenX - GAP - panelW < 0) side = 'right'
          else if (side === 'right' && nodeScreenX + GAP + panelW > window.innerWidth) side = 'left'

          // ── vertical: CSS has translateY(-50%), so actual edges are:
          //   top edge  = top - panelH/2
          //   btm edge  = top + panelH/2
          // Adjust `top` to clamp without touching the animation transform. ──
          let adjustedTop = nodeScreenY
          if (nodeScreenY - panelH / 2 < 0) {
            // Panel would go above screen → align panel top with node position
            adjustedTop = nodeScreenY + panelH / 2
          } else if (nodeScreenY + panelH / 2 > window.innerHeight) {
            // Panel would go below screen → align panel bottom with node position
            adjustedTop = nodeScreenY - panelH / 2
          }

          panel.style.top = `${adjustedTop}px`
          panel.style.left = side === 'right' ? `${nodeScreenX + GAP + 30}px` : 'auto'
          panel.style.right = side === 'left' ? `${window.innerWidth - nodeScreenX + GAP}px` : 'auto'
          panel.classList.add('active')
        }
        activePanelIdxRef.current = bestIdx
      } else {
        // No node — hide active panel
        if (activePanelIdxRef.current !== null) {
          panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
          activePanelIdxRef.current = null
        }
      }

      // Only fire when bestIdx actually changes — prevents redundant DOM updates
      if (bestIdx !== hoveredIndexRef.current) handleNodeHover(bestIdx)
      scene.style.cursor = bestIdx !== null ? 'pointer' : 'grab'
    },
    [handleNodeHover],
  )

  // ─── Pointer handlers ───
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragRef.current = true
    hasDraggedRef.current = false
    // Do NOT clear hoveredIndexRef here — handlePointerUp needs it for click detection.
    // Panel hide happens only when actual drag movement exceeds threshold (handlePointerMove).
    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      rx: rotRef.current.x,
      ry: rotRef.current.y,
    }
    velRef.current = { x: 0, y: 0 }
    if (sceneRef.current) sceneRef.current.style.cursor = 'grabbing'
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragRef.current) {
        const dx = e.clientX - dragStartRef.current.mx
        const dy = e.clientY - dragStartRef.current.my
        if (Math.abs(dx) + Math.abs(dy) > 5 && !hasDraggedRef.current) {
          hasDraggedRef.current = true
          // Hide panel and clear hover only when drag actually starts
          if (activePanelIdxRef.current !== null) {
            panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
            activePanelIdxRef.current = null
          }
          handleNodeHover(null)
        }
        const newRx = dragStartRef.current.rx + dy * DRAG_SENSITIVITY
        const clampedRx = Math.max(-90, Math.min(-50, newRx))
        const newRy = dragStartRef.current.ry + dx * DRAG_SENSITIVITY
        velRef.current = {
          x: (clampedRx - rotRef.current.x) * 0.6,
          y: (newRy - rotRef.current.y) * 0.6,
        }
        rotRef.current.x = clampedRx
        rotRef.current.y = newRy
        return
      }
      calculateHover(e.clientX, e.clientY)
    },
    [calculateHover, handleNodeHover],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDragRef.current) return
    isDragRef.current = false
    if (!hasDraggedRef.current && hoveredIndexRef.current !== null) {
      const work = worksRef.current[hoveredIndexRef.current]
      if (work) handleWorkClick(work)
    }
    if (sceneRef.current) {
      sceneRef.current.style.cursor = hoveredIndexRef.current !== null ? 'pointer' : 'grab'
    }
  }, [handleWorkClick])

  const handlePointerLeave = useCallback(() => {
    isDragRef.current = false
    if (activePanelIdxRef.current !== null) {
      panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
      activePanelIdxRef.current = null
    }
    handleNodeHover(null)
    if (sceneRef.current) sceneRef.current.style.cursor = 'grab'
  }, [handleNodeHover])

  // ─── Entry / exit animations ───
  useEffect(() => {
    if (isActive) {
      // StrictMode guard: skip if entry animation is already playing
      if (entryTlRef.current?.isActive()) return

      entryTlRef.current?.kill()
      rotRef.current = { ...INITIAL_ROT }
      velRef.current = { x: 0, y: 0 }
      entryDoneRef.current = false

      if (scene3dRef.current) {
        scene3dRef.current.style.transform = `rotateX(${INITIAL_ROT.x}deg) rotateY(${INITIAL_ROT.y}deg)`
        scene3dRef.current.style.setProperty('--rx', `${INITIAL_ROT.x}deg`)
        scene3dRef.current.style.setProperty('--ry', `${INITIAL_ROT.y}deg`)
      }

      const tl = gsap.timeline({
        onComplete: () => {
          entryDoneRef.current = true
        },
      })
      entryTlRef.current = tl

      // Rings start invisible (sweep=0) — will draw themselves in
      ORBITAL_RINGS.forEach((_, i) => {
        if (ringEls.current[i]) {
          ringEls.current[i]!.style.setProperty('--sweep', '0deg')
        }
      })

      // Phase 1: scene-center core appears
      tl.fromTo(
        '.scene-center',
        { scale: 0, opacity: 0.6 },
        { scale: 1, opacity: 1, duration: 1.4, ease: 'power3.out' },
        0,
      )

      // Phase 2: rings scale in + draw themselves simultaneously
      tl.fromTo('.orbital-ring', { scale: 0 }, { scale: 1, duration: 0.55, stagger: 0.07, ease: 'power2.out' }, 0.1)
      ringEls.current.forEach((el, i) => {
        if (!el) return
        const proxy = { val: 0 }
        tl.to(
          proxy,
          {
            val: 360,
            duration: 0.55,
            ease: 'power2.inOut',
            onUpdate() {
              el.style.setProperty('--sweep', `${proxy.val}deg`)
            },
          },
          0.1 + i * 0.07,
        )
      })

      // Phase 3: nodes appear after inner rings are mostly drawn
      tl.fromTo(
        '.constellation-node',
        { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'back.out(1.5)' },
        0.75,
      )

      // Phase 4: terminal typewriter — each char flashes active highlight then settles
      indexSplitRef.current?.revert()
      const indexSplit = new SplitText('.constellation-node__index', { type: 'chars' })
      indexSplitRef.current = indexSplit

      gsap.set(indexSplit.chars, { opacity: 0, display: 'inline-block' })
      gsap.set('.constellation-node__index', { clearProps: 'opacity' })

      const CHAR_DELAY = 0.05 // gap between chars within one index
      const NODE_DELAY = 0.1 // gap between each index element starting
      const HOLD = 0.04
      const startTime = 1.3

      // Group chars by parent index element — each node starts independently
      Array.from(indexSplit.elements).forEach((indexEl, nodeIdx) => {
        const nodeStart = startTime + nodeIdx * NODE_DELAY
        const chars = indexSplit.chars.filter((char) => indexEl.contains(char))
        chars.forEach((char, charIdx) => {
          const t = nodeStart + charIdx * CHAR_DELAY
          tl.set(char, { opacity: 1, backgroundColor: '#ffffff', color: '#000000' }, t)
          tl.to(char, { backgroundColor: 'transparent', color: '#ffffff', duration: HOLD }, t + HOLD)
        })
      })

      tl.fromTo('.works-telemetry', { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5 }, 0.6)
      tl.fromTo('.works-progress', { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.75)
    } else {
      entryTlRef.current?.kill()
      entryTlRef.current = null
      entryDoneRef.current = false

      gsap.set('.orbital-ring', { scale: 0 })
      gsap.set('.scene-center', { scale: 0, opacity: 0 })
      gsap.set('.constellation-node', {
        xPercent: -50,
        yPercent: -50,
        scale: 0,
        opacity: 0,
      })
      indexSplitRef.current?.revert()
      indexSplitRef.current = null
      gsap.set('.works-progress', { opacity: 0 })
      gsap.set('.works-telemetry', { opacity: 0 })

      // Reset ring sweep to 0 (invisible) — no scale reset needed
      ORBITAL_RINGS.forEach((_, i) => {
        if (ringEls.current[i]) {
          ringEls.current[i]!.style.setProperty('--sweep', '0deg')
        }
      })
    }
  }, [isActive])

  const closeDetail = () => {
    setIsOpen(false)
  }

  return (
    <div className="inner works__inner">
      {/* Terminal Progress Bar */}
      <div className="terminal-bar works-progress">
        <span className="terminal-bar__label">&gt; WORK_LIST ───</span>
        <span className="terminal-bar__bar">[{works.map((_, i) => (i <= previewIndex ? '█' : '░')).join('')}]</span>
        <span className="works-progress__info text-body">
          {`${String(previewIndex + 1).padStart(3, '0')}/${String(works.length).padStart(3, '0')} ─── ${works[previewIndex]?.game ?? ''}`}
        </span>
      </div>

      {/* Preview Panels — one per work, each managed via DOM ref (no re-render on hover) */}
      {works.map((work, idx) => (
        <div
          key={`preview-${work.id}`}
          className="works-preview"
          ref={(el) => {
            panelRefs.current[idx] = el
          }}
        >
          <div className="works-preview__header">
            <span className="works-preview__panel-id">◼︎ TARGET NODE</span>
            <span className="works-preview__index">
              {String(idx + 1).padStart(3, '0')}/{String(works.length).padStart(3, '0')}
            </span>
          </div>
          <div className="works-preview__thumb">
            <img
              src={work.img}
              alt={work.title}
            />
            <div className="works-preview__thumb-scan" />
          </div>
          <div className="works-preview__data">
            <div className="works-preview__row">
              <span className="works-preview__key">GAME</span>
              <span className="works-preview__val">{work.game}</span>
            </div>
            <div className="works-preview__row">
              <span className="works-preview__key">NAME</span>
              <span className="works-preview__val works-preview__val--title">{work.title}</span>
            </div>
            <div className="works-preview__row">
              <span className="works-preview__key">TECH</span>
              <span className="works-preview__val">{work.stack}</span>
            </div>
          </div>
          <div className="works-preview__footer">
            <span className="works-preview__status">
              <span className="works-preview__dot" />
              ONLINE
            </span>
            <span className="works-preview__action">[ ENTER ]</span>
          </div>
        </div>
      ))}

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
        onPointerLeave={handlePointerLeave}
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
              className="orbital-ring-highlight"
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
                  className="constellation-node"
                  ref={(el) => {
                    nodeEls.current[idx] = el
                  }}
                >
                  <span className="constellation-node__index">{String(idx + 1).padStart(3, '0')}</span>
                  <div className="constellation-node__point" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail Modal */}
      {createPortal(
        <div className={`works__detail ${isOpen ? 'active' : ''}`}>
          <div
            className="works__detail-overlay"
            onClick={closeDetail}
          />
          <div className="works__detail-panel">
            {/* Panel Header */}
            <div className="panel-header">
              <span className="panel-id">◼︎ work_detail</span>
              <button
                className="btn-close-panel"
                onClick={closeDetail}
              >
                [ X ] CLOSE
              </button>
            </div>

            {/* Panel Body */}
            {activeWork && (
              <div
                className="panel-body"
                key={activeWork.id}
              >
                <div className="panel-body__left">
                  <div className="panel-image-container">
                    <span className="corner top-left"></span>
                    <span className="corner top-right"></span>
                    <span className="corner bottom-left"></span>
                    <span className="corner bottom-right"></span>
                    <div className="image-wrapper">
                      {activeWork.img && (
                        <img
                          src={activeWork.img}
                          alt="thumbnail"
                        />
                      )}
                      <div className="panel-image-scan"></div>
                    </div>
                  </div>
                </div>

                <div className="panel-body__right">
                  <div className="panel-meta">
                    <div className="meta-row">
                      <span className="meta-label">ID_CODE</span>{' '}
                      <span className="meta-val">{String(activeWork.id).padStart(3, '0')}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Period</span> <span className="meta-val">{activeWork.date}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Tech</span> <span className="meta-val">{activeWork.stack}</span>
                    </div>
                  </div>

                  <div className="panel-title-wrapper">
                    <h2 className="panel-game text-display">{activeWork.game}</h2>
                    <h1 className="panel-title text-display">{activeWork.title}</h1>
                  </div>

                  <div className="panel-description text-body">{activeWork.description}</div>

                  {activeWork.url && (
                    <div className="panel-action">
                      <a
                        href={activeWork.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-launch"
                      >
                        [ LAUNCH_PROJECT ] <span className="arrow">↗</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export default Works
