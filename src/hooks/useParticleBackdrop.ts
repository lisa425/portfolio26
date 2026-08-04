import { useEffect, type RefObject } from 'react'

const DPR_CAP = 2
const ENTRY_SPREAD = 2.1
const PARTICLE_COLOR = '#d9dde2'
const FIELD_ROT_SPEED = 0.008
const FLOW_DIR = { x: -0.006, y: -0.003 }

export type BackdropLayout = 'orbital' | 'vignette'

type Particle = {
  hx: number
  hy: number
  depth: number
  size: number
  alpha: number
  accent: boolean
  delay: number
  dur: number
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

function randNormal(): number {
  const u = Math.random() || 1e-9
  const v = Math.random() || 1e-9
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function sampleOrbital(): { hx: number; hy: number } {
  if (Math.random() < 0.55) {
    const hx = Math.random()
    const bandSlope = -0.18
    const hy = 0.5 + bandSlope * (hx - 0.5) + randNormal() * 0.11
    return { hx, hy: clamp01(hy) }
  }
  return {
    hx: clamp01(0.5 + randNormal() * 0.24),
    hy: clamp01(0.5 + randNormal() * 0.24),
  }
}

function sampleVignette(): { hx: number; hy: number } {
  for (let i = 0; i < 12; i++) {
    const hx = Math.random()
    const hy = Math.random()
    const distance = Math.hypot(hx - 0.5, hy - 0.5) / 0.707
    if (Math.random() < 0.08 + 0.92 * distance * distance) return { hx, hy }
  }
  return { hx: Math.random(), hy: Math.random() }
}

function seedParticles(layout: BackdropLayout): Particle[] {
  const sample = layout === 'orbital' ? sampleOrbital : sampleVignette
  const particles: Particle[] = []
  const push = (count: number, size: [number, number], alpha: [number, number], accent: boolean) => {
    for (let i = 0; i < count; i++) {
      particles.push({
        ...sample(),
        depth: accent ? rand(1.05, 1.2) : rand(0.85, 1.05),
        size: rand(size[0], size[1]),
        alpha: rand(alpha[0], alpha[1]),
        accent,
        delay: rand(0, 0.5),
        dur: rand(0.9, 1.5),
      })
    }
  }
  push(60, [1.5, 6.5], [0.02, 0.11], false)
  push(4, [3.5, 17.5], [0.08, 0.25], true)
  return particles
}

export function useParticleBackdrop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  active: boolean,
  layout: BackdropLayout = 'orbital',
) {
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const particles = seedParticles(layout)
    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    let animationFrame = 0
    const start = performance.now()
    let previous = start
    let fieldTime = 0

    const loop = (now: number) => {
      animationFrame = requestAnimationFrame(loop)
      const delta = Math.min((now - previous) / 1000, 0.1)
      previous = now
      fieldTime += delta
      const elapsed = (now - start) / 1000

      if (width === 0) {
        resize()
        return
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = PARTICLE_COLOR

      for (const particle of particles) {
        let normalizedX: number
        let normalizedY: number
        if (layout === 'orbital') {
          const theta = FIELD_ROT_SPEED * particle.depth * fieldTime
          const cos = Math.cos(theta)
          const sin = Math.sin(theta)
          const dx = particle.hx - 0.5
          const dy = particle.hy - 0.5
          normalizedX = 0.5 + dx * cos - dy * sin
          normalizedY = 0.5 + dx * sin + dy * cos
        } else {
          normalizedX = (particle.hx + FLOW_DIR.x * particle.depth * fieldTime) % 1
          normalizedY = (particle.hy + FLOW_DIR.y * particle.depth * fieldTime) % 1
          if (normalizedX < 0) normalizedX += 1
          if (normalizedY < 0) normalizedY += 1
        }

        const progress = Math.min(Math.max((elapsed - particle.delay) / particle.dur, 0), 1)
        const spread = ENTRY_SPREAD + (1 - ENTRY_SPREAD) * easeOutCubic(progress)
        const x = (0.5 + (normalizedX - 0.5) * spread) * width
        const y = (0.5 + (normalizedY - 0.5) * spread) * height
        const alpha = particle.alpha * easeOutCubic(progress)
        if (alpha <= 0.003) continue

        ctx.globalAlpha = Math.min(alpha, 1)
        const size = Math.max(1, Math.round(particle.size))
        ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size)
      }
      ctx.globalAlpha = 1
    }

    animationFrame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, canvasRef, layout])
}
