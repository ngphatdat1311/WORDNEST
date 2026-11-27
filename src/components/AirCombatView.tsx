'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Crosshair,
  Flame,
  FolderOpen,
  Gauge,
  Heart,
  Keyboard,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { playChime, speakEnglish, vibrateLight } from '@/lib/speech';
import { isSrsDue } from '@/lib/srs';
import { recoverEnglishFromVietnameseIme } from '@/lib/vietnamese-ime-guard';
import { useWordNestStore } from '@/store/useWordNestStore';
import { WordItem } from '@/types/wordnest';
import {
  CANVAS_H,
  CANVAS_W,
  type ControlMode,
  drawAirCombatFrame,
  type EnemyShip,
  type GamePhase,
  type LaserBeam,
  type Particle,
  SPEED_MULTIPLIER,
  type SpeedPreset,
} from './game/air-combat-renderer';

export function AirCombatView() {
  const words = useWordNestStore((s) => s.words);
  const folders = useWordNestStore((s) => s.folders);
  const stats = useWordNestStore((s) => s.airCombatStats);
  const recordAirCombatGame = useWordNestStore((s) => s.recordAirCombatGame);
  const recordSpellingResult = useWordNestStore((s) => s.recordSpellingResult);
  const showToast = useWordNestStore((s) => s.showToast);

  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>('normal');
  const [expandedArena, setExpandedArena] = useState(false);

  const allActiveWords = useMemo(
    () => words.filter((w) => !w.suspended && w.word.trim().length >= 2),
    [words]
  );

  const dueCount = useMemo(() => allActiveWords.filter((w) => isSrsDue(w)).length, [allActiveWords]);
  const unmasteredCount = useMemo(
    () => allActiveWords.filter((w) => (w.mastery ?? 0) < 2).length,
    [allActiveWords]
  );

  const playableWords = useMemo(() => {
    if (sourceFilter === 'all') return allActiveWords;
    if (sourceFilter === 'due') return allActiveWords.filter((w) => isSrsDue(w));
    if (sourceFilter === 'hard') return allActiveWords.filter((w) => (w.mastery ?? 0) < 2);
    if (sourceFilter.startsWith('folder:')) {
      const fid = sourceFilter.slice('folder:'.length);
      return allActiveWords.filter((w) => w.folderIds?.includes(fid));
    }
    return allActiveWords;
  }, [allActiveWords, sourceFilter]);

  const [controlMode, setControlMode] = useState<ControlMode>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 'type' : 'tap'
  );
  const [phase, setPhase] = useState<GamePhase>('ready');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [hp, setHp] = useState(3);
  const [combo, setCombo] = useState(0);
  const [destroyed, setDestroyed] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [typed, setTyped] = useState('');
  const [lockedEnemy, setLockedEnemy] = useState<EnemyShip | null>(null);
  const [tapOptions, setTapOptions] = useState<WordItem[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mutable high-frequency game state (60fps loop without React re-render overhead)
  const gameRef = useRef({
    enemies: [] as EnemyShip[],
    lasers: [] as LaserBeam[],
    particles: [] as Particle[],
    stars: Array.from({ length: 70 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41) % 100) / 100,
      speed: 0.035 + (i % 4) * 0.025,
      size: 1.2 + (i % 3) * 0.8,
    })),
    nextId: 1,
    spawnTimer: 0,
    score: 0,
    wave: 1,
    hp: 3,
    combo: 0,
    destroyed: 0,
    charsTyped: 0,
    startedAt: 0,
    pausedTotalMs: 0,
    pausedAt: 0,
    lockedId: null as number | null,
    running: false,
  });

  const buildTapOptions = useCallback(
    (target: WordItem) => {
      const pool = playableWords.length >= 4 ? playableWords : allActiveWords;
      const others = pool
        .filter((w) => w.id !== target.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      return [target, ...others].sort(() => Math.random() - 0.5);
    },
    [playableWords, allActiveWords]
  );

  const syncLockedTarget = useCallback(() => {
    const g = gameRef.current;
    if (!g.enemies.length) {
      g.lockedId = null;
      setLockedEnemy(null);
      setTapOptions([]);
      return;
    }
    let locked = g.enemies.find((e) => e.id === g.lockedId) || null;
    if (!locked) {
      locked = [...g.enemies].sort((a, b) => b.y - a.y)[0];
      g.lockedId = locked.id;
    }
    setLockedEnemy({ ...locked });
    setTapOptions(buildTapOptions(locked.word));
  }, [buildTapOptions]);

  const spawnExplosion = (x: number, y: number, color: string, count = 20) => {
    const g = gameRef.current;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 0.08 + Math.random() * 0.24;
      g.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        alpha: 1,
        color,
        size: 2.5 + Math.random() * 3.5,
      });
    }
  };

  const destroyEnemy = useCallback(
    (enemy: EnemyShip) => {
      const g = gameRef.current;
      g.enemies = g.enemies.filter((e) => e.id !== enemy.id);
      g.lasers.push({
        id: g.nextId++,
        x1: 0.5,
        y1: 0.92,
        x2: enemy.x,
        y2: enemy.y,
        alpha: 1,
        color: enemy.isBoss ? '#DEB054' : '#7BC47F',
      });
      spawnExplosion(enemy.x, enemy.y, enemy.isBoss ? '#DEB054' : '#7BC47F', enemy.isBoss ? 28 : 18);

      g.combo += 1;
      g.destroyed += 1;
      g.charsTyped += enemy.word.word.length;
      const pts = (enemy.isBoss ? 30 : 10) + Math.min(20, g.combo * 2);
      g.score += pts;
      const nextWave = Math.floor(g.destroyed / 6) + 1;
      if (nextWave > g.wave) {
        g.wave = nextWave;
        playChime('complete');
      } else {
        playChime('success');
      }
      vibrateLight(18);
      speakEnglish(enemy.word.word, 1.05);
      recordSpellingResult(enemy.word.id, true);

      const elapsedMin = Math.max(
        0.05,
        (Date.now() - g.startedAt - g.pausedTotalMs) / 60000
      );
      const curWpm = Math.round(g.charsTyped / 5 / elapsedMin);

      setScore(g.score);
      setCombo(g.combo);
      setDestroyed(g.destroyed);
      setWave(g.wave);
      setWpm(curWpm);

      if (g.lockedId === enemy.id) {
        g.lockedId = null;
      }
      syncLockedTarget();
    },
    [recordSpellingResult, syncLockedTarget]
  );

  const endGame = useCallback(() => {
    const g = gameRef.current;
    g.running = false;
    const elapsedMin = Math.max(
      0.05,
      (Date.now() - g.startedAt - g.pausedTotalMs) / 60000
    );
    const finalWpm = Math.round(g.charsTyped / 5 / elapsedMin);
    setWpm(finalWpm);
    setPhase('gameover');
    recordAirCombatGame(g.score, g.wave, finalWpm, g.destroyed);
    if (g.score > stats.bestScore && g.score > 0) {
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.65 } });
      showToast(`Kỷ lục Không Chiến mới: ${g.score} điểm!`, 'success');
    }
  }, [recordAirCombatGame, showToast, stats.bestScore]);

  const startGame = () => {
    if (playableWords.length < 2) {
      showToast('Nguồn từ này cần ít nhất 2 từ vựng để bắt đầu chiến đấu!', 'error');
      return;
    }
    const g = gameRef.current;
    g.enemies = [];
    g.lasers = [];
    g.particles = [];
    g.spawnTimer = 0.25;
    g.score = 0;
    g.wave = 1;
    g.hp = 3;
    g.combo = 0;
    g.destroyed = 0;
    g.charsTyped = 0;
    g.startedAt = Date.now();
    g.pausedTotalMs = 0;
    g.pausedAt = 0;
    g.lockedId = null;
    g.running = true;

    setScore(0);
    setWave(1);
    setHp(3);
    setCombo(0);
    setDestroyed(0);
    setWpm(0);
    setTyped('');
    setLockedEnemy(null);
    setTapOptions([]);
    setPhase('playing');
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (phase === 'playing') {
      g.running = false;
      g.pausedAt = Date.now();
      setPhase('paused');
    } else if (phase === 'paused') {
      if (g.pausedAt > 0) {
        g.pausedTotalMs += Date.now() - g.pausedAt;
        g.pausedAt = 0;
      }
      g.running = true;
      setPhase('playing');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [phase]);

  // Esc key toggles Pause cleanly
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, togglePause]);

  // Main 60fps requestAnimationFrame loop
  useEffect(() => {
    if (phase !== 'playing') return;
    let rafId = 0;
    let lastTs = performance.now();
    const speedMult = SPEED_MULTIPLIER[speedPreset];

    const spawnEnemy = () => {
      const g = gameRef.current;
      const activeIds = new Set(g.enemies.map((e) => e.word.id));
      const candidates = playableWords.filter((w) => !activeIds.has(w.id));
      const pool = candidates.length ? candidates : playableWords;
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      const isBoss = (g.destroyed + g.enemies.length + 1) % 6 === 0;

      // Avoid horizontal overlap with recently spawned ships
      let x = 0.16 + Math.random() * 0.68;
      for (let attempt = 0; attempt < 5; attempt++) {
        const cand = 0.15 + Math.random() * 0.7;
        const tooClose = g.enemies.some((e) => e.y < 0.3 && Math.abs(e.x - cand) < 0.2);
        if (!tooClose) {
          x = cand;
          break;
        }
      }

      const ship: EnemyShip = {
        id: g.nextId++,
        word: chosen,
        x,
        y: 0.08,
        speed: ((isBoss ? 0.032 : 0.048) + Math.min(0.055, g.wave * 0.007)) * speedMult,
        isBoss,
        hp: 1,
        maxHp: 1,
      };
      g.enemies.push(ship);
      syncLockedTarget();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      const g = gameRef.current;
      if (!g.running) return;

      // Spawn control
      g.spawnTimer -= dt;
      const maxOnScreen = Math.min(5, 2 + Math.floor(g.wave / 2));
      if (g.spawnTimer <= 0 && g.enemies.length < maxOnScreen) {
        spawnEnemy();
        g.spawnTimer = Math.max(1.4, (3.1 - g.wave * 0.18) / speedMult);
      }

      // Move stars
      for (const s of g.stars) {
        s.y += s.speed * dt;
        if (s.y > 1) s.y = 0;
      }

      // Move enemies & check shield breach
      const survived: EnemyShip[] = [];
      let breached = false;
      for (const e of g.enemies) {
        e.y += e.speed * dt;
        if (e.y >= 0.87) {
          breached = true;
          g.hp -= 1;
          g.combo = 0;
          spawnExplosion(e.x, 0.87, '#DF706B', 18);
          playChime('error');
          vibrateLight([40, 30, 40]);
          if (g.lockedId === e.id) g.lockedId = null;
        } else {
          survived.push(e);
        }
      }
      g.enemies = survived;

      if (breached) {
        setHp(g.hp);
        setCombo(0);
        syncLockedTarget();
        if (g.hp <= 0) {
          endGame();
          return;
        }
      }

      // Update lasers & particles
      g.lasers = g.lasers
        .map((l) => ({ ...l, alpha: l.alpha - dt * 3.5 }))
        .filter((l) => l.alpha > 0);
      g.particles = g.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          alpha: p.alpha - dt * 1.8,
        }))
        .filter((p) => p.alpha > 0);

      // Render Crisp HiDPI Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawAirCombatFrame(ctx, canvas.width, canvas.height, g, controlMode);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase, playableWords, controlMode, speedPreset, syncLockedTarget, endGame]);

  // Typing handler (Desktop — with automatic Unikey/Telex English recovery!)
  const handleTypingChange = (rawVal: string) => {
    if (phase !== 'playing') return;
    const val = recoverEnglishFromVietnameseIme(typed, rawVal).value;
    setTyped(val);
    const clean = val.trim().toLowerCase();
    if (!clean) return;
    const g = gameRef.current;

    const exact = g.enemies.find((e) => e.word.word.toLowerCase() === clean);
    if (exact) {
      destroyEnemy(exact);
      setTyped('');
      return;
    }

    const prefixMatch = g.enemies.find((e) => e.word.word.toLowerCase().startsWith(clean));
    if (prefixMatch && prefixMatch.id !== g.lockedId) {
      g.lockedId = prefixMatch.id;
      setLockedEnemy({ ...prefixMatch });
    }
  };

  // Mobile Tap-Blast handler
  const handleTapAmmo = (opt: WordItem) => {
    if (phase !== 'playing') return;
    const g = gameRef.current;
    const target = g.enemies.find((e) => e.id === g.lockedId);
    if (!target) return;

    if (opt.id === target.word.id) {
      destroyEnemy(target);
    } else {
      playChime('error');
      vibrateLight([25, 25, 25]);
      g.combo = 0;
      setCombo(0);
      showToast('Trượt mục tiêu! Thử lại nhanh!', 'error');
    }
  };

  return (
    <div className={`${expandedArena ? 'max-w-none' : 'max-w-5xl'} mx-auto space-y-4 transition-all`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <Rocket className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            Không Chiến Từ Vựng 2.0
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
            Hạ gục phi thuyền từ vựng đang lao xuống — chọn thư mục từ, tốc độ bay & tạm dừng bất cứ lúc nào!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Control Mode Switcher */}
          <div
            className="inline-flex rounded-xl p-1 border"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {(
              [
                { id: 'tap', label: 'Chạm bắn', icon: Crosshair },
                { id: 'type', label: 'Gõ phím (WPM)', icon: Keyboard },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              const active = controlMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setControlMode(m.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all"
                  style={{
                    backgroundColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text2)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setExpandedArena((v) => !v)}
            className="px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{
              backgroundColor: expandedArena ? 'var(--accent-soft)' : 'var(--card)',
              borderColor: expandedArena ? 'var(--accent)' : 'var(--border)',
              color: expandedArena ? 'var(--accent)' : 'var(--text2)',
            }}
            title="Phóng to / thu gọn khung chiến đấu"
          >
            {expandedArena ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{expandedArena ? 'Thu vừa' : 'Phóng to'}</span>
          </button>
        </div>
      </div>

      {/* Live HUD Bar with Pause Button */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-warm-card rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            Điểm
          </span>
          <span className="font-serif-display font-bold text-lg tabular-nums" style={{ color: 'var(--accent)' }}>
            {score}
          </span>
        </div>
        <div className="bg-warm-card rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            Wave
          </span>
          <span className="font-serif-display font-bold text-lg tabular-nums">{wave}</span>
        </div>
        <div className="bg-warm-card rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--text3)' }}>
            <Flame className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            Combo
          </span>
          <span className="font-serif-display font-bold text-lg tabular-nums" style={{ color: 'var(--gold)' }}>
            x{combo}
          </span>
        </div>
        <div className="bg-warm-card rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            Khiên
          </span>
          <span className="inline-flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className="w-4 h-4"
                style={{
                  color: i < hp ? 'var(--red)' : 'var(--border2)',
                  fill: i < hp ? 'var(--red)' : 'none',
                }}
              />
            ))}
          </span>
        </div>
        <button
          type="button"
          disabled={phase !== 'playing' && phase !== 'paused'}
          onClick={togglePause}
          className="col-span-2 sm:col-span-1 rounded-2xl px-3.5 py-2.5 border text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-45"
          style={{
            backgroundColor: phase === 'paused' ? 'var(--accent)' : 'var(--card)',
            borderColor: phase === 'paused' ? 'var(--accent)' : 'var(--border)',
            color: phase === 'paused' ? '#fff' : 'var(--text)',
          }}
          title="Tạm dừng / Tiếp tục (Phím tắt: Esc)"
        >
          {phase === 'paused' ? (
            <>
              <Play className="w-4 h-4 fill-current" />
              Tiếp tục (Esc)
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              Tạm dừng (Esc)
            </>
          )}
        </button>
      </div>

      {/* Space Battle Arena (Much bigger & crisp!) */}
      <div className="relative rounded-3xl overflow-hidden border shadow-xl" style={{ borderColor: 'var(--border)' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={`w-full block bg-[#131018] ${
            expandedArena
              ? 'h-[62dvh] min-h-[480px]'
              : 'h-[420px] sm:h-[520px] lg:h-[560px]'
          }`}
        />

        {/* READY OVERLAY with Folder & Speed Selection */}
        {phase === 'ready' && (
          <div className="absolute inset-0 bg-black/72 backdrop-blur-[3px] flex flex-col items-center justify-center p-5 sm:p-8 text-center text-white space-y-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#CEA056]/20 border border-[#CEA056]/50 flex items-center justify-center shrink-0">
              <Rocket className="w-7 h-7 text-[#DEB054]" />
            </div>
            <div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold">Sẵn sàng cất cánh!</h2>
              <p className="text-xs sm:text-sm text-white/75 mt-1 max-w-lg">
                {controlMode === 'type'
                  ? 'Gõ nhanh từ tiếng Anh hiện trên phi thuyền để pháo laser tự động khai hỏa. Bấm Esc bất kỳ lúc nào để tạm dừng.'
                  : 'Đọc nghĩa tiếng Việt trên phi thuyền bị khóa mục tiêu rồi chạm đúng từ tiếng Anh bên dưới để bắn hạ!'}
              </p>
            </div>

            {/* Folder / Word Source Selector & Speed Preset */}
            <div className="w-full max-w-xl bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-3 text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Chọn nguồn từ / Thư mục để chiến đấu ({playableWords.length} từ):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSourceFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      sourceFilter === 'all'
                        ? 'bg-[#DEB054] text-[#1A1510] border-[#DEB054] font-semibold'
                        : 'bg-black/30 text-white/85 border-white/20 hover:bg-white/15'
                    }`}
                  >
                    Tất cả ({allActiveWords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceFilter('due')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      sourceFilter === 'due'
                        ? 'bg-[#DEB054] text-[#1A1510] border-[#DEB054] font-semibold'
                        : 'bg-black/30 text-white/85 border-white/20 hover:bg-white/15'
                    }`}
                  >
                    Đến hạn SRS ({dueCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceFilter('hard')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      sourceFilter === 'hard'
                        ? 'bg-[#DEB054] text-[#1A1510] border-[#DEB054] font-semibold'
                        : 'bg-black/30 text-white/85 border-white/20 hover:bg-white/15'
                    }`}
                  >
                    Chưa thuộc ({unmasteredCount})
                  </button>
                  {folders.map((folder) => {
                    const count = allActiveWords.filter((w) => w.folderIds?.includes(folder.id)).length;
                    const key = `folder:${folder.id}`;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setSourceFilter(key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                          sourceFilter === key
                            ? 'bg-[#DEB054] text-[#1A1510] border-[#DEB054] font-semibold'
                            : 'bg-black/30 text-white/85 border-white/20 hover:bg-white/15'
                        }`}
                      >
                        📁 {folder.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/15">
                <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  Tốc độ phi thuyền:
                </span>
                <div className="inline-flex gap-1.5">
                  {(
                    [
                      { id: 'slow', label: 'Chậm (Dễ đánh)' },
                      { id: 'normal', label: 'Vừa (Chuẩn)' },
                      { id: 'fast', label: 'Nhanh (Thử thách)' },
                    ] as const
                  ).map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSpeedPreset(sp.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        speedPreset === sp.id
                          ? 'bg-[#DEB054] text-[#1A1510] border-[#DEB054] font-semibold'
                          : 'bg-black/30 text-white/80 border-white/20 hover:bg-white/15'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-white/75">
              <span className="inline-flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-[#DEB054]" /> Kỷ lục: {stats.bestScore}
              </span>
              <span className="inline-flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#DEB054]" /> WPM cao nhất: {stats.bestWpm}
              </span>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="px-7 py-3 rounded-2xl text-sm font-bold text-[#1A1510] inline-flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 shadow-lg"
              style={{ backgroundColor: '#DEB054' }}
            >
              <Play className="w-4 h-4 fill-current" />
              Bắt đầu chiến đấu ({playableWords.length} từ)
            </button>
          </div>
        )}

        {/* PAUSED OVERLAY */}
        {phase === 'paused' && (
          <div className="absolute inset-0 bg-black/72 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#DEB054]/20 border border-[#DEB054]/50 flex items-center justify-center">
              <Pause className="w-7 h-7 text-[#DEB054]" />
            </div>
            <div>
              <h2 className="font-serif-display text-2xl font-semibold">Đã tạm dừng</h2>
              <p className="text-xs sm:text-sm text-white/75 mt-1">
                Điểm hiện tại: <strong className="text-[#DEB054]">{score}</strong> · Wave {wave} · Đã hạ {destroyed} phi thuyền
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="px-6 py-2.5 rounded-2xl text-sm font-bold text-[#1A1510] inline-flex items-center gap-2 cursor-pointer"
                style={{ backgroundColor: '#DEB054' }}
              >
                <Play className="w-4 h-4 fill-current" />
                Tiếp tục chiến đấu
              </button>
              <button
                type="button"
                onClick={() => {
                  gameRef.current.running = false;
                  setPhase('ready');
                }}
                className="px-5 py-2.5 rounded-2xl text-sm font-medium border border-white/25 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              >
                Đổi thư mục / Tốc độ
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {phase === 'gameover' && (
          <div className="absolute inset-0 bg-black/78 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
            <Shield className="w-12 h-12 text-[#DF706B]" />
            <div>
              <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold">Khiên đã vỡ!</h2>
              <p className="text-sm text-white/80 mt-1">
                Điểm: <strong className="text-[#DEB054]">{score}</strong> · Hạ gục:{' '}
                <strong>{destroyed}</strong> phi thuyền · Tốc độ: <strong>{wpm} WPM</strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={startGame}
                className="px-6 py-2.5 rounded-2xl text-sm font-bold text-[#1A1510] inline-flex items-center gap-2 cursor-pointer"
                style={{ backgroundColor: '#DEB054' }}
              >
                <RotateCcw className="w-4 h-4" />
                Chơi lượt mới
              </button>
              <button
                type="button"
                onClick={() => setPhase('ready')}
                className="px-5 py-2.5 rounded-2xl text-sm font-medium border border-white/25 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              >
                Đổi thư mục / Tốc độ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls Below Arena */}
      {phase === 'playing' && (
        <div className="bg-warm-card rounded-2xl p-4 space-y-3">
          {controlMode === 'type' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text3)' }}>
                <span>
                  Mục tiêu đang khóa:{' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    {lockedEnemy ? `${lockedEnemy.word.word} — ${lockedEnemy.word.meaning}` : 'Đang quét radar...'}
                  </strong>
                </span>
                <span className="tabular-nums font-medium">{wpm} WPM</span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={typed}
                onChange={(e) => handleTypingChange(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Gõ chính xác từ tiếng Anh trên phi thuyền để khai hỏa laser..."
                className="w-full rounded-xl px-4 py-3.5 text-lg font-medium border-2 outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--accent)',
                  color: 'var(--text)',
                }}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--accent)' }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Chạm đúng từ tiếng Anh ứng với nghĩa:
                </span>
                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {lockedEnemy ? `"${lockedEnemy.word.meaning}"` : '...'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {tapOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleTapAmmo(opt)}
                    className="py-3.5 px-4 rounded-xl border text-base font-serif-display font-semibold cursor-pointer transition-all active:scale-95 hover:border-[var(--accent)]"
                    style={{
                      backgroundColor: 'var(--bg)',
                      borderColor: 'var(--border2)',
                      color: 'var(--text)',
                    }}
                  >
                    {opt.word}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
