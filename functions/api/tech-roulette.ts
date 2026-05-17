import { awardGameExp, expForGame } from "../_levels";

const OWNER_EMAIL = "emirkaganaksu02@gmail.com";

const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, index) => index);
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const ALLOWED_CHIPS = new Set([10, 50, 100, 500, 1_000, 5_000, 10_000]);
const BET_LIMITS = { min: 10, max: 10_000 };
const ROUND_SECONDS = 18;
// Minimum result reveal window. The client can keep animating past this if the
// ball still has not physically reached the winning pocket.
const RESULT_REVEAL_MIN_SECONDS = 22;

function rouletteUserColor(userId: number | string) {
  const key = String(userId || 0);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  const hue = Math.round((hash * 137.508) % 360);
  return `hsl(${hue} 78% 64%)`;
}

const OPEN_ROUND_SELECT = `
  SELECT id, status, betting_started_at, spins_at, winning_number, winning_color, winning_parity,
         server_seed_hash, server_seed, client_seed, nonce, result_hmac, created_at, resolved_at
  FROM tech_roulette_rounds
  WHERE status = 'betting'
  ORDER BY id DESC
  LIMIT 1
`;

type RouletteBetType =
  | "straight"
  | "red"
  | "black"
  | "odd"
  | "even"
  | "low"
  | "high"
  | "column"
  | "dozen";

type RouletteBet = {
  type: RouletteBetType;
  amount: number;
  value?: number | string;
  stakeType?: "coin" | "item";
  stakeItemId?: number | null;
  stakeItemLabel?: string | null;
};

type RouletteRound = {
  id: number;
  status: "betting" | "resolved";
  betting_started_at: number;
  spins_at: number;
  winning_number?: number | null;
  winning_color?: string | null;
  winning_parity?: string | null;
  server_seed_hash?: string | null;
  server_seed?: string | null;
  client_seed?: string | null;
  nonce?: number | null;
  result_hmac?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
};

export async function onRequestGet(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  try {
    await ensureRouletteTables(context);
    await ensureWallet(context, auth.user.id);
    const settledRound = await settleExpiredRound(context);
    const round = await getOrCreateOpenRound(context);
    const wallet = await getWallet(context, auth.user.id);
    const [recent, tableBets, myBets, recentNumbers, inventory] =
      await Promise.all([
        loadRecentLogs(context, auth.user.id),
        round ? loadRoundBets(context, round.id, auth.user.id) : [],
        round ? loadUserRoundBets(context, round.id, auth.user.id) : [],
        loadRecentNumbers(context),
        loadInventory(context, auth.user.id),
      ]);

    return Response.json({
      ok: true,
      ekatechwallet: wallet.balance,
      wallet,
      limits: BET_LIMITS,
      roundSeconds: ROUND_SECONDS,
      serverNow: nowSeconds(),
      currentRound: round ? serializeRound(round) : null,
      lastResolvedRound: settledRound ? serializeRound(settledRound) : null,
      tableBets,
      myBets,
      recent: recent?.results || [],
      recentNumbers: recentNumbers?.results || [],
      inventory,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Tech Roulette SQL durumu yüklenemedi.",
        detail: readableError(error),
      },
      { status: 500 },
    );
  }
}

export async function onRequestPost(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await ensureRouletteTables(context);
    await ensureWallet(context, auth.user.id);
    const settledRound = await settleExpiredRound(context);
    const round = await getOrCreateOpenRound(context);
    if (!round)
      throw new Error("Top hâlâ dönüyor. Bahisler açılınca sonraki tura gir.");
    if (round.spins_at <= nowSeconds() + 1)
      throw new Error("Bu tur kapanıyor. Yeni tur için bekle.");

    const bet = await parseBet(context, auth.user.id, body);
    const beforeWallet = await getWallet(context, auth.user.id);

    if (bet.stakeType === "item") {
      const consume = await context.env.DB.prepare(
        `UPDATE off_shop_inventory SET status = 'used', used_at = datetime('now') WHERE id = ? AND user_id = ? AND status = 'available'`,
      )
        .bind(bet.stakeItemId, auth.user.id)
        .run();
      if ((consume.meta?.changes || 0) < 1)
        return Response.json(
          { error: "Bu racon eşyası artık kullanılabilir değil." },
          { status: 409 },
        );
    } else {
      const debit = await context.env.DB.prepare(
        `UPDATE coin_wallets SET balance = COALESCE(balance, 0) - ?, updated_at = datetime('now') WHERE user_id = ? AND COALESCE(balance, 0) >= ?`,
      )
        .bind(bet.amount, auth.user.id, bet.amount)
        .run();

      if ((debit.meta?.changes || 0) < 1) {
        return Response.json(
          {
            error: "Yetersiz ekatechwallet bakiyesi.",
            ekatechwallet: beforeWallet.balance,
            wallet: beforeWallet,
          },
          { status: 402 },
        );
      }

      await context.env.DB.prepare(
        `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
      )
        .bind(
          auth.user.id,
          -bet.amount,
          `Tech Roulette bahis: ${describeBet(bet)} / round ${round.id}`,
        )
        .run();
    }

    await awardGameExp(
      context,
      auth.user.id,
      expForGame(
        bet.type === "straight"
          ? "expert"
          : bet.type === "column" || bet.type === "dozen"
            ? "hard"
            : "medium",
        10,
      ),
      `Tech Roulette oyun EXP: ${describeBet(bet)}`,
      bet.type,
    );

    const betResult = await context.env.DB.prepare(
      `
        INSERT INTO tech_roulette_bets (round_id, user_id, user_name, bet_type, bet_value, bet_amount, stake_type, stake_item_id, stake_item_label, status, wallet_before, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
      `,
    )
      .bind(
        round.id,
        auth.user.id,
        auth.user.name || "OFF Player",
        bet.type,
        bet.value == null ? null : String(bet.value),
        bet.amount,
        bet.stakeType || "coin",
        bet.stakeItemId || null,
        bet.stakeItemLabel || null,
        beforeWallet.balance,
      )
      .run();

    const wallet = await getWallet(context, auth.user.id);
    if (bet.stakeType === "item" && bet.stakeItemId) {
      await context.env.DB.prepare(
        `UPDATE off_shop_inventory SET roulette_bet_id = ? WHERE id = ?`,
      )
        .bind(betResult.meta?.last_row_id || null, bet.stakeItemId)
        .run();
    }

    const [tableBets, myBets, inventory] = await Promise.all([
      loadRoundBets(context, round.id, auth.user.id),
      loadUserRoundBets(context, round.id, auth.user.id),
      loadInventory(context, auth.user.id),
    ]);

    return Response.json({
      ok: true,
      betId: betResult.meta?.last_row_id || null,
      bet,
      ekatechwallet: wallet.balance,
      wallet,
      limits: BET_LIMITS,
      roundSeconds: ROUND_SECONDS,
      serverNow: nowSeconds(),
      currentRound: serializeRound(round),
      lastResolvedRound: settledRound ? serializeRound(settledRound) : null,
      tableBets,
      myBets,
      inventory,
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 400 });
  }
}


export async function onRequestDelete(context: any) {
  const auth = await requireUser(context);
  if (!auth.ok)
    return Response.json({ error: auth.error }, { status: auth.status });

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    await ensureRouletteTables(context);
    await ensureWallet(context, auth.user.id);
    await settleExpiredRound(context);

    const betId = Math.floor(Number(body?.betId || body?.id || 0));
    if (!Number.isFinite(betId) || betId <= 0)
      throw new Error("Geri çekilecek bahis bulunamadı.");

    const bet = await context.env.DB.prepare(
      `SELECT b.*, r.spins_at, r.status AS round_status
       FROM tech_roulette_bets b
       JOIN tech_roulette_rounds r ON r.id = b.round_id
       WHERE b.id = ? AND b.user_id = ?`,
    )
      .bind(betId, auth.user.id)
      .first();

    if (!bet || bet.status !== "pending" || bet.round_status !== "betting")
      throw new Error("Sadece açık turdaki bekleyen çip geri çekilebilir.");
    if ((bet.stake_type || "coin") === "item")
      throw new Error("Racon eşyası masaya koyulduktan sonra geri kaldırılamaz.");
    if (Number(bet.spins_at || 0) <= nowSeconds() + 1)
      throw new Error("Tur kapanırken çip geri çekilemez.");

    const cancel = await context.env.DB.prepare(
      `UPDATE tech_roulette_bets SET status = 'cancelled', settled_at = datetime('now') WHERE id = ? AND user_id = ? AND status = 'pending'`,
    )
      .bind(betId, auth.user.id)
      .run();
    if ((cancel.meta?.changes || 0) < 1)
      throw new Error("Bu çip zaten masadan kalkmış.");

    if ((bet.stake_type || "coin") === "item" && bet.stake_item_id) {
      await context.env.DB.prepare(
        `UPDATE off_shop_inventory SET status = 'available', used_at = NULL, roulette_bet_id = NULL WHERE id = ? AND user_id = ? AND roulette_bet_id = ?`,
      )
        .bind(bet.stake_item_id, auth.user.id, betId)
        .run();
    } else {
      await creditWallet(
        context,
        auth.user.id,
        Number(bet.bet_amount || 0),
        `Tech Roulette bahis iadesi: ${bet.bet_type}${bet.bet_value ? `:${bet.bet_value}` : ""} / round ${bet.round_id}`,
      );
    }

    const wallet = await getWallet(context, auth.user.id);
    const [tableBets, myBets, inventory] = await Promise.all([
      loadRoundBets(context, Number(bet.round_id), auth.user.id),
      loadUserRoundBets(context, Number(bet.round_id), auth.user.id),
      loadInventory(context, auth.user.id),
    ]);

    return Response.json({
      ok: true,
      cancelledBetId: betId,
      ekatechwallet: wallet.balance,
      wallet,
      tableBets,
      myBets,
      inventory,
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 400 });
  }
}

async function settleExpiredRound(context: any): Promise<RouletteRound | null> {
  const open = await context.env.DB.prepare(OPEN_ROUND_SELECT).first();
  if (!open || Number(open.spins_at) > nowSeconds()) return null;

  const fairResult = await fairRouletteNumber(open);
  const winningNumber = fairResult.number;
  const outcome = buildOutcome(winningNumber);
  const close = await context.env.DB.prepare(
    `UPDATE tech_roulette_rounds SET status = 'resolved', winning_number = ?, winning_color = ?, winning_parity = ?, result_hmac = ?, resolved_at = datetime('now') WHERE id = ? AND status = 'betting'`,
  )
    .bind(winningNumber, outcome.color, outcome.parity, fairResult.hmac, open.id)
    .run();

  if ((close.meta?.changes || 0) < 1) {
    const alreadyResolved = await context.env.DB.prepare(
      `SELECT * FROM tech_roulette_rounds WHERE id = ?`,
    )
      .bind(open.id)
      .first();
    return alreadyResolved || null;
  }

  const bets = await context.env.DB.prepare(
    `SELECT * FROM tech_roulette_bets WHERE round_id = ? AND status = 'pending' ORDER BY id ASC`,
  )
    .bind(open.id)
    .all();

  for (const row of bets?.results || []) {
    const bet: RouletteBet = {
      type: row.bet_type,
      value: row.bet_value,
      amount: Number(row.bet_amount || 0),
      stakeType: row.stake_type || "coin",
      stakeItemId: row.stake_item_id,
      stakeItemLabel: row.stake_item_label,
    };
    const settlement = settleBet(bet, winningNumber);
    if (settlement.payoutAmount > 0) {
      await creditWallet(
        context,
        Number(row.user_id),
        settlement.payoutAmount,
        `Tech Roulette kazanç: ${winningNumber} / round ${open.id}${row.stake_item_label ? ` / ${row.stake_item_label}` : ""}`,
      );
    }
    const afterWallet = await getWallet(context, Number(row.user_id));
    await context.env.DB.prepare(
      `UPDATE tech_roulette_bets SET winning_number = ?, payout_multiplier = ?, payout_amount = ?, profit_amount = ?, status = ?, wallet_after = ?, settled_at = datetime('now') WHERE id = ?`,
    )
      .bind(
        winningNumber,
        settlement.oddsMultiplier,
        settlement.payoutAmount,
        settlement.profitAmount,
        settlement.won ? "won" : "lost",
        afterWallet.balance,
        row.id,
      )
      .run();
    await context.env.DB.prepare(
      `
        INSERT INTO tech_roulette_logs (
          round_id, user_id, bet_type, bet_value, bet_amount, winning_number, winning_color, winning_parity,
          payout_multiplier, payout_amount, profit_amount, wallet_before, wallet_after, stake_type, stake_item_id, stake_item_label, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
    )
      .bind(
        open.id,
        row.user_id,
        row.bet_type,
        row.bet_value,
        row.bet_amount,
        winningNumber,
        outcome.color,
        outcome.parity,
        settlement.oddsMultiplier,
        settlement.payoutAmount,
        settlement.profitAmount,
        row.wallet_before || 0,
        afterWallet.balance,
        row.stake_type || "coin",
        row.stake_item_id || null,
        row.stake_item_label || null,
        settlement.won ? "won" : "lost",
      )
      .run();
  }

  return {
    ...open,
    status: "resolved",
    winning_number: winningNumber,
    winning_color: outcome.color,
    winning_parity: outcome.parity,
    resolved_at: new Date().toISOString(),
  };
}

async function getOrCreateOpenRound(
  context: any,
): Promise<RouletteRound | null> {
  const open = await context.env.DB.prepare(OPEN_ROUND_SELECT).first();
  if (open) return ensureRoundFairness(context, open);

  const latestResolved = await context.env.DB.prepare(
    `SELECT MAX(strftime('%s', resolved_at)) AS resolved_at_epoch FROM tech_roulette_rounds WHERE status = 'resolved' AND resolved_at IS NOT NULL`,
  ).first();
  const resolvedAt = Number(latestResolved?.resolved_at_epoch || 0);
  if (resolvedAt > 0 && nowSeconds() - resolvedAt < RESULT_REVEAL_MIN_SECONDS)
    return null;

  return createOpenRound(context);
}

async function ensureRoundFairness(
  context: any,
  round: RouletteRound,
): Promise<RouletteRound> {
  if (round.server_seed_hash && round.server_seed && round.client_seed) return round;

  const serverSeed = randomHex(32);
  const serverSeedHash = await sha512Hex(serverSeed);
  const clientSeed = `tech-roulette:${round.betting_started_at}:${serverSeedHash.slice(0, 16)}`;
  const nonce = Number(round.betting_started_at || round.id);

  await context.env.DB.prepare(
    `UPDATE tech_roulette_rounds SET server_seed_hash = ?, server_seed = ?, client_seed = ?, nonce = ? WHERE id = ? AND status = 'betting'`,
  )
    .bind(serverSeedHash, serverSeed, clientSeed, nonce, round.id)
    .run();

  return {
    ...round,
    server_seed_hash: serverSeedHash,
    server_seed: serverSeed,
    client_seed: clientSeed,
    nonce,
  };
}

async function createOpenRound(context: any): Promise<RouletteRound> {
  const startedAt = nowSeconds();
  const spinsAt = startedAt + ROUND_SECONDS;
  const serverSeed = randomHex(32);
  const serverSeedHash = await sha512Hex(serverSeed);
  const clientSeed = `tech-roulette:${startedAt}:${serverSeedHash.slice(0, 16)}`;
  const nonce = Number(startedAt);
  const result = await context.env.DB.prepare(
    `INSERT INTO tech_roulette_rounds (status, betting_started_at, spins_at, server_seed_hash, server_seed, client_seed, nonce, created_at) VALUES ('betting', ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(startedAt, spinsAt, serverSeedHash, serverSeed, clientSeed, nonce)
    .run();
  return {
    id: Number(result.meta?.last_row_id || 0),
    status: "betting",
    betting_started_at: startedAt,
    spins_at: spinsAt,
    server_seed_hash: serverSeedHash,
    client_seed: clientSeed,
    nonce,
    created_at: new Date(startedAt * 1000).toISOString(),
  };
}

function serializeRound(round: RouletteRound) {
  const resolved = round.status === "resolved";
  return {
    ...round,
    server_seed: resolved ? round.server_seed : undefined,
    fairness: {
      algorithm: "HMAC-SHA512",
      serverSeedHash: round.server_seed_hash || null,
      serverSeed: resolved ? round.server_seed || null : null,
      clientSeed: round.client_seed || null,
      nonce: round.nonce ?? null,
      resultHmac: resolved ? round.result_hmac || null : null,
    },
    secondsLeft: Math.max(0, Number(round.spins_at || 0) - nowSeconds()),
  };
}

function loadRecentLogs(context: any, userId: number) {
  return context.env.DB.prepare(
    `SELECT id, round_id, bet_type, bet_value, bet_amount, stake_type, stake_item_label, winning_number, winning_color, payout_amount, profit_amount, status, created_at FROM tech_roulette_logs WHERE user_id = ? ORDER BY id DESC LIMIT 12`,
  )
    .bind(userId)
    .all();
}

function loadRecentNumbers(context: any) {
  return context.env.DB.prepare(
    `SELECT id, winning_number, winning_color, winning_parity, resolved_at FROM tech_roulette_rounds WHERE status = 'resolved' AND winning_number IS NOT NULL ORDER BY id DESC LIMIT 14`,
  ).all();
}

async function loadRoundBets(context: any, roundId: number, userId: number) {
  const result = await context.env.DB.prepare(
    `
      SELECT id, user_id, user_name, bet_type, bet_value, bet_amount, stake_item_label, created_at
      FROM tech_roulette_bets
      WHERE round_id = ? AND status = 'pending'
      ORDER BY created_at DESC, id DESC
    `,
  )
    .bind(roundId)
    .all();

  const grouped = new Map<string, any>();
  for (const row of result?.results || []) {
    const key = `${row.bet_type}:${row.bet_value == null ? "" : row.bet_value}`;
    const existing = grouped.get(key) || {
      bet_type: row.bet_type,
      bet_value: row.bet_value,
      chip_count: 0,
      total_amount: 0,
      last_bet_at: row.created_at,
      users: [] as string[],
      user_colors: [] as string[],
      item_labels: [] as string[],
      bet_ids: [] as string[],
      my_bet_ids: [] as string[],
    };
    const userColor = rouletteUserColor(row.user_id);
    const userLabel = String(row.user_name || "OFF Player").slice(0, 14);

    existing.chip_count += 1;
    existing.total_amount += Number(row.bet_amount || 0);
    existing.last_bet_at = existing.last_bet_at || row.created_at;
    if (!existing.users.includes(userLabel)) existing.users.push(userLabel);
    if (!existing.user_colors.includes(userColor))
      existing.user_colors.push(userColor);
    if (row.stake_item_label) existing.item_labels.push(row.stake_item_label);
    existing.bet_ids.push(String(row.id));
    if (Number(row.user_id) === Number(userId))
      existing.my_bet_ids.push(String(row.id));
    grouped.set(key, existing);
  }

  return [...grouped.values()]
    .sort((left, right) =>
      String(right.last_bet_at || "").localeCompare(String(left.last_bet_at || "")),
    )
    .map((bet) => ({
      ...bet,
      users: bet.users.join(", "),
      user_colors: bet.user_colors.join(","),
      primary_user_color: bet.user_colors[0] || rouletteUserColor(userId),
      item_labels: bet.item_labels.join(", "),
      bet_ids: bet.bet_ids.join(","),
      my_bet_ids: bet.my_bet_ids.join(","),
    }));
}

function loadUserRoundBets(context: any, roundId: number, userId: number) {
  return context.env.DB.prepare(
    `SELECT id, bet_type, bet_value, bet_amount, stake_type, stake_item_label, status, created_at FROM tech_roulette_bets WHERE round_id = ? AND user_id = ? ORDER BY id DESC`,
  )
    .bind(roundId, userId)
    .all()
    .then((result: any) => result?.results || []);
}

async function parseBet(
  context: any,
  userId: number,
  body: any,
): Promise<RouletteBet> {
  const rawType = String(body?.type || body?.betType || "").toLowerCase();
  const type = rawType as RouletteBetType;
  if (
    ![
      "straight",
      "red",
      "black",
      "odd",
      "even",
      "low",
      "high",
      "column",
      "dozen",
    ].includes(type)
  )
    throw new Error("Geçersiz rulet bahis türü.");

  const stakeItemId = Math.floor(Number(body?.stakeItemId || 0));
  let bet: RouletteBet;

  if (stakeItemId > 0) {
    const item = await context.env.DB.prepare(
      `SELECT id, item_name, emoji, roulette_value FROM off_shop_inventory WHERE id = ? AND user_id = ? AND status = 'available'`,
    )
      .bind(stakeItemId, userId)
      .first();
    if (!item) throw new Error("Kullanılabilir racon eşyası bulunamadı.");
    const amount = Math.floor(Number(item.roulette_value || 0));
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("Eşyanın rulet değeri geçersiz.");
    bet = {
      type,
      amount,
      stakeType: "item",
      stakeItemId,
      stakeItemLabel: `${item.emoji || "🎲"} ${item.item_name || "Racon eşyası"}`,
    };
  } else {
    const chipAmount = Math.floor(Number(body?.chipAmount || body?.chip || 0));
    const chipCount = Math.max(
      1,
      Math.min(10, Math.floor(Number(body?.chipCount || 1))),
    );
    const directAmount = Math.floor(Number(body?.amount || 0));
    const amount = directAmount > 0 ? directAmount : chipAmount * chipCount;

    if (chipAmount > 0 && !ALLOWED_CHIPS.has(chipAmount))
      throw new Error(
        "Geçersiz çip değeri. 10-10000 aralığındaki hızlı çipleri kullanın.",
      );
    if (
      !Number.isFinite(amount) ||
      amount < BET_LIMITS.min ||
      amount > BET_LIMITS.max
    )
      throw new Error("Bahis 10 ile 10000 Tech Coin arasında olmalı.");
    bet = { type, amount, stakeType: "coin" };
  }

  if (type === "straight") {
    const value = Math.floor(Number(body?.value ?? body?.number));
    if (!Number.isFinite(value) || value < 0 || value > 36)
      throw new Error("Tek sayı bahsi 0 ile 36 arasında olmalı.");
    bet.value = value;
  }

  if (type === "column") {
    const value = Math.floor(Number(body?.value ?? body?.column));
    if (!Number.isFinite(value) || value < 1 || value > 3)
      throw new Error("Sütun bahsi 1, 2 veya 3 olmalı.");
    bet.value = value;
  }

  if (type === "dozen") {
    const value = Math.floor(Number(body?.value ?? body?.dozen));
    if (!Number.isFinite(value) || value < 1 || value > 3)
      throw new Error("Deste bahsi 1, 2 veya 3 olmalı.");
    bet.value = value;
  }

  return bet;
}

function settleBet(bet: RouletteBet, winningNumber: number) {
  const oddsMultiplier = getOddsMultiplier(bet.type);
  const won = isWinningBet(bet, winningNumber);
  const payoutAmount = won ? bet.amount * (oddsMultiplier + 1) : 0;
  return {
    won,
    oddsMultiplier,
    payoutAmount,
    profitAmount: payoutAmount - bet.amount,
  };
}

function isWinningBet(bet: RouletteBet, winningNumber: number) {
  if (bet.type === "straight") return Number(bet.value) === winningNumber;
  if (winningNumber === 0) return false;
  if (bet.type === "red") return RED_NUMBERS.has(winningNumber);
  if (bet.type === "black") return !RED_NUMBERS.has(winningNumber);
  if (bet.type === "odd") return winningNumber % 2 === 1;
  if (bet.type === "even") return winningNumber % 2 === 0;
  if (bet.type === "low") return winningNumber >= 1 && winningNumber <= 18;
  if (bet.type === "high") return winningNumber >= 19 && winningNumber <= 36;
  if (bet.type === "column")
    return ((winningNumber - 1) % 3) + 1 === Number(bet.value);
  if (bet.type === "dozen")
    return Math.ceil(winningNumber / 12) === Number(bet.value);
  return false;
}

function getOddsMultiplier(type: RouletteBetType) {
  if (type === "straight") return 35;
  if (type === "column" || type === "dozen") return 2;
  return 1;
}

function buildOutcome(winningNumber: number) {
  const color =
    winningNumber === 0
      ? "green"
      : RED_NUMBERS.has(winningNumber)
        ? "red"
        : "black";
  const parity =
    winningNumber === 0 ? "none" : winningNumber % 2 === 0 ? "even" : "odd";
  return { color, parity };
}

async function fairRouletteNumber(round: RouletteRound) {
  const serverSeed = round.server_seed || randomHex(32);
  const clientSeed = round.client_seed || `tech-roulette:${round.id}`;
  const nonce = Number(round.nonce ?? round.id);
  const hmac = await hmacSha512Hex(
    serverSeed,
    `${clientSeed}:${round.id}:${nonce}`,
  );
  const maxValid =
    Math.floor(0x10000 / ROULETTE_NUMBERS.length) * ROULETTE_NUMBERS.length;

  for (let offset = 0; offset <= hmac.length - 4; offset += 4) {
    const roll = Number.parseInt(hmac.slice(offset, offset + 4), 16);
    if (roll < maxValid)
      return { number: roll % ROULETTE_NUMBERS.length, hmac };
  }

  return {
    number: Number.parseInt(hmac.slice(-8), 16) % ROULETTE_NUMBERS.length,
    hmac,
  };
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function sha512Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha512Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function ensureRouletteTables(context: any) {
  await ensureCoinTables(context);
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_roulette_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'betting',
      betting_started_at INTEGER NOT NULL,
      spins_at INTEGER NOT NULL,
      winning_number INTEGER,
      winning_color TEXT,
      winning_parity TEXT,
      server_seed_hash TEXT,
      server_seed TEXT,
      client_seed TEXT,
      nonce INTEGER,
      result_hmac TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT
    )
  `,
  ).run();
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_roulette_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT,
      bet_type TEXT NOT NULL,
      bet_value TEXT,
      bet_amount INTEGER NOT NULL,
      winning_number INTEGER,
      payout_multiplier INTEGER NOT NULL DEFAULT 0,
      payout_amount INTEGER NOT NULL DEFAULT 0,
      profit_amount INTEGER NOT NULL DEFAULT 0,
      wallet_before REAL NOT NULL DEFAULT 0,
      wallet_after REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      settled_at TEXT
    )
  `,
  ).run();
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS tech_roulette_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER,
      user_id INTEGER NOT NULL,
      bet_type TEXT NOT NULL,
      bet_value TEXT,
      bet_amount INTEGER NOT NULL,
      winning_number INTEGER NOT NULL,
      winning_color TEXT NOT NULL,
      winning_parity TEXT NOT NULL,
      payout_multiplier INTEGER NOT NULL DEFAULT 0,
      payout_amount INTEGER NOT NULL DEFAULT 0,
      profit_amount INTEGER NOT NULL DEFAULT 0,
      wallet_before REAL NOT NULL DEFAULT 0,
      wallet_after REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  ).run();
  await addColumnIfMissing(
    context,
    "tech_roulette_rounds",
    "server_seed_hash",
    "TEXT",
  );
  await addColumnIfMissing(context, "tech_roulette_rounds", "server_seed", "TEXT");
  await addColumnIfMissing(context, "tech_roulette_rounds", "client_seed", "TEXT");
  await addColumnIfMissing(context, "tech_roulette_rounds", "nonce", "INTEGER");
  await addColumnIfMissing(context, "tech_roulette_rounds", "result_hmac", "TEXT");
  await addColumnIfMissing(
    context,
    "tech_roulette_bets",
    "stake_type",
    "TEXT NOT NULL DEFAULT 'coin'",
  );
  await addColumnIfMissing(
    context,
    "tech_roulette_bets",
    "stake_item_id",
    "INTEGER",
  );
  await addColumnIfMissing(
    context,
    "tech_roulette_bets",
    "stake_item_label",
    "TEXT",
  );
  await addColumnIfMissing(
    context,
    "tech_roulette_logs",
    "round_id",
    "INTEGER",
  );
  await addColumnIfMissing(
    context,
    "tech_roulette_logs",
    "stake_type",
    "TEXT NOT NULL DEFAULT 'coin'",
  );
  await addColumnIfMissing(
    context,
    "tech_roulette_logs",
    "stake_item_id",
    "INTEGER",
  );
  await addColumnIfMissing(
    context,
    "tech_roulette_logs",
    "stake_item_label",
    "TEXT",
  );
  await ensureOffShopInventoryTable(context);
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_tech_roulette_rounds_status_spins ON tech_roulette_rounds(status, spins_at)`,
  ).run();
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_tech_roulette_bets_round ON tech_roulette_bets(round_id, created_at DESC)`,
  ).run();
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_tech_roulette_bets_user_round ON tech_roulette_bets(user_id, round_id)`,
  ).run();
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_tech_roulette_logs_user_created ON tech_roulette_logs(user_id, created_at DESC)`,
  ).run();
}

function loadInventory(context: any, userId: number) {
  return context.env.DB.prepare(
    `SELECT id, item_slug, item_name, emoji, roulette_value, status, acquired_at, used_at, roulette_bet_id FROM off_shop_inventory WHERE user_id = ? ORDER BY id DESC LIMIT 80`,
  )
    .bind(userId)
    .all()
    .then((result: any) => result?.results || []);
}

async function ensureOffShopInventoryTable(context: any) {
  await context.env.DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS off_shop_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_slug TEXT NOT NULL,
      item_name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      roulette_value INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      acquired_at TEXT DEFAULT CURRENT_TIMESTAMP,
      used_at TEXT,
      roulette_bet_id INTEGER
    )
  `,
  ).run();
  await context.env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_off_shop_inventory_user_status ON off_shop_inventory(user_id, status, id DESC)`,
  ).run();
}

async function addColumnIfMissing(
  context: any,
  table: string,
  column: string,
  definition: string,
) {
  const info = await context.env.DB.prepare(
    `PRAGMA table_info(${table})`,
  ).all();
  const hasColumn = (info?.results || []).some(
    (row: any) => row.name === column,
  );
  if (!hasColumn)
    await context.env.DB.prepare(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    ).run();
}

async function ensureCoinTables(context: any) {
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_wallets (user_id INTEGER PRIMARY KEY, balance REAL DEFAULT 100, lifetime_earned REAL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS coin_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount REAL NOT NULL, reason TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ).run();
}

async function ensureWallet(context: any, userId: number) {
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO coin_wallets (user_id, balance, lifetime_earned, updated_at) VALUES (?, 100, 0, datetime('now'))`,
  )
    .bind(userId)
    .run();
}

async function getWallet(context: any, userId: number) {
  const wallet = await context.env.DB.prepare(
    `SELECT balance, lifetime_earned, updated_at FROM coin_wallets WHERE user_id = ?`,
  )
    .bind(userId)
    .first();
  return {
    currency: "Tech Coin",
    symbol: "TC",
    balance: Number(wallet?.balance || 0),
    lifetime_earned: Number(wallet?.lifetime_earned || 0),
    updated_at: wallet?.updated_at || null,
  };
}

async function creditWallet(
  context: any,
  userId: number,
  amount: number,
  reason: string,
) {
  await context.env.DB.prepare(
    `UPDATE coin_wallets SET balance = COALESCE(balance, 0) + ?, lifetime_earned = COALESCE(lifetime_earned, 0) + ?, updated_at = datetime('now') WHERE user_id = ?`,
  )
    .bind(amount, Math.max(0, amount), userId)
    .run();
  await context.env.DB.prepare(
    `INSERT INTO coin_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, datetime('now'))`,
  )
    .bind(userId, amount, reason)
    .run();
}

async function requireUser(context: any) {
  const token = getCookie(
    context.request.headers.get("Cookie") || "",
    "session",
  );
  if (!token)
    return { ok: false, status: 401, error: "Giriş yapman gerekiyor." };

  const user = await context.env.DB.prepare(
    `SELECT users.id, users.name, users.email, users.avatar_url, CASE WHEN lower(users.email) = ? THEN 'owner' ELSE COALESCE(users.role, 'client') END AS role FROM sessions JOIN users ON sessions.user_id = users.id WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`,
  )
    .bind(OWNER_EMAIL, token)
    .first();

  if (!user) return { ok: false, status: 401, error: "Oturum geçersiz." };
  if (!["off", "admin", "owner"].includes(user.role))
    return { ok: false, status: 403, error: "OFF erişimi gerekli." };
  return { ok: true, user };
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function describeBet(bet: RouletteBet) {
  return `${bet.type}${bet.value == null ? "" : `:${bet.value}`} (${bet.amount})`;
}

function readableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Tech Roulette işlemi tamamlanamadı.";
}
