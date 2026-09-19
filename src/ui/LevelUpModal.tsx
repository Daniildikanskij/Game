import type { UpgradeChoice } from '../game/upgrades';

export interface LevelUpModalProps {
  level: number;
  characterName: string;
  choices: readonly UpgradeChoice[];
  onSelect: (id: string) => void;
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

function formatDelta(delta: Readonly<Record<string, number>>): string {
  return Object.entries(delta)
    .map(([stat, value]) => `${STAT_LABELS[stat] ?? stat}: ${value > 0 ? '+' : ''}${value}`)
    .join(' · ');
}

export function LevelUpModal({ level, characterName, choices, onSelect }: LevelUpModalProps) {
  return (
    <div className="screen screen--modal absolute inset-0 flex flex-col items-center justify-center z-30 overflow-hidden">
      <div className="modal-backdrop" />
      <div className="modal-panel modal-panel--upgrade relative z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl">
        <span className="modal-kicker">НОВЫЙ УРОВЕНЬ · {characterName.toUpperCase()}</span>
        <div className="modal-emblem">✦</div>
        <h2>Уровень {level}</h2>
        <p className="modal-description">Выбери усиление, которое изменит этот забег.</p>
        <div className="upgrade-grid flex gap-3 md:gap-5 flex-wrap justify-center items-stretch w-full">
          {choices.map((choice, index) => {
            const delta = formatDelta(choice.delta);
            return (
              <button
                key={choice.definition.id}
                onClick={() => onSelect(choice.definition.id)}
                className="upgrade-card group relative overflow-hidden"
                aria-label={`${choice.definition.name}, уровень ${choice.nextLevel}. ${delta}`}
              >
                <span className="upgrade-card__number">0{index + 1}</span>
                <span className="upgrade-card__icon">{choice.definition.icon}</span>
                <span className="upgrade-card__name">{choice.definition.name} · ур. {choice.nextLevel}</span>
                <span className="upgrade-card__description">{choice.description}</span>
                <span className="upgrade-card__description">{delta}</span>
                <span className="upgrade-card__action">ВЗЯТЬ УЛУЧШЕНИЕ →</span>
              </button>
            );
          })}
        </div>
        <span className="modal-footnote">Пауза активна · выбери одну карту · клавиши 1/2/3</span>
      </div>
    </div>
  );
}
