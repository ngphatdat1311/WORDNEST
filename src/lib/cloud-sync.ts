import { CloudSyncConfig, WordNestBackupV1 } from '@/types/wordnest';

/**
 * Lightweight Supabase REST Cloud Sync Adapter (Zero extra SDK dependency).
 * Table schema to create once in Supabase SQL Editor:
 *
 *   create table if not exists wordnest_sync (
 *     sync_code text primary key,
 *     payload jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 *   alter table wordnest_sync enable row level security;
 *   create policy "Allow sync by code" on wordnest_sync
 *     for all using (true) with check (true);
 */
export async function pushToSupabase(
  config: CloudSyncConfig,
  payload: WordNestBackupV1
): Promise<{ ok: boolean; error?: string; syncedAt?: string }> {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.syncCode) {
    return { ok: false, error: 'Thiếu thông tin kết nối Supabase hoặc Mã đồng bộ.' };
  }

  const baseUrl = config.supabaseUrl.replace(/\/+$/, '');
  const syncedAt = new Date().toISOString();

  try {
    const res = await fetch(`${baseUrl}/rest/v1/wordnest_sync`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        sync_code: config.syncCode.trim(),
        payload,
        updated_at: syncedAt,
      }),
    });

    if (!res.ok) {
      const msg = await res.text();
      return { ok: false, error: `Lỗi đẩy dữ liệu (${res.status}): ${msg.slice(0, 120)}` };
    }
    return { ok: true, syncedAt };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi kết nối mạng' };
  }
}

export async function pullFromSupabase(
  config: CloudSyncConfig
): Promise<{ ok: boolean; payload?: WordNestBackupV1; updatedAt?: string; error?: string }> {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.syncCode) {
    return { ok: false, error: 'Thiếu thông tin kết nối Supabase hoặc Mã đồng bộ.' };
  }

  const baseUrl = config.supabaseUrl.replace(/\/+$/, '');
  const code = encodeURIComponent(config.syncCode.trim());

  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/wordnest_sync?sync_code=eq.${code}&select=payload,updated_at&limit=1`,
      {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      }
    );

    if (!res.ok) {
      return { ok: false, error: `Lỗi tải dữ liệu (${res.status})` };
    }

    const rows = (await res.json()) as Array<{ payload: WordNestBackupV1; updated_at: string }>;
    if (!rows.length || !rows[0]?.payload) {
      return { ok: false, error: 'Không tìm thấy bản đồng bộ nào với mã này.' };
    }

    return { ok: true, payload: rows[0].payload, updatedAt: rows[0].updated_at };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi kết nối mạng' };
  }
}
