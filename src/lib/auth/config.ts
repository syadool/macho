import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getConfiguredAppUrl } from "@/lib/app-url";
import { getDb } from "@/lib/db";

export function hasAuthEnv() {
  return Boolean(process.env.BETTER_AUTH_SECRET && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function createAuth(db: D1Database) {
  return betterAuth({
    database: db,
    secret: process.env.BETTER_AUTH_SECRET,
    // NEXT_PUBLIC_* はビルド時に埋め込まれるため、実行時に変えられる BETTER_AUTH_URL を優先する
    baseURL: process.env.BETTER_AUTH_URL || getConfiguredAppUrl() || undefined,
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        prompt: "select_account",
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      // Supabase時代のユーザーIDと同じUUID形式にそろえる
      database: { generateId: "uuid" },
    },
    databaseHooks: {
      user: {
        create: {
          // 旧 handle_new_user トリガー相当: サインアップ時にプロフィール行を作る
          after: async (user) => {
            await db.prepare("insert into user_profiles (user_id) values (?) on conflict (user_id) do nothing").bind(user.id).run();
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const authByDb = new WeakMap<D1Database, Auth>();

export function getAuth(): Auth {
  const db = getDb();
  let auth = authByDb.get(db);
  if (!auth) {
    auth = createAuth(db);
    authByDb.set(db, auth);
  }
  return auth;
}
