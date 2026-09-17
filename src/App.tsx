import { useEffect, useRef, useState, useCallback } from 'react';

// ==================== TYPES ====================
interface Position {
  x: number;
  y: number;
}

interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  level: number;
  xp: number;
  xpToNext: number;
  damage: number;
  attackSpeed: number;
  attackTimer: number;
  projectileCount: number;
  projectileSpeed: number;
  projectileSize: number;
  pickupRange: number;
  armor: number;
  invincibleTimer: number;
  character: number;
}

interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  type: number;
  size: number;
  xpValue: number;
  knockbackX: number;
  knockbackY: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  size: number;
  piercing: number;
  lifetime: number;
  type: number;
}

interface XpOrb {
  x: number;
  y: number;
  value: number;
  size: number;
}

interface DamageNumber {
  x: number;
  y: number;
  value: number;
  lifetime: number;
  color: string;
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (player: Player) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
}

// ==================== CHARACTERS ====================
const CHARACTERS = [
  { name: 'Сакура', emoji: '🌸', color: '#ff69b4', desc: 'Быстрая атака, средний урон' },
  { name: 'Юки', emoji: '❄️', color: '#87ceeb', desc: 'Замораживающие снаряды' },
  { name: 'Хина', emoji: '🔥', color: '#ff4500', desc: 'Высокий урон, медленная атака' },
  { name: 'Мико', emoji: '⚡', color: '#ffd700', desc: 'Много снарядов, низкий урон' },
];

// ==================== GAME STATE ====================
const GAME_STATE = {
  MENU: 'menu',
  CHARACTER_SELECT: 'character_select',
  PLAYING: 'playing',
  LEVEL_UP: 'level_up',
  GAME_OVER: 'game_over',
  PAUSED: 'paused',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef(GAME_STATE.MENU);
  const [uiState, setUiState] = useState(GAME_STATE.MENU);
  const [player, setPlayer] = useState<Player | null>(null);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [killCount, setKillCount] = useState(0);
  const [selectedChar, setSelectedChar] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const joystickRef = useRef<{ active: boolean; startX: number; startY: number; dx: number; dy: number }>({
    active: false, startX: 0, startY: 0, dx: 0, dy: 0,
  });

  const keysRef = useRef<Set<string>>(new Set());
  const playerRef = useRef<Player | null>(null);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const xpOrbsRef = useRef<XpOrb[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const cameraRef = useRef<Position>({ x: 0, y: 0 });
  const gameTimeRef = useRef(0);
  const killCountRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(0);

  // ==================== UPGRADES ====================
  const getUpgrades = useCallback((): Upgrade[] => {
    return [
      {
        id: 'damage_up',
        name: '⚔️ Сила+',
        description: '+20% к урону',
        icon: '⚔️',
        apply: (p: Player) => { p.damage *= 1.2; },
      },
      {
        id: 'speed_up',
        name: '💨 Скорость+',
        description: '+15% к скорости',
        icon: '💨',
        apply: (p: Player) => { p.speed *= 1.15; },
      },
      {
        id: 'attack_speed',
        name: '⚡ Атака+',
        description: '+20% скорость атаки',
        icon: '⚡',
        apply: (p: Player) => { p.attackSpeed *= 1.2; },
      },
      {
        id: 'hp_up',
        name: '❤️ Здоровье+',
        description: '+30 макс. HP',
        icon: '❤️',
        apply: (p: Player) => { p.maxHp += 30; p.hp += 30; },
      },
      {
        id: 'projectile_count',
        name: '🎯 Снаряды+',
        description: '+1 снаряд',
        icon: '🎯',
        apply: (p: Player) => { p.projectileCount += 1; },
      },
      {
        id: 'projectile_speed',
        name: '🚀 Скорость снарядов+',
        description: '+25% скорость снарядов',
        icon: '🚀',
        apply: (p: Player) => { p.projectileSpeed *= 1.25; },
      },
      {
        id: 'pickup_range',
        name: '🧲 Притяжение+',
        description: '+30% радиус сбора',
        icon: '🧲',
        apply: (p: Player) => { p.pickupRange *= 1.3; },
      },
      {
        id: 'armor',
        name: '🛡️ Броня+',
        description: '+2 к броне',
        icon: '🛡️',
        apply: (p: Player) => { p.armor += 2; },
      },
      {
        id: 'projectile_size',
        name: '💫 Размер+',
        description: '+30% размер снарядов',
        icon: '💫',
        apply: (p: Player) => { p.projectileSize *= 1.3; },
      },
      {
        id: 'heal',
        name: '💖 Лечение',
        description: 'Восстановить 50% HP',
        icon: '💖',
        apply: (p: Player) => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); },
      },
    ];
  }, []);

  const getRandomUpgrades = useCallback((count: number): Upgrade[] => {
    const all = getUpgrades();
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }, [getUpgrades]);

  // ==================== INIT GAME ====================
  const initGame = useCallback((charIndex: number) => {
    const baseStats: Player = {
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      speed: 3,
      level: 1,
      xp: 0,
      xpToNext: 10,
      damage: 10,
      attackSpeed: 1,
      attackTimer: 0,
      projectileCount: 1,
      projectileSpeed: 7,
      projectileSize: 8,
      pickupRange: 80,
      armor: 0,
      invincibleTimer: 0,
      character: charIndex,
    };

    // Character-specific bonuses
    switch (charIndex) {
      case 0: // Sakura - fast attack
        baseStats.attackSpeed = 1.3;
        baseStats.damage = 10;
        break;
      case 1: // Yuki - freeze
        baseStats.projectileSpeed = 6;
        baseStats.damage = 12;
        break;
      case 2: // Hina - high damage
        baseStats.damage = 18;
        baseStats.attackSpeed = 0.7;
        break;
      case 3: // Miko - many projectiles
        baseStats.projectileCount = 3;
        baseStats.damage = 6;
        break;
    }

    playerRef.current = baseStats;
    enemiesRef.current = [];
    projectilesRef.current = [];
    xpOrbsRef.current = [];
    damageNumbersRef.current = [];
    particlesRef.current = [];
    cameraRef.current = { x: 0, y: 0 };
    gameTimeRef.current = 0;
    killCountRef.current = 0;
    spawnTimerRef.current = 0;
    setPlayer(baseStats);
    setGameTime(0);
    setKillCount(0);
    setUiState(GAME_STATE.PLAYING);
    gameStateRef.current = GAME_STATE.PLAYING;
  }, []);

  // ==================== SPAWN ENEMIES ====================
  const spawnEnemy = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    const time = gameTimeRef.current;
    const difficulty = 1 + time / 30;

    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 200;
    const x = p.x + Math.cos(angle) * dist;
    const y = p.y + Math.sin(angle) * dist;

    const types = [
      { hp: 20, speed: 1.5, damage: 8, size: 18, xpValue: 3, color: '#8b0000' },
      { hp: 40, speed: 1, damage: 12, size: 24, xpValue: 5, color: '#4a0080' },
      { hp: 15, speed: 2.5, damage: 5, size: 14, xpValue: 2, color: '#006400' },
      { hp: 80, speed: 0.7, damage: 20, size: 32, xpValue: 10, color: '#8b4513' },
    ];

    const typeIdx = Math.random() < 0.7 ? Math.floor(Math.random() * 3) : 3;
    const type = types[typeIdx];

    const enemy: Enemy = {
      x,
      y,
      hp: type.hp * difficulty,
      maxHp: type.hp * difficulty,
      speed: type.speed * (1 + time / 120),
      damage: type.damage * (1 + time / 60),
      type: typeIdx,
      size: type.size,
      xpValue: type.xpValue,
      knockbackX: 0,
      knockbackY: 0,
    };

    enemiesRef.current.push(enemy);
  }, []);

  // ==================== GAME LOOP ====================
  const gameLoop = useCallback((timestamp: number) => {
    if (gameStateRef.current !== GAME_STATE.PLAYING) {
      animFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = timestamp;

    const p = playerRef.current;
    if (!p) return;

    // Update game time
    gameTimeRef.current += dt;
    setGameTime(Math.floor(gameTimeRef.current));

    // Player movement
    let dx = 0, dy = 0;
    if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= 1;
    if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += 1;
    if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= 1;
    if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += 1;

    // Touch joystick input
    if (joystickRef.current.active) {
      dx += joystickRef.current.dx;
      dy += joystickRef.current.dy;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      p.x += dx * p.speed * 60 * dt;
      p.y += dy * p.speed * 60 * dt;
    }

    // Camera
    cameraRef.current.x = p.x - canvas.width / 2;
    cameraRef.current.y = p.y - canvas.height / 2;

    // Invincibility timer
    if (p.invincibleTimer > 0) {
      p.invincibleTimer -= dt;
    }

    // Attack timer
    p.attackTimer -= dt;
    if (p.attackTimer <= 0) {
      p.attackTimer = 1 / p.attackSpeed;

      // Find nearest enemies
      const sorted = [...enemiesRef.current].sort((a, b) => {
        const da = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
        const db = (b.x - p.x) ** 2 + (b.y - p.y) ** 2;
        return da - db;
      });

      for (let i = 0; i < p.projectileCount; i++) {
        const target = sorted[i % sorted.length];
        if (!target) break;

        const angle = Math.atan2(target.y - p.y, target.x - p.x);
        const spread = p.projectileCount > 1 ? (i - (p.projectileCount - 1) / 2) * 0.15 : 0;

        const proj: Projectile = {
          x: p.x,
          y: p.y,
          vx: Math.cos(angle + spread) * p.projectileSpeed,
          vy: Math.sin(angle + spread) * p.projectileSpeed,
          damage: p.damage,
          size: p.projectileSize,
          piercing: 1,
          lifetime: 2,
          type: p.character,
        };
        projectilesRef.current.push(proj);
      }
    }

    // Update projectiles
    projectilesRef.current = projectilesRef.current.filter(proj => {
      proj.x += proj.vx * 60 * dt;
      proj.y += proj.vy * 60 * dt;
      proj.lifetime -= dt;

      if (proj.lifetime <= 0) return false;

      // Check collision with enemies
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const e = enemiesRef.current[i];
        const dist = Math.sqrt((proj.x - e.x) ** 2 + (proj.y - e.y) ** 2);
        if (dist < proj.size + e.size) {
          e.hp -= proj.damage;
          e.knockbackX += proj.vx * 0.3;
          e.knockbackY += proj.vy * 0.3;

          damageNumbersRef.current.push({
            x: e.x,
            y: e.y - e.size,
            value: Math.round(proj.damage),
            lifetime: 0.8,
            color: CHARACTERS[p.character].color,
          });

          // Particles
          for (let j = 0; j < 3; j++) {
            particlesRef.current.push({
              x: e.x,
              y: e.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              lifetime: 0.5,
              maxLifetime: 0.5,
              color: CHARACTERS[p.character].color,
              size: 3 + Math.random() * 3,
            });
          }

          proj.piercing--;
          if (proj.piercing <= 0) return false;
        }
      }
      return true;
    });

    // Update enemies
    enemiesRef.current = enemiesRef.current.filter(e => {
      // Move toward player
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(angle) * e.speed * 60 * dt + e.knockbackX;
      e.y += Math.sin(angle) * e.speed * 60 * dt + e.knockbackY;
      e.knockbackX *= 0.9;
      e.knockbackY *= 0.9;

      // Check death
      if (e.hp <= 0) {
        killCountRef.current++;
        setKillCount(killCountRef.current);

        // Drop XP
        xpOrbsRef.current.push({
          x: e.x,
          y: e.y,
          value: e.xpValue,
          size: 6 + e.xpValue,
        });

        // Death particles
        for (let i = 0; i < 8; i++) {
          particlesRef.current.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            lifetime: 0.6,
            maxLifetime: 0.6,
            color: ['#ff0', '#f0f', '#0ff', '#f00'][e.type],
            size: 4 + Math.random() * 4,
          });
        }
        return false;
      }

      // Damage player
      const distToPlayer = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
      if (distToPlayer < e.size + 20 && p.invincibleTimer <= 0) {
        const dmg = Math.max(1, e.damage - p.armor);
        p.hp -= dmg;
        p.invincibleTimer = 0.5;

        damageNumbersRef.current.push({
          x: p.x,
          y: p.y - 30,
          value: Math.round(dmg),
          lifetime: 1,
          color: '#ff0000',
        });

        if (p.hp <= 0) {
          gameStateRef.current = GAME_STATE.GAME_OVER;
          setUiState(GAME_STATE.GAME_OVER);
          const score = Math.floor(gameTimeRef.current);
          if (score > highScore) {
            setHighScore(score);
          }
        }
      }

      return true;
    });

    // Update XP orbs
    xpOrbsRef.current = xpOrbsRef.current.filter(orb => {
      const dist = Math.sqrt((p.x - orb.x) ** 2 + (p.y - orb.y) ** 2);

      if (dist < p.pickupRange) {
        const angle = Math.atan2(p.y - orb.y, p.x - orb.x);
        const pullSpeed = 8 * (1 - dist / p.pickupRange) + 3;
        orb.x += Math.cos(angle) * pullSpeed * 60 * dt;
        orb.y += Math.sin(angle) * pullSpeed * 60 * dt;
      }

      if (dist < 25) {
        p.xp += orb.value;
        if (p.xp >= p.xpToNext) {
          p.xp -= p.xpToNext;
          p.level++;
          p.xpToNext = Math.floor(p.xpToNext * 1.5);
          // Level up!
          const ups = getRandomUpgrades(3);
          setUpgrades(ups);
          gameStateRef.current = GAME_STATE.LEVEL_UP;
          setUiState(GAME_STATE.LEVEL_UP);
        }
        return false;
      }
      return true;
    });

    // Update damage numbers
    damageNumbersRef.current = damageNumbersRef.current.filter(d => {
      d.y -= 40 * dt;
      d.lifetime -= dt;
      return d.lifetime > 0;
    });

    // Update particles
    particlesRef.current = particlesRef.current.filter(pt => {
      pt.x += pt.vx * 60 * dt;
      pt.y += pt.vy * 60 * dt;
      pt.lifetime -= dt;
      return pt.lifetime > 0;
    });

    // Spawn enemies
    spawnTimerRef.current -= dt;
    if (spawnTimerRef.current <= 0) {
      const spawnRate = Math.max(0.2, 1.5 - gameTimeRef.current / 60);
      spawnTimerRef.current = spawnRate;
      const count = 1 + Math.floor(gameTimeRef.current / 20);
      for (let i = 0; i < count; i++) {
        spawnEnemy();
      }
    }

    // Limit enemies
    if (enemiesRef.current.length > 200) {
      enemiesRef.current = enemiesRef.current.slice(-150);
    }

    // ==================== RENDER ====================
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cam = cameraRef.current;

    // Draw grid
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 1;
    const gridSize = 80;
    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const startY = Math.floor(cam.y / gridSize) * gridSize;
    for (let x = startX; x < cam.x + canvas.width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x - cam.x, 0);
      ctx.lineTo(x - cam.x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < cam.y + canvas.height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y - cam.y);
      ctx.lineTo(canvas.width, y - cam.y);
      ctx.stroke();
    }

    // Draw XP orbs
    xpOrbsRef.current.forEach(orb => {
      const sx = orb.x - cam.x;
      const sy = orb.y - cam.y;
      ctx.beginPath();
      ctx.arc(sx, sy, orb.size, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw particles
    particlesRef.current.forEach(pt => {
      const alpha = pt.lifetime / pt.maxLifetime;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw enemies
    enemiesRef.current.forEach(e => {
      const sx = e.x - cam.x;
      const sy = e.y - cam.y;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return;

      // Enemy body
      const colors = ['#8b0000', '#4a0080', '#006400', '#8b4513'];
      const emojis = ['👹', '👻', '🐛', '👾'];

      ctx.beginPath();
      ctx.arc(sx, sy, e.size, 0, Math.PI * 2);
      ctx.fillStyle = colors[e.type];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Enemy emoji
      ctx.font = `${e.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emojis[e.type], sx, sy);

      // HP bar
      if (e.hp < e.maxHp) {
        const barW = e.size * 2;
        const barH = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - barW / 2, sy - e.size - 10, barW, barH);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(sx - barW / 2, sy - e.size - 10, barW * (e.hp / e.maxHp), barH);
      }
    });

    // Draw projectiles
    projectilesRef.current.forEach(proj => {
      const sx = proj.x - cam.x;
      const sy = proj.y - cam.y;

      ctx.beginPath();
      ctx.arc(sx, sy, proj.size, 0, Math.PI * 2);
      const projColors = ['#ff69b4', '#87ceeb', '#ff4500', '#ffd700'];
      ctx.fillStyle = projColors[proj.type];
      ctx.fill();
      ctx.shadowColor = projColors[proj.type];
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Trail
      ctx.beginPath();
      ctx.arc(sx - proj.vx * 0.5, sy - proj.vy * 0.5, proj.size * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = projColors[proj.type] + '80';
      ctx.fill();
    });

    // Draw player
    const psx = p.x - cam.x;
    const psy = p.y - cam.y;

    // Player glow
    ctx.beginPath();
    ctx.arc(psx, psy, 30, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(psx, psy, 0, psx, psy, 30);
    gradient.addColorStop(0, CHARACTERS[p.character].color + '40');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Player body
    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    ctx.font = '36px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CHARACTERS[p.character].emoji, psx, psy);

    // Pickup range indicator
    ctx.beginPath();
    ctx.arc(psx, psy, p.pickupRange, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff20';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Draw damage numbers
    damageNumbersRef.current.forEach(d => {
      const sx = d.x - cam.x;
      const sy = d.y - cam.y;
      ctx.globalAlpha = d.lifetime;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = d.color;
      ctx.fillText(d.value.toString(), sx, sy);
    });
    ctx.globalAlpha = 1;

    // ==================== HUD ====================
    // HP Bar
    ctx.fillStyle = '#00000080';
    ctx.fillRect(10, 10, 200, 24);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(12, 12, 196 * (p.hp / p.maxHp), 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 200, 24);
    ctx.font = '12px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${Math.ceil(p.hp)}/${p.maxHp}`, 110, 24);

    // XP Bar
    ctx.fillStyle = '#00000080';
    ctx.fillRect(10, 38, 200, 16);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(12, 40, 196 * (p.xp / p.xpToNext), 12);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 38, 200, 16);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Lv.${p.level} (${p.xp}/${p.xpToNext})`, 110, 49);

    // Timer & Kills
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    const mins = Math.floor(gameTimeRef.current / 60);
    const secs = Math.floor(gameTimeRef.current % 60);
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, canvas.width - 20, 28);
    ctx.font = '14px Arial';
    ctx.fillText(`💀 ${killCountRef.current}`, canvas.width - 20, 50);

    // Character info
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`DMG: ${Math.round(p.damage)} | SPD: ${p.speed.toFixed(1)} | ATK: ${p.attackSpeed.toFixed(1)}/s`, 10, canvas.height - 15);

    // Draw virtual joystick if mobile/touch active
    if (joystickRef.current.active) {
      const jx = joystickRef.current.startX;
      const jy = joystickRef.current.startY;
      // Outer circle
      ctx.beginPath();
      ctx.arc(jx, jy, 50, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff40';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Inner circle (thumb)
      ctx.beginPath();
      ctx.arc(
        jx + joystickRef.current.dx * 40,
        jy + joystickRef.current.dy * 40,
        20, 0, Math.PI * 2
      );
      ctx.fillStyle = '#ffffff60';
      ctx.fill();
    }

    setPlayer({ ...p });
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [spawnEnemy, getRandomUpgrades, highScore]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === 'Escape') {
        if (gameStateRef.current === GAME_STATE.PLAYING) {
          gameStateRef.current = GAME_STATE.PAUSED;
          setUiState(GAME_STATE.PAUSED);
        } else if (gameStateRef.current === GAME_STATE.PAUSED) {
          gameStateRef.current = GAME_STATE.PLAYING;
          setUiState(GAME_STATE.PLAYING);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    // Touch controls
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      joystickRef.current.active = true;
      joystickRef.current.startX = touch.clientX;
      joystickRef.current.startY = touch.clientY;
      joystickRef.current.dx = 0;
      joystickRef.current.dy = 0;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!joystickRef.current.active) return;
      e.preventDefault();
      const touch = e.touches[0];
      joystickRef.current.dx = (touch.clientX - joystickRef.current.startX) / 50;
      joystickRef.current.dy = (touch.clientY - joystickRef.current.startY) / 50;
      // Clamp
      const len = Math.sqrt(joystickRef.current.dx ** 2 + joystickRef.current.dy ** 2);
      if (len > 1) {
        joystickRef.current.dx /= len;
        joystickRef.current.dy /= len;
      }
    };
    const handleTouchEnd = () => {
      joystickRef.current.active = false;
      joystickRef.current.dx = 0;
      joystickRef.current.dy = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameLoop]);

  // ==================== LEVEL UP HANDLER ====================
  const handleUpgrade = (upgrade: Upgrade) => {
    if (playerRef.current) {
      upgrade.apply(playerRef.current);
      setPlayer({ ...playerRef.current });
    }
    gameStateRef.current = GAME_STATE.PLAYING;
    setUiState(GAME_STATE.PLAYING);
    setUpgrades([]);
  };

  // ==================== RENDER UI ====================
  return (
    <div className="w-full h-screen overflow-hidden relative bg-gray-900">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* MENU */}
      {uiState === GAME_STATE.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-purple-900/90 to-pink-900/90 z-10">
          <div className="text-center mb-8">
            <h1 className="text-6xl font-bold text-white mb-2 animate-pulse">✨ アニメ Survivors ✨</h1>
            <p className="text-xl text-pink-200">Выживи как можно дольше!</p>
            {highScore > 0 && <p className="text-yellow-300 mt-2">🏆 Рекорд: {Math.floor(highScore / 60)}:{(highScore % 60).toString().padStart(2, '0')}</p>}
          </div>
          <button
            onClick={() => { setUiState(GAME_STATE.CHARACTER_SELECT); gameStateRef.current = GAME_STATE.CHARACTER_SELECT; }}
            className="px-8 py-4 bg-pink-500 hover:bg-pink-400 text-white text-2xl font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all"
          >
            🎮 Начать игру
          </button>
          <div className="mt-8 text-gray-300 text-sm">
            <p>WASD / Стрелки - движение</p>
            <p>Атака автоматическая!</p>
            <p>ESC - пауза</p>
          </div>
        </div>
      )}

      {/* CHARACTER SELECT */}
      {uiState === GAME_STATE.CHARACTER_SELECT && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-900/95 to-purple-900/95 z-10">
          <h2 className="text-4xl font-bold text-white mb-8">Выбери героиню!</h2>
          <div className="grid grid-cols-2 gap-6 max-w-2xl">
            {CHARACTERS.map((char, i) => (
              <button
                key={i}
                onClick={() => initGame(i)}
                className={`p-6 rounded-xl border-2 transition-all transform hover:scale-105 ${
                  selectedChar === i ? 'border-yellow-400 bg-white/20' : 'border-white/30 bg-white/10 hover:bg-white/20'
                }`}
              >
                <div className="text-5xl mb-2">{char.emoji}</div>
                <div className="text-xl font-bold text-white">{char.name}</div>
                <div className="text-sm text-gray-300 mt-1">{char.desc}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setUiState(GAME_STATE.MENU); gameStateRef.current = GAME_STATE.MENU; }}
            className="mt-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            ← Назад
          </button>
        </div>
      )}

      {/* LEVEL UP */}
      {uiState === GAME_STATE.LEVEL_UP && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
          <h2 className="text-4xl font-bold text-yellow-300 mb-2 animate-bounce">⬆️ Уровень {player?.level}!</h2>
          <p className="text-white mb-6">Выбери улучшение:</p>
          <div className="flex gap-4 flex-wrap justify-center">
            {upgrades.map((up, i) => (
              <button
                key={i}
                onClick={() => handleUpgrade(up)}
                className="p-6 bg-gradient-to-b from-purple-800 to-indigo-900 border-2 border-yellow-400 rounded-xl hover:scale-110 transition-all w-48 text-center shadow-xl"
              >
                <div className="text-4xl mb-2">{up.icon}</div>
                <div className="text-lg font-bold text-white">{up.name}</div>
                <div className="text-sm text-gray-300 mt-1">{up.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PAUSED */}
      {uiState === GAME_STATE.PAUSED && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10">
          <h2 className="text-5xl font-bold text-white mb-8">⏸️ Пауза</h2>
          <button
            onClick={() => { gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); }}
            className="px-8 py-4 bg-green-500 hover:bg-green-400 text-white text-xl font-bold rounded-xl mb-4"
          >
            ▶️ Продолжить
          </button>
          <button
            onClick={() => { gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }}
            className="px-8 py-4 bg-red-500 hover:bg-red-400 text-white text-xl font-bold rounded-xl"
          >
            🏠 В меню
          </button>
        </div>
      )}

      {/* GAME OVER */}
      {uiState === GAME_STATE.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
          <h2 className="text-5xl font-bold text-red-400 mb-4">💀 Game Over</h2>
          <div className="text-center text-white mb-8">
            <p className="text-2xl">Время: {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}</p>
            <p className="text-xl mt-2">Уровень: {player?.level}</p>
            <p className="text-xl mt-2">Убийства: {killCount}</p>
          </div>
          <button
            onClick={() => { gameStateRef.current = GAME_STATE.CHARACTER_SELECT; setUiState(GAME_STATE.CHARACTER_SELECT); }}
            className="px-8 py-4 bg-pink-500 hover:bg-pink-400 text-white text-xl font-bold rounded-xl mb-4"
          >
            🔄 Играть снова
          </button>
          <button
            onClick={() => { gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
          >
            🏠 В меню
          </button>
        </div>
      )}
    </div>
  );
}
