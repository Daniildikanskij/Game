import { useEffect, useRef, useState } from 'react';

// ==================== TYPES ====================
interface Player {
  x: number; y: number; hp: number; maxHp: number; speed: number;
  level: number; xp: number; xpToNext: number; damage: number;
  attackSpeed: number; attackTimer: number; projectileCount: number;
  projectileSpeed: number; projectileSize: number; pickupRange: number;
  armor: number; invincibleTimer: number; character: number;
}
interface Enemy {
  x: number; y: number; hp: number; maxHp: number; speed: number;
  damage: number; type: number; size: number; xpValue: number;
  knockbackX: number; knockbackY: number;
}
interface Projectile {
  x: number; y: number; vx: number; vy: number; damage: number;
  size: number; piercing: number; lifetime: number; type: number;
}
interface XpOrb { x: number; y: number; value: number; size: number; }
interface DamageNumber { x: number; y: number; value: number; lifetime: number; color: string; }
interface Upgrade { id: string; name: string; description: string; icon: string; apply: (p: Player) => void; }
interface Particle { x: number; y: number; vx: number; vy: number; lifetime: number; maxLifetime: number; color: string; size: number; }
interface MenuParticle { x: number; y: number; vx: number; vy: number; size: number; opacity: number; emoji: string; }

const CHARACTERS = [
  { name: 'Сакура', emoji: '🌸', color: '#ff69b4', gradient: 'from-pink-500 to-rose-600', desc: 'Быстрая атака, средний урон', stats: '⚡ ATK SPD ↑' },
  { name: 'Юки', emoji: '❄️', color: '#87ceeb', gradient: 'from-cyan-400 to-blue-600', desc: 'Замораживающие снаряды', stats: '🎯 PRECISION ↑' },
  { name: 'Хина', emoji: '🔥', color: '#ff4500', gradient: 'from-orange-500 to-red-600', desc: 'Высокий урон, медленная атака', stats: '💥 DMG ↑' },
  { name: 'Мико', emoji: '⚡', color: '#ffd700', gradient: 'from-yellow-400 to-amber-600', desc: 'Много снарядов, низкий урон', stats: '🌟 MULTI ↑' },
];

const GAME_STATE = { MENU: 'menu', CHARACTER_SELECT: 'character_select', PLAYING: 'playing', LEVEL_UP: 'level_up', GAME_OVER: 'game_over', PAUSED: 'paused' };

const ALL_UPGRADES: Upgrade[] = [
  { id: 'damage_up', name: 'Сила+', description: '+20% к урону', icon: '⚔️', apply: (p: Player) => { p.damage *= 1.2; } },
  { id: 'speed_up', name: 'Скорость+', description: '+15% к скорости', icon: '💨', apply: (p: Player) => { p.speed *= 1.15; } },
  { id: 'attack_speed', name: 'Атака+', description: '+20% скорость атаки', icon: '⚡', apply: (p: Player) => { p.attackSpeed *= 1.2; } },
  { id: 'hp_up', name: 'Здоровье+', description: '+30 макс. HP', icon: '❤️', apply: (p: Player) => { p.maxHp += 30; p.hp += 30; } },
  { id: 'projectile_count', name: 'Снаряды+', description: '+1 снаряд', icon: '🎯', apply: (p: Player) => { p.projectileCount += 1; } },
  { id: 'projectile_speed', name: 'Скорость снарядов+', description: '+25% скорость снарядов', icon: '🚀', apply: (p: Player) => { p.projectileSpeed *= 1.25; } },
  { id: 'pickup_range', name: 'Притяжение+', description: '+30% радиус сбора', icon: '🧲', apply: (p: Player) => { p.pickupRange *= 1.3; } },
  { id: 'armor', name: 'Броня+', description: '+2 к броне', icon: '🛡️', apply: (p: Player) => { p.armor += 2; } },
  { id: 'projectile_size', name: 'Размер+', description: '+30% размер снарядов', icon: '💫', apply: (p: Player) => { p.projectileSize *= 1.3; } },
  { id: 'heal', name: 'Лечение', description: 'Восстановить 50% HP', icon: '💖', apply: (p: Player) => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); } },
];

function getRandomUpgrades(count: number): Upgrade[] {
  return [...ALL_UPGRADES].sort(() => Math.random() - 0.5).slice(0, count);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef(GAME_STATE.MENU);
  const [uiState, setUiState] = useState(GAME_STATE.MENU);
  const [playerData, setPlayerData] = useState({ hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10, damage: 10, speed: 3, attackSpeed: 1 });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [killCount, setKillCount] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [menuParticles] = useState<MenuParticle[]>(() => {
    const emojis = ['🌸', '✨', '⭐', '💫', '🌟', '💖', '🎀'];
    return Array.from({ length: 30 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.3, vy: -Math.random() * 0.5 - 0.1,
      size: Math.random() * 20 + 12, opacity: Math.random() * 0.5 + 0.2,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));
  });

  const keysRef = useRef<Set<string>>(new Set());
  const playerRef = useRef<Player | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const xpOrbsRef = useRef<XpOrb[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cameraRef = useRef({ x: 0, y: 0 });
  const gameTimeRef = useRef(0);
  const killCountRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  const uiUpdateTimerRef = useRef(0);

  const initGame = (charIndex: number) => {
    const p: Player = {
      x: 0, y: 0, hp: 100, maxHp: 100, speed: 3,
      level: 1, xp: 0, xpToNext: 10, damage: 10,
      attackSpeed: 1, attackTimer: 0, projectileCount: 1,
      projectileSpeed: 7, projectileSize: 8, pickupRange: 80,
      armor: 0, invincibleTimer: 0, character: charIndex,
    };
    switch (charIndex) {
      case 0: p.attackSpeed = 1.3; break;
      case 1: p.projectileSpeed = 6; p.damage = 12; break;
      case 2: p.damage = 18; p.attackSpeed = 0.7; break;
      case 3: p.projectileCount = 3; p.damage = 6; break;
    }
    playerRef.current = p;
    enemiesRef.current = []; projectilesRef.current = [];
    xpOrbsRef.current = []; damageNumbersRef.current = [];
    particlesRef.current = []; cameraRef.current = { x: 0, y: 0 };
    gameTimeRef.current = 0; killCountRef.current = 0; spawnTimerRef.current = 0;
    setPlayerData({ hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10, damage: 10, speed: 3, attackSpeed: 1 });
    setGameTime(0); setKillCount(0);
    setUiState(GAME_STATE.PLAYING); gameStateRef.current = GAME_STATE.PLAYING;
  };

  const spawnEnemy = () => {
    const p = playerRef.current; if (!p) return;
    const time = gameTimeRef.current; const difficulty = 1 + time / 30;
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 200;
    const types = [
      { hp: 20, speed: 1.5, damage: 8, size: 18, xpValue: 3 },
      { hp: 40, speed: 1, damage: 12, size: 24, xpValue: 5 },
      { hp: 15, speed: 2.5, damage: 5, size: 14, xpValue: 2 },
      { hp: 80, speed: 0.7, damage: 20, size: 32, xpValue: 10 },
    ];
    const typeIdx = Math.random() < 0.7 ? Math.floor(Math.random() * 3) : 3;
    const t = types[typeIdx];
    enemiesRef.current.push({
      x: p.x + Math.cos(angle) * dist, y: p.y + Math.sin(angle) * dist,
      hp: t.hp * difficulty, maxHp: t.hp * difficulty,
      speed: t.speed * (1 + time / 120), damage: t.damage * (1 + time / 60),
      type: typeIdx, size: t.size, xpValue: t.xpValue, knockbackX: 0, knockbackY: 0,
    });
  };

  // ==================== GAME LOOP ====================
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === 'Escape') {
        if (gameStateRef.current === GAME_STATE.PLAYING) { gameStateRef.current = GAME_STATE.PAUSED; setUiState(GAME_STATE.PAUSED); }
        else if (gameStateRef.current === GAME_STATE.PAUSED) { gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); lastTimeRef.current = performance.now(); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); };
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      joystickRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 };
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!joystickRef.current.active) return; e.preventDefault();
      const touch = e.touches[0];
      joystickRef.current.dx = (touch.clientX - joystickRef.current.startX) / 50;
      joystickRef.current.dy = (touch.clientY - joystickRef.current.startY) / 50;
      const len = Math.sqrt(joystickRef.current.dx ** 2 + joystickRef.current.dy ** 2);
      if (len > 1) { joystickRef.current.dx /= len; joystickRef.current.dy /= len; }
    };
    const handleTouchEnd = () => { joystickRef.current.active = false; joystickRef.current.dx = 0; joystickRef.current.dy = 0; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    lastTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;
      if (gameStateRef.current === GAME_STATE.PLAYING) updateGame(dt, canvas);
      renderGame(canvas, ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateGame = (dt: number, canvas: HTMLCanvasElement) => {
    const p = playerRef.current; if (!p) return;
    gameTimeRef.current += dt;
    uiUpdateTimerRef.current += dt;
    if (uiUpdateTimerRef.current > 0.1) {
      uiUpdateTimerRef.current = 0;
      setGameTime(Math.floor(gameTimeRef.current));
      setKillCount(killCountRef.current);
      setPlayerData({ hp: p.hp, maxHp: p.maxHp, level: p.level, xp: p.xp, xpToNext: p.xpToNext, damage: p.damage, speed: p.speed, attackSpeed: p.attackSpeed });
    }

    let dx = 0, dy = 0;
    if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= 1;
    if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += 1;
    if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= 1;
    if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += 1;
    if (joystickRef.current.active) { dx += joystickRef.current.dx; dy += joystickRef.current.dy; }
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy); dx /= len; dy /= len;
      p.x += dx * p.speed * 60 * dt; p.y += dy * p.speed * 60 * dt;
    }
    cameraRef.current.x = p.x - canvas.width / 2;
    cameraRef.current.y = p.y - canvas.height / 2;
    if (p.invincibleTimer > 0) p.invincibleTimer -= dt;

    p.attackTimer -= dt;
    if (p.attackTimer <= 0) {
      p.attackTimer = 1 / p.attackSpeed;
      const sorted = [...enemiesRef.current].sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
      for (let i = 0; i < p.projectileCount; i++) {
        const target = sorted[i % sorted.length]; if (!target) break;
        const angle = Math.atan2(target.y - p.y, target.x - p.x);
        const spread = p.projectileCount > 1 ? (i - (p.projectileCount - 1) / 2) * 0.15 : 0;
        projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(angle + spread) * p.projectileSpeed, vy: Math.sin(angle + spread) * p.projectileSpeed, damage: p.damage, size: p.projectileSize, piercing: 1, lifetime: 2, type: p.character });
      }
    }

    projectilesRef.current = projectilesRef.current.filter(proj => {
      proj.x += proj.vx * 60 * dt; proj.y += proj.vy * 60 * dt; proj.lifetime -= dt;
      if (proj.lifetime <= 0) return false;
      for (const e of enemiesRef.current) {
        const dist = Math.sqrt((proj.x - e.x) ** 2 + (proj.y - e.y) ** 2);
        if (dist < proj.size + e.size) {
          e.hp -= proj.damage; e.knockbackX += proj.vx * 0.3; e.knockbackY += proj.vy * 0.3;
          damageNumbersRef.current.push({ x: e.x, y: e.y - e.size, value: Math.round(proj.damage), lifetime: 0.8, color: CHARACTERS[p.character].color });
          for (let j = 0; j < 3; j++) particlesRef.current.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, lifetime: 0.5, maxLifetime: 0.5, color: CHARACTERS[p.character].color, size: 3 + Math.random() * 3 });
          proj.piercing--; if (proj.piercing <= 0) return false;
        }
      }
      return true;
    });

    enemiesRef.current = enemiesRef.current.filter(e => {
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(angle) * e.speed * 60 * dt + e.knockbackX;
      e.y += Math.sin(angle) * e.speed * 60 * dt + e.knockbackY;
      e.knockbackX *= 0.9; e.knockbackY *= 0.9;
      if (e.hp <= 0) {
        killCountRef.current++;
        xpOrbsRef.current.push({ x: e.x, y: e.y, value: e.xpValue, size: 6 + e.xpValue });
        for (let i = 0; i < 8; i++) particlesRef.current.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, lifetime: 0.6, maxLifetime: 0.6, color: ['#ff0', '#f0f', '#0ff', '#f00'][e.type], size: 4 + Math.random() * 4 });
        return false;
      }
      const distToPlayer = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
      if (distToPlayer < e.size + 20 && p.invincibleTimer <= 0) {
        const dmg = Math.max(1, e.damage - p.armor); p.hp -= dmg; p.invincibleTimer = 0.5;
        damageNumbersRef.current.push({ x: p.x, y: p.y - 30, value: Math.round(dmg), lifetime: 1, color: '#ff0000' });
        if (p.hp <= 0) {
          gameStateRef.current = GAME_STATE.GAME_OVER; setUiState(GAME_STATE.GAME_OVER);
          setHighScore(prev => Math.max(prev, Math.floor(gameTimeRef.current)));
        }
      }
      return true;
    });

    xpOrbsRef.current = xpOrbsRef.current.filter(orb => {
      const dist = Math.sqrt((p.x - orb.x) ** 2 + (p.y - orb.y) ** 2);
      if (dist < p.pickupRange) {
        const a = Math.atan2(p.y - orb.y, p.x - orb.x);
        const pullSpeed = 8 * (1 - dist / p.pickupRange) + 3;
        orb.x += Math.cos(a) * pullSpeed * 60 * dt; orb.y += Math.sin(a) * pullSpeed * 60 * dt;
      }
      if (dist < 25) {
        p.xp += orb.value;
        if (p.xp >= p.xpToNext) {
          p.xp -= p.xpToNext; p.level++; p.xpToNext = Math.floor(p.xpToNext * 1.5);
          setUpgrades(getRandomUpgrades(3));
          gameStateRef.current = GAME_STATE.LEVEL_UP; setUiState(GAME_STATE.LEVEL_UP);
        }
        return false;
      }
      return true;
    });

    damageNumbersRef.current = damageNumbersRef.current.filter(d => { d.y -= 40 * dt; d.lifetime -= dt; return d.lifetime > 0; });
    particlesRef.current = particlesRef.current.filter(pt => { pt.x += pt.vx * 60 * dt; pt.y += pt.vy * 60 * dt; pt.lifetime -= dt; return pt.lifetime > 0; });

    spawnTimerRef.current -= dt;
    if (spawnTimerRef.current <= 0) {
      spawnTimerRef.current = Math.max(0.2, 1.5 - gameTimeRef.current / 60);
      for (let i = 0; i < 1 + Math.floor(gameTimeRef.current / 20); i++) spawnEnemy();
    }
    if (enemiesRef.current.length > 200) enemiesRef.current = enemiesRef.current.slice(-150);
  };

  const renderGame = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const p = playerRef.current; if (!p) return;
    const cam = cameraRef.current;

    // Grid with glow
    ctx.strokeStyle = '#1a1a3e';
    ctx.lineWidth = 1;
    const gridSize = 80;
    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const startY = Math.floor(cam.y / gridSize) * gridSize;
    for (let x = startX; x < cam.x + canvas.width + gridSize; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x - cam.x, 0); ctx.lineTo(x - cam.x, canvas.height); ctx.stroke();
    }
    for (let y = startY; y < cam.y + canvas.height + gridSize; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y - cam.y); ctx.lineTo(canvas.width, y - cam.y); ctx.stroke();
    }

    // XP orbs
    xpOrbsRef.current.forEach(orb => {
      const sx = orb.x - cam.x, sy = orb.y - cam.y;
      if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) return;
      ctx.save();
      ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(sx, sy, orb.size, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88'; ctx.fill();
      ctx.restore();
    });

    // Particles
    particlesRef.current.forEach(pt => {
      ctx.globalAlpha = pt.lifetime / pt.maxLifetime;
      ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size * (pt.lifetime / pt.maxLifetime), 0, Math.PI * 2);
      ctx.fillStyle = pt.color; ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Enemies
    const colors = ['#8b0000', '#4a0080', '#006400', '#8b4513'];
    const emojis = ['👹', '👻', '🐛', '👾'];
    enemiesRef.current.forEach(e => {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return;
      ctx.save();
      ctx.shadowColor = colors[e.type]; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(sx, sy, e.size, 0, Math.PI * 2);
      ctx.fillStyle = colors[e.type]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.font = `${e.size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emojis[e.type], sx, sy);
      if (e.hp < e.maxHp) {
        const barW = e.size * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - barW / 2, sy - e.size - 10, barW, 4);
        ctx.fillStyle = '#ff4444'; ctx.fillRect(sx - barW / 2, sy - e.size - 10, barW * (e.hp / e.maxHp), 4);
      }
    });

    // Projectiles
    const projColors = ['#ff69b4', '#87ceeb', '#ff4500', '#ffd700'];
    projectilesRef.current.forEach(proj => {
      const sx = proj.x - cam.x, sy = proj.y - cam.y;
      ctx.save();
      ctx.shadowColor = projColors[proj.type]; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(sx, sy, proj.size, 0, Math.PI * 2);
      ctx.fillStyle = projColors[proj.type]; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(sx - proj.vx * 0.5, sy - proj.vy * 0.5, proj.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = projColors[proj.type] + '60'; ctx.fill();
    });

    // Player
    const psx = p.x - cam.x, psy = p.y - cam.y;
    ctx.save();
    const gradient = ctx.createRadialGradient(psx, psy, 0, psx, psy, 40);
    gradient.addColorStop(0, CHARACTERS[p.character].color + '30');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(psx, psy, 40, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) ctx.globalAlpha = 0.5;
    ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(CHARACTERS[p.character].emoji, psx, psy);
    ctx.globalAlpha = 1;

    // Pickup range
    ctx.beginPath(); ctx.arc(psx, psy, p.pickupRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);

    // Damage numbers
    damageNumbersRef.current.forEach(d => {
      ctx.globalAlpha = d.lifetime;
      ctx.font = 'bold 18px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(d.value.toString(), d.x - cam.x + 1, d.y - cam.y + 1);
      ctx.fillStyle = d.color; ctx.fillText(d.value.toString(), d.x - cam.x, d.y - cam.y);
    });
    ctx.globalAlpha = 1;

    // === HUD ===
    // HP Bar
    const hpBarW = 220, hpBarH = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, 14, 14, hpBarW + 4, hpBarH + 4, 6);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 16, 16, hpBarW, hpBarH, 4);
    ctx.fill();
    const hpGrad = ctx.createLinearGradient(16, 0, 16 + hpBarW, 0);
    hpGrad.addColorStop(0, '#ff4444'); hpGrad.addColorStop(1, '#ff8888');
    ctx.fillStyle = hpGrad;
    roundRect(ctx, 16, 16, hpBarW * (p.hp / p.maxHp), hpBarH, 4);
    ctx.fill();
    ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(`❤️ ${Math.ceil(p.hp)} / ${p.maxHp}`, 16 + hpBarW / 2, 30);

    // XP Bar
    const xpBarW = 220, xpBarH = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, 14, 42, xpBarW + 4, xpBarH + 4, 6);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 16, 44, xpBarW, xpBarH, 4);
    ctx.fill();
    const xpGrad = ctx.createLinearGradient(16, 0, 16 + xpBarW, 0);
    xpGrad.addColorStop(0, '#00cc66'); xpGrad.addColorStop(1, '#00ff88');
    ctx.fillStyle = xpGrad;
    roundRect(ctx, 16, 44, xpBarW * (p.xp / p.xpToNext), xpBarH, 4);
    ctx.fill();
    ctx.font = 'bold 10px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff';
    ctx.fillText(`Lv.${p.level}  ${p.xp}/${p.xpToNext}`, 16 + xpBarW / 2, 54);

    // Timer
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(ctx, canvas.width - 130, 12, 116, 50, 10);
    ctx.fill();
    const mins = Math.floor(gameTimeRef.current / 60);
    const secs = Math.floor(gameTimeRef.current % 60);
    ctx.font = 'bold 22px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, canvas.width - 72, 36);
    ctx.font = '13px "Segoe UI", sans-serif'; ctx.fillStyle = '#aaa';
    ctx.fillText(`💀 ${killCountRef.current}`, canvas.width - 72, 54);

    // Stats
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, 10, canvas.height - 36, 380, 28, 8);
    ctx.fill();
    ctx.font = '12px "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#ccc';
    ctx.fillText(`⚔️ ${Math.round(p.damage)}   💨 ${p.speed.toFixed(1)}   ⚡ ${p.attackSpeed.toFixed(1)}/s   🛡️ ${p.armor}   🎯 ×${p.projectileCount}`, 20, canvas.height - 18);

    // Virtual joystick
    if (joystickRef.current.active) {
      const jx = joystickRef.current.startX, jy = joystickRef.current.startY;
      ctx.beginPath(); ctx.arc(jx, jy, 50, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(jx + joystickRef.current.dx * 40, jy + joystickRef.current.dy * 40, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
    }
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const handleUpgrade = (upgrade: Upgrade) => {
    if (playerRef.current) upgrade.apply(playerRef.current);
    gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); setUpgrades([]);
  };

  return (
    <div className="w-full h-screen overflow-hidden relative bg-[#0a0a14] select-none">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ===== MENU ===== */}
      {uiState === GAME_STATE.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#0d0d2b] to-[#1a0033]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,0,255,0.15),transparent_70%)]" />

          {/* Floating particles */}
          {menuParticles.map((p, i) => (
            <div
              key={i}
              className="absolute pointer-events-none animate-float"
              style={{
                left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.size}px`,
                opacity: p.opacity, animation: `floatUp ${8 + i * 0.5}s linear infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            >
              {p.emoji}
            </div>
          ))}

          <div className="relative z-10 text-center px-4">
            {/* Title */}
            <div className="mb-2">
              <span className="text-6xl md:text-8xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg tracking-tight">
                アニメ
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-1 tracking-wide">
              Survivors
            </h1>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-pink-500/50" />
              <p className="text-lg text-purple-200/80 font-medium">✨ Выживи как можно дольше ✨</p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-pink-500/50" />
            </div>

            {highScore > 0 && (
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                <span className="text-yellow-400">🏆</span>
                <span className="text-yellow-200 font-semibold">Рекорд: {Math.floor(highScore / 60)}:{(highScore % 60).toString().padStart(2, '0')}</span>
              </div>
            )}

            <button
              onClick={() => { setUiState(GAME_STATE.CHARACTER_SELECT); gameStateRef.current = GAME_STATE.CHARACTER_SELECT; }}
              className="group relative px-10 py-4 rounded-2xl font-bold text-xl text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 transition-all duration-300 group-hover:from-pink-400 group-hover:via-purple-400 group-hover:to-indigo-400" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 blur-xl" />
              <span className="relative z-10 flex items-center gap-3">
                <span className="text-2xl">🎮</span> Начать игру
              </span>
            </button>

            <div className="mt-10 space-y-2">
              <div className="flex items-center justify-center gap-6 text-sm text-purple-300/60">
                <span className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-xs font-mono">WASD</kbd> Движение</span>
                <span className="flex items-center gap-1.5"><kbd className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-xs font-mono">ESC</kbd> Пауза</span>
              </div>
              <p className="text-xs text-purple-400/40">Атака автоматическая • Собирай опыт • Прокачивайся</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== CHARACTER SELECT ===== */}
      {uiState === GAME_STATE.CHARACTER_SELECT && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d2b] via-[#1a0a3a] to-[#0d0d2b]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,0,255,0.1),transparent_60%)]" />

          <div className="relative z-10 text-center px-4 w-full max-w-3xl">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-2">Выбери героиню</h2>
            <p className="text-purple-300/60 mb-8">Каждая героиня имеет уникальный стиль боя</p>

            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {CHARACTERS.map((char, i) => (
                <button
                  key={i}
                  onClick={() => initGame(i)}
                  className="group relative p-5 md:p-7 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/30 transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] overflow-hidden"
                >
                  {/* Hover glow */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${char.gradient} blur-xl`} />

                  <div className="relative z-10">
                    <div className="text-5xl md:text-6xl mb-3 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                      {char.emoji}
                    </div>
                    <div className="text-lg md:text-xl font-bold text-white mb-1">{char.name}</div>
                    <div className="text-xs md:text-sm text-gray-400 mb-2">{char.desc}</div>
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${char.gradient} text-white`}>
                      {char.stats}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setUiState(GAME_STATE.MENU); gameStateRef.current = GAME_STATE.MENU; }}
              className="mt-8 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all duration-200"
            >
              ← Назад
            </button>
          </div>
        </div>
      )}

      {/* ===== LEVEL UP ===== */}
      {uiState === GAME_STATE.LEVEL_UP && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,200,0,0.08),transparent_60%)]" />

          <div className="relative z-10 text-center px-4">
            <div className="mb-1 text-6xl animate-bounce">⬆️</div>
            <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 bg-clip-text text-transparent mb-1">
              Уровень {playerData.level}!
            </h2>
            <p className="text-white/60 mb-8 text-lg">Выбери улучшение</p>

            <div className="flex gap-3 md:gap-5 flex-wrap justify-center max-w-2xl mx-auto">
              {upgrades.map((up, i) => (
                <button
                  key={i}
                  onClick={() => handleUpgrade(up)}
                  className="group relative p-5 md:p-6 w-44 md:w-52 rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-purple-900/80 to-indigo-950/80 backdrop-blur-md hover:border-yellow-400/60 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-b from-yellow-400/20 to-transparent" />
                  <div className="relative z-10">
                    <div className="text-4xl md:text-5xl mb-3 transition-transform duration-300 group-hover:scale-125">{up.icon}</div>
                    <div className="text-base md:text-lg font-bold text-white mb-1">{up.name}</div>
                    <div className="text-xs md:text-sm text-purple-200/70">{up.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== PAUSED ===== */}
      {uiState === GAME_STATE.PAUSED && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative z-10 text-center">
            <div className="text-6xl mb-4">⏸️</div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8">Пауза</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); lastTimeRef.current = performance.now(); }}
                className="px-10 py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
              >
                ▶️ Продолжить
              </button>
              <button
                onClick={() => { gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }}
                className="px-10 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95"
              >
                🏠 В меню
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== GAME OVER ===== */}
      {uiState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 overflow-hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.05),transparent_60%)]" />

          <div className="relative z-10 text-center px-4">
            <div className="text-6xl mb-3">💀</div>
            <h2 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-red-400 via-rose-400 to-red-500 bg-clip-text text-transparent mb-8">
              Game Over
            </h2>

            <div className="inline-flex flex-col gap-3 px-8 py-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-8">
              <div className="flex items-center gap-4">
                <span className="text-2xl">⏱️</span>
                <div className="text-left">
                  <div className="text-xs text-gray-400">Время</div>
                  <div className="text-xl font-bold text-white">{Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}</div>
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-center gap-4">
                <span className="text-2xl">⭐</span>
                <div className="text-left">
                  <div className="text-xs text-gray-400">Уровень</div>
                  <div className="text-xl font-bold text-white">{playerData.level}</div>
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex items-center gap-4">
                <span className="text-2xl">💀</span>
                <div className="text-left">
                  <div className="text-xs text-gray-400">Убийства</div>
                  <div className="text-xl font-bold text-white">{killCount}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => { gameStateRef.current = GAME_STATE.CHARACTER_SELECT; setUiState(GAME_STATE.CHARACTER_SELECT); }}
                className="px-10 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-pink-500/20"
              >
                🔄 Играть снова
              </button>
              <button
                onClick={() => { gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }}
                className="px-10 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95"
              >
                🏠 В меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
