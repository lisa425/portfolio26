import { useEffect, type RefObject } from 'react'

// ─── Works 배경 성운 파티클 (2D 캔버스) ───
// 섹션 진입 시 바깥→안으로 수렴한 뒤, 크기가 다양한 사각 파티클들이
// 배경에서 은은하게 드리프트+트윙클하는 레이어. Hero의 WebGL 파티클과는
// 완전히 독립된 Works 전용 경량 캔버스 — constellation-scene의 첫 자식으로
// 마운트되어 씬의 display:none(모바일 뷰) 규칙을 그대로 따라간다.
// active가 아니면 rAF 자체를 돌리지 않고, 재진입 때마다 수렴 모션을 다시 재생.

const DPR_CAP = 2
const ENTRY_SPREAD = 2.1 // 진입 시작 시 중심 기준 퍼짐 배율 (2.1배 바깥에서 홈으로)
const TWINKLE_AMP = 0.25 // 정착 후 알파 흔들림 폭 (±25%)

type Particle = {
  hx: number // home x (0~1 정규화)
  hy: number
  driftX: number // 드리프트 속도 (정규화 좌표/초)
  driftY: number
  size: number // px
  alpha: number
  twFreq: number // 트윙클 주파수 (Hz)
  twPhase: number
  delay: number // 진입 수렴 개별 딜레이 (s)
  dur: number // 진입 수렴 소요 (s)
  soft: boolean // true면 블러 스프라이트, false면 크리스프 사각형
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** 큰 파티클용 소프트 사각 스프라이트 — 프레임마다 blur 필터를 쓰지 않도록 1회 프리렌더 */
function makeSoftSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas')
  sprite.width = 96
  sprite.height = 96
  const c = sprite.getContext('2d')
  if (c) {
    c.filter = 'blur(10px)'
    c.fillStyle = '#ffffff'
    c.fillRect(28, 28, 40, 40)
  }
  return sprite
}

/** 레퍼런스(구버전 사이트) 느낌의 3티어 구성: 작은 점 다수 + 중간 사각 + 큰 소프트 사각 */
function seedParticles(): Particle[] {
  const particles: Particle[] = []
  const push = (count: number, size: [number, number], alpha: [number, number], soft: boolean, driftScale = 1) => {
    for (let i = 0; i < count; i++) {
      particles.push({
        hx: Math.random(),
        hy: Math.random(),
        driftX: rand(-1, 1) * 0.004 * driftScale,
        driftY: rand(-1, 1) * 0.004 * driftScale,
        size: rand(size[0], size[1]),
        alpha: rand(alpha[0], alpha[1]),
        twFreq: rand(0.05, 0.22),
        twPhase: rand(0, Math.PI * 2),
        delay: rand(0, 0.5),
        dur: rand(0.9, 1.5),
        soft,
      })
    }
  }
  push(64, [2, 5], [0.12, 0.4], false) // 작은 크리스프 점
  push(9, [9, 20], [0.05, 0.12], false) // 중간 사각형
  push(9, [26, 68], [0.035, 0.08], true, 1.4) // 큰 소프트 사각형 (가까운 느낌 → 살짝 빠른 패럴랙스)
  return particles
}

export function useParticleBackdrop(canvasRef: RefObject<HTMLCanvasElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sprite = makeSoftSprite()
    const particles = seedParticles()

    let w = 0
    let h = 0
    let dpr = 1
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    const start = performance.now()
    let prev = start
    let driftT = 0 // 드리프트/트윙클 누적 시간 — dt 클램프로 백그라운드 복귀 점프 방지

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - prev) / 1000, 0.1)
      prev = now
      driftT += dt
      const elapsed = (now - start) / 1000

      if (w === 0) {
        resize() // 모바일 뷰(display:none) 등으로 0이었다가 보이게 된 경우
        return
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'

      for (const p of particles) {
        // 드리프트 누적 + 정규화 공간 래핑
        let nx = (p.hx + p.driftX * driftT) % 1
        let ny = (p.hy + p.driftY * driftT) % 1
        if (nx < 0) nx += 1
        if (ny < 0) ny += 1

        // 진입 수렴: 중심 기준 ENTRY_SPREAD배 바깥에서 홈 위치로 (개별 딜레이로 유기적으로)
        const t = Math.min(Math.max((elapsed - p.delay) / p.dur, 0), 1)
        const k = ENTRY_SPREAD + (1 - ENTRY_SPREAD) * easeOutCubic(t)
        const x = (0.5 + (nx - 0.5) * k) * w
        const y = (0.5 + (ny - 0.5) * k) * h

        const twinkle = 1 + TWINKLE_AMP * Math.sin(driftT * p.twFreq * Math.PI * 2 + p.twPhase)
        const a = p.alpha * twinkle * easeOutCubic(t) // 수렴하는 동안 페이드인
        if (a <= 0.003) continue

        ctx.globalAlpha = Math.min(a, 1)
        if (p.soft) {
          ctx.drawImage(sprite, x - p.size / 2, y - p.size / 2, p.size, p.size)
        } else {
          ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size)
        }
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, canvasRef])
}
