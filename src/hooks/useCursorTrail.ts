import { useEffect, useRef } from 'react'

// ── Tune these ───────────────────────────────────────
const CHAIN_LENGTH = 10 // number of square particles in the trail
const HEAD_LERP = 0.22 // how fast the head chases the cursor (0–1)
const LINK_LERP = 0.15 // how fast each link chases the one in front
const HEAD_SIZE = 15 // px — size of the closest particle
const TAIL_SHRINK = 0.8 // how much smaller the tail gets (0 = same, 1 = vanishes)
const MERGE_DIST = 10 // px — within this distance to cursor, particle fades out
// ─────────────────────────────────────────────────────

interface Link {
  x: number
  y: number
}

export function useCursorTrail(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const chain = useRef<Link[]>(Array.from({ length: CHAIN_LENGTH }, () => ({ x: -400, y: -400 })))
  const mouse = useRef({ x: -400, y: -400 })
  const rafId = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio
      canvas.height = window.innerHeight * devicePixelRatio
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }
    window.addEventListener('mousemove', onMove)

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio)

      const c = chain.current
      const mx = mouse.current.x
      const my = mouse.current.y

      // ── Update positions ──────────────────────────────
      // Link 0 chases the actual cursor
      c[0].x += (mx - c[0].x) * HEAD_LERP
      c[0].y += (my - c[0].y) * HEAD_LERP

      // Each subsequent link chases the one ahead of it
      for (let i = 1; i < CHAIN_LENGTH; i++) {
        c[i].x += (c[i - 1].x - c[i].x) * LINK_LERP
        c[i].y += (c[i - 1].y - c[i].y) * LINK_LERP
      }

      // ── Render tail→head so head draws on top ─────────
      for (let i = CHAIN_LENGTH - 1; i >= 0; i--) {
        const t = i / (CHAIN_LENGTH - 1) // 0 = head, 1 = tail

        // Base opacity: exponential falloff toward the tail
        const baseOpacity = Math.pow(1 - t, 1.3) * 0.92

        // Merge fade: particles that have caught up to the cursor disappear
        const dx = c[i].x - mx
        const dy = c[i].y - my
        const distToCursor = Math.sqrt(dx * dx + dy * dy)
        const mergeFade = Math.min(distToCursor / MERGE_DIST, 1)

        const opacity = baseOpacity * mergeFade
        if (opacity < 0.01) continue

        const size = HEAD_SIZE * (1 - t * TAIL_SHRINK)

        ctx.save()
        ctx.globalAlpha = opacity
        ctx.shadowColor = '#ffffff'
        ctx.shadowBlur = (1 - t) * 16 + 3
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(c[i].x - size / 2, c[i].y - size / 2, size, size)
        ctx.restore()
      }

      rafId.current = requestAnimationFrame(loop)
    }

    rafId.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId.current)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])
}
