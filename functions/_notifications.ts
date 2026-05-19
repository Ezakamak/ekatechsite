export type NotificationCategory = 'site' | 'off' | 'invest' | 'miner' | 'event' | 'reward';

export type CreateNotificationInput = {
  userId: number;
  type?: string;
  category?: NotificationCategory | string;
  title: string;
  body?: string;
  link?: string;
  actionLabel?: string;
  actionPayload?: string;
  sourceTable?: string;
  sourceId?: string;
  priority?: 'normal' | 'high' | string;
  expiresAt?: string;
};

export async function createNotification(context: any, input: CreateNotificationInput) {
  const userId = Number(input.userId || 0);
  if (!userId || !input.title) return { ok: false, skipped: true };

  if (input.sourceTable && input.sourceId) {
    const existing = await context.env.DB.prepare(
      `SELECT id FROM notifications
       WHERE user_id = ?
         AND source_table = ?
         AND source_id = ?
         AND (expires_at IS NULL OR expires_at > datetime('now'))
       LIMIT 1`
    ).bind(userId, input.sourceTable, input.sourceId).first();
    if (existing) return { ok: true, skipped: true, id: existing.id };
  }

  const result = await context.env.DB.prepare(
    `INSERT INTO notifications
      (user_id, type, category, title, body, link, action_label, action_payload, source_table, source_id, priority, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userId,
    input.type || 'system',
    input.category || 'site',
    input.title,
    input.body || null,
    input.link || null,
    input.actionLabel || null,
    input.actionPayload || null,
    input.sourceTable || null,
    input.sourceId || null,
    input.priority || 'normal',
    input.expiresAt || null
  ).run();

  return { ok: true, id: result.meta?.last_row_id || null, skipped: false };
}

export async function createBulkNotifications(context: any, notifications: CreateNotificationInput[]) {
  const results = [];
  for (const notification of notifications || []) {
    results.push(await createNotification(context, notification));
  }
  return results;
}

export async function markNotificationRead(context: any, userId: number, notificationId?: number) {
  if (notificationId) {
    await context.env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").bind(notificationId, userId).run();
    return;
  }
  await context.env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(userId).run();
}

export async function deleteExpiredNotifications(context: any) {
  return context.env.DB.prepare("DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')").run();
}

export async function createOffFriendRequestNotification(context: any, params: { inviteeId: number; requesterDisplayName: string; friendshipId: number }) {
  return createNotification(context, {
    userId: params.inviteeId,
    category: 'off',
    type: 'friend_request',
    title: 'Yeni arkadaşlık isteği',
    body: `${params.requesterDisplayName} sana arkadaşlık isteği gönderdi.`,
    link: '/off',
    sourceTable: 'off_friendships',
    sourceId: String(params.friendshipId),
    actionLabel: 'İsteği görüntüle',
    priority: 'high',
  });
}

export async function createOffFriendAcceptedNotification(context: any, params: { requesterId: number; addresseeDisplayName: string; friendshipId: number }) {
  return createNotification(context, {
    userId: params.requesterId,
    category: 'off',
    type: 'friend_accepted',
    title: 'Arkadaşlık isteğin kabul edildi',
    body: `${params.addresseeDisplayName} arkadaşlık isteğini kabul etti.`,
    link: '/off',
    sourceTable: 'off_friendships',
    sourceId: `accepted:${params.friendshipId}`,
  });
}

export async function createInvestDailyStockSummaryNotification(context: any, params: { userId: number; stockSymbol: string; dayKey: string; percentChange: number }) {
  const wentUp = params.percentChange >= 0;
  const delta = Math.abs(params.percentChange).toFixed(1);
  return createNotification(context, {
    userId: params.userId,
    category: 'invest',
    type: 'daily_stock_summary',
    title: 'EkaInvest Günlük Özet',
    body: `Sahip olduğun ${params.stockSymbol} hissesi bugün %${delta} ${wentUp ? 'yükseldi' : 'düştü'}.`,
    link: '/market',
    sourceTable: 'invest_daily_summary',
    sourceId: `${params.stockSymbol}:${params.dayKey}`,
  });
}

export async function createMinerNotification(context: any, params: { userId: number; type: 'miner_ready' | 'miner_reward' | 'miner_cooldown'; title: string; body?: string; sourceId?: string }) {
  return createNotification(context, {
    userId: params.userId,
    category: 'miner',
    type: params.type,
    title: params.title,
    body: params.body,
    link: '/tech-coin-miner',
    sourceTable: 'techcoin_miner',
    sourceId: params.sourceId || `${params.type}:${new Date().toISOString().slice(0, 16)}`,
  });
}

export async function createSpecialEventNotification(context: any, params: { userId: number; title: string; body?: string; expiresAt?: string; sourceId?: string }) {
  return createNotification(context, {
    userId: params.userId,
    category: 'event',
    type: 'special_event',
    title: params.title,
    body: params.body,
    link: '/off',
    sourceTable: 'special_events',
    sourceId: params.sourceId || params.title,
    expiresAt: params.expiresAt,
    priority: 'high',
  });
}
