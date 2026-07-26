import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Container, Item, Room, Settings } from '../types'
import { CONTAINER_META } from '../types'
import { ContainerMesh } from './ContainerMesh'
import { INK, NO_RAYCAST, OUTLINE, UNIT_BOX, UNIT_BOX_EDGES, lineMaterial, outlineMaterial, toonMaterial } from './toon'
import { footprint, snap } from '../lib/geometry'
import { CAMERA_PRESETS } from '../lib/viewpoints'
import { useStore } from '../store'

const M = (cm: number) => cm / 100

export type ViewMode = '2d' | '3d'

export { CAMERA_PRESETS } from '../lib/viewpoints'

/** Polar angle of a true isometric eye: acos(1/√3) from the +Y axis. */
const ISO_POLAR = Math.acos(1 / Math.sqrt(3))

/**
 * Vertical field of view of the WebGL view, in degrees.
 *
 * This scene used to render through an orthographic camera locked to the
 * isometric eye. Orthographic is metrically honest but it reads as *wrong*: a
 * rectangular room projects to a parallelogram, every box collapses to a flat
 * hexagon, and near and far objects are drawn at identical size so nothing
 * looks solid. A perspective camera is what makes a room look like a room.
 *
 * 45° rather than the 60° a games camera would use: field of view is the whole
 * source of wide-angle stretch, where boxes near the edge of the frame shear
 * away from the centre. Narrower keeps verticals vertical and box faces square
 * right out to the corners while still giving real depth.
 */
const FOV = 45

/** Elevation above the horizon used when free orbit is off. */
const LOCKED_POLAR = ISO_POLAR

/** Never orbit below the floor or quite to straight-down (both look broken). */
const ORBIT_MIN_POLAR = 0.12
const ORBIT_MAX_POLAR = 1.5

const PAPER = { light: '#fdfdff', dark: '#19202b' }
const FLOOR = { light: '#f6f7fb', dark: '#222b38' }
const WALL = { light: '#eef1f8', dark: '#2a3442' }

// --------------------------------------------------------------------- room

function RoomShell({ room, settings, mode, dark }: { room: Room; settings: Settings; mode: ViewMode; dark: boolean }) {
  const w = M(room.width)
  const l = M(room.length)
  const h = M(room.height)
  const slab = 0.1
  const wallT = 0.12
  const walls = useRef<(THREE.Group | null)[]>([])

  const gridGeom = useMemo(() => {
    const g = Math.max(M(room.grid), 0.05)
    const pts: number[] = []
    const cols = Math.min(400, Math.max(1, Math.round(w / g)))
    const rows = Math.min(400, Math.max(1, Math.round(l / g)))
    for (let i = 0; i <= cols; i++) {
      const x = (i * w) / cols
      pts.push(x, 0, 0, x, 0, l)
    }
    for (let j = 0; j <= rows; j++) {
      const z = (j * l) / rows
      pts.push(0, 0, z, w, 0, z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [w, l, room.grid])

  useEffect(() => () => gridGeom.dispose(), [gridGeom])

  const floorMat = toonMaterial(dark ? FLOOR.dark : room.floorColor || FLOOR.light)
  const wallMat = toonMaterial(dark ? WALL.dark : room.wallColor || WALL.light)
  const ink = outlineMaterial(INK)
  const line = lineMaterial(INK)

  /** A block with the same chunky outline treatment as the furniture. */
  const Slab = ({ p, s, mat, innerRef }: {
    p: [number, number, number]
    s: [number, number, number]
    mat: THREE.Material
    innerRef?: (g: THREE.Group | null) => void
  }) => (
    <group position={p} ref={innerRef}>
      <mesh geometry={UNIT_BOX} material={ink} scale={[s[0] + OUTLINE * 2, s[1] + OUTLINE * 2, s[2] + OUTLINE * 2]} renderOrder={-1} />
      <mesh geometry={UNIT_BOX} material={mat} scale={s} />
      <lineSegments geometry={UNIT_BOX_EDGES} material={line} scale={s} />
    </group>
  )

  /*
    All four walls exist, and the ones between the camera and the room are
    hidden every frame — the standard cut-away every room planner uses. With a
    fixed pair of back walls (what this used to do) three of the four corner
    presets put a wall in front of the furniture, and free orbit put you outside
    the box entirely.

    A wall is in the way exactly when the camera sits on its outward side, so
    the test is one comparison per wall against the camera in room space.
  */
  const root = useRef<THREE.Group>(null)
  const camLocal = useRef(new THREE.Vector3()).current
  useFrame(({ camera }) => {
    const g = walls.current
    if (!root.current || !g[0]) return
    root.current.worldToLocal(camLocal.copy(camera.position))
    g[0].visible = camLocal.z > 0        // north, at z = 0
    if (g[1]) g[1].visible = camLocal.z < l        // south, at z = l
    if (g[2]) g[2].visible = camLocal.x > 0        // west,  at x = 0
    if (g[3]) g[3].visible = camLocal.x < w        // east,  at x = w
  })

  return (
    <group ref={root}>
      <Slab p={[w / 2, -slab / 2, l / 2]} s={[w, slab, l]} mat={floorMat} />

      {settings.showGrid && (
        <lineSegments geometry={gridGeom} position={[0, 0.003, 0]}>
          <lineBasicMaterial color={dark ? '#ffffff' : '#8d99b3'} transparent opacity={dark ? 0.1 : 0.28} />
        </lineSegments>
      )}

      {settings.showWalls && mode === '3d' && (
        <>
          <Slab innerRef={(g) => { walls.current[0] = g }} p={[w / 2, h / 2, -wallT / 2]} s={[w + wallT * 2, h, wallT]} mat={wallMat} />
          <Slab innerRef={(g) => { walls.current[1] = g }} p={[w / 2, h / 2, l + wallT / 2]} s={[w + wallT * 2, h, wallT]} mat={wallMat} />
          <Slab innerRef={(g) => { walls.current[2] = g }} p={[-wallT / 2, h / 2, l / 2]} s={[wallT, h, l]} mat={wallMat} />
          <Slab innerRef={(g) => { walls.current[3] = g }} p={[w + wallT / 2, h / 2, l / 2]} s={[wallT, h, l]} mat={wallMat} />
        </>
      )}
    </group>
  )
}

// ------------------------------------------------------------------- camera

function CameraRig({
  room, preset, mode, enabled, fitTick, freeOrbit,
}: {
  room: Room
  preset: number
  mode: ViewMode
  enabled: boolean
  fitTick: number
  freeOrbit: boolean
}) {
  const { camera, size, invalidate } = useThree()
  const controls = useRef<any>(null)

  const w = M(room.width)
  const l = M(room.length)
  const h = M(room.height)
  const is2d = mode === '2d'

  /* Aim a little below the mid-height of the room: dead centre puts the floor —
     where all the work happens — in the bottom half of the frame. */
  const targetY = is2d ? 0 : h * 0.42
  /* Exact bounding-sphere radius about that aim point, so the fit below can
     never clip a corner whatever direction the camera comes from. */
  const radius = Math.hypot(w / 2, l / 2, is2d ? 0 : Math.max(targetY, h - targetY))

  /**
   * Distance at which a sphere of `radius` exactly fills the smaller of the two
   * field-of-view angles. Doing it per-axis matters: a room wider than it is
   * tall overflows a portrait viewport long before it overflows the vertical
   * FOV, and fitting on the vertical angle alone would crop it.
   */
  const fitDistance = (cam: THREE.PerspectiveCamera) => {
    const vFov = (cam.fov * Math.PI) / 180
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect)
    return radius / Math.sin(Math.min(vFov, hFov) / 2)
  }

  // Layout effect (not passive) so the camera is framed before the labels
  // measure it to size themselves on the same commit.
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const dir3 = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS[0]

    if (cam.isPerspectiveCamera) {
      cam.aspect = size.width / Math.max(1, size.height)
      // Near/far bracket the room rather than being fixed: a 0.1 near plane on a
      // 40 m warehouse burns most of the depth buffer on empty space in front of
      // the camera, which is where the z-fighting between the outline shells and
      // the faces they wrap comes from.
      cam.near = Math.max(0.05, radius / 100)
      cam.far = radius * 40 + 100
    }

    // The preset only supplies an azimuth; elevation is the rig's business, so
    // that the four corner buttons and free orbit agree about how high the eye
    // sits.
    const az = Math.atan2(dir3.dir[0], dir3.dir[2])
    // Looking straight down is singular against an up vector of (0,1,0), so the
    // top-down case uses a genuine 0 polar with up = −Z instead, which is
    // well-defined and puts the room's back edge at the top.
    const polar = is2d ? 0 : LOCKED_POLAR
    const dir = new THREE.Vector3(
      Math.sin(polar) * Math.sin(az),
      Math.cos(polar),
      Math.sin(polar) * Math.cos(az),
    )

    const target = new THREE.Vector3(0, targetY, 0)
    const dist = cam.isPerspectiveCamera
      ? fitDistance(cam) * 1.06
      : Math.max(w, l) * 2.4 + 12

    camera.position.copy(target).addScaledVector(dir, dist)
    camera.up.set(0, is2d ? 0 : 1, is2d ? -1 : 0)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)

    if (controls.current) {
      controls.current.target.copy(target)
      controls.current.update()
    }
    // On-demand rendering: moving the camera by hand is invisible to the
    // reconciler, so the frame has to be asked for explicitly.
    invalidate()
  }, [camera, room.id, room.width, room.length, room.height, preset, mode, fitTick, freeOrbit, size.width, size.height])

  const canRotate = mode === '3d' && freeOrbit

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.14}
      enablePan
      enableRotate={canRotate}
      // Perspective zoom is a dolly, so the limits are distances, not zoom
      // factors. The floor is the useful lower bound — closer than about a
      // metre and the near plane starts eating the object you are inspecting.
      minDistance={Math.max(0.8, h * 0.5)}
      maxDistance={radius * 12 + 20}
      /*
        With rotation off the eye stays at the preset elevation, so dragging
        spins the model about Y only — the same "rotate the object" feel a CAD
        turntable has. Free orbit opens it up but still stops short of the floor
        plane and of straight down, the two angles where a room stops reading as
        a room.
      */
      minPolarAngle={is2d ? 0 : canRotate ? ORBIT_MIN_POLAR : LOCKED_POLAR}
      maxPolarAngle={is2d ? 0 : canRotate ? ORBIT_MAX_POLAR : LOCKED_POLAR}
      // With rotation locked the primary drag should still do something useful,
      // so the left button pans instead of being inert.
      mouseButtons={{
        LEFT: canRotate ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  )
}

/**
 * Applies +/- zoom presses coming from the floating viewport controls.
 *
 * Under a perspective camera "zoom" is a dolly along the view ray, not a
 * projection scale, so the buttons move the eye toward the orbit target and
 * respect the same distance limits the mouse wheel does.
 */
function ZoomBridge({ cmd }: { cmd: { n: number; dir: number } }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as any
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!cmd.n) return
    const step = cmd.dir > 0 ? 1 / 1.22 : 1.22

    const ortho = camera as THREE.OrthographicCamera
    if (ortho.isOrthographicCamera) {
      ortho.zoom = Math.max(2, Math.min(900, ortho.zoom / step))
      ortho.updateProjectionMatrix()
      invalidate()
      return
    }

    const target = controls?.target ?? new THREE.Vector3()
    const off = camera.position.clone().sub(target)
    const dist = THREE.MathUtils.clamp(
      off.length() * step,
      controls?.minDistance ?? 0.8,
      controls?.maxDistance ?? 1e4,
    )
    camera.position.copy(target).addScaledVector(off.normalize(), dist)
    controls?.update?.()
    invalidate()
  }, [cmd.n])
  return null
}

// --------------------------------------------------------------- drag layer

interface DragState {
  id: string
  offX: number
  offZ: number
  moved: boolean
  planeY: number
}

function SceneContent({
  room, containers, items, settings, selectedId, onSelect, onOpenItems, hoveredId, setHoveredId, setDragging, mode, dark,
}: {
  room: Room
  containers: Container[]
  items: Item[]
  settings: Settings
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenItems: (id: string) => void
  hoveredId: string | null
  setHoveredId: (id: string | null) => void
  setDragging: (b: boolean) => void
  mode: ViewMode
  dark: boolean
}) {
  const { camera, gl } = useThree()
  const moveContainer = useStore((s) => s.moveContainer)
  const logMovement = useStore((s) => s.logMovement)
  const setDragInvalid = useStore((s) => s.setDragInvalid)

  const drag = useRef<DragState | null>(null)
  const [ghost, setGhost] = useState<{ x: number; z: number; w: number; d: number } | null>(null)

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])

  const offsetX = -M(room.width) / 2
  const offsetZ = -M(room.length) / 2

  /** Screen point → room coordinates in centimetres, on the plane y = planeY. */
  const pointToRoom = useCallback(
    (clientX: number, clientY: number, planeY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      plane.constant = -planeY
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return null
      return { x: (hit.x - offsetX) * 100, z: (hit.z - offsetZ) * 100 }
    },
    [camera, gl, plane, raycaster, hit, offsetX, offsetZ],
  )

  const endDrag = useCallback(() => {
    const d = drag.current
    drag.current = null
    setGhost(null)
    setDragInvalid(false)
    setDragging(false)
    gl.domElement.style.cursor = ''
    if (d?.moved) {
      const c = useStore.getState().containers.find((k) => k.id === d.id)
      if (c) {
        logMovement({
          type: 'relocate', name: `${c.code} ${c.name}`, qty: 0,
          toContainerId: c.id, roomId: c.roomId,
          note: `Repositioned to x ${Math.round(c.x)} cm, z ${Math.round(c.z)} cm`,
        })
      }
    }
  }, [gl, logMovement, setDragInvalid, setDragging])

  useEffect(() => {
    let raf = 0
    let pending: PointerEvent | null = null
    /* Mirror of the store flag. Re-writing an unchanged value still notifies
       every subscriber, so tracking it locally turns a per-frame store write
       into one write per actual transition. */
    let invalid = false

    const apply = () => {
      raf = 0
      const e = pending
      pending = null
      const d = drag.current
      if (!e || !d) return
      const p = pointToRoom(e.clientX, e.clientY, d.planeY)
      if (!p) return
      const ok = moveContainer(d.id, p.x - d.offX, p.z - d.offZ)
      d.moved = d.moved || ok
      if (ok) {
        if (invalid) { invalid = false; setGhost(null); setDragInvalid(false) }
      } else {
        const c = useStore.getState().containers.find((k) => k.id === d.id)
        if (c) {
          const f = footprint(c)
          const g = settings.snapEnabled ? room.grid : 0
          setGhost({ x: snap(p.x - d.offX, g), z: snap(p.z - d.offZ, g), w: f.w, d: f.d })
        }
        if (!invalid) { invalid = true; setDragInvalid(true) }
      }
    }

    /*
      Coalesce to one move per animation frame. Pointer hardware reports at
      120–1000 Hz and every raw event here used to run a raycast, a collision
      sweep and a store write — several times per painted frame, all but the
      last of them thrown away. Collapsing to the latest position per frame is
      both smoother and strictly less work.
    */
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return
      pending = e
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const onUp = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      pending = null
      invalid = false
      if (drag.current) endDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [pointToRoom, moveContainer, endDrag, setDragInvalid, room.grid, settings.snapEnabled])

  const startDrag = useCallback(
    (c: Container) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onSelect(c.id)
      if (c.locked) return
      const p = pointToRoom(e.clientX, e.clientY, M(c.y))
      if (!p) return
      drag.current = { id: c.id, offX: p.x - c.x, offZ: p.z - c.z, moved: false, planeY: M(c.y) }
      setDragging(true)
      gl.domElement.style.cursor = 'grabbing'
    },
    [pointToRoom, onSelect, setDragging, gl],
  )

  const byContainer = useMemo(() => {
    const map = new Map<string, { count: number; slots: number }>()
    for (const it of items) {
      const cur = map.get(it.containerId) ?? { count: 0, slots: 0 }
      cur.count += 1
      cur.slots += it.slots || 1
      map.set(it.containerId, cur)
    }
    return map
  }, [items])

  return (
    <group position={[offsetX, 0, offsetZ]}>
      <RoomShell room={room} settings={settings} mode={mode} dark={dark} />

      {containers.map((c) => {
        const agg = byContainer.get(c.id)
        const fill = c.capacity ? (agg?.slots ?? 0) / c.capacity : 0
        return (
          <ContainerMesh
            key={c.id}
            container={c}
            fill={fill}
            itemCount={agg?.count ?? 0}
            selected={selectedId === c.id}
            hovered={hoveredId === c.id}
            invalid={false}
            showLabel={settings.showLabels}
            showBadge={settings.showFillBadges && !CONTAINER_META[c.type].obstacle}
            onPointerDown={startDrag(c)}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredId(c.id); gl.domElement.style.cursor = c.locked ? 'not-allowed' : 'grab' }}
            onPointerOut={() => { setHoveredId(null); if (!drag.current) gl.domElement.style.cursor = '' }}
            onClick={(e) => { e.stopPropagation(); onSelect(c.id) }}
            onDoubleClick={(e) => { e.stopPropagation(); onOpenItems(c.id) }}
          />
        )
      })}

      {ghost && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[M(ghost.x), 0.02, M(ghost.z)]} raycast={NO_RAYCAST}>
          <planeGeometry args={[M(ghost.w), M(ghost.d)]} />
          <meshBasicMaterial color="#e05252" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// --------------------------------------------------------------------- root

export function Scene({
  room, containers, items, settings, selectedId, onSelect, onOpenItems, preset, mode, zoomCmd, fitTick, freeOrbit,
}: {
  room: Room
  containers: Container[]
  items: Item[]
  settings: Settings
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenItems: (id: string) => void
  preset: number
  mode: ViewMode
  zoomCmd: { n: number; dir: number }
  fitTick: number
  freeOrbit: boolean
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // Orbit is suspended while an object is being dragged so the two gestures
  // never fight over the same pointer.
  const [dragging, setDragging] = useState(false)
  const dark = settings.theme === 'dark'

  return (
    <Canvas
      className="scene-canvas"
      // `flat` disables ACES tone mapping. Filmic roll-off is exactly wrong for
      // this look: it desaturates the pastels and stops light surfaces from
      // ever reaching white, so the flat cartoon fills turn muddy grey.
      flat
      /*
        Render only when something actually changes, instead of burning a draw
        call every 16 ms on a scene that is usually sitting still. A layout
        editor is idle almost all the time, so this takes steady-state GPU and
        battery use to nothing. React commits invalidate automatically, and
        drei's OrbitControls invalidates on every 'change' event — which is what
        keeps damping settling smoothly rather than freezing mid-glide.
      */
      frameloop="demand"
      // 2× device pixels quadruples the fragment work for a flat-shaded cartoon
      // scene that gains very little from it. 1.5 keeps edges clean on HiDPI
      // without the fill-rate cost.
      dpr={[1, 1.5]}
      camera={{ fov: FOV, position: [20, 18, 20], near: 0.1, far: 8000 }}
      // Belt and braces alongside NO_RAYCAST: the default 1-unit line threshold
      // means one metre in this scene, which would let any stray line steal
      // clicks from a neighbouring object.
      raycaster={{ params: { Line: { threshold: 0.02 }, Points: { threshold: 0.02 } } as THREE.RaycasterParameters }}
      onPointerMissed={() => onSelect(null)}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[dark ? PAPER.dark : PAPER.light]} />

      {/* Total incoming light is kept near 1.0: MeshToonMaterial multiplies the
          base colour, so anything brighter washes the pastels out to white. The
          gradient map already keeps shadowed faces light, so the ambient term
          only needs to lift the darkest band. */}
      <ambientLight intensity={dark ? 0.7 : 1.15} />
      <directionalLight position={[14, 26, 18]} intensity={dark ? 1.0 : 1.7} />
      <directionalLight position={[-18, 12, -10]} intensity={dark ? 0.2 : 0.34} />

      <CameraRig room={room} preset={preset} mode={mode} enabled={!dragging} fitTick={fitTick} freeOrbit={freeOrbit} />
      <ZoomBridge cmd={zoomCmd} />

      <SceneContent
        room={room}
        containers={containers}
        items={items}
        settings={settings}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpenItems={onOpenItems}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        setDragging={setDragging}
        mode={mode}
        dark={dark}
      />
    </Canvas>
  )
}
