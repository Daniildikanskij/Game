export interface PauseModalProps {
  onResume: () => void;
  onMenu: () => void;
}

export function PauseModal({ onResume, onMenu }: PauseModalProps) {
  return (
    <div className="screen screen--modal screen--pause absolute inset-0 flex flex-col items-center justify-center z-30">
      <div className="modal-backdrop" />
      <div className="modal-panel modal-panel--small relative z-10 text-center">
        <div className="modal-emblem modal-emblem--pause">Ⅱ</div>
        <span className="modal-kicker">RUN SUSPENDED</span>
        <h2>Пауза</h2>
        <p className="modal-description">Передохни. Прогресс забега сохранён.</p>
        <div className="modal-actions flex flex-col gap-3">
          <button onClick={onResume} className="game-button game-button--primary">▶ Продолжить забег</button>
          <button onClick={onMenu} className="game-button game-button--ghost">⌂ В меню</button>
        </div>
      </div>
    </div>
  );
}
