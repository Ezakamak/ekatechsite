const EMAIL_REGEX = /@|^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const NICKNAME_REGEX = /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü\s_-]{3,24}$/;
const BLOCKED_NICKNAMES = new Set(["admin", "owner", "bot", "system"]);

export async function ensureUsersNicknameColumn(context: any) {
  const columns = await context.env.DB.prepare(`PRAGMA table_info(users)`).all<any>();
  const hasNickname = (columns?.results || []).some((column: any) => String(column?.name || "").toLowerCase() === "nickname");
  if (!hasNickname) {
    await context.env.DB.prepare(`ALTER TABLE users ADD COLUMN nickname TEXT`).run().catch(() => null);
  }
}

export function guestNameFromId(id: number) {
  const safeId = Number.isFinite(id) ? Math.max(0, Math.trunc(id)) : 0;
  return `Guest ${100 + (safeId % 900)}`;
}

export function isEmailLike(value: string) {
  const v = String(value || "").trim();
  return EMAIL_REGEX.test(v);
}

export function sanitizeNickname(raw: unknown) {
  const nickname = String(raw || "").trim();
  if (!nickname) return { ok: false, error: "Nickname boş olamaz." };
  if (!NICKNAME_REGEX.test(nickname)) return { ok: false, error: "Nickname 3-24 karakter olmalı ve sadece harf/sayı/boşluk/_/- içerebilir." };
  if (isEmailLike(nickname)) return { ok: false, error: "Nickname e-posta olamaz." };
  if (BLOCKED_NICKNAMES.has(nickname.toLowerCase())) return { ok: false, error: "Bu nickname kullanılamaz." };
  return { ok: true, nickname };
}

export function resolvePublicDisplayName(row: any) {
  const userId = Number(row?.id || row?.user_id || 0);
  const nickname = String(row?.nickname || "").trim();
  if (nickname && !isEmailLike(nickname)) return nickname;
  const name = String(row?.name || "").trim();
  if (name && !isEmailLike(name)) return name;
  return guestNameFromId(userId);
}
