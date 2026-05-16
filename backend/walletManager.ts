import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type TransactionType = "DEDUCT_BET" | "ADD_WINNING" | "CASH_OUT" | "WALLET_CREATED";

export interface WalletTransaction {
  id: string;
  type: TransactionType;
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

type WalletStore = Record<string, TechCoinWallet>;

const DEFAULT_WALLET_BALANCE = 14550.25;
const MONEY_PRECISION = 2;

/**
 * File-backed wallet service for Tech Coin balances. The implementation keeps the
 * source of truth on the server and writes every mutation synchronously so a
 * placed bet cannot be lost if the game loop advances before the next tick.
 */
export class WalletManager {
  private readonly dataFilePath: string;
  private wallets: WalletStore = {};

  constructor(dataFilePath = resolve(process.cwd(), "backend", "cüzdan_verisi.json")) {
    this.dataFilePath = dataFilePath;
    this.ensureDataFile();
    this.wallets = this.readStore();
  }

  getWallet(userId: string, userName = "Tech Pilot"): TechCoinWallet {
    if (!this.wallets[userId]) {
      const wallet: TechCoinWallet = {
        userId,
        userName,
        techCoinBalance: DEFAULT_WALLET_BALANCE,
        transactionHistory: [],
      };

      this.wallets[userId] = wallet;
      this.recordTransaction(userId, {
        type: "WALLET_CREATED",
        amount: DEFAULT_WALLET_BALANCE,
        description: "Tech Coin cüzdanı oluşturuldu",
      });
    }

    if (userName && this.wallets[userId].userName !== userName) {
      this.wallets[userId].userName = userName;
      this.persist();
    }

    return this.cloneWallet(this.wallets[userId]);
  }

  deductBet(userId: string, amount: number, roundId: string): TechCoinWallet {
    const wallet = this.getMutableWallet(userId);
    const normalizedAmount = this.normalizeAmount(amount);

    if (normalizedAmount <= 0) {
      throw new Error("INVALID_BET_AMOUNT");
    }

    if (wallet.techCoinBalance < normalizedAmount) {
      throw new Error("INSUFFICIENT_TECH_COIN");
    }

    wallet.techCoinBalance = this.normalizeAmount(wallet.techCoinBalance - normalizedAmount);
    this.recordTransaction(userId, {
      type: "DEDUCT_BET",
      amount: -normalizedAmount,
      roundId,
      description: "Tech Aviator Bahis",
    });

    return this.cloneWallet(wallet);
  }

  addWinning(userId: string, amount: number, roundId: string, multiplier: number): TechCoinWallet {
    const wallet = this.getMutableWallet(userId);
    const normalizedAmount = this.normalizeAmount(amount);

    if (normalizedAmount <= 0) {
      throw new Error("INVALID_WINNING_AMOUNT");
    }

    wallet.techCoinBalance = this.normalizeAmount(wallet.techCoinBalance + normalizedAmount);
    this.recordTransaction(userId, {
      type: "ADD_WINNING",
      amount: normalizedAmount,
      roundId,
      multiplier,
      description: `Tech Aviator Nakit Çekim @ ${multiplier.toFixed(2)}x`,
    });

    return this.cloneWallet(wallet);
  }

  private getMutableWallet(userId: string): TechCoinWallet {
    if (!this.wallets[userId]) {
      this.getWallet(userId);
    }

    return this.wallets[userId];
  }

  private recordTransaction(
    userId: string,
    input: Omit<WalletTransaction, "id" | "balanceAfter" | "createdAt">,
  ): void {
    const wallet = this.wallets[userId];
    wallet.transactionHistory.unshift({
      ...input,
      id: `txn_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      balanceAfter: wallet.techCoinBalance,
      createdAt: new Date().toISOString(),
    });

    wallet.transactionHistory = wallet.transactionHistory.slice(0, 100);
    this.persist();
  }

  private ensureDataFile(): void {
    const dir = dirname(this.dataFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(this.dataFilePath)) {
      writeFileSync(this.dataFilePath, JSON.stringify({}, null, 2), "utf8");
    }
  }

  private readStore(): WalletStore {
    try {
      return JSON.parse(readFileSync(this.dataFilePath, "utf8")) as WalletStore;
    } catch {
      return {};
    }
  }

  private persist(): void {
    writeFileSync(this.dataFilePath, JSON.stringify(this.wallets, null, 2), "utf8");
  }

  private normalizeAmount(amount: number): number {
    return Number(amount.toFixed(MONEY_PRECISION));
  }

  private cloneWallet(wallet: TechCoinWallet): TechCoinWallet {
    return JSON.parse(JSON.stringify(wallet)) as TechCoinWallet;
  }
}
