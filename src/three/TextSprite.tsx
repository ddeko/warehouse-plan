import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { NO_RAYCAST } from './toon'

interface Props {
  text: string
  position: [number, number, number]
  /** on-screen height in CSS pixels — kept constant regardless of zoom */
  px?: number
  color?: string
  background?: string
  border?: string
  bold?: boolean
  renderOrder?: number
  /**
   * Stack the label this many of its own heights above `position`. Because the
   * height is screen-constant, so is the gap — labels never collide at any zoom.
   * 0 sits the label's bottom edge on the anchor point.
   */
  lift?: number
}

/**
 * Canvas-texture label pinned to a constant on-screen size.
 *
 * Sprites are sized in world units, so on a 24 m warehouse a fixed world-size
 * label shrinks to a few pixels. The fix is to recompute the world size each
 * frame from however many screen pixels one world unit currently covers —
 * `zoom` under an orthographic camera, and a function of distance and field of
 * view under a perspective one. Kept dependency-free (no webfont fetch) so the
 * scene renders identically offline, and it costs one draw call per label.
 */
export function TextSprite({
  text,
  position,
  px = 15,
  color = '#e5e9f0',
  background = 'rgba(10,14,20,0.82)',
  border = 'rgba(255,255,255,0.16)',
  bold = false,
  renderOrder = 10,
  lift = 0,
}: Props) {
  const ref = useRef<THREE.Sprite>(null)

  const { texture, aspect } = useMemo(() => {
    const dpr = 3
    const fontSize = 34
    const padX = 14
    const padY = 8
    const font = `${bold ? '700' : '500'} ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`

    const measure = document.createElement('canvas').getContext('2d')!
    measure.font = font
    const w = Math.ceil(measure.measureText(text).width) + padX * 2
    const h = fontSize + padY * 2

    const canvas = document.createElement('canvas')
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    if (background !== 'none') {
      const r = h / 2
      ctx.beginPath()
      ctx.moveTo(r, 0)
      ctx.lineTo(w - r, 0)
      ctx.quadraticCurveTo(w, 0, w, r)
      ctx.lineTo(w, h - r)
      ctx.quadraticCurveTo(w, h, w - r, h)
      ctx.lineTo(r, h)
      ctx.quadraticCurveTo(0, h, 0, h - r)
      ctx.lineTo(0, r)
      ctx.quadraticCurveTo(0, 0, r, 0)
      ctx.closePath()
      ctx.fillStyle = background
      ctx.fill()
      if (border !== 'none') {
        ctx.strokeStyle = border
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 1)

    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    tex.anisotropy = 4
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    return { texture: tex, aspect: w / h }
  }, [text, color, background, border, bold])

  useEffect(() => () => texture.dispose(), [texture])

  const world = useMemo(() => new THREE.Vector3(), [])

  /** Screen pixels covered by one world unit at the sprite's own depth. */
  const pxPerUnit = (camera: THREE.Camera, viewportH: number) => {
    const ortho = camera as THREE.OrthographicCamera
    if (ortho.isOrthographicCamera) return ortho.zoom
    const persp = camera as THREE.PerspectiveCamera
    // A perspective frustum is 2·d·tan(fov/2) tall in world units at distance d,
    // and that height maps to the full viewport, so the ratio falls straight
    // out. Measured per sprite rather than per frame, because two labels at
    // different depths need different world sizes to land on the same pixel
    // height.
    const d = Math.max(0.001, camera.position.distanceTo(world))
    return viewportH / (2 * d * Math.tan(((persp.fov ?? 45) * Math.PI) / 360))
  }

  const apply = (camera: THREE.Camera, viewportH: number) => {
    const sprite = ref.current
    if (!sprite) return
    sprite.getWorldPosition(world)
    const h = px / Math.max(0.0001, pxPerUnit(camera, viewportH))
    sprite.scale.set(h * aspect, h, 1)
    sprite.center.set(0.5, -lift)
  }

  // Size once on mount so the first painted frame is already correct, then
  // track camera changes per frame.
  const camera = useThree((s) => s.camera)
  const height = useThree((s) => s.size.height)
  useLayoutEffect(() => apply(camera, height))
  useFrame(({ camera: c, size }) => apply(c, size.height))

  return (
    // Labels float over unrelated furniture and ignore depth, so they must
    // never take part in picking or they hand away other objects' clicks.
    <sprite ref={ref} position={position} renderOrder={renderOrder} raycast={NO_RAYCAST}>
      <spriteMaterial
        attach="material"
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}
