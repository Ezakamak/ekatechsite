import { respondInvite } from './_shared';
export async function onRequestPost(context: any) {
  const body = await context.request.json().catch(() => null);
  const action = String(body?.action || '');
  if (action !== 'accept' && action !== 'reject') return Response.json({ error: 'Geçersiz işlem.' }, { status: 400 });
  return respondInvite({ ...context, request: new Request(context.request.url, { method: 'POST', headers: context.request.headers, body: JSON.stringify(body) }) }, action as 'accept' | 'reject');
}
