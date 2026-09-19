import type { CharacterDefinition } from '../game/config';

export interface CharacterSelectProps {
  characters: readonly CharacterDefinition[];
  onSelect: (character: number) => void;
  onBack: () => void;
}

export function CharacterSelect({ characters, onSelect, onBack }: CharacterSelectProps) {
  return (
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
          {characters.map((character, index) => (
            <button key={index} onClick={() => onSelect(index)} className="character-card group relative overflow-hidden" style={{ borderColor: `${character.color}55` }}>
              <div className="character-card__glow" style={{ background: `radial-gradient(circle, ${character.color}55 0%, transparent 68%)` }} />
              <div className="character-card__number">0{index + 1}</div>
              <div className="character-card__portrait" style={{ backgroundColor: `${character.color}18`, color: character.color }}>{character.emoji}</div>
              <div className="character-card__name">{character.name}</div>
              <div className="character-card__desc">{character.desc}</div>
              <div className="character-card__stat" style={{ color: character.color }}>{character.stats}</div>
              <span className="character-card__select">ВЫБРАТЬ →</span>
            </button>
          ))}
        </div>
        <button onClick={onBack} className="game-button game-button--ghost">← Назад в меню</button>
      </div>
    </div>
  );
}
