// Cloudflare Worker function to return tech coin balance for authenticated user
// File: workers/get-techcoin.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/techcoin') {
      return new Response('Not Found', { status: 404 });
    }

    // For now, we accept X-User-Id header as authentication.
    const userId = request.headers.get('x-user-id');
    if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    try {
      const stmt = env.D1.prepare('SELECT balance FROM tech_coin_wallets WHERE user_id = ?');
      const res = await stmt.bind(userId).first();
      const balance = res?.balance ?? 0;
      return new Response(JSON.stringify({ balance }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'internal', detail: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
}
