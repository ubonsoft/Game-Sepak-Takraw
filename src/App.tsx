/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameStateSnapshot, GameMode, Difficulty, CameraMode } from './game/gameEngine.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { GameHUD } from './components/GameHUD.tsx';
import { GameOverModal } from './components/GameOverModal.tsx';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameStateSnapshot>({
    mode: 'match',
    status: 'menu',
    difficulty: 'normal',
    playerScore: 0,
    opponentScore: 0,
    playerTouches: 0,
    opponentTouches: 0,
    rallyCount: 0,
    comboCount: 0,
    comboMultiplier: 1,
    lastSkillName: '',
    isPlayerServing: true,
    isWaitingServe: false,
    serveTurn: 'player',
    serveAim: 'center',
    winner: null,
    highScore: 0,
    matchTargetScore: 11,
    autoRunAssist: true,
    isReadyToStrike: false,
    spMeter: 30,
    isSpReady: false,
    servePower: 50,
    arcadeBanner: null,
    bannerType: null,
  });

  const [currentCamera, setCurrentCamera] = useState<CameraMode>('action');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal');
  const [selectedSkin, setSelectedSkin] = useState<'traditional' | 'modern' | 'neon'>('traditional');
  const [selectedMode, setSelectedMode] = useState<GameMode>('match');

  // Initialize Three.js Engine once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(containerRef.current, (newState) => {
      setGameState({ ...newState });
    });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.startGame();
    }
  }, []);

  const handleModeChange = useCallback((mode: GameMode) => {
    setSelectedMode(mode);
    if (engineRef.current) {
      engineRef.current.setMode(mode);
    }
  }, []);

  const handleDifficultyChange = useCallback((diff: Difficulty) => {
    setSelectedDifficulty(diff);
    if (engineRef.current) {
      engineRef.current.setDifficulty(diff);
    }
  }, []);

  const handleSkinChange = useCallback((skin: 'traditional' | 'modern' | 'neon') => {
    setSelectedSkin(skin);
    if (engineRef.current) {
      engineRef.current.setSkin(skin);
    }
  }, []);

  const handleCameraChange = useCallback((cam: CameraMode) => {
    setCurrentCamera(cam);
    if (engineRef.current) {
      engineRef.current.setCameraMode(cam);
    }
  }, []);

  const handleAction = useCallback(
    (action: 'inside_kick' | 'knee_bump' | 'header' | 'sunback' | 'roll_spike' | 'super_roll_spike' | 'block' | 'dive') => {
      if (engineRef.current) {
        engineRef.current.queueAction(action);
      }
    },
    []
  );

  const handleExecuteServe = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.executePlayerServe();
    }
  }, []);

  const handleSetServeAim = useCallback((aim: 'left' | 'center' | 'right') => {
    if (engineRef.current) {
      engineRef.current.setServeAim(aim);
    }
  }, []);

  const handleVirtualMove = useCallback((x: number, z: number) => {
    if (engineRef.current) {
      engineRef.current.virtualMove = { x, z };
    }
  }, []);

  const handleToggleAutoRun = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.toggleAutoRunAssist();
    }
  }, []);

  const handlePauseToggle = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  }, []);

  const handleResetToMenu = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetGame();
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* 3D WebGL Canvas Container (Strictly isolated from React re-renders) */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 pointer-events-auto" />

      {/* Title Screen Overlay */}
      {gameState.status === 'menu' && (
        <TitleScreen
          onStart={handleStartGame}
          mode={selectedMode}
          setMode={handleModeChange}
          difficulty={selectedDifficulty}
          setDifficulty={handleDifficultyChange}
          skin={selectedSkin}
          setSkin={handleSkinChange}
          highScore={gameState.highScore}
          autoRunAssist={gameState.autoRunAssist}
          onToggleAutoRun={handleToggleAutoRun}
        />
      )}

      {/* In-Game World-Matched HUD */}
      {(gameState.status === 'playing' || gameState.status === 'paused' || gameState.status === 'point_scored') && (
        <GameHUD
          state={gameState}
          onAction={handleAction}
          onSetCamera={handleCameraChange}
          currentCamera={currentCamera}
          onPauseToggle={handlePauseToggle}
          onReset={handleResetToMenu}
          onVirtualMove={handleVirtualMove}
          onToggleAutoRun={handleToggleAutoRun}
          onSetDifficulty={handleDifficultyChange}
          onExecuteServe={handleExecuteServe}
          onSetServeAim={handleSetServeAim}
        />
      )}

      {/* Game Over / Victory Modal */}
      {gameState.status === 'game_over' && (
        <GameOverModal
          state={gameState}
          onRestart={handleStartGame}
          onHome={handleResetToMenu}
        />
      )}
    </div>
  );
}
