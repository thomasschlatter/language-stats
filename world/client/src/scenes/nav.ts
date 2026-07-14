// Tile-grid A* navigation for click/tap-to-walk, so the character routes AROUND
// obstacles instead of walking straight into them. The grid is built from a
// world's colliders (see Game.buildNavGrid); this module is the pure pathfinder.

export interface NavGrid {
  walkable: boolean[][] // [row][col]
  cols: number
  rows: number
  tile: number // px per cell
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

// Nearest walkable cell to (cx, cy) via a small breadth-first ring search.
function nearestWalkable(g: NavGrid, cx: number, cy: number): { x: number; y: number } | null {
  if (g.walkable[cy]?.[cx]) return { x: cx, y: cy }
  for (let r = 1; r < Math.max(g.cols, g.rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = cx + dx
        const y = cy + dy
        if (x >= 0 && y >= 0 && x < g.cols && y < g.rows && g.walkable[y][x]) return { x, y }
      }
    }
  }
  return null
}

/**
 * A* from world pixel (sx,sy) to (gx,gy). Returns simplified pixel waypoints
 * (cell centres, collinear points dropped) or null if unreachable. Diagonal
 * moves are allowed but not through wall corners.
 */
export function findPath(
  g: NavGrid,
  sx: number,
  sy: number,
  gx: number,
  gy: number
): Array<{ x: number; y: number }> | null {
  const t = g.tile
  const toC = (v: number, n: number) => clamp(Math.floor(v / t), 0, n - 1)
  let start = { x: toC(sx, g.cols), y: toC(sy, g.rows) }
  let goalC = { x: toC(gx, g.cols), y: toC(gy, g.rows) }
  if (!g.walkable[start.y]?.[start.x]) {
    const n = nearestWalkable(g, start.x, start.y)
    if (n) start = n
  }
  if (!g.walkable[goalC.y]?.[goalC.x]) {
    const n = nearestWalkable(g, goalC.x, goalC.y)
    if (!n) return null
    goalC = n
  }
  if (start.x === goalC.x && start.y === goalC.y) return [{ x: gx, y: gy }]

  const idx = (x: number, y: number) => y * g.cols + x
  const open = new Set<number>([idx(start.x, start.y)])
  const came = new Map<number, number>()
  const gScore = new Map<number, number>([[idx(start.x, start.y), 0]])
  const h = (x: number, y: number) => Math.hypot(x - goalC.x, y - goalC.y)
  const fScore = new Map<number, number>([[idx(start.x, start.y), h(start.x, start.y)]])
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]

  let guard = g.cols * g.rows * 2
  while (open.size && guard-- > 0) {
    // lowest fScore in open
    let cur = -1
    let best = Infinity
    for (const n of open) {
      const f = fScore.get(n) ?? Infinity
      if (f < best) { best = f; cur = n }
    }
    if (cur < 0) break
    const cx = cur % g.cols
    const cy = Math.floor(cur / g.cols)
    if (cx === goalC.x && cy === goalC.y) {
      // reconstruct
      const cells: Array<{ x: number; y: number }> = []
      let c = cur
      while (c !== undefined) {
        cells.unshift({ x: c % g.cols, y: Math.floor(c / g.cols) })
        if (c === idx(start.x, start.y)) break
        c = came.get(c)!
      }
      // drop collinear points, then convert to pixel centres; keep exact goal
      const simple: Array<{ x: number; y: number }> = []
      for (let i = 0; i < cells.length; i++) {
        const a = cells[i - 1]
        const b = cells[i]
        const d = cells[i + 1]
        if (!a || !d || (d.x - b.x) * (b.y - a.y) !== (d.y - b.y) * (b.x - a.x)) simple.push(b)
      }
      const pts = simple.slice(1).map((c2) => ({ x: c2.x * t + t / 2, y: c2.y * t + t / 2 }))
      pts.push({ x: gx, y: gy })
      return pts
    }
    open.delete(cur)
    for (const [dx, dy] of dirs) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue
      if (!g.walkable[ny][nx]) continue
      if (dx !== 0 && dy !== 0) {
        // no cutting through wall corners
        if (!g.walkable[cy][nx] || !g.walkable[ny][cx]) continue
      }
      const ni = idx(nx, ny)
      const step = dx !== 0 && dy !== 0 ? 1.4142 : 1
      const tentative = (gScore.get(cur) ?? Infinity) + step
      if (tentative < (gScore.get(ni) ?? Infinity)) {
        came.set(ni, cur)
        gScore.set(ni, tentative)
        fScore.set(ni, tentative + h(nx, ny))
        open.add(ni)
      }
    }
  }
  return null
}
