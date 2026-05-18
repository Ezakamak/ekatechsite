import { ensureOffProfile, requireOffUser, resolveDisplayName } from "../../_offFriends";

const clean = (value: any, max: number) => {
  const text = String(value || "").replace(/<[^>]*>/g, "").trim();
  if (!text) return null;
  return text.slice(0, max);
};

const DATA_URL_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const parseDataUrl = (value: any, maxBytes: number, fieldName: string) => {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error(`${fieldName} geçersiz formatta`);
  const mimeType = match[1].toLowerCase();
  if (!DATA_URL_TYPES.has(mimeType)) throw new Error(`${fieldName} formatı desteklenmiyor`);
  const base64 = match[2];
  const byteSize = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (byteSize > maxBytes) throw new Error(`${fieldName} boyutu limiti aşıyor`);
  return raw;
};

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  await ensureOffProfile(context, uid);
  const row = await context.env.DB.prepare(`SELECT u.id, u.name, u.username, u.display_name, op.display_name AS off_display_name, op.avatar_url, op.banner_url, op.avatar_data, op.banner_data, op.bio, op.selected_title, op.selected_badge FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(uid).first<any>();
  return Response.json({ ok: true, profile: {
    userId: uid,
    displayName: resolveDisplayName(row),
    avatarUrl: row?.avatar_data || row?.avatar_url || null,
    bannerUrl: row?.banner_data || row?.banner_url || null,
    bio: row?.bio || null,
    selectedTitle: row?.selected_title || null,
    selectedBadge: row?.selected_badge || null,
  } });
}

export const onRequestPatch = async (context: any) => {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  await ensureOffProfile(context, uid);
  const body = await context.request.json().catch(() => ({}));
  let avatarData: string | undefined;
  let bannerData: string | undefined;
  try {
    avatarData = parseDataUrl(body.avatar_data ?? body.avatarData, 300 * 1024, "Avatar");
    bannerData = parseDataUrl(body.banner_data ?? body.bannerData, 700 * 1024, "Banner");
  } catch (error: any) {
    return Response.json({ error: error?.message || "Geçersiz görsel verisi" }, { status: 400 });
  }

  const payload = {
    display_name: clean(body.display_name ?? body.displayName, 24),
    bio: clean(body.bio, 160),
    avatar_url: clean(body.avatar_url ?? body.avatarUrl, 2_000_000),
    banner_url: clean(body.banner_url ?? body.bannerUrl, 2_000_000),
    selected_title: clean(body.selected_title ?? body.selectedTitle, 64),
    selected_badge: clean(body.selected_badge ?? body.selectedBadge, 64)
  };

  if (payload.selected_title) {
    const unlocked = await context.env.DB.prepare(`SELECT 1 FROM off_user_titles WHERE user_id=? AND title_code=?`).bind(uid, payload.selected_title).first<any>();
    if (!unlocked) return Response.json({ error: "Bu lakap henüz kazanılmadı" }, { status: 400 });
  }

  let query = `UPDATE off_profiles SET display_name=?, avatar_url=?, banner_url=?, bio=?, selected_title=?, selected_badge=?`;
  const params: any[] = [payload.display_name, payload.avatar_url, payload.banner_url, payload.bio, payload.selected_title || null, payload.selected_badge];
  if (avatarData !== undefined) {
    query += `, avatar_data=?`;
    params.push(avatarData);
  }
  if (bannerData !== undefined) {
    query += `, banner_data=?`;
    params.push(bannerData);
  }
  query += `, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`;
  params.push(uid);
  await context.env.DB.prepare(query).bind(...params).run();
  return onRequestGet(context);
};

export const onRequestPost = onRequestPatch;
