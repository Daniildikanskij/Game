import { MAX_WAVES, type CharacterDefinition } from '../game/config';
import { getProgressRatio } from '../gameLogic';
import type { PlayerSnapshot, WaveRuntime } from '../game/types';

export interface GameHudProps {
  player: PlayerSnapshot;
  character: CharacterDefinition;
  wave: WaveRuntime;
  elapsedSeconds: number;
  kills: number;
}

export function GameHud({ player, character, wave, elapsedSeconds, kills }: GameHudProps) {
  const hpRatio = getProgressRatio(player.hp, player.maxHp);
  const xpRatio = getProgressRatio(player.xp, player.xpToNext);
  const formattedTime = `${Math.floor(elapsedSeconds / 60)}:${(Math.floor(elapsedSeconds) % 60).toString().padStart(2, '0')}`;

  return (
    <div className="game-hud" aria-label="Игровая информация">
      <div className="hud-row hud-row--top">
        <section className="hud-card hud-card--player">
          <div className="hud-card__heading">
            <span className="hud-kicker">ГЕРОИНЯ</span>
            <span className="hud-level">LV. {player.level}</span>
          </div>
          <div className="hud-player-name"><span style={{ color: character.color }}>{character.emoji}</span>{character.name}</div>
          <div className="meter meter--hp" aria-label={`Здоровье ${Math.ceil(player.hp)} из ${player.maxHp}`}>
            <span className="meter__fill" style={{ width: `${hpRatio * 100}%` }} />
            <span className="meter__label">❤️ {Math.ceil(player.hp)} / {player.maxHp}</span>
          </div>
          <div className="meter meter--xp" aria-label={`Опыт ${player.xp} из ${player.xpToNext}`}>
            <span className="meter__fill" style={{ width: `${xpRatio * 100}%` }} />
            <span className="meter__label">Опыт {player.xp} / {player.xpToNext}</span>
          </div>
        </section>

        <section className={`hud-card hud-card--wave ${wave.number === MAX_WAVES ? 'hud-card--boss' : ''}`}>
          <span className="hud-kicker">ТЕКУЩАЯ ВОЛНА</span>
          <strong className="hud-wave-number">{wave.number}<span>/{MAX_WAVES}</span></strong>
          <span className="hud-wave-time">⏱ {formattedTime}</span>
          <span className="hud-wave-kills">☠ {kills} повержено</span>
        </section>
      </div>

      <div className="hud-stats" aria-label="Характеристики">
        <span><b>⚔</b> Урон <strong>{Math.round(player.damage)}</strong></span>
        <span><b>✦</b> Скорость <strong>{player.speed.toFixed(1)}</strong></span>
        <span><b>ϟ</b> Атака <strong>{player.attackSpeed.toFixed(1)}/с</strong></span>
        <span><b>◈</b> Снаряды <strong>×{player.projectileCount}</strong></span>
        <span><b>⬡</b> Броня <strong>{player.armor}</strong></span>
      </div>
    </div>
  );
}
