import { CHARACTERS, CHEST_TYPES, ENEMY_TYPES, MAP_BOUNDS } from './config.ts';
import type { CanvasMetrics } from './canvas.ts';
import type { RenderSnapshot } from './engine.ts';
import type { MagicType } from './types.ts';

const MAGIC_STYLES: Record<MagicType, { primary: string; secondary: string; glow: string; aura: string }> = {
  arcane: { primary: '#ff7ad9', secondary: '#71f7ff', glow: '#ffd6f8', aura: 'rgba(255, 122, 217, 0.2)' },
  fire: { primary: '#ff7b1d', secondary: '#ffdb70', glow: '#ffb15a', aura: 'rgba(255, 123, 29, 0.22)' },
  ice: { primary: '#79d5ff', secondary: '#d8f4ff', glow: '#9ae3ff', aura: 'rgba(121, 213, 255, 0.2)' },
  lightning: { primary: '#f9f871', secondary: '#a78bfa', glow: '#dffb84', aura: 'rgba(249, 248, 113, 0.22)' },
  shadow: { primary: '#8b5cf6', secondary: '#c4b5fd', glow: '#d8b4fe', aura: 'rgba(139, 92, 246, 0.2)' },
};

function getMagicStyle(type: MagicType | undefined) {
  return MAGIC_STYLES[type ?? 'arcane'];
}

export interface JoystickRenderState {
  active: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  snapshot: RenderSnapshot | null,
  metrics: CanvasMetrics,
  joystick: JoystickRenderState = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 },
): void {
  const { width, height } = metrics;
  ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, width, height);
  if (!snapshot) return;

  const { player: p, camera: cam, chests, xpOrbs, particles, enemies, projectiles, damageNumbers } = snapshot;

  // Grid
  ctx.strokeStyle = '#1a1a3e';
  ctx.lineWidth = 1;
  const gridSize = 80;
  const startX = Math.floor(cam.x / gridSize) * gridSize;
  const startY = Math.floor(cam.y / gridSize) * gridSize;
  for (let x = startX; x < cam.x + width + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x - cam.x, 0); ctx.lineTo(x - cam.x, height); ctx.stroke();
  }
  for (let y = startY; y < cam.y + height + gridSize; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y - cam.y); ctx.lineTo(width, y - cam.y); ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(110, 231, 200, 0.28)';
  ctx.lineWidth = 3;
  ctx.strokeRect(MAP_BOUNDS.minX - cam.x, MAP_BOUNDS.minY - cam.y, MAP_BOUNDS.maxX - MAP_BOUNDS.minX, MAP_BOUNDS.maxY - MAP_BOUNDS.minY);

  // Chests
  chests.forEach(chest => {
    const sx = chest.x - cam.x, sy = chest.y - cam.y;
    if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) return;
    const chestType = CHEST_TYPES[chest.type];
    ctx.save();
    ctx.shadowColor = chestType.color; ctx.shadowBlur = 15;
    ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(chestType.emoji, sx, sy);
    ctx.restore();
  });

  // XP orbs
  xpOrbs.forEach(orb => {
    const sx = orb.x - cam.x, sy = orb.y - cam.y;
    if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) return;
    ctx.save();
    ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.arc(sx, sy, orb.size, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff88'; ctx.fill();
    ctx.restore();
  });

  // Particles
  particles.forEach(particle => {
    ctx.globalAlpha = particle.lifetime / particle.maxLifetime;
    ctx.beginPath(); ctx.arc(particle.x - cam.x, particle.y - cam.y, particle.size * (particle.lifetime / particle.maxLifetime), 0, Math.PI * 2);
    ctx.fillStyle = particle.color; ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Enemies
  enemies.forEach(enemy => {
    const sx = enemy.x - cam.x, sy = enemy.y - cam.y;
    if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) return;
    const definition = ENEMY_TYPES[enemy.type];
    ctx.save();
    ctx.shadowColor = definition.color; ctx.shadowBlur = enemy.isBoss ? 20 : 8;
    ctx.beginPath(); ctx.arc(sx, sy, enemy.size, 0, Math.PI * 2);
    ctx.fillStyle = definition.color; ctx.fill();
    ctx.strokeStyle = enemy.isBoss ? '#ffd700' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = enemy.isBoss ? 4 : 2; ctx.stroke();
    ctx.restore();
    ctx.font = `${enemy.size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(definition.emoji, sx, sy);
    if (enemy.shadowTimer > 0) {
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, enemy.size + 7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.35 + enemy.shadowStacks * 0.12})`;
      ctx.lineWidth = 2 + enemy.shadowStacks * 0.5;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }
    if (enemy.hp < enemy.maxHp) {
      const barW = enemy.size * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - barW / 2, sy - enemy.size - 10, barW, 4);
      ctx.fillStyle = enemy.isBoss ? '#ffd700' : '#ff4444'; ctx.fillRect(sx - barW / 2, sy - enemy.size - 10, barW * (enemy.hp / enemy.maxHp), 4);
    }
  });

  // Projectiles
  const projectileColors = ['#ff69b4', '#87ceeb', '#ff4500', '#ffd700'];
  projectiles.forEach(projectile => {
    const sx = projectile.x - cam.x, sy = projectile.y - cam.y;
    const magicStyle = getMagicStyle(projectile.magicType ?? p.magicType);
    ctx.save();
    ctx.shadowColor = magicStyle.glow; ctx.shadowBlur = 24;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, projectile.size * 3);
    grad.addColorStop(0, magicStyle.primary);
    grad.addColorStop(0.6, magicStyle.secondary);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, projectile.size * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = magicStyle.glow; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(sx, sy, projectile.size, 0, Math.PI * 2);
    ctx.fillStyle = magicStyle.primary; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(sx - projectile.vx * 0.5, sy - projectile.vy * 0.5, projectile.size * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `${magicStyle.secondary}cc`; ctx.fill();
  });

  // Player
  const playerScreenX = p.x - cam.x, playerScreenY = p.y - cam.y;
  const playerStyle = getMagicStyle(p.magicType);
  ctx.save();
  const gradient = ctx.createRadialGradient(playerScreenX, playerScreenY, 0, playerScreenX, playerScreenY, 40);
  gradient.addColorStop(0, `${CHARACTERS[p.character].color}30`);
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(playerScreenX, playerScreenY, 40, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(playerScreenX, playerScreenY, 48, 0, Math.PI * 2);
  ctx.strokeStyle = playerStyle.aura; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();

  if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) ctx.globalAlpha = 0.5;
  ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(CHARACTERS[p.character].emoji, playerScreenX, playerScreenY);
  ctx.globalAlpha = 1;

  // Pickup range
  ctx.beginPath(); ctx.arc(playerScreenX, playerScreenY, p.pickupRange, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);

  // Damage numbers
  damageNumbers.forEach(damage => {
    ctx.globalAlpha = damage.lifetime;
    ctx.font = 'bold 18px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(damage.value.toString(), damage.x - cam.x + 1, damage.y - cam.y + 1);
    ctx.fillStyle = damage.color; ctx.fillText(damage.value.toString(), damage.x - cam.x, damage.y - cam.y);
  });
  ctx.globalAlpha = 1;

  // Virtual joystick
  if (joystick.active) {
    ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, 50, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(joystick.startX + joystick.dx * 40, joystick.startY + joystick.dy * 40, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  }
}
