import React from 'react';
import { GameMode, Difficulty } from '../game/gameEngine.ts';
import { Trophy, Sparkles, Volume2, VolumeX, Shield, Play } from 'lucide-react';
import { sound } from '../game/audio.ts';

interface TitleScreenProps {
  onStart: () => void;
  mode: GameMode;
  setMode: (m: GameMode) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  skin: 'traditional' | 'modern' | 'neon';
  setSkin: (s: 'traditional' | 'modern' | 'neon') => void;
  highScore: number;
  autoRunAssist: boolean;
  onToggleAutoRun: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  mode,
  setMode,
  difficulty,
  setDifficulty,
  skin,
  setSkin,
  highScore,
  autoRunAssist,
  onToggleAutoRun,
}) => {
  const [isMuted, setIsMuted] = React.useState(sound.getMuted());

  const handleToggleMute = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-auto bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/60">
      {/* Top Header: Mute & High Score */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-300 text-xs tracking-wider uppercase font-semibold">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>คะแนนสูงสุด: {highScore.toLocaleString()} แต้ม</span>
        </div>

        <button
          onClick={handleToggleMute}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
          title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          <span>{isMuted ? 'ปิดเสียงอยู่' : 'เสียงเปิด'}</span>
        </button>
      </div>

      {/* Centerpiece: Bespoke Title Lockup */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto my-auto py-4">
        {/* SVG Title Lockup */}
        <div className="relative mb-2">
          <svg className="w-full max-w-lg h-auto overflow-visible" viewBox="0 0 520 120" fill="none">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="thaiFlagGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="35%" stopColor="#2563eb" />
                <stop offset="65%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Back Glow */}
            <text
              x="260"
              y="68"
              textAnchor="middle"
              className="font-sport font-black text-6xl tracking-wider"
              fill="#d97706"
              filter="url(#glow)"
              opacity="0.6"
            >
              เซปักตะกร้อ คิงส์
            </text>

            {/* Main Title */}
            <text
              x="260"
              y="68"
              textAnchor="middle"
              className="font-sport font-black text-6xl tracking-wider"
              fill="url(#goldGrad)"
              stroke="#451a03"
              strokeWidth="2"
            >
              เซปักตะกร้อ คิงส์
            </text>

            {/* English Subtitle */}
            <text
              x="260"
              y="104"
              textAnchor="middle"
              className="font-sport font-bold text-sm tracking-[0.35em]"
              fill="#94a3b8"
            >
              SEPAK TAKRAW 3D CHAMPIONSHIP
            </text>
          </svg>
        </div>

        <p className="text-sm md:text-base text-slate-300 max-w-md font-light mb-6">
          สัมผัสศิลปะการเตะตะกร้อระดับโลก ทั้งลูกแป ลูกเข่ายก และท่าฟาดซันแบ็คสไปค์กลางอากาศสุดอลังการ
        </p>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-4">
          <button
            onClick={() => setMode('match')}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              mode === 'match'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-700/80 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-sm">แข่งข้ามตาข่าย 1v1</span>
            <span className="text-[11px] text-slate-400 font-normal">แมตช์ทางการ 11 แต้ม</span>
          </button>

          <button
            onClick={() => setMode('freestyle')}
            className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              mode === 'freestyle'
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-700/80 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-sm">เดาะฟรีสไตล์</span>
            <span className="text-[11px] text-slate-400 font-normal">สะสมคอมโบลอดห่วง</span>
          </button>
        </div>

        {/* Options Row: Difficulty & Ball Skin */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md mb-6">
          {mode === 'match' && (
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 px-2 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> ระดับ:
              </span>
              {(['easy', 'normal', 'hard', 'master'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                    difficulty === d ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d === 'easy' ? 'มือใหม่' : d === 'normal' ? 'สโมสร' : d === 'hard' ? 'ทีมชาติ' : 'ราชาตะกร้อ'}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 px-2">ลูกตะกร้อ:</span>
            {(['traditional', 'modern', 'neon'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSkin(s)}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  skin === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s === 'traditional' ? 'หวายแท้' : s === 'modern' ? 'โมเดิร์น' : 'นีออน'}
              </button>
            ))}
          </div>

          {/* Auto-Run Assist Toggle */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 px-2">วิ่งรับลูก:</span>
            <button
              onClick={onToggleAutoRun}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                autoRunAssist ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              กึ่งออโต้ (ช่วยดักลูก)
            </button>
            <button
              onClick={onToggleAutoRun}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                !autoRunAssist ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              แมนนวล
            </button>
          </div>
        </div>

        {/* Big Start Button */}
        <button
          onClick={onStart}
          className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-lg shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer w-full max-w-xs"
        >
          <Play className="w-5 h-5 fill-slate-950" />
          <span>ลงสนามแข่งขัน (START)</span>
        </button>
      </div>

      {/* Flat Control Hints Bar */}
      <div className="text-center text-xs text-slate-400 font-mono tracking-wide py-2 border-t border-slate-800/80 max-w-3xl mx-auto w-full">
        <span className="text-amber-400 font-bold">WASD / จอยสติ๊ก</span> เคลื่อนที่ ·{' '}
        <span className="text-amber-400 font-bold">Space</span> โรลสไปค์ 360° ·{' '}
        <span className="text-amber-400 font-bold">L</span> ซันแบ็ค ·{' '}
        <span className="text-amber-400 font-bold">K</span> ชงลูก ·{' '}
        <span className="text-amber-400 font-bold">B</span> บล็อกเน็ต ·{' '}
        <span className="text-amber-400 font-bold">Shift</span> สไลด์เซฟ ·{' '}
        <span className="text-rose-400 font-bold">U</span> ไม้ตายเพลิง
      </div>
    </div>
  );
};
