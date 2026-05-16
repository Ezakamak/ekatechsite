import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import { Server, Socket } from "socket.io";
import { WalletManager, TechCoinWallet } from "./walletManager.js";

const PORT = Number(process.env.TECH_AVIATOR_PORT ?? 4100);
const CLIENT_ORIGIN = process.env.TECH_AVIATOR_CLIENT_ORIGIN ?? "*";
const BETTING_SECONDS = 8;
const CRASHED_SECONDS = 3;
const TICK_MS = 50;
const GROWTH_RATE = 0.06;
const HOUSE_EDGE = 0.03;
const MAX_CRASH_POINT = 10_000;
const INSTANT_CRASH_RATE = 0.03;

export type GameStatus = "STATUS_BETTING" | "STATUS_FLYING" | "STATUS_CRASHED";

interface BetState {
  userId: string;
  socketId: string;
  panelId: string;
  amount: number;
  autoCashoutMultiplier?: number;
  cashedOut: boolean;
}

interface GameRound {
  roundId: string;
  status: GameStatus;
  serverSeed: string;
  salt: string;
  hash: string;
  crashPoint: number;
  currentMultiplier: number;
  startedAt: number;
  bets: Map<string, BetState>;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});
const walletManager = new WalletManager();
let currentRound: GameRound = createRound();
let tickTimer: NodeJS.Timeout | undefined;

app.get("/health", (_req, res) => {
  res.json({ ok: true, game: "Tech Aviator", status: currentRound.status });
});

app.get("/api/provably-fair/current", (_req, res) => {
  res.json(publicRoundSnapshot(true));
});

io.on("connection", (socket) => {
  const userId = normalizeUserId(socket.handshake.auth.userId);
  const userName = String(socket.handshake.auth.userName || "Tech Pilot");
  socket.data.userId = userId;
  socket.join(userId);

  emitWallet(socket, walletManager.getWallet(userId, userName));
  socket.emit("game-state", publicRoundSnapshot(false));

  socket.on("place-bet", (payload, ack) => {
    handlePlaceBet(socket, payload, ack);
  });

  socket.on("cash-out", (payload, ack) => {
    handleCashOut(socket, payload, ack);
  });
});

function handlePlaceBet(socket: Socket, payload: { panelId?: string; amount?: number; autoCashoutMultiplier?: number }, ack?: Function) {
  if (currentRound.status !== "STATUS_BETTING") {
    return reject(ack, socket, "BETTING_CLOSED");
  }

  const userId = socket.data.userId as string;
  const amount = Number(payload.amount);
  const panelId = String(payload.panelId || "main");
  const betKey = `${userId}:${panelId}`;

  if (!Number.isFinite(amount) || amount <= 0) {
    return reject(ack, socket, "INVALID_BET_AMOUNT");
  }

  if (currentRound.bets.has(betKey)) {
    return reject(ack, socket, "BET_ALREADY_PLACED");
  }

  try {
    const wallet = walletManager.deductBet(userId, roundMoney(amount), currentRound.roundId);
    const bet: BetState = {
      userId,
      socketId: socket.id,
      panelId,
      amount: roundMoney(amount),
      autoCashoutMultiplier: sanitizeAutoCashout(payload.autoCashoutMultiplier),
      cashedOut: false,
    };
    currentRound.bets.set(betKey, bet);
    io.to(userId).emit("wallet-update", wallet);
    socket.emit("bet-accepted", { panelId, roundId: currentRound.roundId, amount: bet.amount });
    ack?.({ ok: true, bet, wallet });
  } catch (error) {
    reject(ack, socket, error instanceof Error ? error.message : "BET_REJECTED");
  }
}

function handleCashOut(socket: Socket, payload: { panelId?: string }, ack?: Function) {
  if (currentRound.status !== "STATUS_FLYING") {
    return reject(ack, socket, "CASH_OUT_NOT_AVAILABLE");
  }

  const userId = socket.data.userId as string;
  const panelId = String(payload.panelId || "main");
  const bet = currentRound.bets.get(`${userId}:${panelId}`);

  if (!bet || bet.cashedOut) {
    return reject(ack, socket, "NO_ACTIVE_BET");
  }

  // The client never sends the multiplier. Server-side currentMultiplier is the
  // only value used for paying a cash-out request, eliminating client timing trust.
  payCashOut(bet, currentRound.currentMultiplier, socket, ack);
}

function payCashOut(bet: BetState, multiplier: number, socket?: Socket, ack?: Function) {
  bet.cashedOut = true;
  const payout = roundMoney(bet.amount * multiplier);
  const wallet = walletManager.addWinning(bet.userId, payout, currentRound.roundId, multiplier);
  io.to(bet.userId).emit("wallet-update", wallet);
  io.to(bet.socketId).emit("cash-out-success", {
    panelId: bet.panelId,
    roundId: currentRound.roundId,
    multiplier,
    payout,
  });
  ack?.({ ok: true, multiplier, payout, wallet });
}

function startBettingPhase() {
  clearTickTimer();
  currentRound = createRound();
  currentRound.status = "STATUS_BETTING";
  currentRound.startedAt = Date.now();
  io.emit("round-start", publicRoundSnapshot(false));

  const countdownTimer = setInterval(() => {
    const secondsLeft = Math.max(0, BETTING_SECONDS - Math.floor((Date.now() - currentRound.startedAt) / 1000));
    io.emit("betting-countdown", { roundId: currentRound.roundId, secondsLeft });
  }, 250);

  setTimeout(() => {
    clearInterval(countdownTimer);
    startFlyingPhase();
  }, BETTING_SECONDS * 1000);
}

function startFlyingPhase() {
  currentRound.status = "STATUS_FLYING";
  currentRound.startedAt = Date.now();
  currentRound.currentMultiplier = 1;
  io.emit("flight-start", publicRoundSnapshot(false));

  tickTimer = setInterval(() => {
    const elapsedSeconds = (Date.now() - currentRound.startedAt) / 1000;
    currentRound.currentMultiplier = roundMultiplier(Math.exp(GROWTH_RATE * elapsedSeconds));

    for (const bet of currentRound.bets.values()) {
      if (!bet.cashedOut && bet.autoCashoutMultiplier && currentRound.currentMultiplier >= bet.autoCashoutMultiplier) {
        payCashOut(bet, Math.min(currentRound.currentMultiplier, currentRound.crashPoint));
      }
    }

    io.emit("multiplier-update", {
      roundId: currentRound.roundId,
      currentMultiplier: currentRound.currentMultiplier,
    });

    if (currentRound.currentMultiplier >= currentRound.crashPoint) {
      startCrashedPhase();
    }
  }, TICK_MS);
}

function startCrashedPhase() {
  clearTickTimer();
  currentRound.status = "STATUS_CRASHED";
  currentRound.currentMultiplier = currentRound.crashPoint;
  io.emit("round-crashed", publicRoundSnapshot(true));

  setTimeout(startBettingPhase, CRASHED_SECONDS * 1000);
}

function createRound(): GameRound {
  const serverSeed = crypto.randomBytes(32).toString("hex");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(`${serverSeed}:${salt}`).digest("hex");

  return {
    roundId: `round_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    status: "STATUS_BETTING",
    serverSeed,
    salt,
    hash,
    crashPoint: calculateCrashPoint(hash),
    currentMultiplier: 1,
    startedAt: Date.now(),
    bets: new Map(),
  };
}

function calculateCrashPoint(hash: string): number {
  const first52Bits = Number.parseInt(hash.slice(0, 13), 16);
  const max52 = 2 ** 52;

  if (first52Bits % Math.floor(1 / INSTANT_CRASH_RATE) === 0) {
    return 1;
  }

  const randomUnit = first52Bits / max52;
  const rawMultiplier = (1 - HOUSE_EDGE) / Math.max(1 - randomUnit, 0.000001);
  return Math.min(MAX_CRASH_POINT, Math.max(1.01, roundMultiplier(rawMultiplier)));
}

function publicRoundSnapshot(revealSeed: boolean) {
  return {
    roundId: currentRound.roundId,
    status: currentRound.status,
    salt: currentRound.salt,
    hash: currentRound.hash,
    serverSeed: revealSeed ? currentRound.serverSeed : undefined,
    crashPoint: revealSeed ? currentRound.crashPoint : undefined,
    currentMultiplier: currentRound.currentMultiplier,
    startedAt: currentRound.startedAt,
    bettingSeconds: BETTING_SECONDS,
  };
}

function emitWallet(socket: Socket, wallet: TechCoinWallet) {
  socket.emit("wallet-update", wallet);
}

function reject(ack: Function | undefined, socket: Socket, code: string) {
  socket.emit("game-error", { code });
  ack?.({ ok: false, code });
}

function normalizeUserId(rawUserId: unknown): string {
  const id = String(rawUserId || "demo-pilot").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return id || "demo-pilot";
}

function sanitizeAutoCashout(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1.01) return undefined;
  return roundMultiplier(Math.min(numeric, MAX_CRASH_POINT));
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function roundMultiplier(value: number): number {
  return Number(value.toFixed(2));
}

function clearTickTimer() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = undefined;
}

server.listen(PORT, () => {
  console.log(`Tech Aviator realtime server listening on http://localhost:${PORT}`);
  startBettingPhase();
});
