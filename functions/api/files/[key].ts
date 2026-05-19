import { requireOffUser } from "../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireOffUser(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const key = decodeURIComponent(String(context.params.key || ""));
  const file = await context.env.DB.prepare(`SELECT * FROM uploaded_files WHERE r2_key=? AND deleted_at IS NULL`).bind(key).first<any>();
  if (!file) return new Response("Not found", { status: 404 });
  if (file.visibility === "private" && Number(file.user_id) !== auth.user.id && auth.user.role !== "admin" && auth.user.role !== "owner") return new Response("Forbidden", { status: 403 });
  const object = await context.env.UPLOADS_BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": file.mime_type || "application/octet-stream" } });
}
