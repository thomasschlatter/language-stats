import React, { useRef, useState } from "react";
import styled from "styled-components";
import { useAppSelector } from "../hooks";
import phaserGame from "../PhaserGame";
import { loadQuiz } from "../game/quiz";

// A lightweight cooperative task shown at the top of the world: everyone in the
// room chips correct word answers toward a shared goal. Tapping the banner opens
// a quick one-word challenge; a correct answer sends a point to the room.
const Wrapper = styled.div`
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
`;

const Banner = styled.button`
  pointer-events: auto;
  background: #222639e6;
  color: #eee;
  border: 1px solid #3a3f66;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px #00000055;
  &:hover { border-color: #33ac96; }
`;

const Popup = styled.div`
  pointer-events: auto;
  background: #222639;
  border: 1px solid #3a3f66;
  border-radius: 12px;
  padding: 16px 18px;
  min-width: 260px;
  max-width: 92vw;
  text-align: center;
  box-shadow: 0 6px 20px #00000066;

  .word { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 12px; }
  .fb { font-size: 18px; color: #ffd479; padding: 6px 0; }
  .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .choices button {
    background: #2c3f66; color: #fff; border: 1px solid #4a5f8f;
    border-radius: 8px; padding: 10px 8px; font-size: 15px; cursor: pointer;
  }
  .choices button:hover { background: #35507e; }
`;

type Q = { id?: number; front: string; answer: string; choices: string[] };

export default function TeamTask() {
  const score = useAppSelector((s) => s.room.teamScore);
  const goal = useAppSelector((s) => s.room.teamGoal);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState<Q | null>(null);
  const [feedback, setFeedback] = useState("");
  const queue = useRef<Q[]>([]);
  const lang = useRef("de-DE");

  async function ensureQueue() {
    if (queue.current.length) return;
    try {
      const me = await fetch("/api/auth/me", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null));
      const learning = me?.user?.learning;
      if (learning && learning.length) lang.current = learning[0];
      const { items } = await loadQuiz(lang.current, 6);
      queue.current = items;
    } catch { /* leave queue empty */ }
  }

  async function openChallenge() {
    setFeedback("");
    await ensureQueue();
    const next = queue.current.shift();
    if (!next) {
      setQ(null);
      setFeedback("Add cards to a deck for your language to play.");
      setOpen(true);
      window.setTimeout(() => setOpen(false), 1800);
      return;
    }
    setQ(next);
    setOpen(true);
  }

  function answer(choice: string) {
    if (!q) return;
    const correct = choice === q.answer;
    // Also advance the player's real SRS schedule, like the solo games.
    if (q.id != null) {
      fetch("/api/flashcards/review", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: q.id, rating: correct ? 3 : 1 }),
      }).catch(() => { /* still counts toward the team even if sync fails */ });
    }
    if (correct) {
      (phaserGame.scene.keys.game as any)?.network?.sendScorePoint();
      setFeedback("✅  +1 for the team!");
    } else {
      setFeedback(`❌  It was: ${q.answer}`);
    }
    setQ(null);
    window.setTimeout(() => setOpen(false), 1100);
  }

  return (
    <Wrapper>
      <Banner onClick={openChallenge}>🤝 Team goal {score}/{goal} · answer a word</Banner>
      {open && (
        <Popup>
          {q ? (
            <>
              <div className="word">{q.front}</div>
              <div className="choices">
                {q.choices.map((c, i) => (
                  <button key={i} onClick={() => answer(c)}>{c}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="fb">{feedback}</div>
          )}
        </Popup>
      )}
    </Wrapper>
  );
}
