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

export default function YahtzeeGame() {
  const [gameId, setGameId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [dice, setDice] = useState(() =>
    Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1)
  );
  const [rolling, setRolling] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    socket.on("game-updated", (state) => {
      setGameState(state);
      setDice(state.dice);
      setRolling(false);
      setSelectedCategory(null);
      setHovered(null);
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
      } else {
        alert(res.error);
      }
    });
  };

  const handleRoll = () => {
    if (!gameState) return;
    setRolling(true);
    const animation = setInterval(() => {
      setDice(dice.map(() => Math.floor(Math.random() * 6) + 1));
    }, 100);
    setTimeout(() => {
      clearInterval(animation);
      socket.emit("roll-dice", { gameId }, (res) => {
        if (!res.ok) alert(res.error || "Roll failed");
      });
    }, 1000);
  };

  const handleHold = (index) => {
    if (gameState.players[gameState.currentPlayerIndex]?.socketId !== socket.id)
      return;
    socket.emit("toggle-hold", { gameId, index });
  };

  const handleSubmitScore = () => {
    if (!selectedCategory) return;
    socket.emit(
      "choose-score",
      { gameId, category: selectedCategory },
      (res) => {
        if (!res.ok) alert(res.error || "Score failed");
      }
    );
  };

  function calculatePotential(dice, category) {
    if (!dice || dice.length === 0) return 0;

    const counts = Array(6).fill(0);
    dice.forEach((d) => counts[d - 1]++);
    const total = dice.reduce((a, b) => a + b, 0);

    switch (category) {
      case "aces": return counts[0] * 1;
      case "twos": return counts[1] * 2;
      case "threes": return counts[2] * 3;
      case "fours": return counts[3] * 4;
      case "fives": return counts[4] * 5;
      case "sixes": return counts[5] * 6;
      case "threeKind": return Math.max(...counts) >= 3 ? total : 0;
      case "fourKind": return Math.max(...counts) >= 4 ? total : 0;
      case "fullHouse": return counts.includes(3) && counts.includes(2) ? 25 : 0;
      case "shortStraight":
        return [[1,2,3,4],[2,3,4,5],[3,4,5,6]].some(seq => seq.every(n => counts[n-1]>0)) ? 30 : 0;
      case "longStraight":
        return [1,2,3,4,5].every(n => counts[n-1]>0) || [2,3,4,5,6].every(n => counts[n-1]>0) ? 40 : 0;
      case "yahtzee": return counts.includes(5) ? 50 : 0;
      case "chance": return total;
      default: return 0;
    }
  }

  function calculateTotal(player) {
    if (!player || !player.scores) return 0;
    return Object.values(player.scores).reduce((a,b)=>a+(b||0),0);
  }

  if (!joined) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Join or Create a Game</h2>
        <input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
        <button onClick={handleCreate}>Create Game</button>
        <br /><br />
        <input placeholder="Game ID" value={gameId} onChange={e=>setGameId(e.target.value)} />
        <button onClick={handleJoin}>Join Game</button>
      </div>
    );
  }

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const me = gameState?.players.find(p => p.socketId === socket.id);
  const isMyTurn = currentPlayer?.socketId === socket.id;

  const diceStyle = (d,i) => ({
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
    width: "180px",
  };

  const scoreBoxStyle = (highlight=false) => ({
    display: "inline-block",
    width: "40px",
    height: "25px",
    lineHeight: "25px",
    marginLeft: "5px",
    backgroundColor: highlight ? "yellow" : "#D1FFBD",
    borderRadius: "5px",
    textAlign: "center",
  });

  return (
    <div style={{ padding: "2rem", minHeight: "100vh", backgroundColor: "#D1FFBD" }}>
      <h2 style={{ textAlign: "center" }}>Game: {gameId}</h2>
      <p>Status: {gameState.status}</p>
      {gameState.status !== "finished" && <p>Current Turn: <strong>{currentPlayer?.name}</strong></p>}
      {gameState.status === "finished" && (
        <div style={{ fontSize:"1.5rem", color:"green", marginBottom:"1rem", textAlign:"center" }}>
          🎉 Game Over! Winner: {gameState.winners.join(" & ")}
        </div>
      )}

      <div style={{ textAlign:"center", marginBottom:"1rem" }}>
        {dice.map((d,i)=>(
          <span key={i} style={diceStyle(d,i)} onClick={()=>handleHold(i)}>🎲 {d}</span>
        ))}
      </div>

      <div style={{ textAlign:"center", marginBottom:"1rem" }}>
        <button onClick={handleRoll} disabled={!isMyTurn || gameState.rollsLeft<=0 || rolling}>
          {rolling ? "Rolling..." : `Roll Dice (${gameState.rollsLeft} left)`}
        </button>
      </div>

      <div style={{ display:"flex", justifyContent:"center", gap:"20px", marginTop:"2rem" }}>
        {/* Numbers column */}
        <div style={columnStyle}>
          <h3 style={{ textAlign:"center" }}>Numbers</h3>
          {["aces","twos","threes","fours","fives","sixes"].map(cat=>{
            const potential = calculatePotential(dice, cat);
            return (
              <div key={cat} style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px", alignItems:"center" }}
                   onMouseEnter={()=>setHovered(cat)}
                   onMouseLeave={()=>setHovered(null)}
              >
                <span>{numberLabels[cat]}</span>
                <span style={scoreBoxStyle(hovered===cat)}>{me?.scores?.[cat] ?? (hovered===cat ? potential : "-")}</span>
                <button onClick={()=>setSelectedCategory(cat)} disabled={!isMyTurn || me?.scores?.[cat]!==undefined}>Select</button>
              </div>
            )
          })}
        </div>

        {/* Specials column */}
        <div style={columnStyle}>
          <h3 style={{ textAlign:"center" }}>Specials</h3>
          {["threeKind","fourKind","fullHouse","shortStraight","longStraight","yahtzee","chance"].map(cat=>{
            const potential = calculatePotential(dice, cat);
            return (
              <div key={cat} style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px", alignItems:"center" }}
                   onMouseEnter={()=>setHovered(cat)}
                   onMouseLeave={()=>setHovered(null)}
              >
                <span>{specialLabels[cat]}</span>
                <span style={scoreBoxStyle(hovered===cat)}>{me?.scores?.[cat] ?? (hovered===cat ? potential : "-")}</span>
                <button onClick={()=>setSelectedCategory(cat)} disabled={!isMyTurn || me?.scores?.[cat]!==undefined}>Select</button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Submit Button */}
      <div style={{ textAlign:"center", marginTop:"20px" }}>
        <button onClick={handleSubmitScore} disabled={!selectedCategory || !isMyTurn} style={{padding:"10px 20px", fontSize:"1rem"}}>
          Submit Choice
        </button>
      </div>

      {/* Running Total */}
      <div style={{ textAlign:"center", marginTop:"30px", fontSize:"1.2rem" }}>
        <h3>Running Totals</h3>
        {gameState.players.map(p=>(
          <div key={p.socketId} style={{marginBottom:"5px"}}>
            {p.name}: {calculateTotal(p)}
          </div>
        ))}
      </div>
    </div>
  )
}

