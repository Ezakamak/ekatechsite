export type GameStatus = "STATUS_BETTING" | "STATUS_FLYING" | "STATUS_CRASHED";

export interface WalletTransaction {
  id: string;
  type: "DEDUCT_BET" | "ADD_WINNING" | "CASH_OUT" | "WALLET_CREATED";
  amount: number;
  balanceAfter: number;
  description: string;
  roundId?: string;
  multiplier?: number;
  createdAt: string;
}

export interface TechCoinWallet {
  userId: string;
  userName: string;
  techCoinBalance: number;
  transactionHistory: WalletTransaction[];
}

export interface GameState {
  roundId: string;
  status: GameStatus;
  salt: string;
  hash: string;
  serverSeed?: string;
  crashPoint?: number;
  currentMultiplier: number;
  startedAt: number;
  bettingSeconds: number;
}

export interface BetPanelState {
  id: string;
  amount: number;
  autoBet: boolean;
  autoCashout: boolean;
  autoCashoutMultiplier: number;
  activeBetAmount?: number;
  isBetAccepted: boolean;
  hasCashedOut: boolean;
}

export interface SocketLike {
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
  emit: (event: string, payload?: unknown, ack?: (response: any) => void) => void;
  disconnect: () => void;
}
