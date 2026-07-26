/**
 * The four corner viewpoints, shared by both renderers.
 *
 * Deliberately free of any three.js import: the WebGL scene is lazy-loaded, so
 * anything the always-on UI needs (the viewpoint buttons) has to live somewhere
 * that doesn't drag the 3D library into the initial bundle.
 *
 * Only the horizontal component is read — the 3D rig takes the azimuth from
 * here and supplies its own elevation, and the plan view uses the index as a
 * 90° sheet rotation. The labels are just corner names; the room carries no
 * orientation data.
 */
export const CAMERA_PRESETS: { label: string; dir: [number, number, number] }[] = [
  { label: 'NE', dir: [1, 1, 1] },
  { label: 'NW', dir: [-1, 1, 1] },
  { label: 'SW', dir: [-1, 1, -1] },
  { label: 'SE', dir: [1, 1, -1] },
]
