// server/server.js
const path = require("path");
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3001;

function makeId(len = 6) {
  return Math.random().toString(36).substr(2, len).toUpperCase();
}

const GAMES = new Map();
const CATEGORIES = [
  'aces','twos','threes','fours','fives','sixes',
  'threeKind','fourKind','fullHouse','shortStraight','longStraight','yahtzee','chance'
];

function sum(arr){ return arr.reduce((a,b)=>a+b,0); }

function countsFromDice(dice){
  const counts = Array(7).fill(0);
  dice.forEach(d=>counts[d]++);
  return counts;
}

function computeScore(dice, category){
  const counts = countsFromDice(dice);
  const total = sum(dice);
  switch(category){
    case 'aces': return counts[1]*1;
    case 'twos': return counts[2]*2;
    case 'threes': return counts[3]*3;
    case 'fours': return counts[4]*4;
    case 'fives': return counts[5]*5;
    case 'sixes': return counts[6]*6;
    case 'threeKind': return Object.values(counts).some(c=>c>=3) ? total : 0;
    case 'fourKind': return Object.values(counts).some(c=>c>=4) ? total : 0;
    case 'fullHouse': {
      const has3 = Object.values(counts).some(c=>c===3);
      const has2 = Object.values(counts).some(c=>c===2);
      return (has3 && has2) ? 25 : 0;
    }
    case 'shortStraight': {
      const set = new Set(dice);
      const seqs = [[1,2,3,4],[2,3,4,5],[3,4,5,6]];
      return seqs.some(seq => seq.every(n=>set.has(n))) ? 30 : 0;
    }
    case 'longStraight': {
      const set = new Set(dice);
      const a=[1,2,3,4,5], b=[2,3,4,5,6];
      return (a.every(n=>set.has(n)) || b.every(n=>set.has(n))) ? 40 : 0;
    }
    case 'yahtzee': return Object.values(counts).some(c=>c===5) ? 50 : 0;
    case 'chance': return total;
    default: return 0;
  }
}

function newGame(ownerName, ownerSocketId){
  const id = makeId(6);
  const state = {
    id,
    players: [
      { socketId: ownerSocketId, name: ownerName, scores: {}, total: 0 }
    ],
    dice: [1,1,1,1,1],
    holds: [false,false,false,false,false],
    rollsLeft: 3,
    currentPlayerIndex: 0,
    status: 'waiting', // waiting, playing, finished
  };
  GAMES.set(id, state);
  return state;
}

io.on('connection', socket => {
  console.log('conn', socket.id);

  socket.on('create-game', ({name}, cb) => {
    const g = newGame(name||'Player 1', socket.id);
    socket.join('game_' + g.id);
    cb && cb({ ok:true, gameId: g.id, state:g });
  });

  socket.on('join-game', ({gameId, name}, cb) => {
    const g = GAMES.get(gameId);
    if(!g) return cb && cb({ ok:false, error:'No game' });
    if(g.players.length >= 2) return cb && cb({ ok:false, error:'Full' });

    g.players.push({ socketId: socket.id, name: name||'Player 2', scores: {}, total: 0 });
    g.status = 'playing';
    socket.join('game_' + g.id);
    io.to('game_' + g.id).emit('game-updated', g);
    cb && cb({ ok:true, state:g });
  });

  socket.on('roll-dice', ({gameId}, cb) => {
    const g = GAMES.get(gameId);
    if(!g) return cb && cb({ ok:false });
    const playerIndex = g.players.findIndex(p=>p.socketId===socket.id);
    if(playerIndex !== g.currentPlayerIndex) return cb && cb({ ok:false, error:'Not your turn' });
    if(g.rollsLeft <= 0) return cb && cb({ ok:false, error:'No rolls left' });

    for(let i=0;i<5;i++){
      if(!g.holds[i]) g.dice[i] = Math.floor(Math.random()*6)+1;
    }
    g.rollsLeft -= 1;
    io.to('game_' + g.id).emit('game-updated', g);
    cb && cb({ ok:true, state:g });
  });

  socket.on('toggle-hold', ({gameId, index}, cb) => {
    const g = GAMES.get(gameId);
    if(!g) return cb && cb({ ok:false });
    const playerIndex = g.players.findIndex(p=>p.socketId===socket.id);
    if(playerIndex !== g.currentPlayerIndex) return cb && cb({ ok:false, error:'Not your turn' });

    g.holds[index] = !g.holds[index];
    io.to('game_' + g.id).emit('game-updated', g);
    cb && cb({ ok:true, state:g });
  });

  socket.on('choose-score', ({gameId, category}, cb) => {
    const g = GAMES.get(gameId);
    if(!g) return cb && cb({ ok:false });
    const playerIndex = g.players.findIndex(p=>p.socketId===socket.id);
    if(playerIndex !== g.currentPlayerIndex) return cb && cb({ ok:false, error:'Not your turn' });

    const player = g.players[playerIndex];
    if(player.scores[category] !== undefined) return cb && cb({ ok:false, error:'Category taken' });

    const pts = computeScore(g.dice, category);
    player.scores[category] = pts;
    player.total = Object.values(player.scores).reduce((a,b)=>a+(b||0), 0);

    // reset dice/holds/rolls and switch player
    g.dice = [1,1,1,1,1];
    g.holds = [false,false,false,false,false];
    g.rollsLeft = 3;
    g.currentPlayerIndex = (g.currentPlayerIndex + 1) % g.players.length;

    // check finish
    const bothDone = g.players.every(p => CATEGORIES.every(cat => p.scores[cat] !== undefined));
    if(bothDone) {
      g.status = 'finished';
      const maxScore = Math.max(...g.players.map(p => p.total));
      g.winners = g.players.filter(p => p.total === maxScore).map(p => p.name);
    }

    io.to('game_' + g.id).emit('game-updated', g);
    cb && cb({ ok:true, state:g });
  });

  socket.on('get-state', ({gameId}, cb) => {
    const g = GAMES.get(gameId);
    cb && cb({ ok: !!g, state: g });
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
  });
});

// Serve React build folder in production
app.use(express.static(path.join(__dirname, "../client/build")));

app.get('/:catchAll(*)', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

server.listen(PORT, ()=> console.log('Server up', PORT));
