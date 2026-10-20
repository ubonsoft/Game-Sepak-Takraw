import React from 'react';
import { GameStateSnapshot } from '../game/gameEngine.ts';
import { Trophy, RotateCcw, Home, Sparkles } from 'lucide-react';

interface GameOverModalProps {
  state: GameStateSnapshot;
  onRestart: () => void;
  onHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ state, onRestart, onHome }) => {
  const isWinner = state.winner === 'player';

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75 pointer-events-auto">
      <div className="flex flex-col items-center max-w-sm w-full p-6 rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl text-center animate-scale-up">
        {/* Trophy / Result Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
            isWinner
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/20'
              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
          }`}
        >
          {isWinner ? <Trophy className="w-8 h-8" /> : <Sparkles className="w-8 h-8" />}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black font-sport tracking-wide text-white mb-1">
          {state.mode === 'match'
            ? isWinner
              ? '🏆 ชัยชนะของทีมชาติไทย!'
              : 'จบการแข่งขัน (MATCH OVER)'
            : '🌟 สิ้นสุดรอบการเดาะ!'}
        </h2>

        <p className="text-sm text-slate-400 mb-5">
          {state.mode === 'match'
            ? isWinner
              ? 'ยินดีด้วย! คุณคว้าแชมป์การแข่งขันเซปักตะกร้อ'
              : 'พยายามได้ดีมาก ฝึกซ้อมแล้วกลับมาเอาชนะคู่แข่งใหม่'
            : `คะแนนรอบนี้: ${state.playerScore.toLocaleString()} แต้ม`}
        </p>

        {/* Score Summary Box */}
        {state.mode === 'match' && (
          <div className="flex items-center justify-around w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6">
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 font-semibold">ไทย (THA)</span>
              <span className="font-sport font-black text-3xl text-amber-400 tabular-nums">
                {state.playerScore}
              </span>
            </div>
            <span className="text-slate-600 font-bold text-lg">-</span>
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 font-semibold">คู่แข่ง (RIVAL)</span>
              <span className="font-sport font-black text-3xl text-slate-300 tabular-nums">
                {state.opponentScore}
              </span>
            </div>
          </div>
        )}

        {state.mode === 'freestyle' && (
          <div className="flex flex-col gap-2 w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6">
            <div className="flex justify-between text-xs text-slate-300">
              <span>คอมโบสูงสุด:</span>
              <span className="font-bold text-cyan-400">{state.comboCount} ครั้ง</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>คะแนนสถิติสูงสุด:</span>
              <span className="font-bold text-amber-400">{state.highScore.toLocaleString()} แต้ม</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 w-full">
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 cursor-pointer transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>เล่นใหม่อีกครั้ง (REPLAY)</span>
          </button>

          <button
            onClick={onHome}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs cursor-pointer transition-all"
          >
            <Home className="w-4 h-4" />
            <span>กลับหน้าหลัก (MENU)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
