export async function onRequestGet(context: any) {
  const clientId = context.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return Response.json({ error: "GOOGLE_CLIENT_ID eksik. Cloudflare Pages environment variables içine ekle." }, { status: 500 });
  }

  const origin = new URL(context.request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      "Set-Cookie": `google_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
