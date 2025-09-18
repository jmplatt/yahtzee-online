import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io();

export default function YahtzeeGame() {
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [dice, setDice] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    socket.on("game-updated", (state) => {
      setGameState(state);
      setDice(state.dice);
      setSelectedCategory(""); // reset selection on update
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

  const submitScore = () => {
    if (!selectedCategory) return;
    socket.emit("choose-score", { gameId, category: selectedCategory }, (res) => {
      if (!res.ok) alert(res.error || "Score failed");
      setSelectedCategory(""); // reset after submission
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

  // Labels for columns
  const numbers = [
    { key: "aces", label: "One" },
    { key: "twos", label: "Two" },
    { key: "threes", label: "Three" },
    { key: "fours", label: "Four" },
    { key: "fives", label: "Five" },
    { key: "sixes", label: "Six" },
  ];

  const specials = [
    { key: "threeKind", label: "X3" },
    { key: "fourKind", label: "X4" },
    { key: "fullHouse", label: "House" },
    { key: "shortStraight", label: "S" },
    { key: "longStraight", label: "L" },
    { key: "yahtzee", label: "Y" },
    { key: "chance", label: "?" },
  ];

  const renderCategoryButton = (cat) => {
    const scored = me?.scores?.[cat.key] !== undefined;
    const selected = selectedCategory === cat.key;
    return (
      <div
        key={cat.key}
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 10px",
          margin: "4px 0",
          borderRadius: "6px",
          backgroundColor: scored ? "#d1ffd6" : selected ? "#ffe680" : "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
          cursor: !scored && isMyTurn ? "pointer" : "default",
          transition: "background-color 0.2s",
        }}
        onClick={() => !scored && isMyTurn && setSelectedCategory(cat.key)}
      >
        <span>{cat.label}</span>
        <span>{me?.scores?.[cat.key] ?? "-"}</span>
      </div>
    );
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", backgroundColor: "#fefefe", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center", color: "#333" }}>Yahtzee Game: {gameId}</h2>
      <p style={{ textAlign: "center", color: "#555" }}>Status: <strong>{gameState.status}</strong></p>
      {gameState.status !== "finished" && (
        <p style={{ textAlign: "center" }}>Current Turn: <strong>{currentPlayer?.name}</strong></p>
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
          }}
        >
          Roll Dice ({gameState.rollsLeft} left)
        </button>
      </div>

      {/* Two-column Scoreboard */}
      <div style={{ display: "flex", justifyContent: "center", gap: "3rem", marginTop: "2rem" }}>
        <div style={{ backgroundColor: "#f0f8ff", padding: "1rem", borderRadius: "10px", minWidth: "140px" }}>
          <h3 style={{ textAlign: "center", color: "#333" }}>Numbers</h3>
          {numbers.map(renderCategoryButton)}
        </div>

        <div style={{ backgroundColor: "#fff0f5", padding: "1rem", borderRadius: "10px", minWidth: "160px" }}>
          <h3 style={{ textAlign: "center", color: "#333" }}>Specials</h3>
          {specials.map(renderCategoryButton)}
        </div>
      </div>

      {/* Submit button */}
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          onClick={submitScore}
          disabled={!selectedCategory}
          style={{
            padding: "10px 20px",
            fontSize: "1rem",
            borderRadius: "8px",
            border: "none",
            backgroundColor: selectedCategory ? "#007bff" : "#ccc",
            color: "#fff",
            cursor: selectedCategory ? "pointer" : "not-allowed",
          }}
        >
          Submit Choice
        </button>
      </div>
    </div>
  );
}
