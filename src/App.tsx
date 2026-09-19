import { useEffect, useRef, useState } from 'react';
import {
  addExperience,
  buildWaveSpawnQueue,
  getMovementKey,
  getProgressRatio,
  spawnProbability,
} from './gameLogic';
import {
  CHARACTERS,
  CHEST_TYPES,
  ENEMY_TYPES,
  GAME_STATE,
  HIGH_SCORE_STORAGE_KEY,
  WAVE_CONFIGS as WAVES,
} from './game/config';
import type {
  Chest,
  DamageNumber,
  Enemy,
  MenuParticle,
  Particle,
  Player,
  Projectile,
  GameState,
  WaveEnemy,
  XpOrb,
} from './game/types';

interface Upgrade { id: string; name: string; description: string; icon: string; apply: (p: Player) => void; }

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
  const gameStateRef = useRef<GameState>(GAME_STATE.MENU);
  const [uiState, setUiState] = useState<GameState>(GAME_STATE.MENU);
  const [playerData, setPlayerData] = useState({ hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 10, damage: 10, speed: 3, attackSpeed: 1 });
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [killCount, setKillCount] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      const stored = Number.parseInt(window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY) ?? '0', 10);
      return Number.isFinite(stored) ? stored : 0;
    } catch {
      return 0;
    }
  });
  const [showPauseBtn, setShowPauseBtn] = useState(false);
  const [currentWave, setCurrentWave] = useState(1);
  const [waveIntro, setWaveIntro] = useState(false);

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
  const chestsRef = useRef<Chest[]>([]);
  const cameraRef = useRef({ x: 0, y: 0 });
  const gameTimeRef = useRef(0);
  const killCountRef = useRef(0);
  const currentWaveRef = useRef(1);
  const waveTimerRef = useRef(0);
  const waveEnemiesSpawnedRef = useRef(0);
  const waveEnemiesAliveRef = useRef(0);
  const waveEnemiesTotalRef = useRef(0);
  const waveSpawnQueueRef = useRef<WaveEnemy[]>([]);
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const joystickRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });
  const uiUpdateTimerRef = useRef(0);
  const waveIntroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLevelUpsRef = useRef(0);

  const getPlayerSnapshot = (p: Player) => ({
    hp: p.hp,
    maxHp: p.maxHp,
    level: p.level,
    xp: p.xp,
    xpToNext: p.xpToNext,
    damage: p.damage,
    speed: p.speed,
    attackSpeed: p.attackSpeed,
  });

  const recordHighScore = (score: number) => {
    setHighScore(previous => {
      const next = Math.max(previous, score);
      if (next > previous) {
        try {
          window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(next));
        } catch {
          // Local storage may be unavailable in private browsing contexts.
        }
      }
      return next;
    });
  };

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
    particlesRef.current = []; chestsRef.current = []; cameraRef.current = { x: 0, y: 0 };
    gameTimeRef.current = 0; killCountRef.current = 0;
    currentWaveRef.current = 1; waveTimerRef.current = 0;
    waveEnemiesSpawnedRef.current = 0; waveEnemiesAliveRef.current = 0; waveEnemiesTotalRef.current = 0;
    waveSpawnQueueRef.current = [];
    pendingLevelUpsRef.current = 0;
    keysRef.current.clear();
    setPlayerData(getPlayerSnapshot(p));
    setGameTime(0); setKillCount(0); setCurrentWave(1);
    setUiState(GAME_STATE.PLAYING); gameStateRef.current = GAME_STATE.PLAYING;
    startWave(1);
  };

  const startWave = (waveNum: number) => {
    const wave = WAVES[waveNum - 1];
    if (!wave) return;
    
    waveTimerRef.current = wave.duration;
    waveEnemiesSpawnedRef.current = 0;
    waveEnemiesAliveRef.current = 0;
    waveSpawnQueueRef.current = buildWaveSpawnQueue(wave.enemies, Math.random);
    waveEnemiesTotalRef.current = waveSpawnQueueRef.current.length;
    
    // Spawn chests
    const chestCount = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < chestCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 400;
      const p = playerRef.current;
      if (p) {
        chestsRef.current.push({
          x: p.x + Math.cos(angle) * dist,
          y: p.y + Math.sin(angle) * dist,
          type: Math.floor(Math.random() * CHEST_TYPES.length),
          collected: false,
        });
      }
    }

    // Show wave intro
    if (waveIntroTimeoutRef.current) clearTimeout(waveIntroTimeoutRef.current);
    setWaveIntro(true);
    waveIntroTimeoutRef.current = setTimeout(() => {
      setWaveIntro(false);
      waveIntroTimeoutRef.current = null;
    }, 2000);
  };

  const spawnEnemy = (type: number, isBoss: boolean = false) => {
    const p = playerRef.current; if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * 200;
    const t = ENEMY_TYPES[type];
    const waveMultiplier = 1 + (currentWaveRef.current - 1) * 0.15;
    
    const enemy: Enemy = {
      x: p.x + Math.cos(angle) * dist,
      y: p.y + Math.sin(angle) * dist,
      hp: t.hp * waveMultiplier * (isBoss ? 10 : 1),
      maxHp: t.hp * waveMultiplier * (isBoss ? 10 : 1),
      speed: t.speed * (isBoss ? 0.5 : 1),
      damage: t.damage * waveMultiplier * (isBoss ? 2 : 1),
      type: type,
      size: t.size * (isBoss ? 3 : 1),
      xpValue: t.xpValue * (isBoss ? 50 : 1),
      knockbackX: 0, knockbackY: 0,
      isBoss: isBoss,
    };
    enemiesRef.current.push(enemy);
  };

  // Detect mobile
  useEffect(() => {
    setShowPauseBtn('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // ==================== GAME LOOP ====================
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const clearJoystick = () => {
      joystickRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    };
    const clearInput = () => {
      keysRef.current.clear();
      clearJoystick();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const movementKey = getMovementKey(e);
      if (movementKey) {
        keysRef.current.add(movementKey);
        e.preventDefault();
      }
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (gameStateRef.current === GAME_STATE.PLAYING) { gameStateRef.current = GAME_STATE.PAUSED; setUiState(GAME_STATE.PAUSED); }
        else if (gameStateRef.current === GAME_STATE.PAUSED) { gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); lastTimeRef.current = performance.now(); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const movementKey = getMovementKey(e);
      if (movementKey) keysRef.current.delete(movementKey);
    };
    const handleWindowBlur = () => {
      clearInput();
      if (gameStateRef.current === GAME_STATE.PLAYING) {
        gameStateRef.current = GAME_STATE.PAUSED;
        setUiState(GAME_STATE.PAUSED);
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) handleWindowBlur();
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (gameStateRef.current !== GAME_STATE.PLAYING) return;
      e.preventDefault();
      const touch = e.touches[0];
      joystickRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 };
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (gameStateRef.current !== GAME_STATE.PLAYING) return;
      if (!joystickRef.current.active) return;
      e.preventDefault();
      const touch = e.touches[0];
      joystickRef.current.dx = (touch.clientX - joystickRef.current.startX) / 50;
      joystickRef.current.dy = (touch.clientY - joystickRef.current.startY) / 50;
      const len = Math.sqrt(joystickRef.current.dx ** 2 + joystickRef.current.dy ** 2);
      if (len > 1) { joystickRef.current.dx /= len; joystickRef.current.dy /= len; }
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (gameStateRef.current !== GAME_STATE.PLAYING) return;
      e.preventDefault();
      clearJoystick();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('touchend', clearJoystick);
    window.addEventListener('touchcancel', clearJoystick);
    window.addEventListener('pointerup', clearJoystick);
    window.addEventListener('pointercancel', clearJoystick);

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
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchend', clearJoystick);
      window.removeEventListener('touchcancel', clearJoystick);
      window.removeEventListener('pointerup', clearJoystick);
      window.removeEventListener('pointercancel', clearJoystick);
      if (waveIntroTimeoutRef.current) clearTimeout(waveIntroTimeoutRef.current);
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
      setCurrentWave(currentWaveRef.current);
      setPlayerData(getPlayerSnapshot(p));
    }

    let dx = 0, dy = 0;
    if (keysRef.current.has('up')) dy -= 1;
    if (keysRef.current.has('down')) dy += 1;
    if (keysRef.current.has('left')) dx -= 1;
    if (keysRef.current.has('right')) dx += 1;
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
        waveEnemiesAliveRef.current = Math.max(0, waveEnemiesAliveRef.current - 1);
        xpOrbsRef.current.push({ x: e.x, y: e.y, value: e.xpValue, size: 6 + e.xpValue });
        for (let i = 0; i < 8; i++) particlesRef.current.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, lifetime: 0.6, maxLifetime: 0.6, color: ENEMY_TYPES[e.type].color, size: 4 + Math.random() * 4 });
        return false;
      }
      const distToPlayer = Math.sqrt((p.x - e.x) ** 2 + (p.y - e.y) ** 2);
      if (distToPlayer < e.size + 20 && p.invincibleTimer <= 0) {
        const dmg = Math.max(1, e.damage - p.armor); p.hp -= dmg; p.invincibleTimer = 0.5;
        damageNumbersRef.current.push({ x: p.x, y: p.y - 30, value: Math.round(dmg), lifetime: 1, color: '#ff0000' });
        if (p.hp <= 0) {
          gameStateRef.current = GAME_STATE.GAME_OVER; setUiState(GAME_STATE.GAME_OVER);
          recordHighScore(Math.floor(gameTimeRef.current));
          setPlayerData(getPlayerSnapshot({ ...p, hp: 0 }));
        }
      }
      return true;
    });

    // Chest collection
    chestsRef.current = chestsRef.current.filter(chest => {
      if (chest.collected) return false;
      const dist = Math.sqrt((p.x - chest.x) ** 2 + (p.y - chest.y) ** 2);
      if (dist < 40) {
        chest.collected = true;
        const chestType = CHEST_TYPES[chest.type];
        // Apply reward
        switch (chestType.reward) {
          case 'heal': p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3); break;
          case 'damage': p.damage *= 1.15; break;
          case 'speed': p.speed *= 1.1; break;
          case 'upgrade':
            setUpgrades(getRandomUpgrades(1));
            gameStateRef.current = GAME_STATE.LEVEL_UP; setUiState(GAME_STATE.LEVEL_UP);
            break;
        }
        for (let i = 0; i < 12; i++) particlesRef.current.push({ x: chest.x, y: chest.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, lifetime: 0.8, maxLifetime: 0.8, color: chestType.color, size: 5 + Math.random() * 5 });
        return false;
      }
      return true;
    });

    let experienceChanged = false;
    xpOrbsRef.current = xpOrbsRef.current.filter(orb => {
      const dist = Math.sqrt((p.x - orb.x) ** 2 + (p.y - orb.y) ** 2);
      if (dist < p.pickupRange) {
        const a = Math.atan2(p.y - orb.y, p.x - orb.x);
        const pullSpeed = 8 * (1 - dist / p.pickupRange) + 3;
        orb.x += Math.cos(a) * pullSpeed * 60 * dt; orb.y += Math.sin(a) * pullSpeed * 60 * dt;
      }
      if (dist < 25) {
        const experience = addExperience({ level: p.level, xp: p.xp, xpToNext: p.xpToNext }, orb.value);
        p.level = experience.progress.level;
        p.xp = experience.progress.xp;
        p.xpToNext = experience.progress.xpToNext;
        experienceChanged = true;
        if (experience.levelsGained > 0) {
          pendingLevelUpsRef.current += experience.levelsGained;
          if (gameStateRef.current === GAME_STATE.PLAYING) {
            setUpgrades(getRandomUpgrades(3));
            gameStateRef.current = GAME_STATE.LEVEL_UP; setUiState(GAME_STATE.LEVEL_UP);
          }
        }
        return false;
      }
      return true;
    });
    if (experienceChanged) setPlayerData(getPlayerSnapshot(p));

    damageNumbersRef.current = damageNumbersRef.current.filter(d => { d.y -= 40 * dt; d.lifetime -= dt; return d.lifetime > 0; });
    particlesRef.current = particlesRef.current.filter(pt => { pt.x += pt.vx * 60 * dt; pt.y += pt.vy * 60 * dt; pt.lifetime -= dt; return pt.lifetime > 0; });

    // Wave system
    waveTimerRef.current -= dt;
    const spawnNextWaveEnemy = () => {
      const enemyConfig = waveSpawnQueueRef.current[waveEnemiesSpawnedRef.current];
      if (!enemyConfig) return;
      spawnEnemy(enemyConfig.type, enemyConfig.isBoss ?? false);
      waveEnemiesSpawnedRef.current += 1;
      waveEnemiesAliveRef.current += 1;
    };

    if (waveTimerRef.current > 0 && waveEnemiesSpawnedRef.current < waveEnemiesTotalRef.current) {
      const spawnRate = 3 * (1 + currentWaveRef.current * 0.1);
      if (Math.random() < spawnProbability(spawnRate, dt)) spawnNextWaveEnemy();
    } else if (waveEnemiesSpawnedRef.current < waveEnemiesTotalRef.current) {
      // Do not let a slow frame rate or a long pause strand a wave without its remaining enemies.
      spawnNextWaveEnemy();
    } else if (waveTimerRef.current <= 0 && waveEnemiesAliveRef.current <= 0) {
      // Wave complete
      if (currentWaveRef.current < 30) {
        currentWaveRef.current++;
        setCurrentWave(currentWaveRef.current);
        startWave(currentWaveRef.current);
      } else {
        // Victory!
        gameStateRef.current = GAME_STATE.GAME_OVER; setUiState(GAME_STATE.GAME_OVER);
        recordHighScore(Math.floor(gameTimeRef.current));
      }
    }
  };

  const renderGame = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const p = playerRef.current; if (!p) return;
    const cam = cameraRef.current;

    // Grid
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

    // Chests
    chestsRef.current.forEach(chest => {
      const sx = chest.x - cam.x, sy = chest.y - cam.y;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return;
      const chestType = CHEST_TYPES[chest.type];
      ctx.save();
      ctx.shadowColor = chestType.color; ctx.shadowBlur = 15;
      ctx.font = '32px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(chestType.emoji, sx, sy);
      ctx.restore();
    });

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
    enemiesRef.current.forEach(e => {
      const sx = e.x - cam.x, sy = e.y - cam.y;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) return;
      const t = ENEMY_TYPES[e.type];
      ctx.save();
      ctx.shadowColor = t.color; ctx.shadowBlur = e.isBoss ? 20 : 8;
      ctx.beginPath(); ctx.arc(sx, sy, e.size, 0, Math.PI * 2);
      ctx.fillStyle = t.color; ctx.fill();
      ctx.strokeStyle = e.isBoss ? '#ffd700' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = e.isBoss ? 4 : 2; ctx.stroke();
      ctx.restore();
      ctx.font = `${e.size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.emoji, sx, sy);
      if (e.hp < e.maxHp) {
        const barW = e.size * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - barW / 2, sy - e.size - 10, barW, 4);
        ctx.fillStyle = e.isBoss ? '#ffd700' : '#ff4444'; ctx.fillRect(sx - barW / 2, sy - e.size - 10, barW * (e.hp / e.maxHp), 4);
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
    if (playerRef.current) {
      upgrade.apply(playerRef.current);
      setPlayerData(getPlayerSnapshot(playerRef.current));
    }
    pendingLevelUpsRef.current = Math.max(0, pendingLevelUpsRef.current - 1);
    joystickRef.current = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    if (pendingLevelUpsRef.current > 0) {
      setUpgrades(getRandomUpgrades(3));
      gameStateRef.current = GAME_STATE.LEVEL_UP;
      setUiState(GAME_STATE.LEVEL_UP);
      return;
    }
    gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); setUpgrades([]);
    lastTimeRef.current = performance.now();
  };

  const activeCharacter = CHARACTERS[playerRef.current?.character ?? 0];
  const showHud = uiState !== GAME_STATE.MENU && uiState !== GAME_STATE.CHARACTER_SELECT;
  const hpRatio = getProgressRatio(playerData.hp, playerData.maxHp);
  const xpRatio = getProgressRatio(playerData.xp, playerData.xpToNext);
  const formattedTime = `${Math.floor(gameTime / 60)}:${(gameTime % 60).toString().padStart(2, '0')}`;

  return (
    <div className="game-shell w-full h-screen overflow-hidden relative select-none">
      <canvas ref={canvasRef} className="game-canvas absolute inset-0" />

      {showHud && (
        <div className="game-hud" aria-label="Игровая информация">
          <div className="hud-row hud-row--top">
            <section className="hud-card hud-card--player">
              <div className="hud-card__heading">
                <span className="hud-kicker">ГЕРОИНЯ</span>
                <span className="hud-level">LV. {playerData.level}</span>
              </div>
              <div className="hud-player-name"><span style={{ color: activeCharacter.color }}>{activeCharacter.emoji}</span>{activeCharacter.name}</div>
              <div className="meter meter--hp" aria-label={`Здоровье ${Math.ceil(playerData.hp)} из ${playerData.maxHp}`}>
                <span className="meter__fill" style={{ width: `${hpRatio * 100}%` }} />
                <span className="meter__label">❤️ {Math.ceil(playerData.hp)} / {playerData.maxHp}</span>
              </div>
              <div className="meter meter--xp" aria-label={`Опыт ${playerData.xp} из ${playerData.xpToNext}`}>
                <span className="meter__fill" style={{ width: `${xpRatio * 100}%` }} />
                <span className="meter__label">Опыт {playerData.xp} / {playerData.xpToNext}</span>
              </div>
            </section>

            <section className={`hud-card hud-card--wave ${currentWave === 30 ? 'hud-card--boss' : ''}`}>
              <span className="hud-kicker">ТЕКУЩАЯ ВОЛНА</span>
              <strong className="hud-wave-number">{currentWave}<span>/30</span></strong>
              <span className="hud-wave-time">⏱ {formattedTime}</span>
              <span className="hud-wave-kills">☠ {killCount} повержено</span>
            </section>
          </div>

          <div className="hud-stats" aria-label="Характеристики">
            <span><b>⚔</b> Урон <strong>{Math.round(playerData.damage)}</strong></span>
            <span><b>✦</b> Скорость <strong>{playerData.speed.toFixed(1)}</strong></span>
            <span><b>ϟ</b> Атака <strong>{playerData.attackSpeed.toFixed(1)}/с</strong></span>
            <span><b>◈</b> Снаряды <strong>×{playerRef.current?.projectileCount ?? 1}</strong></span>
            <span><b>⬡</b> Броня <strong>{playerRef.current?.armor ?? 0}</strong></span>
          </div>
        </div>
      )}

      {/* Wave intro */}
      {waveIntro && (
        <div className="wave-intro absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="wave-intro__panel text-center animate-pulse">
            <div className="wave-intro__kicker">ПРИГОТОВЬСЯ К БОЮ</div>
            <div className="wave-intro__title">
              ВОЛНА {currentWave}
            </div>
            <div className="wave-intro__subtitle">{currentWave === 30 ? '👑 ФИНАЛЬНЫЙ БОСС 👑' : 'Выживи. Собери. Усилься.'}</div>
          </div>
        </div>
      )}

      {/* Pause button for mobile */}
      {uiState === GAME_STATE.PLAYING && showPauseBtn && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            gameStateRef.current = GAME_STATE.PAUSED; setUiState(GAME_STATE.PAUSED);
          }}
          className="pause-fab absolute top-3 left-1/2 -translate-x-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          aria-label="Пауза"
        >
          ⏸
        </button>
      )}

      {/* MENU */}
      {uiState === GAME_STATE.MENU && (
        <div className="screen screen--menu absolute inset-0 flex flex-col items-center justify-center z-20 overflow-hidden">
          <div className="screen__aurora" />
          <div className="screen__grid" />
          {menuParticles.map((p, i) => (
            <div key={i} className="absolute pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.size}px`, opacity: p.opacity, animation: `floatUp ${8 + i * 0.5}s linear infinite`, animationDelay: `${i * 0.3}s` }}>
              {p.emoji}
            </div>
          ))}
          <div className="menu-content relative z-10 flex flex-col items-center text-center px-4 w-full max-w-2xl">
            <div className="brand-lockup">
              <span className="brand-lockup__jp">アニメ</span>
              <span className="brand-lockup__title">SURVIVORS</span>
              <span className="brand-lockup__line" />
              <span className="brand-lockup__subtitle">NEON SURVIVAL PROTOCOL</span>
            </div>
            <p className="menu-lead">30 волн. 4 героини. Один шанс пережить ночь.</p>
            {highScore > 0 && (
              <div className="record-badge">
                <span>🏆</span>
                <span>Личный рекорд <strong>{Math.floor(highScore / 60)}:{(highScore % 60).toString().padStart(2, '0')}</strong></span>
              </div>
            )}
            <button onClick={() => { setUiState(GAME_STATE.CHARACTER_SELECT); gameStateRef.current = GAME_STATE.CHARACTER_SELECT; }} className="game-button game-button--primary">
              <span className="game-button__icon">▶</span> Начать выживание
            </button>
            <div className="control-hints">
              <span><kbd>W A S D</kbd> или стрелки <small>ДВИЖЕНИЕ</small></span>
              <span><kbd>ESC</kbd> <small>ПАУЗА</small></span>
            </div>
            <p className="menu-footnote">Собирай энергию · выбирай улучшения · победи босса</p>
          </div>
        </div>
      )}

      {/* CHARACTER SELECT */}
      {uiState === GAME_STATE.CHARACTER_SELECT && (
        <div className="screen screen--select absolute inset-0 flex flex-col items-center justify-center z-20 overflow-hidden">
          <div className="screen__aurora" />
          <div className="screen__grid" />
          <div className="select-content relative z-10 flex flex-col items-center text-center px-4 w-full max-w-3xl">
            <div className="screen-heading">
              <span className="screen-heading__eyebrow">ШАГ 01 / LOADOUT</span>
              <h2>Выбери героиню</h2>
              <p>У каждой свой темп, дальность и стиль боя.</p>
            </div>
            <div className="character-grid grid grid-cols-2 gap-4 md:gap-6 w-full max-w-xl">
              {CHARACTERS.map((char, i) => (
                <button key={i} onClick={() => initGame(i)} className="character-card group relative overflow-hidden" style={{ borderColor: `${char.color}55` }}>
                  <div className="character-card__glow" style={{ background: `radial-gradient(circle, ${char.color}55 0%, transparent 68%)` }} />
                  <div className="character-card__number">0{i + 1}</div>
                  <div className="character-card__portrait" style={{ backgroundColor: `${char.color}18`, color: char.color }}>{char.emoji}</div>
                  <div className="character-card__name">{char.name}</div>
                  <div className="character-card__desc">{char.desc}</div>
                  <div className="character-card__stat" style={{ color: char.color }}>{char.stats}</div>
                  <span className="character-card__select">ВЫБРАТЬ →</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setUiState(GAME_STATE.MENU); gameStateRef.current = GAME_STATE.MENU; }} className="game-button game-button--ghost">← Назад в меню</button>
          </div>
        </div>
      )}

      {/* LEVEL UP */}
      {uiState === GAME_STATE.LEVEL_UP && (
        <div className="screen screen--modal absolute inset-0 flex flex-col items-center justify-center z-30 overflow-hidden">
          <div className="modal-backdrop" />
          <div className="modal-panel modal-panel--upgrade relative z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl">
            <span className="modal-kicker">НОВЫЙ УРОВЕНЬ · {activeCharacter.name.toUpperCase()}</span>
            <div className="modal-emblem">✦</div>
            <h2>Уровень {playerData.level}</h2>
            <p className="modal-description">Выбери усиление, которое изменит этот забег.</p>
            <div className="upgrade-grid flex gap-3 md:gap-5 flex-wrap justify-center items-stretch w-full">
              {upgrades.map((up, i) => (
                <button key={i} onClick={() => handleUpgrade(up)} className="upgrade-card group relative overflow-hidden">
                  <span className="upgrade-card__number">0{i + 1}</span>
                  <span className="upgrade-card__icon">{up.icon}</span>
                  <span className="upgrade-card__name">{up.name}</span>
                  <span className="upgrade-card__description">{up.description}</span>
                  <span className="upgrade-card__action">ВЗЯТЬ УЛУЧШЕНИЕ →</span>
                </button>
              ))}
            </div>
            <span className="modal-footnote">Пауза активна · выбери одну карту</span>
          </div>
        </div>
      )}

      {/* PAUSED */}
      {uiState === GAME_STATE.PAUSED && (
        <div className="screen screen--modal screen--pause absolute inset-0 flex flex-col items-center justify-center z-30">
          <div className="modal-backdrop" />
          <div className="modal-panel modal-panel--small relative z-10 text-center">
            <div className="modal-emblem modal-emblem--pause">Ⅱ</div>
            <span className="modal-kicker">RUN SUSPENDED</span>
            <h2>Пауза</h2>
            <p className="modal-description">Передохни. Прогресс забега сохранён.</p>
            <div className="modal-actions flex flex-col gap-3">
              <button onClick={() => { gameStateRef.current = GAME_STATE.PLAYING; setUiState(GAME_STATE.PLAYING); lastTimeRef.current = performance.now(); }} className="game-button game-button--primary">▶ Продолжить забег</button>
              <button onClick={() => { keysRef.current.clear(); gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }} className="game-button game-button--ghost">⌂ В меню</button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {uiState === GAME_STATE.GAME_OVER && (
        <div className={`screen screen--modal ${currentWave === 30 ? 'screen--victory' : 'screen--defeat'} absolute inset-0 flex flex-col items-center justify-center z-30 overflow-hidden`}>
          <div className="modal-backdrop" />
          <div className="modal-panel result-panel relative z-10 text-center px-4">
            <div className="result-icon">{currentWave === 30 ? '✦' : '×'}</div>
            <span className="modal-kicker">{currentWave === 30 ? 'MISSION COMPLETE' : 'SIGNAL LOST'}</span>
            <h2>{currentWave === 30 ? 'ПОБЕДА' : 'ЗАБЕГ ОКОНЧЕН'}</h2>
            <p className="modal-description">{currentWave === 30 ? 'Ты пережила все 30 волн.' : 'Следующая попытка будет сильнее.'}</p>
            <div className="result-grid">
              <div><span>ВОЛНА</span><strong>{currentWave}<small>/30</small></strong></div>
              <div><span>ВРЕМЯ</span><strong>{formattedTime}</strong></div>
              <div><span>УРОВЕНЬ</span><strong>{playerData.level}</strong></div>
              <div><span>УБИЙСТВА</span><strong>{killCount}</strong></div>
            </div>
            <div className="modal-actions flex flex-col gap-3">
              <button onClick={() => { gameStateRef.current = GAME_STATE.CHARACTER_SELECT; setUiState(GAME_STATE.CHARACTER_SELECT); }} className="game-button game-button--primary">↻ Новый забег</button>
              <button onClick={() => { keysRef.current.clear(); gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }} className="game-button game-button--ghost">⌂ В меню</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
