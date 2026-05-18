import { ensureOffProfile, requireOffUser, resolveDisplayName } from "../../_offFriends";

const clean = (value: any, max: number) => {
  const text = String(value || "").replace(/<[^>]*>/g, "").trim();
  if (!text) return null;
  return text.slice(0, max);
};

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const uid = auth.user.id;
  await ensureOffProfile(context, uid);
  const row = await context.env.DB.prepare(`SELECT u.id, u.name, u.username, u.display_name, op.display_name AS off_display_name, op.avatar_url, op.banner_url, op.bio, op.selected_title, op.selected_badge FROM users u LEFT JOIN off_profiles op ON op.user_id=u.id WHERE u.id=?`).bind(uid).first<any>();
  return Response.json({ ok: true, profile: {
    userId: uid,
    displayName: resolveDisplayName(row),
    avatarUrl: row?.avatar_url || null,
    bannerUrl: row?.banner_url || null,
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
  const payload = {
    display_name: clean(body.display_name ?? body.displayName, 24),
    bio: clean(body.bio, 160),
    avatar_url: clean(body.avatar_url ?? body.avatarUrl, 512),
    banner_url: clean(body.banner_url ?? body.bannerUrl, 512),
    selected_title: clean(body.selected_title ?? body.selectedTitle, 64),
    selected_badge: clean(body.selected_badge ?? body.selectedBadge, 64)
  };
  await context.env.DB.prepare(`UPDATE off_profiles SET display_name=?, avatar_url=?, banner_url=?, bio=?, selected_title=?, selected_badge=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
    .bind(payload.display_name, payload.avatar_url, payload.banner_url, payload.bio, payload.selected_title, payload.selected_badge, uid).run();
  return onRequestGet(context);
};

export const onRequestPost = onRequestPatch;
