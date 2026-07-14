import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createPortal } from 'react-dom'
import { useMobile } from '../hooks/useMobile'
import { renderText } from '../utils/renderText'
import Lenis from 'lenis'
import type { SubProjectType, WorksListRowItem, WorkType } from '../types'
import { WorkDetailImage, WorksPreviewCard, WorksSubList } from './ui'
import worksStyles from './Works.module.scss'

gsap.registerPlugin(SplitText, ScrollTrigger)

interface WorksProps {
  isActive: boolean
}

// ─── Category Map (확장 시 여기에만 추가) ───
const CATEGORY_MAP: Record<number, string> = {
  0: 'Personal_work',
  1: 'Nexon',
}

// ─── 3D Configuration ───
const DEG = Math.PI / 180
const INITIAL_ROT = { x: -50, y: 43 }
// 드래그/관성으로 틀 수 있는 틸트(rotateX) 범위 — 실제 화면에서 구도가 좋았던
// 텔레메트리 샘플(RX -50.00 ~ -75.45)을 기준으로 확정. RY(세로축)는 자동 회전
// 축이고 어느 각도든 구도가 안 깨져서(샘플 RY 80~220 넓게 분포) 제한하지 않는다.
const ROT_X_MIN = -76
const ROT_X_MAX = -50
const AUTO_ROTATE_SPEED = 0.06
const DRAG_SENSITIVITY = 0.35
const MOMENTUM_DECAY = 0.94

// ─── Component Configurations (Dynamic Layout) ───

const RING_PRESETS = [
  { rx: 75, ry: 15, rz: -10, angle: -45 }, // 0
  { rx: 60, ry: -20, rz: 15, angle: 160 }, // 1
  { rx: 68, ry: 25, rz: -5, angle: 80 }, // 2
  { rx: 55, ry: -10, rz: 30, angle: -140 }, // 3
  { rx: 70, ry: 18, rz: -20, angle: 10 }, // 4
  { rx: 65, ry: -25, rz: -15, angle: -80 }, // 5
  { rx: 80, ry: 5, rz: 25, angle: 120 }, // 6
  { rx: 50, ry: 35, rz: -5, angle: 45 }, // 7
  { rx: 72, ry: -15, rz: 10, angle: -15 }, // 8
  { rx: 60, ry: 20, rz: -30, angle: 170 }, // 9
]

const DECORATIVE_RINGS = [
  { rx: 62, ry: -25, rz: 18, op: 0.05, angle: 0 },
  { rx: 74, ry: 10, rz: -35, op: 0.04, angle: 0 },
  { rx: 58, ry: -5, rz: 25, op: 0.03, angle: 0 },
]

function getPointOnRing(ring: any, angleDeg: number) {
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
  // 두 기준을 분리해서 사용:
  //  - isMobileDevice(디바이스, 불변): 3D 씬을 아예 마운트할지 결정 — 진짜 모바일
  //    기기는 씬 자체를 안 만들고, PC는 뷰포트와 무관하게 항상 마운트 유지(킵얼라이브)
  //  - isMobileView(디바이스 OR 뷰포트≤$tablet, 리액티브): 어떤 UI를 보여줄지 결정 —
  //    PC에서도 창이 좁아지면 모바일 리스트 UI로 전환되고, 씬은 CSS(display:none)로만
  //    숨겨져 재초기화 비용 없이 다시 넓히면 즉시 복귀한다
  const { isMobile: isMobileView, isMobileDevice } = useMobile()
  // 키 리네이밍: works.items → works.selectedProject, works.subproject → works.subProject
  // (i18next는 키가 없으면 키 문자열을 돌려주므로 Array.isArray로 가드)
  const selectedRaw = t('works.selectedProject', { returnObjects: true })
  const works = (Array.isArray(selectedRaw) ? selectedRaw : []) as WorkType[]
  const subRaw = t('works.subProject', { returnObjects: true })
  const subProjects = (Array.isArray(subRaw) ? subRaw : []) as SubProjectType[]
  // 드로어의 Selected Project도 Other Projects와 같은 텍스트 리스트로 통일 —
  // WorksSubList가 기대하는 공용 행 모양으로 매핑 (game을 title 앞에 붙여 구분)
  const selectedRows: WorksListRowItem[] = works.map((w) => ({
    title: `${w.game} — ${w.title}`,
    dept: w.dept,
    intro: w.intro,
    date: w.date,
    stack: w.stack,
  }))

  const [activeWork, setActiveWork] = useState<WorkType | null>(null)
  const hoveredIndexRef = useRef<number | null>(null) // no state — direct DOM for zero re-renders
  const [previewIndex, setPreviewIndex] = useState<number>(0) // progress bar display
  const [isOpen, setIsOpen] = useState(false)

  // ─── PC 우측 드로어: Selected Project 궤도는 항상 그대로, VIEW MORE로
  // View All(카드 리스트 + Other Projects)을 사이드 패널로 열고 닫는다.
  // 모바일은 드로어 없이 항상 리스트가 디폴트.
  // 세션마다 닫힌 상태로 시작 — "선호 모드"가 아니라 "잠깐 펼쳐보는 패널"이라
  // localStorage에 굳이 기억 안 함.
  const [drawerOpen, setDrawerOpen] = useState(false)
  // rAF 루프에서 최신 open 여부를 읽기 위한 ref (effect로 동기화)
  const drawerOpenRef = useRef(drawerOpen)
  useEffect(() => {
    drawerOpenRef.current = drawerOpen
  }, [drawerOpen])
  // rAF 루프에서 최신 뷰포트 모드를 읽기 위한 ref — 모바일 뷰 동안 프레임 작업 정지
  const isMobileViewRef = useRef(isMobileView)
  useEffect(() => {
    isMobileViewRef.current = isMobileView
  }, [isMobileView])

  // DOM refs
  const sceneRef = useRef<HTMLDivElement>(null)
  const scene3dRef = useRef<HTMLDivElement>(null)
  const ringEls = useRef<(HTMLDivElement | null)[]>([])
  const ringHighlightEls = useRef<(HTMLDivElement | null)[]>([])
  // One ref per work panel — show/hide managed via direct DOM (no React re-render)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const activePanelIdxRef = useRef<number | null>(null)
  // Direct DOM refs for hover classes — eliminates React re-renders on hover
  const nodeEls = useRef<(HTMLDivElement | null)[]>([])
  // Mobile list container ref — used for Lenis scroll & reset on section re-entry
  const mobileListRef = useRef<HTMLDivElement | null>(null)
  const mobileListContentRef = useRef<HTMLDivElement | null>(null)
  const mobileLenisRef = useRef<Lenis | null>(null)

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
  const ringHighlightSweeps = useRef<number[]>([])
  const rafRef = useRef(0)

  // ─── Lenis (모바일 뷰 전용 — 뷰포트 전환 시 init/destroy) ───
  useEffect(() => {
    if (!isMobileView) return
    if (!mobileListRef.current || !mobileListContentRef.current) return

    // 1. Lenis Init
    const lenis = new Lenis({
      wrapper: mobileListRef.current,
      content: mobileListContentRef.current,
      lerp: 0.1,
      wheelMultiplier: 1.2,
      touchMultiplier: 1.5,
    })
    mobileLenisRef.current = lenis

    const rafCb = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(rafCb)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      mobileLenisRef.current = null
      gsap.ticker.remove(rafCb)
    }
  }, [isMobileView])

  // ─── Dynamic Layout State ───
  const [ringScale, setRingScale] = useState(1)

  useEffect(() => {
    const syncScale = () => {
      const baseScale = window.innerWidth / 1200
      const scale = Math.max(0.3, Math.min(1, baseScale))
      setRingScale(scale)
    }
    syncScale()
    window.addEventListener('resize', syncScale)
    return () => window.removeEventListener('resize', syncScale)
  }, [])

  const rings = useMemo(() => {
    const result = []
    const count = works.length
    // 노드 링(1~5)만 축소 — 장식 링은 그대로 둬서 화면이 차 보이게 유지.
    // 노드 화면 투영 거리는 링 폭에 정비례(계수 ≈0.512, RX[-76,-50] 전 구간 스윕):
    // MAX 800 → 최악 |sy| ≈ 408px + 칩 반경 24px = 432 < 900높이 뷰포트 반높이 450
    // (기존 950은 최악 489px로 5번 노드가 화면 밖으로 나갔음)
    const START_W = 280
    const MAX_NODE_W = 800
    const step = count > 1 ? (MAX_NODE_W - START_W) / (count - 1) : 0

    for (let i = 0; i < count; i++) {
      const preset = RING_PRESETS[i % RING_PRESETS.length]
      const w = (START_W + step * i) * ringScale
      const op = 0.15 - 0.09 * (i / Math.max(1, count - 1))
      result.push({ w, h: w, ...preset, op })
    }

    const decorStart = 1150 // Adjusted down from 1650 to match tighter orbits
    const decorStep = 300 // Adjusted down from 350
    DECORATIVE_RINGS.forEach((dec, i) => {
      const w = (decorStart + decorStep * i) * ringScale
      result.push({ w, h: w, ...dec })
    })

    return result
  }, [works.length, ringScale])

  const node3d = useMemo(() => {
    return rings.slice(0, works.length).map((ring) => getPointOnRing(ring, ring.angle))
  }, [rings, works.length])

  const node3dRef = useRef(node3d)
  node3dRef.current = node3d
  const ringsRef = useRef(rings)
  ringsRef.current = rings

  useEffect(() => {
    isActiveRef.current = isActive
    if (isActive) {
      setPreviewIndex(0)
      // Reset mobile list scroll to top on re-entry
      if (isMobileView) {
        if (mobileLenisRef.current) {
          mobileLenisRef.current.scrollTo(0, { immediate: true })
        } else if (mobileListRef.current) {
          mobileListRef.current.scrollTop = 0
        }
      }
    }
  }, [isActive, isMobileView])

  // ─── Main animation loop ───
  // 진짜 모바일 기기는 루프 자체를 안 돌리고(씬 미마운트), PC에서는 루프를 유지하되
  // 모바일 뷰 동안(씬 display:none) isMobileViewRef 게이트로 프레임당 작업을 0으로.
  useEffect(() => {
    if (isMobileDevice) return

    let running = true

    const loop = () => {
      if (!running) return

      if (isActiveRef.current && entryDoneRef.current && !drawerOpenRef.current && !isMobileViewRef.current) {
        // Momentum / auto-rotate
        if (!isDragRef.current) {
          if (Math.abs(velRef.current.x) > 0.001 || Math.abs(velRef.current.y) > 0.001) {
            const nextRx = rotRef.current.x + velRef.current.x
            rotRef.current.x = Math.max(ROT_X_MIN, Math.min(ROT_X_MAX, nextRx))
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
        for (let i = 0; i < worksRef.current.length; i++) {
          if (ringHighlightSweeps.current[i] === undefined) {
            ringHighlightSweeps.current[i] = 0
          }
          const target = hoveredIndexRef.current === i ? 360 : 0
          ringHighlightSweeps.current[i] += (target - ringHighlightSweeps.current[i]) * 0.15
          if (ringHighlightEls.current[i]) {
            ringHighlightEls.current[i]!.style.setProperty('--draw-sweep', `${ringHighlightSweeps.current[i]}deg`)
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
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

  // ─── 드로어 열기/닫기 (PC 단일 버튼) ───
  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => {
      const next = !prev
      // 여는 순간 떠 있던 호버 패널 정리 — 드로어 위로 fixed 패널이 떠버리는 걸 방지.
      // (드로어가 열리면 백드롭이 씬 위를 덮어 새 호버 판정 자체가 안 들어오지만,
      // 열기 직전까지 활성이던 패널은 그대로 남아있으므로 명시적으로 지운다.)
      if (next && activePanelIdxRef.current !== null) {
        panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
        activePanelIdxRef.current = null
        handleNodeHover(null)
      }
      return next
    })
  }, [handleNodeHover])

  // ─── 뷰포트가 모바일 폭으로 좁아지는 순간 PC 전용 오버레이 정리 ───
  // 드로어/호버 패널은 !isMobileView 조건으로 언마운트되지만, 열림 state와
  // activePanelIdxRef가 남아 있으면 다시 넓혔을 때 유령처럼 복귀한다.
  useEffect(() => {
    if (!isMobileView) return
    setDrawerOpen(false)
    if (activePanelIdxRef.current !== null) {
      panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
      activePanelIdxRef.current = null
    }
    handleNodeHover(null)
  }, [isMobileView, handleNodeHover])

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

      const candidates: {
        idx: number
        dist: number
        sx: number
        sy: number
      }[] = []
      node3dRef.current.forEach((pos, idx) => {
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
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isMobileDevice) return
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
    },
    [isMobileDevice],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isMobileDevice) return
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
        const clampedRx = Math.max(ROT_X_MIN, Math.min(ROT_X_MAX, newRx))
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
    [calculateHover, handleNodeHover, isMobileDevice],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (isMobileDevice) return
      if (!isDragRef.current) return
      isDragRef.current = false
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      if (!hasDraggedRef.current && hoveredIndexRef.current !== null) {
        const work = worksRef.current[hoveredIndexRef.current]
        if (work) handleWorkClick(work)
      }
      if (sceneRef.current) {
        sceneRef.current.style.cursor = hoveredIndexRef.current !== null ? 'pointer' : 'grab'
      }
    },
    [handleWorkClick, isMobileDevice],
  )

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (isMobileDevice) return
      isDragRef.current = false
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      if (activePanelIdxRef.current !== null) {
        panelRefs.current[activePanelIdxRef.current]?.classList.remove('active')
        activePanelIdxRef.current = null
      }
      handleNodeHover(null)
      if (sceneRef.current) sceneRef.current.style.cursor = 'grab'
    },
    [handleNodeHover, isMobileDevice],
  )

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
      ringsRef.current.forEach((_, i) => {
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
      tl.fromTo(
        '.orbital-ring',
        { '--ring-scale': 0 } as any,
        {
          '--ring-scale': 1,
          duration: 0.55,
          stagger: 0.07,
          ease: 'power2.out',
        },
        0.1,
      )
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
        {
          scale: 1,
          opacity: 1,
          duration: 0.5,
          stagger: 0.07,
          ease: 'back.out(1.5)',
        },
        0.75,
      )

      // Phase 4: terminal typewriter — each char flashes active highlight then settles
      indexSplitRef.current?.revert()
      const indexSplit = new SplitText('.constellation-node__index', {
        type: 'chars',
      })
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
          tl.to(
            char,
            {
              backgroundColor: 'transparent',
              color: '#ffffff',
              duration: HOLD,
            },
            t + HOLD,
          )
        })
      })
    } else {
      entryTlRef.current?.kill()
      entryTlRef.current = null
      entryDoneRef.current = false

      gsap.set('.orbital-ring', { '--ring-scale': 0 } as any)
      gsap.set('.scene-center', { scale: 0, opacity: 0 })
      gsap.set('.constellation-node', {
        xPercent: -50,
        yPercent: -50,
        scale: 0,
        opacity: 0,
      })
      gsap.set('.works-list-content .works-preview', {
        opacity: 0,
        clearProps: 'y',
      })
      indexSplitRef.current?.revert()
      indexSplitRef.current = null

      // Reset ring sweep to 0 (invisible) — no scale reset needed
      ringsRef.current.forEach((_, i) => {
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
    // is-mobile-device 클래스는 이제 "모바일 뷰"(디바이스 OR 뷰포트) 기준으로 부착 —
    // App.scss의 works 모바일 스타일 전체(리스트 표시, constellation-scene display:none 등)가
    // 이 클래스 하나로 게이트되므로 CSS 변경 없이 반응형 전환이 따라온다
    <div className={`inner works__inner ${isMobileView ? 'is-mobile-device' : ''}`}>
      {/* PC 드로어 열기 버튼 — Selected Project 궤도는 항상 그대로 두고,
          View All(텍스트 리스트)만 하단 바텀시트로 열고 닫는다 */}
      {!isMobileView && (
        <div className={worksStyles['view-toggle']}>
          <button
            type="button"
            className={`${worksStyles['view-toggle__btn']}${drawerOpen ? ` ${worksStyles['view-toggle__btn--active']}` : ''}`}
            onClick={toggleDrawer}
            aria-pressed={drawerOpen}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? '[ CLOSE ]' : '[ VIEW MORE ]'}
          </button>
        </div>
      )}

      {/* 드로어 백드롭 — 씬 위를 덮어 궤도 인터랙션을 자연히 차단(z-index로),
          바깥 클릭 시 드로어를 닫는다. 항상 렌더하고 --open으로 페이드 */}
      {!isMobileView && (
        <div
          className={`${worksStyles['drawer-backdrop']}${drawerOpen ? ` ${worksStyles['drawer-backdrop--open']}` : ''}`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* PC View All 드로어: Selected Project 단일 열 리스트 + Other Projects.
          항상 렌더하고 --open으로 슬라이드 — 트랜지션을 위해 언마운트하지 않는다 */}
      {!isMobileView && (
        <aside className={`${worksStyles['drawer']}${drawerOpen ? ` ${worksStyles['drawer--open']}` : ''}`}>
          <div className={worksStyles['drawer__inner']}>
            <WorksSubList
              items={selectedRows}
              title="SELECTED PROJECT"
              onItemClick={(idx) => handleWorkClick(works[idx])}
            />
            <WorksSubList items={subProjects} />
          </div>
        </aside>
      )}

      {/* Mobile list: panels rendered inside scrollable container.
          PC 호버 패널과 같은 panelRefs를 쓰므로 반드시 상호배타로 렌더할 것
          (isMobileView ↔ !isMobileView — 동시에 마운트되면 ref가 충돌한다) */}
      {isMobileView && (
        <div
          className="works-list-container"
          ref={mobileListRef}
        >
          <div
            ref={mobileListContentRef}
            className="works-list-content"
          >
            {works.map((work, idx) => (
              <WorksPreviewCard
                key={`preview-mob-${work.id}`}
                work={work}
                index={idx}
                total={works.length}
                active
                onClick={() => handleWorkClick(work)}
                ref={(el) => {
                  panelRefs.current[idx] = el
                }}
              />
            ))}
            <WorksSubList items={subProjects} />
          </div>
        </div>
      )}

      {/* PC hover panels: fixed-positioned, shown on node hover via direct DOM */}
      {!isMobileView &&
        works.map((work, idx) => (
          <WorksPreviewCard
            key={`preview-pc-${work.id}`}
            work={work}
            index={idx}
            total={works.length}
            ref={(el) => {
              panelRefs.current[idx] = el
            }}
          />
        ))}

      {/* 3D Scene Container — 드로어가 열려도 항상 보임(백드롭이 위를 덮어
          인터랙션만 자연히 차단), rAF 루프는 drawerOpenRef로 회전만 정지 */}
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

        {/* 3D world — 의도적으로 isMobileView가 아니라 isMobileDevice 기준(킵얼라이브):
            PC에서는 뷰포트가 좁아져도 언마운트하지 않고 CSS(display:none)로만 숨겨서,
            다시 넓혔을 때 진입 애니메이션 재생/썸네일 재로드 없이 즉시 복귀한다.
            진짜 모바일 기기만 아예 마운트하지 않는다. */}
        {!isMobileDevice && (
          <div
            className="scene-3d"
            ref={scene3dRef}
          >
            {/* Base Rings */}
            {rings.map((ring, i) => (
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
                    transform: `translate(-50%, -50%) rotateX(${ring.rx}deg) rotateY(${ring.ry}deg) rotateZ(${ring.rz}deg) scale(var(--ring-scale, 1))`,
                    '--ring-opacity': ring.op,
                  } as React.CSSProperties
                }
              />
            ))}

            {/* Highlight Rings (on hover comet tail), only mapped to node rings */}
            {rings.slice(0, works.length).map((ring, i) => (
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
              const pos = node3d[idx]
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
                    <div className="constellation-node__point">
                      <img
                        src={work.thumbnail}
                        alt=""
                        loading="eager"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
              <span className="panel-id">
                ◼︎ project
                {activeWork ? `:${String(activeWork.id).padStart(3, '0')}` : ''}
              </span>
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
                <div className="panel-meta">
                  <div className="panel-meta__left">
                    <div className="meta-row">
                      <span className="meta-label">Dept</span> <span className="meta-val">{activeWork.dept}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Period</span> <span className="meta-val">{activeWork.date}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Tech</span> <span className="meta-val">{activeWork.stack}</span>
                    </div>
                  </div>

                  {activeWork.url && (
                    <div className="panel-action">
                      <a
                        href={activeWork.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-launch"
                      >
                        [ Link<span className="arrow">↗</span> ]
                      </a>
                    </div>
                  )}
                </div>

                <div className="panel-title-wrapper">
                  <h2 className="panel-game text-display">{activeWork.game}</h2>
                  <h1 className="panel-title text-display">{renderText(activeWork.title)}</h1>
                </div>

                <div className="panel-description text-body">
                  {activeWork.intro && <p className="panel-intro">{renderText(activeWork.intro)}</p>}
                  {activeWork.description.map((highlight, hIdx) => (
                    <div
                      className="panel-highlight"
                      key={hIdx}
                    >
                      <p className="panel-highlight__title">{renderText(highlight.title)}</p>
                      {highlight.p.map((line, lIdx) => (
                        <p
                          className="panel-highlight__body"
                          key={lIdx}
                        >
                          {renderText(line)}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>

                {activeWork.img.length > 0 ? <WorkDetailImage src={activeWork.img} /> : null}
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
