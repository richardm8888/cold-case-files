import React, { useEffect, useState } from 'react'
import { ColdCaseGame } from './engine/game'
import { ClueType } from './engine/models'

// Minimal single-player demo wired to the engine. Uses deterministic seed for reproducible startup.
export default function App() {
  const [game, setGame] = useState<ColdCaseGame | null>(null)
  const [playerId] = useState('player1')
  const [message, setMessage] = useState<string | null>(null)
  const [, forceRerender] = useState(0)

  useEffect(() => {
    // build decks
    const namesByType: Record<ClueType, string[]> = {
      Evidence: [
        'Bloody Knife','Fingerprint','Blood Sample','Torn Fabric','Gun','Fiber','Strange Residue','Notebook'
      ],
      Suspect: [
        'Mr. Gray','Ms. Blue','Dr. Green','Officer Black','Ms. White','Mr. Gold','Mr. Red','Ms. Violet'
      ],
      Location: [
        'Docks','Warehouse','Alley','Mansion','Park','Train Station','Bar','Factory'
      ]
    }

    // lazy import of models util function
    // create clue deck via engine static
    // create some case cards (simple examples)
    import('./engine/models').then((models) => {
      const clueDeck = (ColdCaseGame as any).createClueDeck(namesByType)

      // simple case deck examples - mixed Any and Specific
      const caseDeck = [
        { id: 'case-1', requirements: [{ kind: 'Any', type: ClueType.Evidence }, { kind: 'Any', type: ClueType.Location }] },
        { id: 'case-2', requirements: [{ kind: 'Specific', type: ClueType.Evidence, name: 'Bloody Knife' }, { kind: 'Any', type: ClueType.Suspect }] },
        { id: 'case-3', requirements: [{ kind: 'Any', type: ClueType.Location }, { kind: 'Any', type: ClueType.Suspect }, { kind: 'Any', type: ClueType.Evidence }] }
      ]

      const g = new ColdCaseGame('game-1', [playerId], clueDeck, caseDeck as any)
      g.setup(() => 0.42) // seeded-ish RNG
      setGame(g)
    })
  }, [playerId])

  if (!game) return <div className="container">Loading...</div>

  const state = game.serialize()
  const player = state.players.find((p) => p.id === playerId)!

  function refresh() { forceRerender((n) => n + 1) }

  async function onDraw() {
    try {
      const card = (game.drawClue as any)(playerId)
      setMessage(`Drew: ${card.type} - ${card.name} (bank ${card.bankValue})`)
      // After draw, engine expects endTurnAfterDraw() if player doesn't solve
      refresh()
    } catch (err: any) {
      if (String(err).includes('HAND_OVERAGE')) {
        setMessage('Hand overage: please resolve by banking or discarding a card via UI (not implemented in demo).')
      } else {
        setMessage(String(err))
      }
    }
  }

  function onBank(index: number) {
    try {
      game.bankClue(playerId, index)
      setMessage('Banked card')
      refresh()
    } catch (err: any) {
      setMessage(String(err))
    }
  }

  function onSolve(caseId: string) {
    // naive: try to match requirements by selecting first matching indices
    const face = state.faceUpCases.find((c) => c.id === caseId)!
    const usedIndices: number[] = []
    const hand = player.hand
    const reqs = face.requirements.slice()

    // match specific first
    for (let i = reqs.length - 1; i >= 0; i--) {
      const r = reqs[i]
      if (r.kind === 'Specific') {
        const idx = hand.findIndex((h) => h.type === r.type && h.name === r.name && !usedIndices.includes(hand.indexOf(h)))
        if (idx === -1) { setMessage('Cannot solve: missing specific requirement'); return }
        usedIndices.push(idx)
        reqs.splice(i,1)
      }
    }
    for (const r of reqs) {
      const idx = hand.findIndex((h) => h.type === r.type && !usedIndices.includes(hand.indexOf(h)))
      if (idx === -1) { setMessage('Cannot solve: missing any requirement'); return }
      usedIndices.push(idx)
    }

    try {
      game.solveCase(playerId, caseId, usedIndices)
      setMessage('Solved case')
      refresh()
    } catch (err:any) {
      setMessage(String(err))
    }
  }

  return (
    <div className="container">
      <h1>Cold Case Files — Demo</h1>
      <div className="section">
        <h2>Face-up Cases</h2>
        <div className="cases">
          {state.faceUpCases.map((c) => (
            <div key={c.id} className="card">
              <div><strong>{c.id}</strong></div>
              <div>Points: {(c.requirements || []).reduce((s:any,r:any)=>s + (r.kind === 'Any' ? 2 : 5),0)}</div>
              <ul>
                {c.requirements.map((r:any, i:number) => (
                  <li key={i}>{r.kind === 'Any' ? `Any ${r.type}` : `${r.type}: ${r.name}`}</li>
                ))}
              </ul>
              <button onClick={() => onSolve(c.id)}>Solve (auto-select)</button>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Your Hand ({player.hand.length})</h2>
        <div className="hand">
          {player.hand.map((c, i) => (
            <div key={c.id} className="card small">
              <div>{c.type}</div>
              <div>{c.name}</div>
              <div>Bank: {c.bankValue}</div>
              <button onClick={() => onBank(i)}>Bank</button>
            </div>
          ))}
        </div>
        <div className="actions">
          <button onClick={onDraw}>Draw</button>
        </div>
      </div>

      <div className="section">
        <h2>Public</h2>
        <div>Discard pile: {state.discardPile.length}</div>
        <div>Score: {player.score}</div>
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  )
}