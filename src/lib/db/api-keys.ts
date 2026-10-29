import { getDb, newId, nowIso } from "@/lib/db";

export type ApiKeySummary = {
  id: string;
  key_prefix: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

export async function listApiKeys(userId: string) {
  const { results } = await getDb()
    .prepare("select id, key_prefix, name, created_at, last_used_at from api_keys where user_id = ? order by created_at desc")
    .bind(userId)
    .all<ApiKeySummary>();
  return results;
}

export async function countApiKeys(userId: string) {
  const row = await getDb().prepare("select count(*) as count from api_keys where user_id = ?").bind(userId).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function insertApiKey(userId: string, input: { keyHash: string; keyPrefix: string; name: string }) {
  await getDb()
    .prepare("insert into api_keys (id, user_id, key_hash, key_prefix, name, created_at) values (?, ?, ?, ?, ?, ?)")
    .bind(newId(), userId, input.keyHash, input.keyPrefix, input.name, nowIso())
    .run();
}

export async function deleteApiKey(userId: string, keyId: string) {
  await getDb().prepare("delete from api_keys where id = ? and user_id = ?").bind(keyId, userId).run();
}

/** GPT Actions のBearer認証用。キーのハッシュから持ち主を引き、最終利用日時を更新する。 */
export async function touchApiKeyByHash(keyHash: string) {
  const row = await getDb()
    .prepare("update api_keys set last_used_at = ? where key_hash = ? returning user_id")
    .bind(nowIso(), keyHash)
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}
