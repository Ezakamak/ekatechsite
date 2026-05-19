import { requireSessionOnly } from "../../_offFriends";

export async function onRequestGet(context: any) {
  const auth = await requireSessionOnly(context);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const key = decodeURIComponent(String(context.params.key || ""));
  const fileStmt = context.env.DB.prepare(`SELECT user_id, mime_type, visibility, r2_key FROM uploaded_files WHERE r2_key=? AND deleted_at IS NULL`).bind(key);
  const file = await fileStmt.first<any>();
  if (!file) return new Response("Not found", { status: 404 });
  if (file.visibility === "private" && Number(file.user_id) !== auth.user.id && auth.user.role !== "admin" && auth.user.role !== "owner") return new Response("Forbidden", { status: 403 });
  const object = await context.env.UPLOADS_BUCKET.get(file.r2_key || key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": file.mime_type || "application/octet-stream", "Cache-Control": file.visibility === "public" ? "public, max-age=86400, s-maxage=86400" : "private, max-age=60" } });
}
