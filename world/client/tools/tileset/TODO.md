# Level Creator — TODO (features to build)

(Parked *decisions* live in RECONSIDER.md; this is *work to do*.)

## Editor tools
- **Move tool** (next to Eraser). A mode to reposition an already-placed item: click to pick it up,
  drag/click to drop it at a new cell (snap + same placement rules — bounds, no-stacking, road-only
  for vehicles). Keeps the item's id and interactions. (user, 2026-07-18)

## Vehicles
- **Direction-aware lane placement.** BLOCKED by assets, documented 2026-07-18: the only vehicles
  are trash trucks; the horizontal (`_left`/`_right`) ones are 8×5 = **5 tiles tall**, and the
  City-street road is only 5 asphalt rows — so a truck fills the WHOLE road, leaving no lane to
  assign per facing. Lanes need EITHER narrower vehicle sprites (1-2 tall) OR a wider road (≥2 rows
  per lane + a divider). Also: facing is baked into the sprite (`truck_left` vs `truck_right`), not
  from the flip flag — so a `facing` field on vehicle objects (set from the name in classification)
  is needed, not the exported `dir`. Revisit when better/narrower vehicle art is added. (user request
  2026-07-18; deferred with evidence.)

- **Vehicles must actually move + animate** (in the played room, phase 2). A placed vehicle should
  drive along its lane and play its drive animation — not sit static. The world already animates
  city traffic (`world/client/src/.../ambientLife.ts` `addCityTraffic` drives car spritesheets), so
  reuse that: the exported entity carries `kind:"vehicle"`, `dir`, `moves:true`, `stopsForPlayer` —
  the world spawns it as a moving animated agent that stops at red lights (see traffic-light TODO).
  (user, 2026-07-18)

- **Big vehicles need more collision rows.** Large vehicles (trucks) need at least one extra row of
  collideables on top of their base — a single bottom-row footprint is too thin for a tall truck, the
  player clips into it. When vehicle collision is implemented in the played room, scale the solid-row
  count with the sprite's size (e.g. bottom 2-3 rows for an 8×5 truck). (user, 2026-07-18)

## Smart / composite objects (collapse animation-frame pieces into ONE functional object)
- **Traffic light.** Singles like `traffic_light_new_front_diagonal_left_up_orange` are *frames/pieces*
  of one object, not separate objects — this is the Street-tab bloat (~168 near-identical faces). Give
  the user ONE traffic-light object that: (a) **cycles** green→orange→red→green over time (animated),
  and (b) **stops cars** (vehicles) that face it when red. Needs: pick the correct per-direction
  frame set from the singles, an animation spec in the entity, and a game-side rule linking a red
  light to vehicle stop. Same pattern will apply to other animated multi-frame props (doors, signs).
  (user, 2026-07-18)
  - Related: this justifies a `kind:"traffic_light"` (like `kind:"vehicle"`) with frame + timing data
    in the exported `entities`, and a filter so the raw frames don't clutter the palette.

## Codebase hygiene
- **Fix the world-client TypeScript errors.** `world/client` build is `tsc && vite build`, but prod
  deploy runs `npx vite build` directly (esbuild, no typecheck) — so ~15 pre-existing `tsc` errors
  are silently tolerated and never caught. Files: `scenes/LobbyScene.ts`, `scenes/Practice.ts`
  (null-checks on tilemap layers), `stores/ComputerStore.ts` + `web/WebRTC.ts` (`Peer` used as
  namespace not type), `web/ShareScreenManager.ts` (`Error.type`). Clean them so `tsc` passes and
  `npm run build` works again — restores type-safety as a guard. (user, 2026-07-18)

## Server / site integration (in progress)
- Serve the editor from the Groupifier site; per-user map storage; autosave; open a saved map as a
  playable room in the world. (Being built.)
