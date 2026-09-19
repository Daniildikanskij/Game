import type { UpgradeChoice } from '../game/upgrades';
import type { ItemChoice } from '../game/items';

export interface LevelUpModalProps {
  level: number;
  characterName: string;
  choices: readonly UpgradeChoice[];
  itemChoices: readonly ItemChoice[];
  onSelect: (id: string) => void;
  onSelectItem: (id: string) => void;
}

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  maxHp: 'макс. HP',
  damage: 'урон',
  speed: 'скорость',
  attackSpeed: 'атака',
  projectileCount: 'снаряды',
  projectileSpeed: 'скорость снаряда',
  projectileSize: 'размер снаряда',
  pickupRange: 'подбор',
  armor: 'броня',
};

const MAGIC_LABELS = {
  arcane: 'Аркана',
  fire: 'Огонь',
  ice: 'Лёд',
  lightning: 'Молния',
  shadow: 'Тень',
} as const;

const RARITY_LABELS = {
  common: 'Обычный',
  uncommon: 'Необычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
} as const;

function formatDelta(delta: Readonly<Record<string, number>>): string {
  return Object.entries(delta)
    .map(([stat, value]) => `${STAT_LABELS[stat] ?? stat}: ${value > 0 ? '+' : ''}${value}`)
    .join(' · ');
}

export function LevelUpModal({ level, characterName, choices, itemChoices, onSelect, onSelectItem }: LevelUpModalProps) {
  const itemMode = itemChoices.length > 0;

  return (
    <div className="screen screen--modal absolute inset-0 flex flex-col items-center justify-center z-30 overflow-hidden">
      <div className="modal-backdrop" />
      <div className="modal-panel modal-panel--upgrade relative z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl">
        <span className="modal-kicker">{itemMode ? 'СУНДУК · НАГРАДА' : `НОВЫЙ УРОВЕНЬ · ${characterName.toUpperCase()}`}</span>
        <div className="modal-emblem">{itemMode ? '🧿' : '✦'}</div>
        <h2>{itemMode ? 'Выбери предмет' : `Уровень ${level}`}</h2>
        <p className="modal-description">{itemMode ? 'Один предмет останется с тобой до конца забега.' : 'Выбери усиление, которое изменит этот забег.'}</p>
        <div className="upgrade-grid flex gap-3 md:gap-5 flex-wrap justify-center items-stretch w-full">
          {itemMode ? itemChoices.map((choice, index) => (
            <button
              key={choice.definition.id}
              onClick={() => onSelectItem(choice.definition.id)}
              className="upgrade-card group relative overflow-hidden"
              aria-label={`${choice.definition.name}, ${RARITY_LABELS[choice.definition.rarity]}, уровень ${choice.nextLevel}`}
            >
              <span className="upgrade-card__number">0{index + 1}</span>
              <span className="upgrade-card__icon">{choice.definition.icon}</span>
              <span className="upgrade-card__name">{choice.definition.name} · ур. {choice.nextLevel}</span>
              <span className="upgrade-card__description">{choice.definition.description}</span>
              <span className="upgrade-card__description">{RARITY_LABELS[choice.definition.rarity]}</span>
              <span className="upgrade-card__action">ВЗЯТЬ ПРЕДМЕТ →</span>
            </button>
          )) : choices.map((choice, index) => {
            const delta = formatDelta(choice.delta);
            const elementLabel = choice.definition.magicType ? `Стихия: ${MAGIC_LABELS[choice.definition.magicType]}` : 'Стихия: Аркана';
            return (
              <button
                key={choice.definition.id}
                onClick={() => onSelect(choice.definition.id)}
                className="upgrade-card group relative overflow-hidden"
                aria-label={`${choice.definition.name}, уровень ${choice.nextLevel}. ${delta}. ${elementLabel}`}
              >
                <span className="upgrade-card__number">0{index + 1}</span>
                <span className="upgrade-card__icon">{choice.definition.icon}</span>
                <span className="upgrade-card__name">{choice.definition.name} · ур. {choice.nextLevel}</span>
                <span className="upgrade-card__description">{choice.description}</span>
                <span className="upgrade-card__description">{elementLabel}</span>
                <span className="upgrade-card__description">{delta}</span>
                <span className="upgrade-card__action">ВЗЯТЬ УЛУЧШЕНИЕ →</span>
              </button>
            );
          })}
        </div>
        <span className="modal-footnote">Пауза активна · выбери одну карту{itemMode ? '' : ' · клавиши 1/2/3'}</span>
      </div>
    </div>
  );
}
