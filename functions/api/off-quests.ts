import { ensureOffTables, requireOffUser } from "../_offMigrations";
import { claimQuest, periodKeyForQuest } from "../_offQuests";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  await ensureOffTables(context);
  const quests = await context.env.DB.prepare(`SELECT * FROM off_quests WHERE is_active = 1 ORDER BY CASE type WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 WHEN 'seasonal' THEN 3 ELSE 4 END, id`).all();
  const progress = await context.env.DB.prepare(`SELECT * FROM off_user_quest_progress WHERE user_id = ? ORDER BY updated_at DESC`).bind(auth.user.id).all();
  return Response.json({ ok: true, quests: (quests?.results || []).map((q: any) => ({ ...q, period_key: periodKeyForQuest(q.type) })), progress: progress?.results || [] });
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const body = await context.request.json().catch(() => ({}));
  try {
    const result = await claimQuest(context, auth.user.id, String(body?.questSlug || body?.slug || ""), body?.periodKey);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Görev claim edilemedi." }, { status: 400 });
  }
}
