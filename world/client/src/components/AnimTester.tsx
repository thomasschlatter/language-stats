import { useState } from 'react'
import styled from 'styled-components'
import phaserGame from '../PhaserGame'
import { TEST_ROWS } from '../anims/testAnims'

// Dev/QA overlay: one button per animation row of the full body sheet. Clicking
// plays that row's `test_` animation on a big sprite above the player so we can
// verify each animation (idle/walk/shoot/…) renders correctly, then wire the
// good ones into real gameplay. Collapsible so it stays out of the way.
const Panel = styled.div`
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 70;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  border-radius: 10px;
  padding: 8px;
  font-size: 12px;
  max-width: 190px;
  user-select: none;

  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  button {
    background: #2b6cb0;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 4px;
    font-size: 11px;
    cursor: pointer;
  }
  button:hover {
    background: #3182ce;
  }
  .stop {
    grid-column: 1 / -1;
    background: #718096;
  }
`

function callScene(method: string, ...args: any[]) {
  for (const scene of phaserGame.scene.getScenes(true)) {
    const fn = (scene as any)[method]
    if (typeof fn === 'function') {
      fn.apply(scene, args)
      return
    }
  }
}

export default function AnimTester() {
  const [open, setOpen] = useState(true)
  return (
    <Panel>
      <div className="head" onClick={() => setOpen((o) => !o)}>
        <span>🎬 Animations</span>
        <span>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="grid">
          {TEST_ROWS.map((r) => (
            <button key={r.name} onClick={() => callScene('playTestAnim', r.name)}>
              {r.label}
            </button>
          ))}
          <button className="stop" onClick={() => callScene('stopTestAnim')}>
            ✕ hide
          </button>
        </div>
      )}
    </Panel>
  )
}
