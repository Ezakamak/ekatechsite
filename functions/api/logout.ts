export async function onRequestPost(context: any) {
  try {
    const token = getCookie(context.request.headers.get("Cookie") || "", "session");

    if (token) {
      await context.env.DB
        .prepare("DELETE FROM sessions WHERE token = ?")
        .bind(token)
        .run();
    }

    return new Response(JSON.stringify({ success: true, message: "Çıkış yapıldı." }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
      },
    });
  } catch (error) {
    return Response.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

function getCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
