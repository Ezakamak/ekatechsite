import { debitTechCoins, getWallet } from "../_coinWallet";
import { ensureOffTables, requireOffUser } from "../_offMigrations";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const items = await context.env.DB.prepare(`SELECT c.*, uc.acquired_at, COALESCE(uc.equipped, 0) AS equipped FROM off_cosmetics c LEFT JOIN off_user_cosmetics uc ON uc.cosmetic_slug = c.slug AND uc.user_id = ? WHERE c.is_active = 1 ORDER BY c.category, c.cost_points`).bind(auth.user.id).all();
  return Response.json({ ok: true, cosmetics: items?.results || [], wallet: await getWallet(context, auth.user.id) });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  const slug = String(body?.slug || "");
  const action = String(body?.action || "unlock");
  await ensureOffTables(context);
  const item: any = await context.env.DB.prepare(`SELECT * FROM off_cosmetics WHERE slug = ? AND is_active = 1`).bind(slug).first();
  if (!item) return Response.json({ error: "Kozmetik bulunamadı." }, { status: 404 });
  if (action === "equip") {
    const owned: any = await context.env.DB.prepare(`SELECT id FROM off_user_cosmetics WHERE user_id = ? AND cosmetic_slug = ?`).bind(auth.user.id, slug).first();
    if (!owned) return Response.json({ error: "Önce kilidi açmalısın." }, { status: 403 });
    await context.env.DB.prepare(`UPDATE off_user_cosmetics SET equipped = 0 WHERE user_id = ? AND cosmetic_slug IN (SELECT slug FROM off_cosmetics WHERE category = ?)`).bind(auth.user.id, item.category).run();
    await context.env.DB.prepare(`UPDATE off_user_cosmetics SET equipped = 1 WHERE user_id = ? AND cosmetic_slug = ?`).bind(auth.user.id, slug).run();
    const column = item.category === "frame" ? "equipped_frame_slug" : item.category === "avatar_glow" ? "equipped_avatar_glow_slug" : item.category === "name_tag" ? "equipped_name_tag_slug" : null;
    if (column) await context.env.DB.prepare(`UPDATE off_user_profiles SET ${column} = ?, updated_at = datetime('now') WHERE user_id = ?`).bind(slug, auth.user.id).run();
    return Response.json({ ok: true, message: "Kozmetik kullanılıyor.", wallet: await getWallet(context, auth.user.id) });
  }
  const insert = await context.env.DB.prepare(`INSERT OR IGNORE INTO off_user_cosmetics (user_id, cosmetic_slug, acquired_at, equipped) VALUES (?, ?, datetime('now'), 0)`).bind(auth.user.id, slug).run();
  if ((insert.meta?.changes || 0) < 1) return Response.json({ error: "Bu kozmetik zaten sende." }, { status: 409 });
  const debit = await debitTechCoins(context, auth.user.id, Number(item.cost_points || 0), `OFF Cosmetic: ${slug}`);
  if (!debit.ok) {
    await context.env.DB.prepare(`DELETE FROM off_user_cosmetics WHERE user_id = ? AND cosmetic_slug = ?`).bind(auth.user.id, slug).run();
    return Response.json({ error: "Yetersiz Tech Coin bakiyesi.", wallet: debit.wallet }, { status: 402 });
  }
  return Response.json({ ok: true, message: "Kozmetik kilidi açıldı.", wallet: debit.wallet, cosmetic: item });
}
