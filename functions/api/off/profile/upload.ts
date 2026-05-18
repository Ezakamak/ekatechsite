import { requireOffUser } from "../../../_offFriends";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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

  const dataUrl = `data:${file.type};base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}`;
  const column = type === "avatar" ? "avatar_url" : "banner_url";
  await context.env.DB.prepare(`UPDATE off_profiles SET ${column}=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).bind(dataUrl, auth.user.id).run();

  return Response.json({ ok: true, url: dataUrl });
}
