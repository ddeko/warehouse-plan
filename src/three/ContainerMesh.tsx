import { memo, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { Container } from '../types'
import { CONTAINER_META } from '../types'
import { TextSprite } from './TextSprite'
import { buildParts } from '../lib/parts'
import {
  INK, INK_INVALID, INK_SELECTED, NO_RAYCAST, OUTLINE, UNIT_BOX, UNIT_BOX_EDGES, UNIT_CYL, UNIT_CYL_EDGES,
  deepen, lineMaterial, outlineMaterial, tint, toonMaterial,
} from './toon'

const M = (cm: number) => cm / 100

export interface ContainerVisual {
  container: Container
  fill: number
  itemCount: number
  selected: boolean
  hovered: boolean
  invalid: boolean
  showLabel: boolean
  showBadge: boolean
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void
  onClick: (e: ThreeEvent<MouseEvent>) => void
  onDoubleClick: (e: ThreeEvent<MouseEvent>) => void
}

export const ContainerMesh = memo(function ContainerMesh({
  container: c, fill, itemCount, selected, hovered, invalid, showLabel, showBadge,
  onPointerDown, onPointerOver, onPointerOut, onClick, onDoubleClick,
}: ContainerVisual) {
  const meta = CONTAINER_META[c.type]
  const w = M(c.w)
  const h = M(c.h)
  const d = M(c.d)

  const inkColor = invalid ? INK_INVALID : selected ? INK_SELECTED : INK
  const parts = useMemo(() => buildParts(c, fill), [c, fill])

  const mats = useMemo(() => {
    const base = hovered && !selected ? tint(c.color, 0.18) : c.color
    return {
      body: toonMaterial(base),
      trim: toonMaterial(deepen(base, 0.1)),
      goods: toonMaterial('#e9edf5'),
      glass: toonMaterial('#cfd8e6'),
      outline: outlineMaterial(inkColor),
      line: lineMaterial(inkColor),
    }
  }, [c.color, hovered, selected, inkColor])

  const badge = itemCount > 0 ? `${itemCount} Â· ${Math.round(fill * 100)}%` : ''

  return (
    <group
      position={[M(c.x), M(c.y), M(c.z)]}
      rotation={[0, (-c.rotation * Math.PI) / 180, 0]}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {parts.map((part, i) => {
        const geo = part.round ? UNIT_CYL : UNIT_BOX
        const edges = part.round ? UNIT_CYL_EDGES : UNIT_BOX_EDGES
        const mat = mats[part.tone ?? 'body']
        // The shell grows by a fixed thickness on every side, so the outline
        // keeps the same visual weight whatever the part's proportions are.
        const shell: [number, number, number] = [
          part.s[0] + OUTLINE * 2,
          part.s[1] + OUTLINE * 2,
          part.s[2] + OUTLINE * 2,
        ]
        return (
          <group key={i} position={part.p}>
            {part.outline !== false && (
              <mesh geometry={geo} material={mats.outline} scale={shell} renderOrder={-1} raycast={NO_RAYCAST} />
            )}
            <mesh geometry={geo} material={mat} scale={part.s} raycast={NO_RAYCAST} />
            <lineSegments geometry={edges} material={mats.line} scale={part.s} raycast={NO_RAYCAST} />
          </group>
        )
      })}

      {/*
        The one and only pick target: a hull matching the object's true extent.
        Rendered with a fully transparent material rather than `visible={false}`
        so it is unambiguously raycastable, and it keeps open-work objects like
        racks and cages easy to grab without clicking exactly on a post.
      */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -M(c.y) + 0.014, 0]} raycast={NO_RAYCAST}>
          <planeGeometry args={[w + 0.16, d + 0.16]} />
          <meshBasicMaterial color={INK_SELECTED} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}

      {showLabel && (
        <TextSprite
          text={selected ? `${c.code} Â· ${c.name}` : c.code}
          position={[0, h + 0.12, 0]}
          lift={showBadge && badge ? 1.15 : 0}
          px={selected ? 17 : 14}
          bold={selected}
          color={selected ? '#ffffff' : '#3a4459'}
          background={selected ? 'rgba(59,99,240,0.96)' : 'rgba(255,255,255,0.95)'}
          border={selected ? 'none' : 'rgba(58,68,89,0.28)'}
          renderOrder={selected ? 12 : 10}
        />
      )}

      {showBadge && badge && !meta.obstacle && (
        <TextSprite
          text={badge}
          position={[0, h + 0.12, 0]}
          lift={0}
          px={12}
          bold
          color="#3a4459"
          background={fill > 1 ? 'rgba(255,184,184,0.98)' : fill > 0.85 ? 'rgba(255,224,163,0.98)' : 'rgba(159,224,205,0.98)'}
          border="rgba(58,68,89,0.24)"
        />
      )}
    </group>
  )
})
