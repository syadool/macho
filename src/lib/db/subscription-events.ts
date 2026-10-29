import { getDb, newId, nowIso } from "@/lib/db";

export async function recordSubscriptionEvent(input: { stripeEventId: string; eventType: string; payload: unknown }) {
  await getDb()
    .prepare(
      `insert into subscription_events (id, stripe_event_id, event_type, payload, created_at) values (?, ?, ?, ?, ?)
      on conflict (stripe_event_id) do nothing`,
    )
    .bind(newId(), input.stripeEventId, input.eventType, JSON.stringify(input.payload), nowIso())
    .run();
}

/** 旧 claim_subscription_event RPC。未処理かつ処理中でない（または5分以上止まっている）イベントだけ取得できる。 */
export async function claimSubscriptionEvent(stripeEventId: string) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const row = await getDb()
    .prepare(
      `update subscription_events set processing_started_at = ?
      where stripe_event_id = ?
        and processed_at is null
        and (processing_started_at is null or processing_started_at < ?)
      returning id`,
    )
    .bind(nowIso(), stripeEventId, staleBefore)
    .first<{ id: string }>();
  return row !== null;
}

export async function markSubscriptionEventProcessed(stripeEventId: string, userId: string | null) {
  await getDb()
    .prepare("update subscription_events set user_id = ?, processed_at = ? where stripe_event_id = ?")
    .bind(userId, nowIso(), stripeEventId)
    .run();
}
