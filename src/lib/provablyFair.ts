export type FairCard = { suit: "C" | "D" | "H" | "S"; rank: string; code: string; id: string };

const HEX_CHARS = "0123456789abcdef";
const CARD_SUITS = ["C", "D", "H", "S"] as const;
const CARD_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export async function sha256(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bufferToHex(digest);
}

export async function hmacSha256(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return bufferToHex(signature);
}

export function createServerSeed() {
  return randomHex(32);
}

export function createClientSeed() {
  return `client-${randomHex(16)}`;
}

export function createNonce() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const view = new DataView(bytes.buffer);
  return Number(view.getBigUint64(0) % 9_000_000_000_000_000n) + 1;
}

export async function verifyServerHash(serverSeed: string, serverHash: string) {
  return (await sha256(serverSeed)) === serverHash;
}

export async function generateDiceRoll(serverSeed: string, clientSeed: string, nonce: number | string) {
  const resultHmac = await hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
  const sample = Number.parseInt(resultHmac.slice(0, 13), 16);
  const random = sample / 0x20000000000000;
  const roll = Math.floor(random * 10000) / 100;
  return { roll: Number(roll.toFixed(2)), resultHmac };
}

export async function generateBlackjackDeck(serverSeed: string, clientSeed: string, nonce: number | string) {
  const deckHmac = await hmacSha256(serverSeed, `${clientSeed}:${nonce}:deck`);
  const deck = createStandardDeck();
  const random = createHmacRandomStream(serverSeed, `${clientSeed}:${nonce}:deck`);

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = await random.nextInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return { deck, deckHmac };
}

export async function verifyBlackjackDeck(serverSeed: string, clientSeed: string, nonce: number | string, usedDeck: Array<string | FairCard>) {
  const { deck } = await generateBlackjackDeck(serverSeed, clientSeed, nonce);
  const expected = deck.map(cardCode);
  const actual = usedDeck.map(cardCode);
  return expected.length === actual.length && expected.every((code, index) => code === actual[index]);
}

export function createStandardDeck(): FairCard[] {
  const cards: FairCard[] = [];
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      const code = `${rank}${suit}`;
      cards.push({ suit, rank, code, id: code });
    }
  }
  return cards;
}

export function cardCode(card: string | Partial<FairCard>) {
  if (typeof card === "string") return card;
  return String(card?.code || `${card?.rank || ""}${card?.suit || ""}`);
}

function createHmacRandomStream(serverSeed: string, messagePrefix: string) {
  let counter = 0;
  let hex = "";
  let offset = 0;

  async function refill() {
    hex += await hmacSha256(serverSeed, `${messagePrefix}:${counter}`);
    counter += 1;
  }

  return {
    async nextInt(maxExclusive: number) {
      if (maxExclusive <= 1) return 0;
      const bucketSize = 0x1_0000_0000;
      const limit = bucketSize - (bucketSize % maxExclusive);
      while (true) {
        if (offset + 8 > hex.length) await refill();
        const value = Number.parseInt(hex.slice(offset, offset + 8), 16);
        offset += 8;
        if (value < limit) return value % maxExclusive;
      }
    },
  };
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) hex += HEX_CHARS[byte >> 4] + HEX_CHARS[byte & 15];
  return hex;
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
