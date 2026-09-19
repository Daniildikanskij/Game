import { MAX_WAVES } from '../game/config';

export interface GameOverModalProps {
  result: 'victory' | 'defeat';
  wave: number;
  elapsedSeconds: number;
  level: number;
  kills: number;
  seed?: number;
  onRestart: () => void;
  onMenu: () => void;
}

export function GameOverModal({ result, wave, elapsedSeconds, level, kills, seed, onRestart, onMenu }: GameOverModalProps) {
  const victory = result === 'victory';
  const formattedTime = `${Math.floor(elapsedSeconds / 60)}:${(Math.floor(elapsedSeconds) % 60).toString().padStart(2, '0')}`;

  return (
    <div className={`screen screen--modal ${victory ? 'screen--victory' : 'screen--defeat'} absolute inset-0 flex flex-col items-center justify-center z-30 overflow-hidden`} aria-live="polite">
      <div className="modal-backdrop" />
      <div className="modal-panel result-panel relative z-10 text-center px-4">
        <div className="result-icon">{victory ? '✦' : '×'}</div>
        <span className="modal-kicker">{victory ? 'MISSION COMPLETE' : 'SIGNAL LOST'}</span>
        <h2>{victory ? 'ПОБЕДА' : 'ЗАБЕГ ОКОНЧЕН'}</h2>
        <p className="modal-description">{victory ? `Ты пережила все ${MAX_WAVES} волн.` : 'Следующая попытка будет сильнее.'}</p>
        <div className="result-grid">
          <div><span>ВОЛНА</span><strong>{wave}<small>/{MAX_WAVES}</small></strong></div>
          <div><span>ВРЕМЯ</span><strong>{formattedTime}</strong></div>
          <div><span>УРОВЕНЬ</span><strong>{level}</strong></div>
          <div><span>УБИЙСТВА</span><strong>{kills}</strong></div>
        </div>
        {seed !== undefined && <span className="modal-footnote">КОД ЗАБЕГА: {seed}</span>}
        <div className="modal-actions flex flex-col gap-3">
          <button onClick={onRestart} className="game-button game-button--primary">↻ Новый забег</button>
          <button onClick={onMenu} className="game-button game-button--ghost">⌂ В меню</button>
        </div>
      </div>
    </div>
  );
}
