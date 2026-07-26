# StoreSpace — Warehouse & Storage Management

An interactive storage/warehouse manager. Model rooms to real dimensions, place
storage objects inside them in an isometric 3D view, drag them around with grid
snapping and collision detection, and track the stock inside every container
down to barcode, lot and expiry.

Everything runs in the browser — no backend, no account. State persists to
`localStorage` and can be exported/imported as JSON.

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # production bundle in dist/
```


### Rooms
- Create rooms from width / length / height (cm, m or inches — stored in cm).
- Presets for common footprints (stock room, 24×16 m warehouse, 40 ft container…).
- Per-room snap grid, floor/wall colours, zone, temperature and humidity.
- Live floor area and volume; resizing a room pulls stray objects back inside.

### Layout editor
Two views, and only two:

- **2D** — a true-shape SVG floor plan. A rectangular room is a rectangle, and
  nothing is foreshortened. Rotates in 90° steps.
- **3D** — a three.js / react-three-fiber scene through a real perspective
  camera (45° FOV), so boxes read as solid boxes with genuine depth. All four
  walls exist; the two between the camera and the room are hidden every frame,
  so the interior is never occluded from any angle.

Both render on demand — an idle scene costs no frames — and both coalesce drag
updates to one per animation frame.

- **Drag** an object to move it; **left-drag empty space** orbits, **right-drag**
  pans, **wheel** zooms.
- Four corner camera presets, each auto-framed by fitting the room's bounding
  sphere against whichever field-of-view axis is tighter.
- **Grid snap** (per-room spacing) or free positioning.
- **Collision detection** — an object cannot overlap another or leave the room.
  A rejected position shows a red ghost footprint at the attempted spot while
  the object stays at its last valid location. Vertical overlap is considered
  too, so a wall shelf can sit above a floor unit.
- **Auto-arrange** packs everything into rows, largest first, skipping locked
  objects and obstacles.
- Keyboard: arrows nudge by one grid step (shift = ×5), `R` rotates 90°,
  `Ctrl+D` duplicates, `Delete` removes, `Esc` deselects, double-click opens the
  container's item list.
- Labels and fill badges are drawn as canvas-texture sprites pinned to a
  constant on-screen size, so they stay legible from any zoom level.

### Storage objects
19 types, each with its own geometry, defaults and behaviour: shelf, pallet
rack, pallet, stack, box, crate, cupboard, cabinet, fridge, freezer, storage
unit, bin, drum, tank, roll cage, table, workbench, plus pillar and door as
non-storage obstacles that still block placement.

Every object is fully editable via forms — size, position, elevation, rotation,
colour, levels, slot capacity, weight limit, target temperature, zone, lock.

### Inventory
Each container holds a list of stock lines. Only containers that actually hold
stock get a fill badge in the 3D view, so an empty room stays readable.

Per line: SKU, barcode, name, category, quantity, UoM, slots consumed, unit cost
and weight, reorder point, lot, serial, status (in stock / reserved /
quarantine / damaged / expired), supplier, sub-location, received and expiry
dates, tags and notes.

- Filterable, sortable inventory table across all rooms.
- Barcode search box doubles as a scanner target.
- Printable barcode label sheets (2–4 columns) via the browser print dialog.
- CSV export, CSV bulk import with a downloadable template.

### Operations
- **Movements / audit trail** — every receipt, pick, transfer, adjustment, cycle
  count, disposal and object relocation is journalled with user, reference and
  note. Manual posting dialog included.
- **Transfers** split a stock line when only part of the quantity moves.
- **Dashboard** — KPIs, room utilisation, stock status mix, top categories, and
  live alerts for low stock, expiring/expired lots and over-capacity or
  overweight containers. Every alert links straight to the object in the layout.
- **Reports** — ABC (Pareto) analysis, capacity & space, stock aging, valuation
  by category, zone density. Each exports to CSV and prints.
- **Ctrl+K** command palette searches rooms, objects, SKUs and barcodes.
- Dark and light themes; JSON backup/restore; sample warehouse dataset.

## Layout

```
src/
  types.ts              domain model + storage-object catalogue
  store.ts              zustand store (state, actions, persistence)
  lib/
    geometry.ts         footprints, collision, snapping, free-spot search
    utils.ts            units, formatting, barcode/SKU/code generation
    csv.ts              CSV read/write
    seed.ts             sample warehouse generator
  svg/
    project.ts          top-down plan projection
    PlanScene.tsx       2D floor plan, drag/pan/zoom
  three/
    Scene.tsx           canvas, camera rig, room shell, drag controller
    ContainerMesh.tsx   per-type geometry and fill visualisation
    TextSprite.tsx      screen-constant canvas labels
  components/           forms, inspector, palette, labels, UI primitives
  views/                dashboard, rooms, inventory, movements, reports, data
```

## Notes

Lengths are stored as centimetres throughout so room and object dimensions stay
exactly comparable; the display unit is a presentation concern only.
