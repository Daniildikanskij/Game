import type { MenuParticle } from '../game/types';

export interface MenuScreenProps {
  highScore: number;
  menuParticles: readonly MenuParticle[];
  onStart: () => void;
}

export function MenuScreen({ highScore, menuParticles, onStart }: MenuScreenProps) {
  return (
    <div className="screen screen--menu absolute inset-0 flex flex-col items-center justify-center z-20 overflow-hidden">
      <div className="screen__aurora" />
      <div className="screen__grid" />
      {menuParticles.map((particle, index) => (
        <div key={index} className="absolute pointer-events-none" style={{ left: `${particle.x}%`, top: `${particle.y}%`, fontSize: `${particle.size}px`, opacity: particle.opacity, animation: `floatUp ${8 + index * 0.5}s linear infinite`, animationDelay: `${index * 0.3}s` }}>
          {particle.emoji}
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
        <button onClick={onStart} className="game-button game-button--primary">
          <span className="game-button__icon">▶</span> Начать выживание
        </button>
        <div className="control-hints">
          <span><kbd>W A S D</kbd> или стрелки <small>ДВИЖЕНИЕ</small></span>
          <span><kbd>ESC</kbd> <small>ПАУЗА</small></span>
        </div>
        <p className="menu-footnote">Собирай энергию · выбирай улучшения · победи босса</p>
      </div>
    </div>
  );
}
