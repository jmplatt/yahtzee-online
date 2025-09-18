import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io();

export default function YahtzeeGame() {
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [dice, setDice] = useState([]);
  const [hoverScore, setHoverScore] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const numbers = ["aces","twos","threes","fours","fives","sixes"];
  const specials = ["threeKind","fourKind","fullHouse","shortStraight","longStraight","yahtzee","chance"];

  useEffect(() => {
    socket.on("game-updated", (state) => {
      setGameState(state);
      setDice(state.dice);
      setSelectedCategory(null); // reset selection after update
    });

    return () => {
      socket.off("game-updated");
    };
  }, []);

  const handleCreate = () => {
    socket.emit("create-game", { name }, (res) => {
      if (res.ok) {
        setGameId(res.gameId);
        setGameState(res.state);
        setJoined(true);
      }
    });
  };

  const handleJoin = () => {
    socket.emit("join-game", { gameId, name }, (res) => {
      if (res.ok) {
        setGameState(res.state);
        setJoined(true);
      } else {
        alert(res.error);
      }
    });
  };

  const handleRoll = () => {
    socket.emit("roll-dice", { gameId }, (res) => {
      if (!res.ok) alert(res.error || "Roll failed");
    });
  };

  const handleHold = (index) => {
    if (!isMyTurn) return;
    socket.emit("toggle-hold", { gameId, index });
  };

  const handleSubmitScore = () => {
    if (!selectedCategory) return;
    socket.emit("choose-score", { gameId, category: selectedCategory }, (res) => {
      if (!res.ok) alert(res.error || "Score failed");
      setSelectedCategory(null);
    });
  };

  if (!joined) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginRight: "1rem" }}
        />
        <button onClick={handleCreate}>Create Game</button>
        <br /><br />
        <input
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          style={{ marginRight: "1rem" }}
        />
        <button onClick={handleJoin}>Join Game</button>
      </div>
    );
  }

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const me = gameState?.players.find((p) => p.socketId === socket.id);
  const isMyTurn = currentPlayer?.socketId === socket.id;

  const computeHoverScore = (category) => {
    if (!dice) return 0;
    // replicate your scoring logic
    const counts = Array(7).fill(0);
    dice.forEach(d => counts[d]++);
    const total = dice.reduce((a,b)=>a+b,0);

    switch(category){
      case 'aces': return counts[1];
      case 'twos': return counts[2]*2;
      case 'threes': return counts[3]*3;
      case 'fours': return counts[4]*4;
      case 'fives': return counts[5]*5;
      case 'sixes': return counts[6]*6;
      case 'threeKind': return Object.values(counts).some(c=>c>=3)?total:0;
      case 'fourKind': return Object.values(counts).some(c=>c>=4)?total:0;
      case 'fullHouse': return (Object.values(counts).some(c=>c===3) && Object.values(counts).some(c=>c===2))?25:0;
      case 'shortStraight': {
        const set = new Set(dice);
        const seqs = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
        return seqs.some(seq=>seq.every(n=>set.has(n)))?30:0;
      }
      case 'longStraight': {
        const set = new Set(dice);
        return ([1,2,3,4,5].every(n=>set.has(n)) || [2,3,4,5,6].every(n=>set.has(n)))?40:0;
      }
      case 'yahtzee': return Object.values(counts).some(c=>c===5)?50:0;
      case 'chance': return total;
      default: return 0;
    }
  };

  const renderCategoryButton = (cat) => (
    <div
      key={cat}
      style={{
        padding: "8px",
        margin: "5px 0",
        cursor: isMyTurn && me?.scores?.[cat] === undefined ? "pointer" : "not-allowed",
        backgroundColor: selectedCategory===cat ? "#ffeb99" : "#ffffff",
        borderRadius: "5px",
        border: "1px solid #333",
        position: "relative"
      }}
      onClick={() => isMyTurn && me?.scores?.[cat] === undefined && setSelectedCategory(cat)}
      onMouseEnter={() => setHoverScore(computeHoverScore(cat))}
      onMouseLeave={() => setHoverScore(null)}
    >
      {cat} {hoverScore && selectedCategory !== cat && me?.scores?.[cat]===undefined ? `(${computeHoverScore(cat)})` : ""}
    </div>
  );

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", backgroundColor: "#D1FFBD" }}>
      <h2>Game: {gameId}</h2>

      {gameState && (
        <>
          <p>Status: {gameState.status}</p>
          {gameState.status !== "finished" && (
            <p>Current Turn: <strong>{currentPlayer?.name}</strong></p>
          )}
          {gameState.status === "finished" && (
            <div style={{ fontSize: "1.5rem", color: "green", marginBottom: "1rem" }}>
              🎉 Game Over! Winner:{" "}
              {gameState.winners.length > 1
                ? gameState.winners.join(" & ") + " (tie!)"
                : gameState.winners[0]}
            </div>
          )}

          <div style={{ fontSize: "2rem", margin: "20px 0" }}>
            {dice.map((d, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 10px",
                  width: "50px",
                  height: "50px",
                  lineHeight: "50px",
                  textAlign: "center",
                  fontSize: "1.5rem",
                  backgroundColor: gameState.holds[i] ? "#90D5FF" : "#fff",
                  borderRadius: "10px",
                  border: "2px solid #333",
                  cursor: isMyTurn ? "pointer" : "default",
                  transition: "all 0.3s",
                  transform: "rotate(0deg)",
                }}
                onClick={() => handleHold(i)}
              >
                🎲 {d}
              </span>
            ))}
          </div>

          <button onClick={handleRoll} disabled={!isMyTurn || gameState.rollsLeft <= 0}>
            Roll Dice ({gameState.rollsLeft} left)
          </button>

          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", marginTop: "2rem" }}>
            {/* Numbers Column */}
            <div style={{ backgroundColor: "#90D5FF", padding: "1rem", borderRadius: "10px", minWidth: "140px" }}>
              <h3 style={{ textAlign: "center" }}>Numbers</h3>
              {numbers.map(renderCategoryButton)}
            </div>
            {/* Specials Column */}
            <div style={{ backgroundColor: "#D1FFBD", padding: "1rem", borderRadius: "10px", minWidth: "160px" }}>
              <h3 style={{ textAlign: "center" }}>Specials</h3>
              {specials.map(renderCategoryButton)}
            </div>
          </div>

          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button
              onClick={handleSubmitScore}
              disabled={!selectedCategory}
              style={{ padding: "10px 20px", marginTop: "1rem", fontSize: "1rem", cursor: "pointer" }}
            >
              Submit Score
            </button>
          </div>

          <h3>Score Tally</h3>
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}>
            {gameState.players.map(p => (
              <div key={p.socketId} style={{ padding: "1rem", border: "2px solid #333", borderRadius: "10px", minWidth: "120px", backgroundColor: "#ffffff" }}>
                <h4>{p.name}</h4>
                <p>Total Score: {p.total}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
