import type { WordItem } from '@/types/wordnest';

export interface EnemyShip {
  id: number;
  word: WordItem;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  speed: number;
  isBoss: boolean;
  hp: number;
  maxHp: number;
}

export interface LaserBeam {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

export interface StarFieldPoint {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export type ControlMode = 'tap' | 'type';
export type SpeedPreset = 'slow' | 'normal' | 'fast';
export type GamePhase = 'ready' | 'playing' | 'paused' | 'gameover';

export const SPEED_MULTIPLIER: Record<SpeedPreset, number> = {
  slow: 0.62,
  normal: 1.0,
  fast: 1.38,
};

export const CANVAS_W = 1100;
export const CANVAS_H = 620;

export function drawAirCombatFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: {
    stars: StarFieldPoint[];
    lasers: LaserBeam[];
    particles: Particle[];
    enemies: EnemyShip[];
    lockedId: number | null;
  },
  controlMode: ControlMode
): void {
  // Deep warm space backdrop
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#110E16');
  grad.addColorStop(1, '#211A14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of state.stars) {
    ctx.fillStyle = 'rgba(245, 238, 226, 0.5)';
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Defense shield line
  ctx.strokeStyle = 'rgba(222, 176, 84, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, H * 0.87);
  ctx.lineTo(W, H * 0.87);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lasers
  for (const l of state.lasers) {
    ctx.save();
    ctx.globalAlpha = l.alpha;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(l.x1 * W, l.y1 * H);
    ctx.lineTo(l.x2 * W, l.y2 * H);
    ctx.stroke();
    ctx.restore();
  }

  // Particles
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Enemy ships (LARGE, ultra-readable pills!)
  for (const e of state.enemies) {
    const ex = e.x * W;
    const ey = e.y * H;
    const isLocked = e.id === state.lockedId;

    if (isLocked) {
      ctx.strokeStyle = '#F2C56D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, ey, e.isBoss ? 30 : 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = e.isBoss ? '#E0923E' : isLocked ? '#DEB054' : '#8E7962';
    ctx.beginPath();
    ctx.moveTo(ex, ey + (e.isBoss ? 20 : 15));
    ctx.lineTo(ex - (e.isBoss ? 24 : 18), ey - (e.isBoss ? 14 : 11));
    ctx.lineTo(ex + (e.isBoss ? 24 : 18), ey - (e.isBoss ? 14 : 11));
    ctx.closePath();
    ctx.fill();

    const mainText =
      controlMode === 'type' ? e.word.word : e.word.meaning.slice(0, 32);
    const subText =
      controlMode === 'type' && e.word.meaning ? e.word.meaning.slice(0, 28) : '';

    ctx.font = `700 ${e.isBoss ? 24 : 21}px Inter, system-ui, sans-serif`;
    const mainW = ctx.measureText(mainText).width;
    ctx.font = '500 14px Inter, system-ui, sans-serif';
    const subW = subText ? ctx.measureText(subText).width : 0;

    const padX = 18;
    const pillW = Math.max(mainW, subW) + padX * 2;
    const pillH = subText ? 54 : 38;
    const px = Math.max(10, Math.min(W - pillW - 10, ex - pillW / 2));
    const py = Math.max(8, ey - (pillH + 22));

    ctx.fillStyle = isLocked ? 'rgba(235, 188, 98, 0.97)' : 'rgba(26, 22, 18, 0.92)';
    ctx.strokeStyle = isLocked ? '#FFF6E0' : 'rgba(222, 176, 84, 0.45)';
    ctx.lineWidth = isLocked ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = `700 ${e.isBoss ? 24 : 21}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = isLocked ? '#1A140D' : '#FFFDF8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainText, px + pillW / 2, py + (subText ? 20 : pillH / 2 + 1));

    if (subText) {
      ctx.font = '500 14px Inter, system-ui, sans-serif';
      ctx.fillStyle = isLocked ? 'rgba(26, 20, 13, 0.78)' : 'rgba(240, 234, 224, 0.75)';
      ctx.fillText(subText, px + pillW / 2, py + 41);
    }
  }

  // Bottom Player Turret
  ctx.fillStyle = '#DEB054';
  ctx.beginPath();
  ctx.moveTo(W * 0.5, H * 0.89);
  ctx.lineTo(W * 0.5 - 22, H * 0.97);
  ctx.lineTo(W * 0.5 + 22, H * 0.97);
  ctx.closePath();
  ctx.fill();
}
