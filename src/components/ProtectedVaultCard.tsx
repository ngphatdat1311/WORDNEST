'use client';

import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  HardDrive,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useWordNestStore } from '@/store/useWordNestStore';

interface VaultStatus {
  configured: boolean;
  enabled: boolean;
  locked: boolean;
  vaultDir: string;
  lastBackupAt: string | null;
  lastBackupSizeBytes: number;
  fileCount: number;
}

interface DesktopVaultBridge {
  getStatus: () => Promise<VaultStatus>;
  pickDir: () => Promise<{ canceled: boolean; path?: string }>;
  setup: (opts: {
    password: string;
    currentPassword?: string;
    vaultDir?: string;
  }) => Promise<{ ok: boolean; error?: string; status?: VaultStatus }>;
  backupNow: (rawJson?: string) => Promise<{ ok: boolean; bytes?: number; error?: string; status?: VaultStatus }>;
  unlock: (
    password: string,
    action: 'unlock-folder' | 'disable' | 'delete-all'
  ) => Promise<{ ok: boolean; error?: string; status?: VaultStatus }>;
  relock: () => Promise<{ ok: boolean; error?: string; status?: VaultStatus }>;
  restore: (
    password: string,
    useLatest: boolean
  ) => Promise<{ ok: boolean; canceled?: boolean; rawJson?: string; error?: string }>;
  openFolder: () => Promise<{ ok: boolean; error?: string }>;
}

function getVaultBridge(): DesktopVaultBridge | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as { wordnestDesktop?: { vault?: DesktopVaultBridge } }).wordnestDesktop?.vault ?? null
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProtectedVaultCard() {
  const exportBackup = useWordNestStore((s) => s.exportBackup);
  const importBackup = useWordNestStore((s) => s.importBackup);
  const showToast = useWordNestStore((s) => s.showToast);

  const [bridge] = useState<DesktopVaultBridge | null>(() => getVaultBridge());
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [draftDir, setDraftDir] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [showPassForm, setShowPassForm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    bridge
      .getStatus()
      .then((s) => {
        if (!active) return;
        setStatus(s);
        setDraftDir(s.vaultDir || '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [bridge]);

  if (!bridge) {
    return (
      <div className="bg-warm-card rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: 'var(--green)' }} />
          <h2 className="font-semibold text-sm">Két Sao Lưu Tự Động Chống Xóa (Desktop App)</h2>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          Khi dùng ứng dụng <strong>WordNest Desktop (.exe / .dmg / .deb / .AppImage)</strong>, bạn có thể chọn một thư mục riêng trên máy để tự động sao lưu liên tục theo định dạng nén siêu nhẹ &amp; mã hóa AES-256-GCM (<code>.wnbak</code>), khóa chống xóa ở cấp hệ điều hành và chỉ mở khóa/xóa được khi nhập đúng mật khẩu của bạn.
        </p>
      </div>
    );
  }

  const handlePickFolder = async () => {
    const res = await bridge.pickDir();
    if (!res.canceled && res.path) {
      setDraftDir(res.path);
      if (status?.configured) {
        setShowPassForm(true);
        showToast('Nhập mật khẩu hiện tại bên dưới rồi bấm Lưu để đổi thư mục két sao lưu.', 'default');
      }
    }
  };

  const handleSaveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const passToUse = newPassword.trim() || currentPassword.trim();
    if (passToUse.length < 4) {
      showToast('Mật khẩu bảo vệ cần tối thiểu 4 ký tự.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await bridge.setup({
        password: passToUse,
        currentPassword: status?.configured ? currentPassword : undefined,
        vaultDir: draftDir || undefined,
      });
      if (!res.ok) {
        showToast(res.error || 'Không thể thiết lập két sao lưu.', 'error');
        return;
      }
      if (res.status) setStatus(res.status);
      // Push immediate fresh backup snapshot
      const backupPayload = JSON.stringify({ state: exportBackup() });
      const bRes = await bridge.backupNow(backupPayload);
      if (bRes.status) setStatus(bRes.status);
      setNewPassword('');
      setCurrentPassword('');
      setShowPassForm(false);
      showToast('Đã bật két sao lưu tự động liên tục & khóa chống xóa bằng mật khẩu!', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleBackupNow = async () => {
    setBusy(true);
    try {
      const backupPayload = JSON.stringify({ state: exportBackup() });
      const res = await bridge.backupNow(backupPayload);
      if (!res.ok) {
        showToast(res.error || 'Chưa bật két sao lưu.', 'error');
        return;
      }
      if (res.status) setStatus(res.status);
      showToast(`Đã sao lưu nén (${formatBytes(res.bytes || 0)}) và khóa chống xóa!`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockAction = async (action: 'unlock-folder' | 'delete-all') => {
    if (!actionPassword.trim()) {
      showToast('Vui lòng nhập mật khẩu két sao lưu trước!', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await bridge.unlock(actionPassword.trim(), action);
      if (!res.ok) {
        showToast(res.error || 'Mật khẩu không đúng!', 'error');
        return;
      }
      if (res.status) setStatus(res.status);
      setActionPassword('');
      showToast(
        action === 'delete-all'
          ? 'Đã xác thực mật khẩu và xóa sạch file backup cũ trong két.'
          : 'Đã mở khóa chống xóa thư mục sao lưu (bạn có thể bấm Khóa lại bất cứ lúc nào).',
        'success'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (useLatest: boolean) => {
    if (!actionPassword.trim()) {
      showToast('Nhập mật khẩu két sao lưu vào ô bên dưới để giải mã & khôi phục!', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await bridge.restore(actionPassword.trim(), useLatest);
      if (res.canceled) return;
      if (!res.ok || !res.rawJson) {
        showToast(res.error || 'Mật khẩu không đúng hoặc file hỏng.', 'error');
        return;
      }
      const parsed = JSON.parse(res.rawJson) as { state?: unknown };
      const payload = parsed?.state ?? parsed;
      const result = importBackup(payload, 'replace');
      setActionPassword('');
      showToast(`Đã giải mã & khôi phục trọn vẹn ${result.imported} từ vựng từ két bảo vệ!`, 'success');
    } catch {
      showToast('Không thể đọc nội dung file sao lưu.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-warm-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: 'var(--green)' }} />
            <h2 className="font-semibold text-sm">Két Sao Lưu Tự Động Chống Xóa (.wnbak)</h2>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
            Tự động nén Gzip siêu nhẹ + mã hóa AES-256-GCM liên tục mỗi khi bạn học, lưu vào thư mục trên máy và khóa chống xóa — không thể xóa hay đọc nếu không có mật khẩu của bạn.
          </p>
        </div>

        {status?.configured && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
            style={{
              backgroundColor: status.locked ? 'var(--green-soft)' : 'var(--gold-soft)',
              color: status.locked ? 'var(--green)' : 'var(--gold)',
            }}
          >
            {status.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {status.locked ? 'Đang khóa chống xóa' : 'Đang mở khóa'}
          </span>
        )}
      </div>

      {/* Folder path + live lightweight metrics */}
      <div
        className="rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: 'var(--text3)' }}>
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            Thư mục két sao lưu trên máy
          </div>
          <p className="text-xs font-mono truncate" style={{ color: 'var(--text)' }} title={draftDir}>
            {draftDir || status?.vaultDir || '...'}
          </p>
          {status?.configured && (
            <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
              Dung lượng siêu nhẹ: <strong>{formatBytes(status.lastBackupSizeBytes)}</strong> ·{' '}
              {status.fileCount} bản lưu (xoay vòng 7 ngày)
              {status.lastBackupAt
                ? ` · Cập nhật: ${new Date(status.lastBackupAt).toLocaleTimeString('vi-VN')}`
                : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePickFolder}
            className="px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            Chọn thư mục
          </button>
          {status?.configured && (
            <button
              type="button"
              onClick={() => bridge.openFolder()}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Mở thư mục
            </button>
          )}
        </div>
      </div>

      {/* Setup / Change Password Form */}
      {(!status?.configured || showPassForm) && (
        <form onSubmit={handleSaveVault} className="space-y-2.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {status?.configured && (
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mật khẩu hiện tại..."
                className="rounded-xl px-3 py-2 text-xs border outline-none"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
              />
            )}
            <input
              type="password"
              required={!status?.configured}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={
                status?.configured
                  ? 'Mật khẩu mới (để trống nếu giữ nguyên)'
                  : 'Đặt mật khẩu bảo vệ két (>= 4 ký tự)...'
              }
              className="rounded-xl px-3 py-2 text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--green)' }}
            >
              <Lock className="w-3.5 h-3.5" />
              {status?.configured ? 'Lưu cấu hình & Khóa lại' : 'Bật sao lưu liên tục & Khóa chống xóa'}
            </button>
            {status?.configured && (
              <button
                type="button"
                onClick={() => setShowPassForm(false)}
                className="px-3 py-2 rounded-xl border text-xs cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      )}

      {/* Active Vault Controls */}
      {status?.configured && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleBackupNow}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sao lưu ngay
            </button>
            {!status.locked && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const res = await bridge.relock();
                  if (res.status) setStatus(res.status);
                  showToast('Đã khóa chống xóa trở lại cho két sao lưu!', 'success');
                }}
                className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: 'var(--green)', color: 'var(--green)', backgroundColor: 'var(--green-soft)' }}
              >
                <Lock className="w-3.5 h-3.5" />
                Khóa chống xóa lại
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPassForm((v) => !v)}
              className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Đổi mật khẩu / Thư mục
            </button>
          </div>

          {/* Password-gated Unlock / Restore / Delete bar */}
          <div
            className="rounded-xl p-3 border space-y-2"
            style={{ backgroundColor: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <p className="text-[11px] font-medium" style={{ color: 'var(--text2)' }}>
              Thao tác yêu cầu mật khẩu (Khôi phục dữ liệu / Mở khóa để xóa file backup):
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="password"
                value={actionPassword}
                onChange={(e) => setActionPassword(e.target.value)}
                placeholder="Nhập mật khẩu két sao lưu..."
                className="flex-1 min-w-[180px] rounded-xl px-3 py-1.5 text-xs border outline-none"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRestore(true)}
                className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--blue)', color: 'var(--blue)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục bản mới nhất
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleRestore(false)}
                className="px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text2)' }}
              >
                Chọn file .wnbak...
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleUnlockAction('unlock-folder')}
                className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--gold)', color: 'var(--gold)' }}
              >
                <Unlock className="w-3.5 h-3.5" />
                Mở khóa thư mục
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleUnlockAction('delete-all')}
                className="px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: 'var(--card)', borderColor: 'var(--red)', color: 'var(--red)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
