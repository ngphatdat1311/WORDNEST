import { CloudSyncConfig, WordNestBackupV1 } from '@/types/wordnest';
import { mergeWordNestBackups } from '@/lib/sync-merge';

/**
 * WordNest 2.1 Cloud Sync Adapter (Zero extra SDK dependency).
 *
 * RECOMMENDED SECURE SCHEMA (Supabase Auth + Strict Row-Level Security):
 *   create table if not exists wordnest_user_sync (
 *     user_id uuid primary key references auth.users(id) on delete cascade,
 *     payload jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 *   alter table wordnest_user_sync enable row level security;
 *   create policy "Users manage own sync" on wordnest_user_sync
 *     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

export function resolveSupabaseEndpoints(config: CloudSyncConfig): {
  url: string;
  anonKey: string;
} {
  const url = (config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const anonKey = (config.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey };
}

export interface AuthSessionResult {
  ok: boolean;
  userId?: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  needsEmailConfirm?: boolean;
  error?: string;
}

export async function signUpWithEmail(
  config: CloudSyncConfig,
  email: string,
  password: string
): Promise<AuthSessionResult> {
  const { url, anonKey } = resolveSupabaseEndpoints(config);
  if (!url || !anonKey) {
    return { ok: false, error: 'Thiếu Supabase URL hoặc Anon Key.' };
  }
  try {
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.msg || data?.error_description || `Đăng ký thất bại (${res.status})`,
      };
    }
    if (!data.access_token) {
      return {
        ok: true,
        needsEmailConfirm: true,
        email: email.trim(),
        userId: data?.user?.id,
      };
    }
    return {
      ok: true,
      userId: data.user?.id,
      email: data.user?.email || email.trim(),
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi kết nối mạng' };
  }
}

export async function signInWithEmail(
  config: CloudSyncConfig,
  email: string,
  password: string
): Promise<AuthSessionResult> {
  const { url, anonKey } = resolveSupabaseEndpoints(config);
  if (!url || !anonKey) {
    return { ok: false, error: 'Thiếu Supabase URL hoặc Anon Key.' };
  }
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error_description || data?.msg || `Đăng nhập thất bại (${res.status})`,
      };
    }
    return {
      ok: true,
      userId: data.user?.id,
      email: data.user?.email || email.trim(),
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi kết nối mạng' };
  }
}

async function refreshSession(
  url: string,
  anonKey: string,
  refreshToken: string
): Promise<AuthSessionResult> {
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      return { ok: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
    }
    return {
      ok: true,
      userId: data.user?.id,
      email: data.user?.email,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
    };
  } catch {
    return { ok: false, error: 'Không thể làm mới phiên đăng nhập.' };
  }
}

function isAccountSyncReady(config: CloudSyncConfig): boolean {
  return Boolean(config.accessToken && config.userId && config.authMode !== 'code');
}

export async function pushToSupabase(
  config: CloudSyncConfig,
  payload: WordNestBackupV1
): Promise<{
  ok: boolean;
  error?: string;
  syncedAt?: string;
  refreshedAuth?: Partial<CloudSyncConfig>;
}> {
  const { url, anonKey } = resolveSupabaseEndpoints(config);
  const useAccount = isAccountSyncReady(config);

  if (!url || !anonKey || (!useAccount && !config.syncCode)) {
    return { ok: false, error: 'Thiếu thông tin kết nối Supabase (đăng nhập tài khoản hoặc Mã đồng bộ).' };
  }

  const syncedAt = new Date().toISOString();

  const sendRequest = async (bearerToken: string) => {
    const endpoint = useAccount
      ? `${url}/rest/v1/wordnest_user_sync`
      : `${url}/rest/v1/wordnest_sync`;
    const bodyObj = useAccount
      ? { user_id: config.userId, payload, updated_at: syncedAt }
      : { sync_code: config.syncCode.trim(), payload, updated_at: syncedAt };

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(bodyObj),
    });
  };

  try {
    let token = useAccount ? config.accessToken! : anonKey;
    let res = await sendRequest(token);
    let refreshedAuth: Partial<CloudSyncConfig> | undefined;

    if (res.status === 401 && useAccount && config.refreshToken) {
      const ref = await refreshSession(url, anonKey, config.refreshToken);
      if (ref.ok && ref.accessToken) {
        token = ref.accessToken;
        refreshedAuth = {
          accessToken: ref.accessToken,
          refreshToken: ref.refreshToken,
        };
        res = await sendRequest(token);
      }
    }

    if (!res.ok) {
      const msg = await res.text();
      return { ok: false, error: `Lỗi đẩy dữ liệu (${res.status}): ${msg.slice(0, 120)}` };
    }
    return { ok: true, syncedAt, refreshedAuth };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi kết nối mạng' };
  }
}

export async function pullFromSupabase(
  config: CloudSyncConfig
): Promise<{
  ok: boolean;
  notFound?: boolean;
  payload?: WordNestBackupV1;
  updatedAt?: string;
  error?: string;
  refreshedAuth?: Partial<CloudSyncConfig>;
}> {
  const { url, anonKey } = resolveSupabaseEndpoints(config);
  const useAccount = isAccountSyncReady(config);

  if (!url || !anonKey || (!useAccount && !config.syncCode)) {
    return { ok: false, error: 'Thiếu thông tin kết nối Supabase (đăng nhập tài khoản hoặc Mã đồng bộ).' };
  }

  const fetchRows = async (bearerToken: string) => {
    const queryUrl = useAccount
      ? `${url}/rest/v1/wordnest_user_sync?user_id=eq.${encodeURIComponent(config.userId!)}&select=payload,updated_at&limit=1`
      : `${url}/rest/v1/wordnest_sync?sync_code=eq.${encodeURIComponent(config.syncCode.trim())}&select=payload,updated_at&limit=1`;
    return fetch(queryUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${bearerToken}`,
      },
    });
  };

  try {
    let token = useAccount ? config.accessToken! : anonKey;
    let res = await fetchRows(token);
    let refreshedAuth: Partial<CloudSyncConfig> | undefined;

    if (res.status === 401 && useAccount && config.refreshToken) {
      const ref = await refreshSession(url, anonKey, config.refreshToken);
      if (ref.ok && ref.accessToken) {
        token = ref.accessToken;
        refreshedAuth = {
          accessToken: ref.accessToken,
          refreshToken: ref.refreshToken,
        };
        res = await fetchRows(token);
      }
    }

    if (!res.ok) {
      return { ok: false, error: `Lỗi tải dữ liệu (${res.status})` };
    }

    const rows = (await res.json()) as Array<{ payload: WordNestBackupV1; updated_at: string }>;
    if (!rows.length || !rows[0]?.payload) {
      return {
        ok: false,
        notFound: true,
        error: 'Chưa có bản đồng bộ nào trên Cloud.',
        refreshedAuth,
      };
    }

    return { ok: true, payload: rows[0].payload, updatedAt: rows[0].updated_at, refreshedAuth };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi kết nối mạng' };
  }
}

/**
 * Conflict-free Two-Way Sync:
 * Pulls remote snapshot -> merges per-record with local -> pushes merged result back.
 * Studying offline on phone + laptop simultaneously will NEVER wipe either device's progress.
 */
export async function syncTwoWayWithSupabase(
  config: CloudSyncConfig,
  localBackup: WordNestBackupV1
): Promise<{
  ok: boolean;
  mergedPayload?: WordNestBackupV1;
  syncedAt?: string;
  refreshedAuth?: Partial<CloudSyncConfig>;
  error?: string;
}> {
  const pullRes = await pullFromSupabase(config);
  const workingConfig: CloudSyncConfig = pullRes.refreshedAuth
    ? { ...config, ...pullRes.refreshedAuth }
    : config;

  // If remote doesn't exist yet (first-ever sync), push local directly
  const mergedPayload =
    pullRes.ok && pullRes.payload
      ? mergeWordNestBackups(localBackup, pullRes.payload)
      : localBackup;

  if (!pullRes.ok && !pullRes.notFound) {
    return { ok: false, error: pullRes.error };
  }

  const pushRes = await pushToSupabase(workingConfig, mergedPayload);
  if (!pushRes.ok) {
    return { ok: false, error: pushRes.error };
  }

  return {
    ok: true,
    mergedPayload,
    syncedAt: pushRes.syncedAt,
    refreshedAuth: {
      ...(pullRes.refreshedAuth || {}),
      ...(pushRes.refreshedAuth || {}),
    },
  };
}
