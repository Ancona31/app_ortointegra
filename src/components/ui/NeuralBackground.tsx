'use client'

import { useRef, useEffect } from 'react'

/* ═══════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN — Ajusta estos valores para personalizar la animación
   ═══════════════════════════════════════════════════════════════════════ */

/** Nodos por píxel² — ~80 nodos en 1920×1080. Subir = más denso */
const NODE_DENSITY = 0.00004

/** Velocidad máxima base en px/frame (capa frontal). Bajar = más calma */
const NODE_SPEED = 0.15

/** Distancia máxima (px) para trazar conexión entre dos nodos */
const CONNECTION_DIST = 150

/** Radio de influencia del cursor (px) */
const MOUSE_RADIUS = 200

/** Fuerza de atracción del cursor sobre los nodos cercanos */
const MOUSE_STRENGTH = 0.02

/** Grosor máximo de las líneas de conexión */
const LINE_WIDTH = 0.3

/** Color de acento en formato RGB (sin alpha) — teal/cian Spinus */
const ACCENT_RGB = '0, 188, 212'

/** Cantidad de capas de profundidad (parallax) */
const LAYER_COUNT = 3

/* ═══════════════════════════════════════════════════════════════════════
   TIPOS INTERNOS
   ═══════════════════════════════════════════════════════════════════════ */

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  /** 0 = lejano, LAYER_COUNT-1 = cercano */
  layer: number
  /** Escala derivada de la capa (0.4 … 1.0) */
  scale: number
  /** Offset aleatorio para el pulso orgánico (0 … 2π) */
  pulseOffset: number
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENTE
   ═══════════════════════════════════════════════════════════════════════ */

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return

    const context = cvs.getContext('2d', { alpha: false })
    if (!context) return

    // Aliases locales para que TS no se queje de posible null dentro de closures
    const canvas = cvs
    const ctx = context

    /* ── Estado mutable (sin React state para evitar re-renders) ── */

    let nodes: Node[] = []
    let width = 0
    let height = 0
    let animId = 0
    const mouse = { x: -9999, y: -9999 }

    /* ── Helpers ── */

    function createNode(w: number, h: number): Node {
      const layer = Math.floor(Math.random() * LAYER_COUNT)
      // Capas: 0 = lejana (pequeña, lenta), 2 = cercana (grande, rápida)
      const scale = 0.4 + (layer / (LAYER_COUNT - 1)) * 0.6
      const speed = NODE_SPEED * scale
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: (Math.random() - 0.5) * speed * 2,
        layer,
        scale,
        pulseOffset: Math.random() * Math.PI * 2,
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Recalcular nodos según nueva área
      const targetCount = Math.max(20, Math.floor(width * height * NODE_DENSITY))
      while (nodes.length < targetCount) nodes.push(createNode(width, height))
      if (nodes.length > targetCount) nodes.length = targetCount
    }

    /* ── Gradiente radial de fondo (cacheado) ── */

    let bgGradient: CanvasGradient | null = null

    function buildBgGradient() {
      const cx = width * 0.5
      const cy = height * 0.4
      const r = Math.max(width, height) * 0.8
      bgGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      bgGradient.addColorStop(0, '#FFFFFF')
      bgGradient.addColorStop(1, '#F0F4F8')
    }

    /* ── Loop de animación ── */

    function animate() {
      const now = performance.now() * 0.001 // segundos

      // 1. Fondo
      if (bgGradient) {
        ctx.fillStyle = bgGradient
        ctx.fillRect(0, 0, width, height)
      }

      // 2. Mover nodos
      const mouseR2 = MOUSE_RADIUS * MOUSE_RADIUS

      for (const n of nodes) {
        // Atracción del mouse
        const dmx = mouse.x - n.x
        const dmy = mouse.y - n.y
        const distMouse2 = dmx * dmx + dmy * dmy
        if (distMouse2 < mouseR2 && distMouse2 > 1) {
          const distMouse = Math.sqrt(distMouse2)
          const force = MOUSE_STRENGTH * n.scale * (1 - distMouse / MOUSE_RADIUS)
          n.vx += (dmx / distMouse) * force
          n.vy += (dmy / distMouse) * force
        }

        // Limitar velocidad según capa
        const maxSpeed = NODE_SPEED * n.scale
        const speed2 = n.vx * n.vx + n.vy * n.vy
        if (speed2 > maxSpeed * maxSpeed) {
          const s = maxSpeed / Math.sqrt(speed2)
          n.vx *= s
          n.vy *= s
        }

        // Fricción suave para que desacelere
        n.vx *= 0.998
        n.vy *= 0.998

        n.x += n.vx
        n.y += n.vy

        // Rebote suave en bordes
        if (n.x < 0) { n.x = 0; n.vx = Math.abs(n.vx) * 0.5 }
        if (n.x > width) { n.x = width; n.vx = -Math.abs(n.vx) * 0.5 }
        if (n.y < 0) { n.y = 0; n.vy = Math.abs(n.vy) * 0.5 }
        if (n.y > height) { n.y = height; n.vy = -Math.abs(n.vy) * 0.5 }
      }

      // 3. Conexiones — ordenar por capa para que las lejanas se dibujen primero
      const connDist2 = CONNECTION_DIST * CONNECTION_DIST
      ctx.lineWidth = LINE_WIDTH

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]

          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist2 = dx * dx + dy * dy
          if (dist2 > connDist2) continue

          const dist = Math.sqrt(dist2)
          let alpha = (1 - dist / CONNECTION_DIST) * 0.35

          // Capa promedio para la opacidad de la línea
          const avgScale = (a.scale + b.scale) * 0.5
          alpha *= avgScale

          // Boost por proximidad del mouse al punto medio
          const mx = (a.x + b.x) * 0.5
          const my = (a.y + b.y) * 0.5
          const mdx = mouse.x - mx
          const mdy = mouse.y - my
          const mDist2 = mdx * mdx + mdy * mdy
          if (mDist2 < mouseR2) {
            alpha *= 1 + (1 - Math.sqrt(mDist2) / MOUSE_RADIUS) * 1.5
          }

          alpha = Math.min(alpha, 0.6)

          // Gradiente entre nodos (haz de energía)
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          grad.addColorStop(0, `rgba(${ACCENT_RGB}, ${alpha * 0.3})`)
          grad.addColorStop(0.5, `rgba(${ACCENT_RGB}, ${alpha})`)
          grad.addColorStop(1, `rgba(${ACCENT_RGB}, ${alpha * 0.3})`)

          ctx.beginPath()
          ctx.strokeStyle = grad
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      // 4. Nodos — dibujar por capa (lejanas primero)
      for (let layer = 0; layer < LAYER_COUNT; layer++) {
        for (const n of nodes) {
          if (n.layer !== layer) continue

          // Pulso orgánico senoidal (latido asincrónico)
          const pulse = 0.6 + 0.4 * Math.sin(now * 1.2 + n.pulseOffset)
          const radius = (1.2 + n.scale * 1.8) * (0.85 + pulse * 0.15)
          const alpha = (0.3 + n.scale * 0.5) * pulse

          // Boost si el mouse está cerca
          let glowRadius = radius
          const dmx = mouse.x - n.x
          const dmy = mouse.y - n.y
          const dMouse2 = dmx * dmx + dmy * dmy
          if (dMouse2 < mouseR2) {
            const proximity = 1 - Math.sqrt(dMouse2) / MOUSE_RADIUS
            glowRadius += proximity * 3 * n.scale
          }

          // Glow (shadow)
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.shadowColor = `rgba(${ACCENT_RGB}, ${0.6 * n.scale})`
          ctx.shadowBlur = 6 + n.scale * 8
          ctx.beginPath()
          ctx.arc(n.x, n.y, glowRadius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${ACCENT_RGB}, 1)`
          ctx.fill()
          ctx.restore()
        }
      }

      animId = requestAnimationFrame(animate)
    }

    /* ── Event listeners ── */

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    function onMouseLeave() {
      mouse.x = -9999
      mouse.y = -9999
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX
        mouse.y = e.touches[0].clientY
      }
    }

    function onTouchEnd() {
      mouse.x = -9999
      mouse.y = -9999
    }

    function onResize() {
      resize()
      buildBgGradient()
    }

    /* ── Setup ── */

    resize()
    buildBgGradient()
    animId = requestAnimationFrame(animate)

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('resize', onResize)

    /* ── Cleanup ── */

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    />
  )
}
