export async function onRequestGet(context: any) {
  try {
    const result = await context.env.DB
      .prepare(`
        SELECT id, announcement_type, message, image_url, expires_at, created_at
        FROM announcements
        WHERE is_active = 1 AND datetime(expires_at) > datetime('now')
        ORDER BY id DESC
        LIMIT 1
      `)
      .all();

    return Response.json({ announcements: result?.results || [] });
  } catch (error) {
    return Response.json({ announcements: [], error: "announcements tablosu henüz hazır değil." });
  }
}
