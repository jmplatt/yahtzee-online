import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import YahtzeeGame from "./YahtzeeGame";

// connect to backend server (port 3001)
const socket = io("http://localhost:3001");

function App() {
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    socket.on("connect", () => {
      setStatus("✅ Connected to Yahtzee server!");
    });

    socket.on("disconnect", () => {
      setStatus("❌ Disconnected from server");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Let's Play Yahtzee!</h1>
      <p>{status}</p>
      <YahtzeeGame /> 
    </div>
  );
}

export default App;

