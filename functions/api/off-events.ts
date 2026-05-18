import { creditTechCoins } from "../_coinWallet";
import { awardGameExp } from "../_levels";
import { unlockBadge } from "../_offAchievements";
import { ensureOffTables, requireAdminUser, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const rows = await context.env.DB.prepare(`SELECT e.*, p.joined_at, p.completed_at, p.claimed_at FROM off_events e LEFT JOIN off_event_participants p ON p.event_id = e.id AND p.user_id = ? WHERE e.is_active = 1 ORDER BY e.starts_at DESC`).bind(auth.user.id).all();
  return Response.json({ ok: true, events: rows?.results || [] });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  await ensureOffTables(context);
  if (body?.adminCreate) {
    const admin = await requireAdminUser(context);
    if (!admin.ok) return Response.json({ error: admin.error }, { status: admin.status });
    await context.env.DB.prepare(`INSERT INTO off_events (slug, title_tr, title_en, description_tr, description_en, target_game, starts_at, ends_at, reward_exp, reward_points, reward_badge_slug, is_active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`).bind(body.slug, body.title_tr, body.title_en || body.title_tr, body.description_tr, body.description_en || body.description_tr, body.target_game || null, body.starts_at, body.ends_at, Number(body.reward_exp || 0), Number(body.reward_points || 0), body.reward_badge_slug || null, auth.user.id).run();
    return Response.json({ ok: true });
  }
  const event: any = await context.env.DB.prepare(`SELECT * FROM off_events WHERE id = ? AND is_active = 1`).bind(Number(body?.eventId || 0)).first();
  if (!event) return Response.json({ error: "Etkinlik bulunamadı." }, { status: 404 });
  if (body?.action === "claim") {
    const claim = await context.env.DB.prepare(`UPDATE off_event_participants SET claimed_at = datetime('now') WHERE event_id = ? AND user_id = ? AND claimed_at IS NULL`).bind(event.id, auth.user.id).run();
    if ((claim.meta?.changes || 0) < 1) return Response.json({ error: "Etkinlik ödülü zaten claim edildi veya katılım yok." }, { status: 409 });
    const level = Number(event.reward_exp || 0) ? await awardGameExp(context, auth.user.id, Number(event.reward_exp || 0), `OFF Event: ${event.slug}`, "event") : null;
    const wallet = Number(event.reward_points || 0) ? await creditTechCoins(context, auth.user.id, Number(event.reward_points || 0), `OFF Event: ${event.slug}`) : null;
    const badge = event.reward_badge_slug ? await unlockBadge(context, auth.user.id, event.reward_badge_slug, "event") : null;
    return Response.json({ ok: true, level, wallet, unlockedBadges: badge ? [badge] : [] });
  }
  await context.env.DB.prepare(`INSERT OR IGNORE INTO off_event_participants (event_id, user_id, joined_at) VALUES (?, ?, datetime('now'))`).bind(event.id, auth.user.id).run();
  return Response.json({ ok: true });
}
