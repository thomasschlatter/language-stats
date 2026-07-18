# RECONSIDER — level-creator decisions parked for later

Deliberately-simple choices in `create-level.html` to revisit once the core is proven. None are
bugs; each is a "good enough for now, might want more later" call the user made explicitly.

- **One collidable per cell (no stacking).** The editor forbids placing a second colliding object
  on a cell another collidable already occupies — stops "a thousand lamps on one tile." Walk-behind
  (Over) and Ground tiles may still overlap freely. RECONSIDER: some real scenes want intentional
  stacking (a crate on a table, a sign on a wall). May relax to "warn, don't block," or allow
  stacking only for specific kinds. (user, 2026-07-18)

- **Interactions are FIXED per object type.** Sittable/takeable/breakable/etc. come from the
  classification pass (manifest) or category default and are display-only in the editor — not
  per-instance editable. RECONSIDER: let the user override interactions per placed instance, so e.g.
  a specific house becomes liftable/takeable for a special scene. The `entities` export already
  carries per-instance rows, so this is a UI addition, not a data change. (user, 2026-07-18)

- **Map size is FIXED at 40×30.** No resize control. RECONSIDER: variable map size once the tool is
  proven — but the game's maps are all 40×30, and end users shouldn't pick arbitrary sizes, so it's
  locked for now. (user, 2026-07-18)

- **No user asset loading — bundle only.** The "+ PNG / + JSON" load buttons and drag-drop were
  removed: this ships on the Groupifier site for end users, who must not swap tilesets or hand-edit
  maps. Assets come only from the generated `editor-assets.js`. RECONSIDER: a curated set of
  additional bundled tilesets (interiors, other themes) — added by re-running the bundler, never by
  user upload. (user, 2026-07-18)

- **Layer + tall-object split are always automatic.** No manual layer override in the UI. The
  auto-rule: terrain→Ground, buildings→Walls (whole), aircon→Over, other props→bottom row on
  Furniture + rest on Over (walk-behind). RECONSIDER: expose a manual override for edge cases the
  heuristic gets wrong (until the manifest carries correct `layer`/`solid` for everything). (user, 2026-07-18)
