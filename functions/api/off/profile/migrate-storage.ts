import { requireOffUser } from "../../../_offFriends";

function parseDataUrl(raw: string) {
  const m = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return { mime, bytes };
}

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const row = await context.env.DB.prepare(`SELECT avatar_data, banner_data FROM off_profiles WHERE user_id=?`).bind(auth.user.id).first<any>();
  if (!row) return Response.json({ ok: true, migrated: 0 });
  let migrated = 0;
  for (const field of ["avatar_data", "banner_data"] as const) {
    const parsed = parseDataUrl(String(row[field] || ""));
    if (!parsed) continue;
    const key = `off/${auth.user.id}/${field}/${Date.now()}-${crypto.randomUUID()}`;
    await context.env.UPLOADS_BUCKET.put(key, parsed.bytes, { httpMetadata: { contentType: parsed.mime } });
    await context.env.DB.prepare(`INSERT INTO uploaded_files (user_id, file_name, file_size, mime_type, r2_key, visibility) VALUES (?, ?, ?, ?, ?, 'private')`).bind(auth.user.id, `${field}.img`, parsed.bytes.length, parsed.mime, key).run();
    await context.env.DB.prepare(`UPDATE storage_quota SET used_bytes = used_bytes + ?, updated_at=CURRENT_TIMESTAMP WHERE id=1`).bind(parsed.bytes.length).run();
    const col = field === "avatar_data" ? "avatar_url" : "banner_url";
    await context.env.DB.prepare(`UPDATE off_profiles SET ${col}=?, ${field}=NULL, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).bind(`/api/files/${encodeURIComponent(key)}`, auth.user.id).run();
    migrated++;
  }
  return Response.json({ ok: true, migrated });
}
