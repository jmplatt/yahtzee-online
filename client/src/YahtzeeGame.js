import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io();

export default function YahtzeeGame() {
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [dice, setDice] = useState([]);

  useEffect(() => {
    socket.on("game-updated", (state) => {
      setGameState(state);
      setDice(state.dice);
    });

    return () => socket.off("game-updated");
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
      } else alert(res.error);
    });
  };

  const handleRoll = () => {
    socket.emit("roll-dice", { gameId }, (res) => {
      if (!res.ok) alert(res.error || "Roll failed");
    });
  };

  const handleHold = (index) => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.socketId !== socket.id) return;
    socket.emit("toggle-hold", { gameId, index });
  };

  const handleScore = (category) => {
    socket.emit("choose-score", { gameId, category }, (res) => {
      if (!res.ok) alert(res.error || "Score failed");
    });
  };

  if (!joined) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={handleCreate} style={{ marginLeft: "10px" }}>Create Game</button>
        <br /><br />
        <input placeholder="Game ID" value={gameId} onChange={(e) => setGameId(e.target.value)} />
        <button onClick={handleJoin} style={{ marginLeft: "10px" }}>Join Game</button>
      </div>
    );
  }

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const me = gameState?.players.find((p) => p.socketId === socket.id);
  const isMyTurn = currentPlayer?.socketId === socket.id;

  const numbers = ["aces", "twos", "threes", "fours", "fives", "sixes"];
  const specials = ["threeKind","fourKind","fullHouse","shortStraight","longStraight","yahtzee","chance"];

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", backgroundColor: "#fefefe", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center", color: "#333" }}>Yahtzee Game: {gameId}</h2>
      <p style={{ textAlign: "center", color: "#555" }}>Status: <strong>{gameState.status}</strong></p>
      {gameState.status !== "finished" && (
        <p style={{ textAlign: "center" }}>Current Turn: <strong>{currentPlayer?.name}</strong></p>
      )}
      {gameState.status === "finished" && (
        <div style={{ fontSize: "1.5rem", color: "green", textAlign: "center", margin: "1rem 0" }}>
          🎉 Game Over! Winner:{" "}
          {gameState.winners.length > 1
            ? gameState.winners.join(" & ") + " (tie!)"
            : gameState.winners[0]}
        </div>
      )}

      {/* Dice */}
      <div style={{ fontSize: "2rem", textAlign: "center", margin: "1rem 0" }}>
        {dice.map((d, i) => (
          <span
            key={i}
            style={{
              margin: "0 10px",
              cursor: isMyTurn ? "pointer" : "default",
              opacity: gameState.holds[i] ? 0.5 : 1,
              transition: "transform 0.2s",
              display: "inline-block",
              padding: "10px",
              border: "2px solid #ddd",
              borderRadius: "8px",
              backgroundColor: "#f0f0f0",
            }}
            onClick={() => handleHold(i)}
          >
            🎲 {d}
          </span>
        ))}
      </div>

      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <button
          onClick={handleRoll}
          disabled={!isMyTurn || gameState.rollsLeft <= 0}
          style={{
            padding: "10px 20px",
            fontSize: "1rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: isMyTurn ? "#4CAF50" : "#ccc",
            color: "#fff",
            cursor: isMyTurn ? "pointer" : "not-allowed",
            transition: "background-color 0.3s"
          }}
        >
          Roll Dice ({gameState.rollsLeft} left)
        </button>
      </div>

      {/* Two-column Scoreboard */}
      <div style={{ display: "flex", justifyContent: "center", gap: "3rem", marginTop: "2rem" }}>
        {/* Column 1 */}
        <div style={{ backgroundColor: "#f0f8ff", padding: "1rem", borderRadius: "10px", minWidth: "140px" }}>
          <h3 style={{ textAlign: "center", color: "#333" }}>Numbers</h3>
          {numbers.map((cat) => (
            <div
              key={cat}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 10px",
                margin: "4px 0",
                borderRadius: "6px",
                backgroundColor: me?.scores?.[cat] !== undefined ? "#d1ffd6" : "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                cursor: me?.scores?.[cat] === undefined && isMyTurn ? "pointer" : "default",
                transition: "background-color 0.2s",
              }}
              onClick={() => isMyTurn && handleScore(cat)}
            >
              <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
              <span>{me?.scores?.[cat] ?? "-"}</span>
            </div>
          ))}
        </div>

        {/* Column 2 */}
        <div style={{ backgroundColor: "#fff0f5", padding: "1rem", borderRadius: "10px", minWidth: "160px" }}>
          <h3 style={{ textAlign: "center", color: "#333" }}>Specials</h3>
          {specials.map((cat) => (
            <div
              key={cat}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 10px",
                margin: "4px 0",
                borderRadius: "6px",
                backgroundColor: me?.scores?.[cat] !== undefined ? "#d1ffd6" : "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                cursor: me?.scores?.[cat] === undefined && isMyTurn ? "pointer" : "default",
                transition: "background-color 0.2s",
              }}
              onClick={() => isMyTurn && handleScore(cat)}
            >
              <span>{cat}</span>
              <span>{me?.scores?.[cat] ?? "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
