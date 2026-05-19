import { requireOffUser } from "../../../_offFriends";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function onRequestPost(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const form = await context.request.formData();
  const file = form.get("file");
  const type = String(form.get("type") || "");

  if (!(file instanceof File)) return Response.json({ error: "Dosya gerekli" }, { status: 400 });
  if (type !== "avatar" && type !== "banner") return Response.json({ error: "Geçersiz yükleme tipi" }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Sadece PNG, JPEG veya WEBP yükleyebilirsin" }, { status: 400 });

  const maxSize = type === "avatar" ? 300 * 1024 : 700 * 1024;
  if (file.size > maxSize) {
    return Response.json({ error: type === "avatar" ? "Avatar en fazla 300KB olabilir" : "Banner en fazla 700KB olabilir" }, { status: 400 });
  }

  const quota = await context.env.DB.prepare("SELECT used_bytes, max_bytes FROM storage_quota WHERE id=1").first<any>();
  const used = Number(quota?.used_bytes || 0);
  const max = Number(quota?.max_bytes || 8000000000);
  if (used + file.size > max) {
    return Response.json({ error: "Depolama limiti doldu. Yeni dosya yüklenemez." }, { status: 413 });
  }

  const r2Key = `off/${auth.user.id}/${type}/${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await context.env.UPLOADS_BUCKET.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });

  await context.env.DB.prepare(
    `INSERT INTO uploaded_files (user_id, file_name, file_size, mime_type, r2_key, visibility) VALUES (?, ?, ?, ?, ?, 'private')`
  ).bind(auth.user.id, file.name, file.size, file.type, r2Key).run();

  await context.env.DB.prepare(`UPDATE storage_quota SET used_bytes = used_bytes + ?, updated_at=CURRENT_TIMESTAMP WHERE id=1`).bind(file.size).run();

  const column = type === "avatar" ? "avatar_url" : "banner_url";
  const url = `/api/files/${encodeURIComponent(r2Key)}`;
  await context.env.DB.prepare(`UPDATE off_profiles SET ${column}=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).bind(url, auth.user.id).run();

  return Response.json({ ok: true, url });
}
