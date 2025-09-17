import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001"); // backend URL

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
    if (gameState.players[gameState.currentPlayerIndex]?.socketId !== socket.id) return;
    socket.emit("toggle-hold", { gameId, index });
  };

  const handleScore = (category) => {
    socket.emit("choose-score", { gameId, category }, (res) => {
      if (!res.ok) alert(res.error || "Score failed");
    });
  };

  if (!joined) {
    return (
      <div style={{ padding: "2rem" }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleCreate}>Create Game</button>
        <br />
        <input
          placeholder="Game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
        <button onClick={handleJoin}>Join Game</button>
      </div>
    );
  }

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const me = gameState?.players.find((p) => p.socketId === socket.id);
  const isMyTurn = currentPlayer?.socketId === socket.id;

  // Dynamic background based on turn
  const backgroundColor = currentPlayer
    ? currentPlayer === gameState.players[0]
      ? "#9OD5FF" // Player 1's turn
      : "#CFFDBC" // Player 2's turn
    : "#ffffff";

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", backgroundColor }}>
      <h2>Game: {gameId}</h2>

      {gameState && (
        <>
          <p>Status: {gameState.status}</p>
          {gameState.status !== "finished" && (
            <p>
              Current Turn: <strong>{currentPlayer?.name}</strong>
            </p>
          )}
          {gameState.status === "finished" && (
            <div style={{ fontSize: "1.5rem", color: "green", marginBottom: "1rem" }}>
              🎉 Game Over! Winner:{" "}
              {gameState.winners.length > 1
                ? gameState.winners.join(" & ") + " (tie!)"
                : gameState.winners[0]}
            </div>
          )}

          <p>
            Players:{" "}
            {gameState.players.map((p) => (
              <span
                key={p.socketId}
                style={{
                  fontWeight: currentPlayer?.socketId === p.socketId ? "bold" : "normal",
                  marginRight: "1rem",
                }}
              >
                {p.name} ({p.total})
              </span>
            ))}
          </p>

          <div style={{ fontSize: "2rem" }}>
            {dice.map((d, i) => (
              <span
                key={i}
                style={{
                  margin: "0 10px",
                  cursor: isMyTurn ? "pointer" : "default",
                  opacity: gameState.holds[i] ? 0.5 : 1,
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

          <h3>Scoreboard</h3>
          <table border="1" cellPadding="5">
            <thead>
              <tr>
                <th>Player</th>
                {[
                  "aces","twos","threes","fours","fives","sixes",
                  "threeKind","fourKind","fullHouse","shortStraight",
                  "longStraight","yahtzee","chance"
                ].map((cat) => (
                  <th key={cat}>{cat}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {gameState.players.map((p) => (
                <tr key={p.socketId}>
                  <td>{p.name}</td>
                  {[
                    "aces","twos","threes","fours","fives","sixes",
                    "threeKind","fourKind","fullHouse","shortStraight",
                    "longStraight","yahtzee","chance"
                  ].map((cat) => (
                    <td key={cat}>{p.scores?.[cat] ?? "-"}</td>
                  ))}
                  <td>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Choose a Category</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {[
              "aces","twos","threes","fours","fives","sixes",
              "threeKind","fourKind","fullHouse","shortStraight",
              "longStraight","yahtzee","chance"
            ].map((cat) => (
              <button
                key={cat}
                onClick={() => handleScore(cat)}
                disabled={!isMyTurn || me?.scores?.[cat] !== undefined}
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

