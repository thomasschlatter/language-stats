# Level Creator — TODO (features to build)

(Parked *decisions* live in RECONSIDER.md; this is *work to do*.)

## Editor tools
- **Move tool** (next to Eraser). A mode to reposition an already-placed item: click to pick it up,
  drag/click to drop it at a new cell (snap + same placement rules — bounds, no-stacking, road-only
  for vehicles). Keeps the item's id and interactions. (user, 2026-07-18)

## Vehicles
- **Direction-aware lane placement.** Vehicle road-placement works, but a vehicle facing one way
  should only go on its matching lane (drive-on-the-left: eastbound on the near lane, westbound on
  the far lane), and flipping direction (X) should switch which lane is valid. Today `canPlace`
  only checks "on a road tile" regardless of facing. Needs the ground/road model to know lane rows
  + a per-facing valid-lane check. (user, 2026-07-18)

- **Vehicles must actually move + animate** (in the played room, phase 2). A placed vehicle should
  drive along its lane and play its drive animation — not sit static. The world already animates
  city traffic (`world/client/src/.../ambientLife.ts` `addCityTraffic` drives car spritesheets), so
  reuse that: the exported entity carries `kind:"vehicle"`, `dir`, `moves:true`, `stopsForPlayer` —
  the world spawns it as a moving animated agent that stops at red lights (see traffic-light TODO).
  (user, 2026-07-18)

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
