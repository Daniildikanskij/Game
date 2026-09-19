import { MAX_WAVES, type CharacterDefinition } from '../game/config';
import { getProgressRatio } from '../gameLogic';
import { UPGRADE_DEFINITIONS } from '../game/upgrades';
import type { CSSProperties } from 'react';
import type { PlayerSnapshot, WaveRuntime } from '../game/types';

export interface GameHudProps {
  player: PlayerSnapshot;
  character: CharacterDefinition;
  wave: WaveRuntime;
  elapsedSeconds: number;
  kills: number;
}

const MAGIC_LABELS = {
  arcane: 'Аркана',
  fire: 'Огонь',
  ice: 'Лёд',
  lightning: 'Молния',
  shadow: 'Тень',
} as const;

const MAGIC_ICONS = {
  arcane: '✦',
  fire: '🔥',
  ice: '❄️',
  lightning: '⚡',
  shadow: '🌑',
} as const;

const MAGIC_COLORS = {
  arcane: '#d9a7ff',
  fire: '#ff8a4c',
  ice: '#7dd3fc',
  lightning: '#fde047',
  shadow: '#c084fc',
} as const;

export function GameHud({ player, character, wave, elapsedSeconds, kills }: GameHudProps) {
  const hpRatio = getProgressRatio(player.hp, player.maxHp);
  const xpRatio = getProgressRatio(player.xp, player.xpToNext);
  const formattedTime = `${Math.floor(elapsedSeconds / 60)}:${(Math.floor(elapsedSeconds) % 60).toString().padStart(2, '0')}`;
  const magicLabel = MAGIC_LABELS[player.magicType ?? 'arcane'];
  const magicIcon = MAGIC_ICONS[player.magicType ?? 'arcane'];
  const activeMagicTypes = player.activeMagicTypes.length > 0 ? player.activeMagicTypes : ['arcane' as const];
  const activeUpgrades = UPGRADE_DEFINITIONS.filter(definition => (player.ownedUpgrades[definition.id] ?? 0) > 0);

  return (
    <div className="game-hud" aria-label="Игровая информация">
      <div className="hud-row hud-row--top">
        <section className="hud-card hud-card--player">
          <div className="hud-card__heading">
            <span className="hud-kicker">ГЕРОИНЯ</span>
            <span className="hud-level">LV. {player.level}</span>
          </div>
          <div className="hud-player-name"><span style={{ color: character.color }}>{character.emoji}</span>{character.name}</div>
          <div className="hud-magic" aria-label={`Текущая магия ${magicLabel}`}>
            <span className="hud-magic__icon">{magicIcon}</span>
            <span className="hud-magic__text">{magicLabel}</span>
          </div>
          <div className="meter meter--hp" aria-label={`Здоровье ${Math.ceil(player.hp)} из ${player.maxHp}`}>
            <span className="meter__fill" style={{ width: `${hpRatio * 100}%` }} />
            <span className="meter__label">❤️ HP {Math.ceil(player.hp)} / {player.maxHp}</span>
          </div>
          <div className="meter meter--xp" aria-label={`Опыт ${player.xp} из ${player.xpToNext}`}>
            <span className="meter__fill" style={{ width: `${xpRatio * 100}%` }} />
            <span className="meter__label">✦ ОПЫТ {player.xp} / {player.xpToNext}</span>
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

      <section className="hud-build" aria-label="Активные улучшения">
        <div className="hud-build__heading">
          <span className="hud-kicker">АКТИВНЫЙ БИЛД</span>
          <span className="hud-build__count">{activeUpgrades.length} улучш.</span>
        </div>
        <div className="hud-build__slots">
          <div className="hud-build__group" aria-label="Стихии">
            {activeMagicTypes.map(type => (
              <span
                className="hud-build__slot hud-build__slot--magic"
                key={type}
                title={`${MAGIC_LABELS[type]}: активный эффект`}
                style={{ '--slot-color': MAGIC_COLORS[type] } as CSSProperties}
              >
                <span>{MAGIC_ICONS[type]}</span>
                <small>{MAGIC_LABELS[type]}</small>
              </span>
            ))}
          </div>
          <div className="hud-build__group" aria-label="Улучшения">
            {activeUpgrades.length > 0 ? activeUpgrades.map(definition => (
              <span
                className="hud-build__slot"
                key={definition.id}
                title={`${definition.name}: уровень ${player.ownedUpgrades[definition.id]}`}
              >
                <span>{definition.icon}</span>
                <b>{player.ownedUpgrades[definition.id]}</b>
              </span>
            )) : (
              <span className="hud-build__empty">Выбери первое улучшение</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
