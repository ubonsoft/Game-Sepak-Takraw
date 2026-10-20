import React, { useState } from 'react';
import { GameStateSnapshot, CameraMode, Difficulty } from '../game/gameEngine.ts';
import {
  Camera,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Shield,
  Zap,
  ArrowLeft,
  ArrowRight,
  Flame,
  Sparkles,
  Crosshair,
} from 'lucide-react';
import { sound } from '../game/audio.ts';

interface GameHUDProps {
  state: GameStateSnapshot;
  onAction: (
    action:
      | 'inside_kick'
      | 'knee_bump'
      | 'header'
      | 'sunback'
      | 'roll_spike'
      | 'super_roll_spike'
      | 'block'
      | 'dive'
  ) => void;
  onSetCamera: (cam: CameraMode) => void;
  currentCamera: CameraMode;
  onPauseToggle: () => void;
  onReset: () => void;
  onVirtualMove: (x: number, z: number) => void;
  onToggleAutoRun: () => void;
  onSetDifficulty: (diff: Difficulty) => void;
  onExecuteServe: () => void;
  onSetServeAim: (aim: 'left' | 'center' | 'right') => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  state,
  onAction,
  onSetCamera,
  currentCamera,
  onPauseToggle,
  onReset,
  onVirtualMove,
  onToggleAutoRun,
  onSetDifficulty,
  onExecuteServe,
  onSetServeAim,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [showDiffMenu, setShowDiffMenu] = useState(false);

  // Virtual joystick state
  const [, setTouchActive] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const handleMuteToggle = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  // Touch joystick handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchActive(true);
    handleTouchMove(e);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2;

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const nx = (Math.cos(angle) * clampedDist) / maxRadius;
    const ny = (Math.sin(angle) * clampedDist) / maxRadius;

    setTouchPos({ x: nx * 32, y: ny * 32 });
    onVirtualMove(nx, ny);
  };

  const handleTouchEnd = () => {
    setTouchActive(false);
    setTouchPos({ x: 0, y: 0 });
    onVirtualMove(0, 0);
  };

  const difficultyLabels: Record<Difficulty, { label: string; sub: string; color: string }> = {
    easy: { label: 'มือใหม่', sub: 'Beginner', color: 'text-emerald-400' },
    normal: { label: 'ลีกสโมสร', sub: 'Club', color: 'text-amber-400' },
    hard: { label: 'ทีมชาติ', sub: 'National', color: 'text-rose-400' },
    master: { label: 'ราชาตะกร้อ', sub: 'King', color: 'text-purple-400' },
  };

  // 3-touch Takraw phase description
  const touchPhase =
    state.playerTouches === 1
      ? 'จังหวะ 1/3 (รับลูก)'
      : state.playerTouches === 2
      ? 'จังหวะ 2/3 (ชงลูก)'
      : state.playerTouches === 3
      ? 'จังหวะ 3/3 (ฟาดทำแต้ม!)'
      : state.opponentTouches > 0
      ? `คู่แข่ง ${state.opponentTouches}/3`
      : 'พร้อมเล่น';

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 md:p-5 select-none overflow-hidden">
      {/* ✦ 1. TOP PERIMETER: SCOREBOARD, SP POWER GAUGE & TOUCH COUNTER ✦ */}
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
        {state.mode === 'match' ? (
          /* Match Mode Scoreboard */
          <div className="flex flex-col items-center gap-1.5 w-full max-w-2xl">
            <div className="flex items-center justify-between gap-3 md:gap-6 px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-white shadow-2xl backdrop-blur-md pointer-events-auto w-full">
              {/* Player Side (Thailand) */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-6 rounded flex flex-col overflow-hidden border border-slate-600 shadow-sm shrink-0">
                  <div className="h-1/5 bg-red-600" />
                  <div className="h-1/5 bg-white" />
                  <div className="h-1/5 bg-blue-700" />
                  <div className="h-1/5 bg-white" />
                  <div className="h-1/5 bg-red-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-wider text-slate-200">ไทย (THA)</span>
                  {state.isPlayerServing && (
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                      ✦ เสิร์ฟ
                    </span>
                  )}
                </div>
                <span className="font-sport font-black text-2xl md:text-3xl text-amber-400 tabular-nums ml-2">
                  {String(state.playerScore).padStart(2, '0')}
                </span>
              </div>

              {/* Match Mid Divider & Difficulty Switcher */}
              <div className="flex flex-col items-center px-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowDiffMenu(!showDiffMenu)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 hover:border-amber-500/60 text-[11px] font-semibold text-slate-300 cursor-pointer transition-colors"
                    title="คลิกเพื่อเปลี่ยนระดับความยาก"
                  >
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span>{difficultyLabels[state.difficulty].label}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-400 font-mono">
                    เป้า {state.matchTargetScore} |
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                      state.playerTouches === 2
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : state.playerTouches === 3
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {touchPhase}
                  </span>
                </div>
              </div>

              {/* Opponent Side */}
              <div className="flex items-center gap-2.5">
                <span className="font-sport font-black text-2xl md:text-3xl text-slate-200 tabular-nums mr-2">
                  {String(state.opponentScore).padStart(2, '0')}
                </span>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold tracking-wider text-slate-200">คู่แข่ง (RIVAL)</span>
                  {!state.isPlayerServing && (
                    <span className="text-[10px] text-amber-400 font-bold">
                      ✦ เสิร์ฟ
                    </span>
                  )}
                </div>
                <div className="w-8 h-6 rounded bg-amber-600 flex items-center justify-center font-black text-[10px] text-slate-950 border border-slate-600 shrink-0">
                  MAS
                </div>
              </div>
            </div>

            {/* ✦ ROLL SPIKE SP POWER GAUGE (หลอดท่าไม้ตาย) ✦ */}
            <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 backdrop-blur-sm pointer-events-auto">
              <div className="flex items-center gap-1 text-[11px] font-black tracking-wider shrink-0">
                <Flame
                  className={`w-4 h-4 ${
                    state.isSpReady ? 'text-rose-500 animate-bounce' : 'text-amber-400'
                  }`}
                />
                <span className={state.isSpReady ? 'text-rose-400 font-black' : 'text-slate-300'}>
                  SP GAUGE
                </span>
              </div>

              <div className="flex-1 h-3 rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-800 relative">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    state.isSpReady
                      ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 shadow-lg shadow-rose-500/50 animate-pulse'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, state.spMeter))}%` }}
                />
              </div>

              <span
                className={`text-[10px] font-black font-mono shrink-0 ${
                  state.isSpReady ? 'text-rose-400 animate-pulse' : 'text-slate-400'
                }`}
              >
                {state.isSpReady ? 'MAX READY!' : `${Math.round(state.spMeter)}%`}
              </span>
            </div>
          </div>
        ) : (
          /* Freestyle Juggling Scoreboard */
          <div className="flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-white shadow-xl pointer-events-auto">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">คะแนนเดาะ</span>
              <span className="font-sport font-black text-2xl md:text-3xl text-amber-400 tabular-nums">
                {state.playerScore.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">คอมโบ</span>
              <span className="font-sport font-bold text-xl text-cyan-400 tabular-nums">
                x{state.comboMultiplier} ({state.comboCount} ครั้ง)
              </span>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">สถิติสูงสุด</span>
              <span className="font-sport font-semibold text-sm text-slate-300 tabular-nums">
                {state.highScore.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Live Difficulty Dropdown Menu */}
        {showDiffMenu && (
          <div className="mt-2 p-1.5 rounded-xl bg-slate-950/95 border border-slate-800 shadow-2xl flex items-center gap-1 pointer-events-auto">
            {(['easy', 'normal', 'hard', 'master'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => {
                  onSetDifficulty(d);
                  setShowDiffMenu(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  state.difficulty === d
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                {difficultyLabels[d].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ✦ 2. DYNAMIC ARCADE BANNERS (Roll Spike Hallmark Popups) ✦ */}
      <div className="absolute top-28 md:top-32 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-30">
        {state.arcadeBanner && (
          <div
            className={`px-6 py-2 rounded-2xl text-base md:text-xl font-sport font-black tracking-wider shadow-2xl backdrop-blur-md border animate-in zoom-in-75 duration-200 ${
              state.bannerType === 'super'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white border-yellow-300/80 shadow-rose-600/50 scale-110'
                : state.bannerType === 'perfect'
                ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 border-amber-300 shadow-amber-500/50'
                : state.bannerType === 'block'
                ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white border-cyan-300 shadow-cyan-500/50'
                : state.bannerType === 'ace'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-emerald-300 shadow-emerald-500/50'
                : state.bannerType === 'dig'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 border-yellow-300 shadow-amber-600/40'
                : 'bg-slate-900/90 text-amber-300 border-amber-500/50'
            }`}
          >
            {state.arcadeBanner}
          </div>
        )}

        {state.lastSkillName && !state.arcadeBanner && !state.isWaitingServe && (
          <div className="mt-1 px-3.5 py-1 rounded-full bg-slate-900/85 border border-slate-700/80 text-slate-200 text-xs font-semibold tracking-wide shadow-md">
            {state.lastSkillName}
          </div>
        )}
      </div>

      {/* ✦ 3. INTERACTIVE SERVE TIMING & AIM CONTROLS OVERLAY ✦ */}
      {state.isWaitingServe && (
        <div className="my-auto mx-auto flex flex-col items-center pointer-events-auto z-20 w-full max-w-sm px-3">
          {state.serveTurn === 'player' ? (
            <div className="flex flex-col items-center gap-3 p-4 md:p-5 rounded-2xl bg-slate-950/95 border border-amber-500/60 backdrop-blur-md shadow-2xl text-center w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 text-amber-400 text-xs md:text-sm font-black uppercase tracking-wider">
                <Zap className="w-4 h-4 fill-amber-400" />
                <span>ถึงตาคุณเสิร์ฟลูก (YOUR SERVE)</span>
              </div>

              {/* ✦ Ace Serve Oscillating Timing Bar ✦ */}
              <div className="flex flex-col items-center w-full bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between w-full text-[11px] mb-1 font-semibold">
                  <span className="text-slate-400">จังหวะเสิร์ฟ:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    หยุดในโซนเขียว = ACE!
                  </span>
                </div>

                {/* Oscillating Bar */}
                <div className="w-full h-5 rounded-lg bg-slate-950 border border-slate-800 relative overflow-hidden flex items-center">
                  {/* Sweet spot in center (40% to 60%) */}
                  <div className="absolute left-[40%] w-[20%] h-full bg-emerald-500/40 border-x border-emerald-400 flex items-center justify-center">
                    <span className="text-[9px] font-black text-emerald-300 tracking-tighter">
                      ACE
                    </span>
                  </div>

                  {/* Moving Needle */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-amber-400 shadow-md shadow-amber-400/80 rounded-full -translate-x-1/2 transition-all duration-75"
                    style={{ left: `${state.servePower}%` }}
                  />
                </div>
              </div>

              {/* Aim Direction Selector */}
              <div className="flex flex-col items-center w-full">
                <span className="text-[11px] text-slate-400 mb-1.5">เลือกทิศทางเสิร์ฟ:</span>
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  {(['left', 'center', 'right'] as const).map((aim) => (
                    <button
                      key={aim}
                      onClick={() => onSetServeAim(aim)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        state.serveAim === aim
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30 scale-105'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {aim === 'left' && <ArrowLeft className="w-3 h-3" />}
                      <span>{aim === 'left' ? 'เจาะซ้าย' : aim === 'center' ? 'ผ่ากลาง' : 'ฉีกขวา'}</span>
                      {aim === 'right' && <ArrowRight className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary Serve Strike Button */}
              <button
                onClick={onExecuteServe}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <Zap className="w-5 h-5 fill-slate-950" />
                <span>กดเสิร์ฟลูก (SERVE)</span>
              </button>

              <span className="text-[10px] text-slate-400 font-mono">
                หรือกด <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-bold">Space</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-bold">J</kbd>
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-4 px-6 rounded-2xl bg-slate-950/90 border border-slate-800 text-center max-w-sm animate-pulse shadow-xl">
              <span className="text-amber-400 font-bold text-sm">คู่แข่งกำลังเตรียมเสิร์ฟลูก...</span>
              <span className="text-[11px] text-slate-400">เตรียมขยับไปดักรับลูกในแดนไทย</span>
            </div>
          )}
        </div>
      )}

      {/* ✦ 4. ROLL SPIKE TOUCH CONTROLS (Authentic Mobile D-Pad & Action Cluster) ✦ */}
      <div className="flex items-end justify-between w-full pointer-events-none mb-14 md:mb-16">
        {/* Virtual 8-way D-Pad */}
        <div
          className="pointer-events-auto w-28 h-28 md:w-32 md:h-32 rounded-full bg-slate-950/80 border-2 border-slate-700/60 backdrop-blur-sm flex items-center justify-center touch-none relative active:border-amber-500/80 shadow-2xl"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Directional cross markings */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <div className="w-full h-0.5 bg-slate-400" />
            <div className="h-full w-0.5 bg-slate-400 absolute" />
          </div>

          <div
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/40 transform transition-transform"
            style={{
              transform: `translate(${touchPos.x}px, ${touchPos.y}px)`,
            }}
          />
        </div>

        {/* Action Button Cluster (Styled like Roll Spike Sepak Takraw Android) */}
        <div className="pointer-events-auto flex flex-col gap-2 items-end">
          {/* Ready to strike cue badge */}
          {state.isReadyToStrike && !state.isWaitingServe && (
            <div className="text-[11px] font-black text-amber-300 bg-amber-500/25 border border-amber-400/60 px-3.5 py-1 rounded-full shadow-lg shadow-amber-500/30 animate-pulse flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>จังหวะเข้าทำ! ฟาดเลย</span>
            </div>
          )}

          {/* ✦ SUPER ROLL SPIKE BUTTON (Unlocks when SP is 100%) ✦ */}
          {state.isSpReady && (
            <button
              onClick={() => onAction('super_roll_spike')}
              className="w-full py-2 px-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-xs shadow-xl shadow-rose-600/50 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all animate-bounce border border-yellow-300"
            >
              <Flame className="w-4 h-4 fill-white" />
              <span>SUPER ROLL SPIKE [U]</span>
            </button>
          )}

          {/* Primary Attack Buttons: Roll Spike & Sunback */}
          <div className="flex gap-2">
            {/* Acrobatic Sunback Spike */}
            <button
              onClick={() => onAction('sunback')}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-black text-xs shadow-lg shadow-amber-600/30 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform border border-amber-400/40"
              title="ฟาดซันแบ็ค (Sunback Spike)"
            >
              <Zap className="w-4 h-4 mb-0.5 text-yellow-300" />
              <span>ซันแบ็ค</span>
              <span className="text-[9px] text-amber-200 opacity-80">[L]</span>
            </button>

            {/* ✦ THE SIGNATURE ROLL SPIKE (ฟาดม้วนตัว 360°) ✦ */}
            <button
              onClick={() => onAction('roll_spike')}
              className="w-18 h-18 rounded-2xl bg-gradient-to-br from-rose-600 via-red-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-sm shadow-xl shadow-rose-600/40 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform border-2 border-yellow-300/80"
              title="ฟาดม้วนตัว 360° (Roll Spike)"
            >
              <Flame className="w-5 h-5 mb-0.5 fill-yellow-300 text-yellow-300 animate-pulse" />
              <span className="leading-tight">โรลสไปค์</span>
              <span className="text-[9px] text-yellow-200 font-bold">[Space]</span>
            </button>
          </div>

          {/* Defense & Tactical Row: Set / Pass, Net Block, Dive */}
          <div className="flex gap-2">
            {/* Emergency Dive / Slide Dig */}
            <button
              onClick={() => onAction('dive')}
              className="w-13 h-13 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 font-bold text-[11px] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
              title="พุ่งสไลด์รับลูก (Dive Save)"
            >
              <span>สไลด์</span>
              <span className="text-[9px] text-slate-400">[Shift]</span>
            </button>

            {/* Net Jump Block */}
            <button
              onClick={() => onAction('block')}
              className="w-13 h-13 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-sky-500/50 text-sky-300 font-bold text-[11px] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
              title="บล็อกหน้าตาข่าย (Net Block)"
            >
              <Shield className="w-3.5 h-3.5 mb-0.5" />
              <span>บล็อก</span>
              <span className="text-[9px] text-slate-400">[B]</span>
            </button>

            {/* Set / Toss (Knee Bump) */}
            <button
              onClick={() => onAction('knee_bump')}
              className="w-13 h-13 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/50 text-cyan-300 font-bold text-[11px] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
              title="ชงลูก / ตั้งลูก (Set / Toss)"
            >
              <span>ชงลูก</span>
              <span className="text-[9px] text-slate-400">[K]</span>
            </button>

            {/* Inside Kick / Pass */}
            <button
              onClick={() => onAction('inside_kick')}
              className="w-13 h-13 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-md"
              title="ลูกแปข้างเท้า (Inside Kick)"
            >
              <span>ลูกแป</span>
              <span className="text-[9px] opacity-75">[J]</span>
            </button>
          </div>
        </div>
      </div>

      {/* ✦ 5. UNIFIED BOTTOM CONTROL DOCK (Collapsible) ✦ */}
      <div className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 w-full max-w-xl px-3 transition-transform duration-300">
        <div
          className={`flex flex-col items-center bg-slate-950/95 border border-slate-800 rounded-2xl p-2 shadow-2xl transition-all duration-300 backdrop-blur-md ${
            isDockCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
          }`}
        >
          {/* Collapse / Expand Toggle Tab */}
          <button
            onClick={() => setIsDockCollapsed(!isDockCollapsed)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1 rounded-full cursor-pointer transition-colors mb-1"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>แสดงเมนูควบคุม</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>ซ่อนเมนู (H)</span>
              </>
            )}
          </button>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full pt-1 border-t border-slate-800/80">
            {/* Camera View Modes */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <Camera className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              {(['action', 'broadcast', 'aerial'] as CameraMode[]).map((cam) => (
                <button
                  key={cam}
                  onClick={() => onSetCamera(cam)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium cursor-pointer transition-colors ${
                    currentCamera === cam
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cam === 'action' ? 'ติดตาม' : cam === 'broadcast' ? 'ทีวี (Roll Spike)' : 'มุมสูง'}
                </button>
              ))}
            </div>

            {/* Quick Live Difficulty Button */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <Shield className="w-3 h-3 text-slate-400 ml-1" />
              {(['easy', 'normal', 'hard', 'master'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onSetDifficulty(d)}
                  className={`px-2 py-0.5 text-[11px] rounded-lg font-medium cursor-pointer transition-colors ${
                    state.difficulty === d
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={difficultyLabels[d].sub}
                >
                  {d === 'easy' ? 'ง่าย' : d === 'normal' ? 'สโมสร' : d === 'hard' ? 'ทีมชาติ' : 'ราชา'}
                </button>
              ))}
            </div>

            {/* Auto-Run Assist Toggle */}
            <button
              onClick={onToggleAutoRun}
              className={`px-2.5 py-1 text-xs rounded-xl font-medium cursor-pointer transition-colors flex items-center gap-1.5 border ${
                state.autoRunAssist
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
              title="สลับโหมดวิ่งดักรับลูกอัตโนมัติ"
            >
              <span>รับลูก:</span>
              <span className="font-bold">{state.autoRunAssist ? 'ออโต้' : 'แมนนวล'}</span>
            </button>

            {/* Actions: Pause, Mute, Menu Reset */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleMuteToggle}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={onPauseToggle}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
                title="พักเกม (Esc)"
              >
                {state.status === 'paused' ? <Play className="w-4 h-4 text-amber-400" /> : <Pause className="w-4 h-4" />}
              </button>

              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>หน้าหลัก</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
