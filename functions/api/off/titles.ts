import { requireOffUser } from "../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await context.env.DB.prepare(
    `SELECT t.code, t.name, t.description, t.rarity
     FROM off_user_titles ut
     JOIN off_titles t ON t.code = ut.title_code
     WHERE ut.user_id = ?
     ORDER BY ut.unlocked_at DESC`
  ).bind(auth.user.id).all();
  return Response.json({ ok: true, titles: rows.results || [] });
}
