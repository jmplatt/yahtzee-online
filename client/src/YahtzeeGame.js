import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io();

const numberLabels = {
  aces: "One",
  twos: "Two",
  threes: "Three",
  fours: "Four",
  fives: "Five",
  sixes: "Six",
};

const specialLabels = {
  threeKind: "x3",
  fourKind: "x4",
  fullHouse: "House",
  shortStraight: "S",
  longStraight: "L",
  yahtzee: "Y",
  chance: "?",
};

const allCategories = [
  "aces","twos","threes","fours","fives","sixes",
  "threeKind","fourKind","fullHouse","shortStraight","longStraight","yahtzee","chance"
];

export default function YahtzeeGame() {
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [dice, setDice] = useState([1,1,1,1,1]);
  const [rolling, setRolling] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    socket.on("game-updated", (state) => {
      setGameState(state);
      setDice(state.dice);
      setRolling(false);
      setSelectedCategory(null);
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
    if (!gameState) return;
    setRolling(true);
    // animate dice: temporary random values
    const animation = setInterval(() => {
      setDice(dice.map(() => Math.floor(Math.random()*6)+1));
    }, 100);
    setTimeout(() => {
      clearInterval(animation);
      socket.emit("roll-dice", { gameId }, (res) => {
        if (!res.ok) alert(res.error || "Roll failed");
      });
    }, 1000);
  };

  const handleHold = (index) => {
    if (gameState.players[gameState.currentPlayerIndex]?.socketId !== socket.id) return;
    socket.emit("toggle-hold", { gameId, index });
  };

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
  };

  const handleSubmitScore = () => {
    if (!selectedCategory) return;
    socket.emit("choose-score", { gameId, category: selectedCategory }, (res) => {
      if (!res.ok) alert(res.error || "Score failed");
    });
  };

  if (!joined) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Join or Create a Game</h2>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleCreate}>Create Game</button>
        <br /><br />
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

  const diceStyle = (d, i) => ({
    width: "50px",
    height: "50px",
    lineHeight: "50px",
    margin: "0 5px",
    fontSize: "1.5rem",
    backgroundColor: gameState.holds[i] ? "#D1FFBD" : "#90D5FF",
    borderRadius: "8px",
    display: "inline-block",
    cursor: isMyTurn ? "pointer" : "default",
    transition: "all 0.2s",
    userSelect: "none",
  });

  const columnStyle = {
    backgroundColor: "#90D5FF",
    padding: "10px",
    margin: "5px",
    borderRadius: "8px",
    width: "120px",
  };

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", backgroundColor: "#D1FFBD" }}>
      <h2>Game: {gameId}</h2>
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

      <div style={{ marginBottom: "1rem" }}>
        {dice.map((d, i) => (
          <span key={i} style={diceStyle(d, i)} onClick={() => handleHold(i)}>
            🎲 {d}
          </span>
        ))}
      </div>

      <button onClick={handleRoll} disabled={!isMyTurn || gameState.rollsLeft <= 0 || rolling}>
        {rolling ? "Rolling..." : `Roll Dice (${gameState.rollsLeft} left)`}
      </button>

      <div style={{ display: "flex", marginTop: "2rem" }}>
        {/* Number column */}
        <div style={columnStyle}>
          <h3>Numbers</h3>
          {["aces","twos","threes","fours","fives","sixes"].map((cat) => (
            <div key={cat} style={{ marginBottom: "8px" }}>
              <span>{numberLabels[cat]}: </span>
              <span>{me?.scores?.[cat] ?? "-"}</span>
              <button
                onClick={() => handleSelectCategory(cat)}
                disabled={!isMyTurn || me?.scores?.[cat] !== undefined}
                style={{
                  marginLeft: "5px",
                  cursor: isMyTurn && me?.scores?.[cat] === undefined ? "pointer" : "not-allowed",
                }}
              >
                Select
              </button>
            </div>
          ))}
        </div>

        {/* Special column */}
        <div style={columnStyle}>
          <h3>Specials</h3>
          {["threeKind","fourKind","fullHouse","shortStraight","longStraight","yahtzee","chance"].map((cat) => (
            <div key={cat} style={{ marginBottom: "8px" }}>
              <span>{specialLabels[cat]}: </span>
              <span>{me?.scores?.[cat] ?? "-"}</span>
              <button
                onClick={() => handleSelectCategory(cat)}
                disabled={!isMyTurn || me?.scores?.[cat] !== undefined}
                style={{
                  marginLeft: "5px",
                  cursor: isMyTurn && me?.scores?.[cat] === undefined ? "pointer" : "not-allowed",
                }}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={handleSubmitScore}
          disabled={!selectedCategory || !isMyTurn}
          style={{ padding: "10px 20px", fontSize: "1rem", marginTop: "10px" }}
        >
          Submit Choice
        </button>
      </div>
    </div>
  );
}

