import { useEffect, useRef, useState } from 'react';
import {
  CHARACTERS,
  GAME_STATE,
  HIGH_SCORE_STORAGE_KEY,
  MAX_WAVES,
} from './game/config';
import { createRandom } from './game/random';
import { applyCanvasMetrics, getCanvasMetrics, getCanvasViewport, type CanvasMetrics } from './game/canvas';
import { renderGame as renderScene } from './game/renderer';
import {
  createGameSession,
  getRenderSnapshot,
  pauseSession,
  resumeSession,
  selectUpgrade,
  updateGame as updateGameSession,
  type GameEvents,
  type GameSession,
} from './game/engine';
import { createInputController, type InputController } from './game/input';
import { GameHud } from './ui/GameHud';
import { MenuScreen } from './ui/MenuScreen';
import { CharacterSelect } from './ui/CharacterSelect';
import { LevelUpModal } from './ui/LevelUpModal';
import { PauseModal } from './ui/PauseModal';
import { GameOverModal } from './ui/GameOverModal';
import type { GameState, MenuParticle, Player, PlayerSnapshot } from './game/types';
import type { UpgradeChoice } from './game/upgrades';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>(GAME_STATE.MENU);
  const [uiState, setUiState] = useState<GameState>(GAME_STATE.MENU);
  const [playerData, setPlayerData] = useState<PlayerSnapshot>({
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 10,
    damage: 10,
    speed: 3,
    attackSpeed: 1,
    projectileCount: 1,
    armor: 0,
    magicType: 'arcane' as const,
    activeMagicTypes: ['arcane'] as const,
    ownedUpgrades: {},
  });
  const [upgrades, setUpgrades] = useState<UpgradeChoice[]>([]);
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
    const random = createRandom(0x4d454e55);
    return Array.from({ length: 30 }, () => ({
      x: random.next() * 100, y: random.next() * 100,
      vx: (random.next() - 0.5) * 0.3, vy: -random.next() * 0.5 - 0.1,
      size: random.next() * 20 + 12, opacity: random.next() * 0.5 + 0.2,
      emoji: emojis[random.int(emojis.length)],
    }));
  });

  const sessionRef = useRef<GameSession | null>(null);
  const inputControllerRef = useRef<InputController | null>(null);
  const animFrameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const canvasMetricsRef = useRef<CanvasMetrics>({ width: 0, height: 0, dpr: 1, bufferWidth: 0, bufferHeight: 0 });
  const uiUpdateTimerRef = useRef(0);
  const waveIntroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPlayerSnapshot = (p: Player, ownedUpgrades: Readonly<Record<string, number>>) => ({
    hp: p.hp,
    maxHp: p.maxHp,
    level: p.level,
    xp: p.xp,
    xpToNext: p.xpToNext,
    damage: p.damage,
    speed: p.speed,
    attackSpeed: p.attackSpeed,
    projectileCount: p.projectileCount,
    armor: p.armor,
    magicType: p.magicType,
    activeMagicTypes: p.activeMagicTypes ?? [p.magicType],
    ownedUpgrades,
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

  const showWaveIntro = (waveNumber: number) => {
    setCurrentWave(waveNumber);
    if (waveIntroTimeoutRef.current) clearTimeout(waveIntroTimeoutRef.current);
    setWaveIntro(true);
    waveIntroTimeoutRef.current = setTimeout(() => {
      setWaveIntro(false);
      waveIntroTimeoutRef.current = null;
    }, 2000);
  };

  const syncUiWithSession = (session: GameSession) => {
    setPlayerData(getPlayerSnapshot(session.player, session.ownedUpgrades));
    setGameTime(Math.floor(session.elapsedSeconds));
    setKillCount(session.kills);
    setCurrentWave(session.wave.number);
    setUiState(session.state);
    gameStateRef.current = session.state;
  };

  const applyEngineEvents = (session: GameSession, events: GameEvents) => {
    if (events.upgradeChoices.length > 0) setUpgrades(events.upgradeChoices);
    if (events.stateChanged) {
      setUiState(events.stateChanged);
      gameStateRef.current = events.stateChanged;
      if (events.stateChanged !== GAME_STATE.LEVEL_UP) setUpgrades([]);
    }
    if (events.waveStarted !== null) showWaveIntro(events.waveStarted);
    if (events.gameOver) recordHighScore(Math.floor(session.elapsedSeconds));
    syncUiWithSession(session);
  };

  const initGame = (charIndex: number) => {
    const session = createGameSession({ character: charIndex });
    sessionRef.current = session;
    inputControllerRef.current?.reset();
    setUpgrades([]);
    setUiState(GAME_STATE.PLAYING);
    gameStateRef.current = GAME_STATE.PLAYING;
    syncUiWithSession(session);
    showWaveIntro(session.wave.number);
  };

  // Detect mobile
  useEffect(() => {
    setShowPauseBtn('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // ==================== GAME LOOP ====================
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => {
      const layout = canvas.parentElement?.getBoundingClientRect();
      const viewport = getCanvasViewport(
        layout?.width ?? 0,
        layout?.height ?? 0,
        window.innerWidth,
        window.innerHeight,
      );
      const metrics = getCanvasMetrics(viewport.width, viewport.height, window.devicePixelRatio);
      applyCanvasMetrics(canvas, ctx, metrics);
      canvasMetricsRef.current = metrics;
    };
    resize();
    window.addEventListener('resize', resize);
    const dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handleDprChange = () => resize();
    dprMediaQuery.addEventListener('change', handleDprChange);

    const handlePauseToggle = () => {
      const session = sessionRef.current;
      if (session?.state === GAME_STATE.PLAYING) {
        pauseSession(session);
        inputControllerRef.current?.reset();
        syncUiWithSession(session);
      } else if (session?.state === GAME_STATE.PAUSED) {
        resumeSession(session);
        syncUiWithSession(session);
        lastTimeRef.current = performance.now();
      }
    };
    const inputController = createInputController({
      canvas,
      getGameState: () => gameStateRef.current,
      onPauseToggle: handlePauseToggle,
      onUpgradeHotkey: (index) => {
        const choice = sessionRef.current?.upgradeChoices[index];
        if (choice) handleUpgrade(choice);
      },
    });
    inputControllerRef.current = inputController;

    lastTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;
      const session = sessionRef.current;
      if (session?.state === GAME_STATE.PLAYING) {
        const events = updateGameSession(session, dt, inputController.getMovement(), canvasMetricsRef.current);
        uiUpdateTimerRef.current += dt;
        if (uiUpdateTimerRef.current > 0.1 || events.stateChanged || events.waveStarted !== null || events.gameOver) {
          uiUpdateTimerRef.current = 0;
          applyEngineEvents(session, events);
        }
      }
      renderGame(canvas, ctx);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      dprMediaQuery.removeEventListener('change', handleDprChange);
      inputController.dispose();
      inputControllerRef.current = null;
      if (waveIntroTimeoutRef.current) clearTimeout(waveIntroTimeoutRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderGame = (_canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const session = sessionRef.current;
    renderScene(ctx, session ? getRenderSnapshot(session) : null, canvasMetricsRef.current, inputControllerRef.current?.getJoystick());
  };

  const handleUpgrade = (upgrade: UpgradeChoice) => {
    const session = sessionRef.current;
    if (!session) return;
    const events = selectUpgrade(session, upgrade.definition.id);
    inputControllerRef.current?.reset();
    applyEngineEvents(session, events);
    if (session.state === GAME_STATE.PLAYING) lastTimeRef.current = performance.now();
  };

  const activeCharacter = CHARACTERS[sessionRef.current?.player.character ?? 0];
  const showHud = uiState !== GAME_STATE.MENU && uiState !== GAME_STATE.CHARACTER_SELECT;
  const emptyWave = { number: currentWave, remainingSeconds: 0, spawnInterval: Number.POSITIVE_INFINITY, spawnAccumulator: 0, spawned: 0, alive: 0, total: 0, queue: [] };

  return (
    <div className="game-shell w-full h-screen overflow-hidden relative select-none">
      <canvas ref={canvasRef} className="game-canvas absolute inset-0" />

      {showHud && (
        <GameHud
          player={playerData}
          character={activeCharacter}
          wave={sessionRef.current?.wave ?? emptyWave}
          elapsedSeconds={gameTime}
          kills={killCount}
        />
      )}

      {/* Wave intro */}
      {waveIntro && (
        <div className="wave-intro absolute inset-0 flex items-center justify-center z-30 pointer-events-none" role="status" aria-live="polite">
          <div className="wave-intro__panel text-center animate-pulse">
            <div className="wave-intro__kicker">ПРИГОТОВЬСЯ К БОЮ</div>
            <div className="wave-intro__title">
              ВОЛНА {currentWave}
            </div>
            <div className="wave-intro__subtitle">{currentWave === MAX_WAVES ? '👑 ФИНАЛЬНЫЙ БОСС 👑' : 'Выживи. Собери. Усилься.'}</div>
          </div>
        </div>
      )}

      {/* Pause button for mobile */}
      {uiState === GAME_STATE.PLAYING && showPauseBtn && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const session = sessionRef.current;
            if (session) {
              pauseSession(session);
              inputControllerRef.current?.reset();
              syncUiWithSession(session);
            }
          }}
          className="pause-fab absolute top-3 left-1/2 -translate-x-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform"
          aria-label="Пауза"
        >
          ⏸
        </button>
      )}

      {/* MENU */}
      {uiState === GAME_STATE.MENU && (
        <MenuScreen
          highScore={highScore}
          menuParticles={menuParticles}
          onStart={() => { setUiState(GAME_STATE.CHARACTER_SELECT); gameStateRef.current = GAME_STATE.CHARACTER_SELECT; }}
        />
      )}

      {/* CHARACTER SELECT */}
      {uiState === GAME_STATE.CHARACTER_SELECT && (
        <CharacterSelect
          characters={CHARACTERS}
          onSelect={initGame}
          onBack={() => { setUiState(GAME_STATE.MENU); gameStateRef.current = GAME_STATE.MENU; }}
        />
      )}

      {/* LEVEL UP */}
      {uiState === GAME_STATE.LEVEL_UP && (
        <LevelUpModal
          level={playerData.level}
          characterName={activeCharacter.name}
          choices={upgrades}
          onSelect={(id) => {
            const choice = upgrades.find(item => item.definition.id === id);
            if (choice) handleUpgrade(choice);
          }}
        />
      )}

      {/* PAUSED */}
      {uiState === GAME_STATE.PAUSED && (
        <PauseModal
          onResume={() => {
            const session = sessionRef.current;
            if (session) {
              resumeSession(session);
              syncUiWithSession(session);
              lastTimeRef.current = performance.now();
            }
          }}
          onMenu={() => { inputControllerRef.current?.reset(); sessionRef.current = null; gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }}
        />
      )}

      {/* GAME OVER */}
      {uiState === GAME_STATE.GAME_OVER && (
        <GameOverModal
          result={sessionRef.current?.result ?? (currentWave === MAX_WAVES ? 'victory' : 'defeat')}
          wave={currentWave}
          elapsedSeconds={gameTime}
          level={playerData.level}
          kills={killCount}
          seed={sessionRef.current?.seed}
          onRestart={() => { gameStateRef.current = GAME_STATE.CHARACTER_SELECT; setUiState(GAME_STATE.CHARACTER_SELECT); }}
          onMenu={() => { inputControllerRef.current?.reset(); sessionRef.current = null; gameStateRef.current = GAME_STATE.MENU; setUiState(GAME_STATE.MENU); }}
        />
      )}
    </div>
  );
}
