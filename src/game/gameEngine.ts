import * as THREE from 'three';
import { TakrawArena } from './court.ts';
import { TakrawBall } from './ball.ts';
import { TakrawPlayer, ActionType } from './character.ts';
import { ParticleSystem } from './particles.ts';
import { sound } from './audio.ts';
import confetti from 'canvas-confetti';

export type GameMode = 'match' | 'freestyle' | 'target';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'master';
export type CameraMode = 'action' | 'broadcast' | 'aerial';

export interface GameStateSnapshot {
  mode: GameMode;
  status: 'menu' | 'playing' | 'paused' | 'point_scored' | 'game_over';
  difficulty: Difficulty;
  playerScore: number;
  opponentScore: number;
  playerTouches: number;
  opponentTouches: number;
  rallyCount: number;
  comboCount: number;
  comboMultiplier: number;
  lastSkillName: string;
  isPlayerServing: boolean;
  isWaitingServe: boolean;
  serveTurn: 'player' | 'opponent';
  serveAim: 'left' | 'center' | 'right';
  winner: 'player' | 'opponent' | null;
  highScore: number;
  matchTargetScore: number;
  autoRunAssist: boolean;
  isReadyToStrike: boolean;
  // ✦ Roll Spike Android Mechanics ✦
  spMeter: number; // 0 to 100
  isSpReady: boolean; // spMeter >= 100
  servePower: number; // 0 to 100 oscillating timing meter for Ace Serve
  arcadeBanner: string | null;
  bannerType: 'perfect' | 'roll_spike' | 'super' | 'block' | 'ace' | 'dig' | null;
}

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  // Components
  public arena!: TakrawArena;
  public ball!: TakrawBall;
  public player!: TakrawPlayer;
  public opponent!: TakrawPlayer;
  public particles!: ParticleSystem;

  // Game configuration
  public mode: GameMode = 'match';
  public difficulty: Difficulty = 'normal';
  public cameraMode: CameraMode = 'action';
  public skin: 'traditional' | 'modern' | 'neon' = 'traditional';

  // Game loop & state
  public status: 'menu' | 'playing' | 'paused' | 'point_scored' | 'game_over' = 'menu';
  public playerScore = 0;
  public opponentScore = 0;
  public playerTouches = 0;
  public opponentTouches = 0;
  public rallyCount = 0;
  public comboCount = 0;
  public comboMultiplier = 1;
  public lastSkillName = '';
  public isPlayerServing = true;
  public isWaitingServe = false;
  public serveTurn: 'player' | 'opponent' = 'player';
  public serveAim: 'left' | 'center' | 'right' = 'center';
  private opponentServeTimer: number | null = null;
  public winner: 'player' | 'opponent' | null = null;
  public highScore = 0;
  public readonly matchTargetScore = 11;
  public autoRunAssist: boolean = true;
  public isReadyToStrike: boolean = false;

  // ✦ Roll Spike Specific Systems ✦
  public spMeter = 30; // 0 to 100 (Power gauge)
  public servePower = 50; // 0 to 100 oscillating meter
  public arcadeBanner: string | null = null;
  public bannerType: 'perfect' | 'roll_spike' | 'super' | 'block' | 'ace' | 'dig' | null = null;
  private bannerTimer = 0;
  private postServeTimer = 0;

  // State update callback to React
  private onStateChange?: (state: GameStateSnapshot) => void;

  // Animation & Delta
  private lastTime = 0;
  private reqId: number | null = null;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private cameraTargetPos = new THREE.Vector3();
  private cameraLookTarget = new THREE.Vector3();

  // Keys & Input Buffer
  private heldKeys: Record<string, boolean> = {};
  private inputBuffer: { action: ActionType; time: number } | null = null;
  private readonly bufferWindow = 0.22; // 220ms input buffering

  // Virtual Joystick input
  public virtualMove = { x: 0, z: 0 };

  // Fluid Athletic Movement & Inertia
  private playerVelocity = new THREE.Vector2(0, 0);
  private smoothBallTarget = new THREE.Vector3(0, 0, 4.15);
  private aiVelocity = new THREE.Vector2(0, 0);
  private smoothAiTarget = new THREE.Vector3(0, 0, -4.2);

  // AI behavior variables
  private aiReactionTimer = 0;
  private aiDecisionDelay = 0.12;

  constructor(container: HTMLElement, onStateChange?: (state: GameStateSnapshot) => void) {
    this.container = container;
    this.onStateChange = onStateChange;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);

    // 3. Renderer with high PBR standards
    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Initialize world elements
    this.initWorld();

    // 5. Setup Input Handlers
    this.setupInputs();

    // 6. Pre-warm shader pipeline
    this.renderer.compile(this.scene, this.camera);

    // 7. Start render loop
    this.startLoop();

    // Resize handler
    window.addEventListener('resize', this.onResize);
  }

  private initWorld() {
    this.arena = new TakrawArena(this.scene, this.renderer);

    this.particles = new ParticleSystem(this.scene);

    this.ball = new TakrawBall(
      this.scene,
      {
        onFloorBounce: (pos, vel) => this.handleFloorBounce(pos, vel),
        onNetHit: () => {
          // Stable net reaction without camera vibration
        },
      },
      this.skin
    );

    // Player (South side: Z > 0, facing -1 towards North)
    this.player = new TakrawPlayer(this.scene, {
      jerseyColor: 0x1d4ed8, // Thailand Blue
      shortsColor: 0xffffff,
      skinColor: 0xd9a066,
      headbandColor: 0xef4444, // Red Mongkhon
      jerseyNumber: '7',
    });
    this.player.facing = -1;
    this.player.position.set(0, 0, 5.0);

    // Opponent AI (North side: Z < 0, facing 1 towards South)
    this.opponent = new TakrawPlayer(this.scene, {
      jerseyColor: 0xeab308, // Gold / Yellow
      shortsColor: 0x1e293b,
      skinColor: 0xcaa078,
      headbandColor: 0x06b6d4,
      jerseyNumber: '10',
      isAI: true,
    });
    this.opponent.facing = 1;
    this.opponent.position.set(0, 0, -5.0);

    // Load saved high score
    const saved = localStorage.getItem('takraw_highscore');
    if (saved) this.highScore = parseInt(saved, 10) || 0;
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.heldKeys[e.code] = true;

      // Handle direct serve triggers and aim controls when waiting for serve
      if (this.isWaitingServe && this.serveTurn === 'player') {
        if (e.code === 'Space' || e.code === 'KeyJ' || e.code === 'Enter') {
          this.executePlayerServe();
          return;
        }
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
          this.setServeAim('left');
          return;
        }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') {
          this.setServeAim('right');
          return;
        }
        if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.setServeAim('center');
          return;
        }
      }

      // Roll Spike Android Control Scheme:
      // Space: Roll Spike (Signature acrobatic 360 flip!)
      // KeyJ: Inside Kick (ลูกแป)
      // KeyK: Knee Bump / Set Toss (ชงลูก/ตั้งลูก)
      // KeyL: Sunback Spike (ฟาดซันแบ็ค)
      // KeyB: Net Block (กระโดดยกขาบล็อกหน้าเน็ต)
      // KeyC or Shift: Emergency Dive / Slide Dig (พุ่งสไลด์รับลูก)
      // KeyU: Super Roll Spike (ไม้ตายลูกฟาดเพลิง เมื่อ SP เต็ม 100)
      // KeyH: Header (ลูกโหม่ง)
      if (e.code === 'Space') {
        this.queueAction('roll_spike');
      } else if (e.code === 'KeyJ') {
        this.queueAction('inside_kick');
      } else if (e.code === 'KeyK') {
        this.queueAction('knee_bump');
      } else if (e.code === 'KeyL') {
        this.queueAction('sunback');
      } else if (e.code === 'KeyB') {
        this.queueAction('block');
      } else if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.queueAction('dive');
      } else if (e.code === 'KeyU') {
        this.queueAction('super_roll_spike');
      } else if (e.code === 'KeyH') {
        this.queueAction('header');
      } else if (e.code === 'Escape') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.heldKeys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.heldKeys = {};
      this.virtualMove = { x: 0, z: 0 };
    });
  }

  public showBanner(text: string, type: 'perfect' | 'roll_spike' | 'super' | 'block' | 'ace' | 'dig', duration: number = 1.3) {
    this.arcadeBanner = text;
    this.bannerType = type;
    this.bannerTimer = duration;
    this.broadcastState();
  }

  public queueAction(action: ActionType) {
    if (this.status === 'menu') {
      this.startGame();
      return;
    }
    if (this.status !== 'playing') return;

    // If waiting for player serve, pressing any action button executes serve!
    if (this.isWaitingServe && this.serveTurn === 'player') {
      this.executePlayerServe();
      return;
    }

    this.inputBuffer = { action, time: performance.now() };
    this.tryExecutePlayerAction();
  }

  public setServeAim(aim: 'left' | 'center' | 'right') {
    this.serveAim = aim;
    this.broadcastState();
  }

  public executePlayerServe() {
    if (!this.isWaitingServe || this.serveTurn !== 'player' || this.status !== 'playing') return;

    this.isWaitingServe = false;
    this.player.triggerAction('serve', 0.65);
    this.postServeTimer = 1.2; // Server stays anchored in backcourt ready stance, prevents rushing net

    // Aim target on opponent's court (length: -6.7m to 0m, width: -3.05m to 3.05m)
    let targetX = 0;
    let targetZ = -5.0;
    if (this.serveAim === 'left') {
      targetX = -1.9;
      targetZ = -4.9;
    } else if (this.serveAim === 'right') {
      targetX = 1.9;
      targetZ = -4.9;
    } else {
      targetX = (Math.random() - 0.5) * 0.8;
      targetZ = -5.3;
    }

    const dx = targetX - this.ball.position.x;
    const dz = targetZ - this.ball.position.z;

    // ✦ Roll Spike Timing Bar Check: Green Sweet Spot is 40% - 60% ✦
    const isAce = this.servePower >= 40 && this.servePower <= 60;

    if (isAce) {
      // Powerful, flat bullet Ace Serve!
      const speed = 14.5;
      const time = Math.abs(dz) / speed;
      this.ball.velocity.set(dx / time, 2.5, dz / time);
      sound.playAceServe();
      sound.playWhistle(true);
      this.particles.burstSparks(this.ball.position, 26, true);
      this.showBanner('🎯 ACE SERVE (PERFECT)!', 'ace');
      this.spMeter = Math.min(100, this.spMeter + 25);
      this.lastSkillName = `🎯 เอซเสิร์ฟความเร็วสูง (${this.serveAim === 'left' ? 'เจาะซ้าย' : this.serveAim === 'right' ? 'ฉีกขวา' : 'ผ่ากลาง'})!`;
    } else {
      // Standard clean loop serve
      const time = 1.35;
      this.ball.velocity.set(dx / time, 5.2, dz / time);
      sound.playKick('instep', 1.1);
      sound.playWhistle(true);
      this.spMeter = Math.min(100, this.spMeter + 10);
      this.lastSkillName = `เสิร์ฟหลังเท้า (${this.serveAim === 'left' ? 'เจาะซ้าย' : this.serveAim === 'right' ? 'ฉีกขวา' : 'ผ่ากลาง'})`;
    }

    this.ball.lastHitter = 'player';
    this.ball.touchCount = 1;
    this.broadcastState();
  }

  private executeOpponentServe() {
    if (!this.isWaitingServe || this.serveTurn !== 'opponent' || this.status !== 'playing') return;

    this.isWaitingServe = false;
    this.opponent.triggerAction('serve', 0.65);
    sound.playKick('instep', 1.15);
    sound.playWhistle(true);

    // AI targets player court strategically
    let targetX = 0;
    let targetZ = 4.8;

    if (this.difficulty === 'master') {
      targetX = Math.random() < 0.5 ? -2.2 : 2.2;
      targetZ = 4.5 + Math.random() * 1.5;
    } else if (this.difficulty === 'hard') {
      targetX = (Math.random() - 0.5) * 4.2;
      targetZ = 4.4 + Math.random() * 1.5;
    } else if (this.difficulty === 'normal') {
      targetX = (Math.random() - 0.5) * 3.2;
      targetZ = 4.6;
    } else {
      targetX = (Math.random() - 0.5) * 1.5;
      targetZ = 4.8;
    }

    const time = this.difficulty === 'master' ? 1.15 : this.difficulty === 'hard' ? 1.25 : 1.45;
    const dx = targetX - this.ball.position.x;
    const dz = targetZ - this.ball.position.z;

    this.ball.velocity.set(dx / time, 5.2, dz / time);
    this.ball.lastHitter = 'opponent';
    this.ball.touchCount = 1;
    this.lastSkillName = 'คู่แข่งเสิร์ฟลูกมาแล้ว! เตรียมรับ';
    this.broadcastState();
  }

  private tryExecutePlayerAction() {
    if (!this.inputBuffer) return;
    const now = performance.now();
    if (now - this.inputBuffer.time > this.bufferWindow * 1000) {
      this.inputBuffer = null;
      return;
    }

    const action = this.inputBuffer.action;
    const playerPos = this.player.position;
    const ballPos = this.ball.position;
    const distToBall = playerPos.distanceTo(ballPos);

    // ✦ 1. NET BLOCK ACTION (ระบบบล็อกหน้าตาข่าย) ✦
    if (action === 'block') {
      this.player.triggerAction('block', 0.55);
      // Check if player is positioned at the net and ball is coming across the net tape
      const isNearNet = playerPos.z <= 2.2;
      const isBallAtNet = Math.abs(ballPos.z) <= 1.4 && ballPos.y >= 1.2 && ballPos.y <= 2.8;
      const isIncomingFromOpponent = this.ball.velocity.z > 0 || this.ball.lastHitter === 'opponent';

      if (isNearNet && isBallAtNet && isIncomingFromOpponent) {
        // Successful Net Block! Rebound ball directly down into opponent court!
        sound.playBlock();
        this.particles.triggerBlockEffect(ballPos);
        this.cameraShake = 0.08;
        this.hitstopTimer = 0.06;

        this.ball.velocity.set((Math.random() - 0.5) * 2.0, 1.4, -6.5);
        this.ball.lastHitter = 'player';
        this.playerTouches = 1;
        this.spMeter = Math.min(100, this.spMeter + 35);
        this.showBanner('🛡️ MONSTER BLOCK!', 'block');
        this.lastSkillName = 'บล็อกหน้าตาข่ายสำเร็จ! (NET BLOCK)';
        this.inputBuffer = null;
        this.broadcastState();
        return;
      }
      this.inputBuffer = null;
      return;
    }

    // ✦ 2. EMERGENCY DIVE / SLIDE DIG ACTION (พุ่งสไลด์รับลูก) ✦
    if (action === 'dive') {
      this.player.triggerAction('dive', 0.55);
      sound.playSlide();

      // Extended dive reach: up to 3.4m horizontally, low ball height
      if (distToBall <= 3.4 && ballPos.y <= 1.9 && ballPos.z >= 0.4) {
        // Slide towards ball
        this.player.position.lerp(new THREE.Vector3(ballPos.x, this.player.position.y, ballPos.z + 0.3), 0.65);
        this.playerTouches++;
        this.rallyCount++;

        // Pop ball softly up into attack zone (setup dig)
        this.ball.applyKick(new THREE.Vector3(0, 5.8, -0.9), 'dive', 'player');
        this.particles.burstSparks(ballPos, 14, false);
        this.spMeter = Math.min(100, this.spMeter + 15);
        this.showBanner('⚡ NICE DIG SAVE!', 'dig');
        this.lastSkillName = 'พุ่งสไลด์รับลูก! (DIVE DIG)';
        this.inputBuffer = null;
        this.broadcastState();
        return;
      }
      this.inputBuffer = null;
      return;
    }

    // ✦ 3. SUPER ROLL SPIKE ACTION (ไม้ตายท่าฟาดลูกเพลิง) ✦
    if (action === 'super_roll_spike') {
      if (this.spMeter < 100) {
        // Not enough SP -> fallback to regular Roll Spike
        this.inputBuffer.action = 'roll_spike';
        this.tryExecutePlayerAction();
        return;
      }
      // Consume full SP
      this.spMeter = 0;
      this.player.triggerAction('super_roll_spike', 0.7);
      if (distToBall <= 3.2 && ballPos.y >= 0.6 && ballPos.y <= 4.2) {
        this.executePlayerKick('super_roll_spike');
        this.inputBuffer = null;
        return;
      }
      this.inputBuffer = null;
      return;
    }

    // ✦ 4. STRIKE & SPIKE ACTIONS (Roll Spike, Sunback, Knee Set, Inside Kick) ✦
    const hitRadius = (action === 'roll_spike' || action === 'sunback') ? 2.8 : 1.9;
    const ballHeight = ballPos.y;

    // Trigger visual animation for responsive tactile feel
    const animDur = (action === 'roll_spike' || action === 'sunback') ? 0.65 : 0.42;
    this.player.triggerAction(action, animDur);

    if (distToBall <= hitRadius && ballHeight <= 4.0 && ballHeight >= 0.2) {
      // Connect with ball!
      this.executePlayerKick(action);
      this.inputBuffer = null;
    }
  }

  private executePlayerKick(action: ActionType) {
    this.playerTouches++;
    this.rallyCount++;

    const impulse = new THREE.Vector3();
    const ballH = this.ball.position.y;

    if (this.mode === 'freestyle') {
      // Juggling mode
      this.comboCount++;
      this.comboMultiplier = Math.min(10, Math.floor(this.comboCount / 3) + 1);
      const pointsAdded = 50 * this.comboMultiplier;
      this.playerScore += pointsAdded;
      if (this.playerScore > this.highScore) {
        this.highScore = this.playerScore;
        localStorage.setItem('takraw_highscore', this.highScore.toString());
      }
      sound.playComboUp(this.comboCount);

      // Check hoop targets in freestyle
      this.particles.targets.forEach((target) => {
        if (target.isActive && this.ball.position.distanceTo(target.position) < target.radius + 0.3) {
          target.isActive = false;
          this.playerScore += target.points * this.comboMultiplier;
          sound.playScoreFanfare();
          this.particles.triggerShockwave(target.position, true);
        }
      });

      if (action === 'super_roll_spike' || action === 'roll_spike') {
        impulse.set((Math.random() - 0.5) * 1.5, 8.2, (Math.random() - 0.5) * 1.5);
        this.particles.triggerShockwave(this.ball.position, true);
        this.showBanner('🌪️ ROLL SPIKE!', 'roll_spike');
      } else if (action === 'sunback') {
        impulse.set((Math.random() - 0.5) * 1.5, 7.5, (Math.random() - 0.5) * 1.5);
      } else if (action === 'knee_bump') {
        impulse.set((Math.random() - 0.5) * 0.8, 5.0, (Math.random() - 0.5) * 0.8);
      } else {
        impulse.set((Math.random() - 0.5) * 1.0, 5.8, (Math.random() - 0.5) * 1.0);
      }

      this.ball.applyKick(impulse, action === 'roll_spike' ? 'roll_spike' : action === 'knee_bump' ? 'knee' : 'inside', 'player');
      this.broadcastState();
      return;
    }

    // ✦ MATCH MODE (Official ISTAF & Roll Spike Sepak Takraw Rules) ✦
    const shouldSet = this.playerTouches < 2 && action === 'knee_bump';

    if (shouldSet) {
      // ✦ 3-Touch Phase: TOSS / SET (ชงลูก / ตั้งลูก) ✦
      // Pops ball high and floaty right near the net into prime strike zone!
      impulse.set(this.player.position.x * 0.4, 6.4, 1.4 - this.player.position.z * 0.25);
      this.particles.burstSparks(this.ball.position, 14, false);
      this.spMeter = Math.min(100, this.spMeter + 12);
      this.showBanner('🎯 SET UP / ชงลูก!', 'dig', 1.0);
      this.lastSkillName = 'ชงลูกยกหน้าเน็ต! (FEEDER SET)';
      this.ball.applyKick(impulse, 'knee', 'player');
      this.broadcastState();
      return;
    }

    // Attack over the net!
    const targetX = (Math.random() - 0.5) * 4.6; // Opponent court width
    const targetZ = -2.0 - Math.random() * 3.8; // Opponent deep or short court
    const dx = targetX - this.ball.position.x;
    const dz = targetZ - this.ball.position.z;

    if (action === 'super_roll_spike') {
      // ✦ SUPER ROLL SPIKE (ไม้ตายฟาดเพลิงบรรลัยกัลป์) ✦
      this.hitstopTimer = 0.14; // Dramatic Matrix hitstop freeze frame!
      this.cameraShake = 0.18;
      this.particles.triggerShockwave(this.ball.position, true, true);
      this.particles.burstSparks(this.ball.position, 40, true);
      sound.playCrowdCheer(true);

      const speed = 17.5; // Blazing supersonic velocity!
      const travelTime = Math.max(0.24, Math.abs(dz) / speed);
      impulse.set(dx / travelTime, 1.2, dz / travelTime);

      this.showBanner('🔥 SUPER ROLL SPIKE!', 'super', 2.0);
      this.lastSkillName = '🔥 ลูกฟาดไฟบรรลัยกัลป์! (SUPER ROLL SPIKE)';
      this.opponentTouches = 0;
      this.ball.applyKick(impulse, 'super_spike', 'player');

    } else if (action === 'roll_spike') {
      // ✦ ICONIC ROLL SPIKE (ฟาดม้วนตัว 360° กลางอากาศ) ✦
      // Check timing sweet spot: ball height in prime strike elevation (1.8m to 3.2m)
      const isPerfect = ballH >= 1.8 && ballH <= 3.2;

      if (isPerfect) {
        this.hitstopTimer = 0.08;
        this.cameraShake = 0.1;
        this.particles.triggerShockwave(this.ball.position, true);
        this.particles.burstSparks(this.ball.position, 34, true);
        sound.playPerfectChime();
        sound.playCrowdCheer(true);

        const speed = 14.8;
        const travelTime = Math.max(0.3, Math.abs(dz) / speed);
        impulse.set(dx / travelTime, 1.8, dz / travelTime);

        this.spMeter = Math.min(100, this.spMeter + 25);
        this.showBanner('✨ PERFECT ROLL SPIKE!', 'perfect');
        this.lastSkillName = '✨ เพอร์เฟกต์โรลสไปค์! (PERFECT ROLL SPIKE)';
      } else {
        this.hitstopTimer = 0.05;
        this.cameraShake = 0.05;
        this.particles.triggerShockwave(this.ball.position, true);
        this.particles.burstSparks(this.ball.position, 22, true);

        const speed = 12.6;
        const travelTime = Math.max(0.35, Math.abs(dz) / speed);
        impulse.set(dx / travelTime, 2.2, dz / travelTime);

        this.spMeter = Math.min(100, this.spMeter + 15);
        this.showBanner('🌪️ ROLL SPIKE!', 'roll_spike');
        this.lastSkillName = '🌪️ ฟาดม้วนตัว! (ROLL SPIKE)';
      }

      this.opponentTouches = 0;
      this.ball.applyKick(impulse, 'roll_spike', 'player');

    } else if (action === 'sunback') {
      // ✦ SUNBACK SPIKE (ฟาดซันแบ็ค) ✦
      this.hitstopTimer = 0.05;
      this.cameraShake = 0.06;
      this.particles.triggerShockwave(this.ball.position, true);
      this.particles.burstSparks(this.ball.position, 26, true);
      sound.playCrowdCheer(true);

      const speed = 12.0;
      const travelTime = Math.max(0.38, Math.abs(dz) / speed);
      impulse.set(dx / travelTime, 2.2, dz / travelTime);

      this.spMeter = Math.min(100, this.spMeter + 15);
      this.showBanner('⚡ SUNBACK SPIKE!', 'roll_spike');
      this.lastSkillName = '⚡ ฟาดซันแบ็ค! (SUNBACK SPIKE)';
      this.opponentTouches = 0;
      this.ball.applyKick(impulse, 'sunback', 'player');

    } else {
      // Standard Inside Kick / Header / Dig
      const travelTime = 1.55;
      impulse.set(dx / travelTime, 4.8, dz / travelTime);
      this.particles.burstSparks(this.ball.position, 10, false);
      this.spMeter = Math.min(100, this.spMeter + 8);
      this.lastSkillName = action === 'header' ? 'ลูกโหม่ง (HEADER)' : 'ลูกแปข้างเท้า (INSIDE KICK)';
      this.opponentTouches = 0;
      this.ball.applyKick(impulse, action === 'header' ? 'header' : 'inside', 'player');
    }

    this.broadcastState();
  }

  private executeOpponentKick(action: ActionType) {
    this.opponentTouches++;
    this.rallyCount++;

    const isSpike = action === 'sunback';
    if (isSpike) {
      this.hitstopTimer = 0.04;
      this.cameraShake = 0;
      this.particles.triggerShockwave(this.ball.position, true);
      this.particles.burstSparks(this.ball.position, 24, true);
    } else {
      this.cameraShake = 0;
      this.particles.burstSparks(this.ball.position, 12, false);
    }

    const impulse = new THREE.Vector3();
    const shouldSet = this.opponentTouches < 2 && Math.random() < (this.difficulty === 'master' ? 0.35 : this.difficulty === 'hard' ? 0.45 : 0.6);

    if (shouldSet) {
      // Tactical Setup: Pop ball high near the net for a killer spike!
      const setX = (Math.random() - 0.5) * 1.5;
      const setZ = -1.4;
      const dx = setX - this.opponent.position.x;
      const dz = setZ - this.opponent.position.z;
      impulse.set(dx * 0.8, 5.4, dz * 0.8);
      this.opponent.triggerAction('knee_bump', 0.45);
      this.lastSkillName = 'คู่แข่งตั้งลูกยก!';
    } else {
      // Tactical Attack over the net!
      // AI chooses placement away from the player's position
      const playerPos = this.player.position;
      let targetX = 0;
      let targetZ = 4.8;

      if (this.difficulty === 'master' || this.difficulty === 'hard') {
        // High IQ: If player is leaning left (x < -0.3), spike hard right (x > 1.2)
        // If player is leaning right (x > 0.3), spike hard left (x < -1.2)
        if (playerPos.x < -0.3) {
          targetX = 1.4 + Math.random() * 1.2;
        } else if (playerPos.x > 0.3) {
          targetX = -1.4 - Math.random() * 1.2;
        } else {
          targetX = Math.random() < 0.5 ? -2.2 : 2.2;
        }

        // Depth tactic: Drop shot if player is deep (> 5.2m), or baseline smash if player is shallow (< 2.8m)
        if (playerPos.z > 5.2 && Math.random() < 0.35) {
          targetZ = 1.8; // Drop shot just over the net!
        } else if (playerPos.z < 2.8) {
          targetZ = 5.8; // Deep baseline attack
        } else {
          targetZ = 3.8 + Math.random() * 2.2;
        }
      } else if (this.difficulty === 'normal') {
        targetX = (Math.random() - 0.5) * 4.4;
        targetZ = 3.5 + Math.random() * 2.5;
      } else {
        // Easy: generous, centered returns
        targetX = (Math.random() - 0.5) * 2.5;
        targetZ = 4.2;
      }

      const dx = targetX - this.ball.position.x;
      const dz = targetZ - this.ball.position.z;

      if (isSpike) {
        // Sunback Spike: Sharp downward trajectory and high speed!
        const speed = this.difficulty === 'master' ? 14.5 : this.difficulty === 'hard' ? 12.8 : this.difficulty === 'normal' ? 10.5 : 8.5;
        const travelTime = Math.max(0.35, Math.abs(dz) / speed);
        impulse.set(dx / travelTime, 2.2, dz / travelTime);
        this.lastSkillName = 'คู่แข่งฟาดซันแบ็ค!';
      } else {
        const travelTime = this.difficulty === 'master' ? 1.2 : this.difficulty === 'hard' ? 1.35 : 1.6;
        impulse.set(dx / travelTime, 4.8, dz / travelTime);
        this.lastSkillName = action === 'header' ? 'คู่แข่งโหม่งข้ามตาข่าย' : 'คู่แข่งเปิดลูกแป';
      }

      this.playerTouches = 0;
      this.opponent.triggerAction(action, 0.45);
    }

    const oppKickType = action === 'knee_bump' ? 'knee' : action === 'header' ? 'header' : action === 'sunback' ? 'sunback' : 'inside';
    this.ball.applyKick(impulse, oppKickType, 'opponent');
    this.broadcastState();
  }

  private updateAI(dt: number) {
    if (this.mode === 'freestyle') return;

    this.aiReactionTimer += dt;
    if (this.aiReactionTimer < this.aiDecisionDelay) return;
    this.aiReactionTimer = 0;

    // AI tracks predicted ball landing
    const predicted = this.ball.getPredictedLanding();
    const aiPos = this.opponent.position;

    // Move towards landing target if ball is headed to opponent side (Z < 0)
    let targetAiVelX = 0;
    let targetAiVelZ = 0;
    const aiSpeed = this.difficulty === 'master' ? 8.2 : this.difficulty === 'hard' ? 7.0 : this.difficulty === 'normal' ? 5.6 : 4.2;

    const isOpponentServing = this.opponent.currentAction === 'serve';
    // AI only chases ball if it is genuinely landing on AI side (predicted.z <= -0.3)
    const isBallHeadingToAI =
      !isOpponentServing &&
      predicted.z <= -0.3 &&
      (this.ball.velocity.z < -0.05 || this.ball.lastHitter === 'player' || (this.ball.lastHitter === 'opponent' && this.opponentTouches < 3));

    if (isBallHeadingToAI) {
      const rawTargetX = THREE.MathUtils.clamp(predicted.x, -2.6, 2.6);
      const rawTargetZ = THREE.MathUtils.clamp(predicted.z - 0.25, -6.0, -1.15);
      this.smoothAiTarget.lerp(new THREE.Vector3(rawTargetX, 0, rawTargetZ), Math.min(1.0, 10 * dt));

      const dx = this.smoothAiTarget.x - aiPos.x;
      const dz = this.smoothAiTarget.z - aiPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.08) {
        const ease = THREE.MathUtils.smoothstep(dist, 0.08, 1.4);
        targetAiVelX = (dx / dist) * aiSpeed * ease;
        targetAiVelZ = (dz / dist) * aiSpeed * ease;
      }
    } else {
      // Return to baseline / midcourt defense position safely away from net
      const defaultZ = -4.2;
      const defaultX = THREE.MathUtils.clamp(this.ball.position.x * 0.35, -1.6, 1.6);
      this.smoothAiTarget.lerp(new THREE.Vector3(defaultX, 0, defaultZ), Math.min(1.0, 8 * dt));

      const dx = this.smoothAiTarget.x - aiPos.x;
      const dz = this.smoothAiTarget.z - aiPos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.12) {
        const ease = THREE.MathUtils.smoothstep(dist, 0.12, 1.6);
        targetAiVelX = (dx / dist) * aiSpeed * 0.65 * ease;
        targetAiVelZ = (dz / dist) * aiSpeed * 0.65 * ease;
      }
    }

    if (isOpponentServing) {
      targetAiVelX = 0;
      targetAiVelZ = 0;
      this.aiVelocity.set(0, 0);
    }

    // Apply continuous inertia damping to AI
    this.aiVelocity.x = THREE.MathUtils.lerp(this.aiVelocity.x, targetAiVelX, Math.min(1.0, 12 * dt));
    this.aiVelocity.y = THREE.MathUtils.lerp(this.aiVelocity.y, targetAiVelZ, Math.min(1.0, 12 * dt));

    aiPos.x += this.aiVelocity.x * dt;
    aiPos.z += this.aiVelocity.y * dt;
    aiPos.x = THREE.MathUtils.clamp(aiPos.x, -2.7, 2.7);
    aiPos.z = THREE.MathUtils.clamp(aiPos.z, -6.3, -1.0);

    // Diving save: If ball is falling low (< 1.2m) and AI is within 2.3m, lunges to keep ball alive
    const distToBall = aiPos.distanceTo(this.ball.position);
    const ballH = this.ball.position.y;

    if (this.ball.position.z < 0 && this.ball.velocity.y < -1.8 && ballH < 1.3 && distToBall < 2.4 && this.ball.lastHitter !== 'opponent') {
      aiPos.lerp(this.ball.position, 0.45);
      this.executeOpponentKick('inside_kick');
      this.lastSkillName = 'คู่แข่งพุ่งรับลูกทัน!';
    } else if (distToBall < 1.9 && ballH < 3.4 && ballH > 0.35 && this.ball.lastHitter !== 'opponent') {
      // Standard return or spike
      const spikeChance = this.difficulty === 'master' ? 0.92 : this.difficulty === 'hard' ? 0.8 : this.difficulty === 'normal' ? 0.5 : 0.22;
      if (ballH > 1.7 && Math.random() < spikeChance) {
        this.executeOpponentKick('sunback');
      } else if (ballH < 1.2) {
        this.executeOpponentKick('knee_bump');
      } else if (ballH > 2.2) {
        this.executeOpponentKick('header');
      } else {
        this.executeOpponentKick('inside_kick');
      }
    }

    // In master or hard: If player jumps near the net (z < 2.5) with sunback, AI rushes forward to contest/block
    if ((this.difficulty === 'master' || this.difficulty === 'hard') && this.player.currentAction === 'sunback' && this.player.position.z < 2.5) {
      aiPos.z = THREE.MathUtils.lerp(aiPos.z, -0.7, 10 * dt);
      aiPos.x = THREE.MathUtils.lerp(aiPos.x, this.player.position.x, 8 * dt);
    }

    this.opponent.update(dt, { x: this.aiVelocity.x / aiSpeed, z: this.aiVelocity.y / aiSpeed }, this.ball.position);
  }

  private handleFloorBounce(pos: THREE.Vector3, vel: number) {
    if (this.status !== 'playing') return;

    this.particles.triggerShockwave(pos, vel > 8);

    if (this.mode === 'freestyle') {
      if (this.comboCount > 0) {
        sound.playWhistle(false);
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.lastSkillName = 'ตกพื้น! รีเซ็ตคอมโบ';
        this.broadcastState();
      }
      return;
    }

    // Official ISTAF 13.4m x 6.1m Court Boundaries
    const courtHalfW = 3.05;
    const courtHalfL = 6.7;
    const isInsideCourt = Math.abs(pos.x) <= courtHalfW && Math.abs(pos.z) <= courtHalfL;

    this.status = 'point_scored';
    sound.playWhistle(true);

    if (pos.z > 0) {
      if (isInsideCourt) {
        this.awardPoint('opponent', 'แต้มของคู่แข่ง! (ลูกลงแดนไทย)');
      } else {
        if (this.ball.lastHitter === 'opponent') {
          this.awardPoint('player', 'ลูกออกหลัง! ได้แต้ม');
        } else {
          this.awardPoint('opponent', 'ลูกออก! เสียแต้ม');
        }
      }
    } else {
      if (isInsideCourt) {
        this.awardPoint('player', 'ลูกลงแดนคู่แข่ง! สุดยอดแต้ม!');
      } else {
        if (this.ball.lastHitter === 'player') {
          this.awardPoint('opponent', 'ฟาดออกเส้น! เสียแต้ม');
        } else {
          this.awardPoint('player', 'คู่แข่งทำออก! ได้แต้ม');
        }
      }
    }
  }

  private awardPoint(scorer: 'player' | 'opponent', message: string) {
    this.lastSkillName = message;

    if (scorer === 'player') {
      this.playerScore++;
      sound.playScoreFanfare();
      sound.playCrowdCheer(true);
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#ffffff', '#ef4444', '#f59e0b'],
      });
    } else {
      this.opponentScore++;
      sound.playWhistle(false);
    }

    this.broadcastState();

    if (this.playerScore >= this.matchTargetScore && this.playerScore - this.opponentScore >= 2) {
      this.endMatch('player');
      return;
    } else if (this.opponentScore >= this.matchTargetScore && this.opponentScore - this.playerScore >= 2) {
      this.endMatch('opponent');
      return;
    }

    setTimeout(() => {
      if (this.status === 'point_scored') {
        this.prepareServe(scorer === 'player');
      }
    }, 1800);
  }

  private prepareServe(playerServes: boolean) {
    if (this.opponentServeTimer) {
      clearTimeout(this.opponentServeTimer);
      this.opponentServeTimer = null;
    }

    this.status = 'playing';
    this.isWaitingServe = true;
    this.serveTurn = playerServes ? 'player' : 'opponent';
    this.isPlayerServing = playerServes;
    this.playerTouches = 0;
    this.opponentTouches = 0;
    this.rallyCount = 0;

    this.playerVelocity.set(0, 0);
    this.aiVelocity.set(0, 0);

    if (playerServes) {
      // Player stands in official Tekong service circle (2.45m from baseline 6.7m = z 4.25)
      this.player.position.set(0, 0, 4.25);
      this.opponent.position.set(0, 0, -4.8);
      this.smoothBallTarget.set(0, 0, 4.25);
      this.smoothAiTarget.set(0, 0, -4.8);
      this.ball.reset(0.15, 1.35, 3.8);
      this.ball.velocity.set(0, 0, 0);
      this.lastSkillName = 'ตาคุณเสิร์ฟ! เลือกทิศ [ซ้าย/กลาง/ขวา] แล้วกด [เสิร์ฟ]';
    } else {
      // Opponent stands in official Tekong service circle
      this.opponent.position.set(0, 0, -4.25);
      this.player.position.set(0, 0, 4.8);
      this.smoothBallTarget.set(0, 0, 4.8);
      this.smoothAiTarget.set(0, 0, -4.25);
      this.ball.reset(-0.15, 1.35, -3.8);
      this.ball.velocity.set(0, 0, 0);
      this.lastSkillName = 'คู่แข่งเตรียมเสิร์ฟลูก...';

      // Schedule opponent serve after windup delay
      const serveDelay = this.difficulty === 'master' ? 950 : this.difficulty === 'hard' ? 1150 : 1350;
      this.opponentServeTimer = window.setTimeout(() => {
        if (this.isWaitingServe && this.serveTurn === 'opponent' && this.status === 'playing') {
          this.executeOpponentServe();
        }
      }, serveDelay);
    }

    this.broadcastState();
  }

  private endMatch(winner: 'player' | 'opponent') {
    this.status = 'game_over';
    this.winner = winner;
    if (winner === 'player') {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      });
      sound.playScoreFanfare();
      sound.playCrowdCheer(true);
    }
    this.broadcastState();
  }

  public setMode(mode: GameMode) {
    this.mode = mode;
    if (mode === 'freestyle') {
      this.particles.createFreestyleHoops(this.scene);
      this.playerScore = 0;
      this.comboCount = 0;
      this.comboMultiplier = 1;
    } else {
      this.particles.clearTargets(this.scene);
    }
    this.resetGame();
  }

  public setSkin(skin: 'traditional' | 'modern' | 'neon') {
    this.skin = skin;
    this.ball.setSkin(skin);
  }

  public setDifficulty(diff: Difficulty) {
    this.difficulty = diff;
    this.aiDecisionDelay = diff === 'master' ? 0.01 : diff === 'hard' ? 0.04 : diff === 'normal' ? 0.12 : 0.22;
    this.broadcastState();
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  public startGame() {
    this.status = 'playing';
    this.playerScore = 0;
    this.opponentScore = 0;
    this.playerTouches = 0;
    this.opponentTouches = 0;
    this.rallyCount = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.winner = null;

    if (this.mode === 'freestyle') {
      this.player.position.set(0, 0, 2.5);
      this.ball.reset(0, 2.8, 2.5);
      this.particles.createFreestyleHoops(this.scene);
      this.isWaitingServe = false;
    } else {
      this.prepareServe(true);
    }

    sound.playWhistle(true);
    this.broadcastState();
  }

  public resetGame() {
    if (this.opponentServeTimer) {
      clearTimeout(this.opponentServeTimer);
      this.opponentServeTimer = null;
    }
    this.status = 'menu';
    this.playerScore = 0;
    this.opponentScore = 0;
    this.winner = null;
    this.isWaitingServe = false;
    this.playerVelocity.set(0, 0);
    this.aiVelocity.set(0, 0);
    this.player.position.set(0, 0, 4.8);
    this.opponent.position.set(0, 0, -4.8);
    this.ball.reset(0, 2.5, 4.5);
    this.broadcastState();
  }

  public togglePause() {
    if (this.status === 'playing') {
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.status = 'playing';
    }
    this.broadcastState();
  }

  public toggleAutoRunAssist(): boolean {
    this.autoRunAssist = !this.autoRunAssist;
    this.broadcastState();
    return this.autoRunAssist;
  }

  public setAutoRunAssist(enabled: boolean) {
    this.autoRunAssist = enabled;
    this.broadcastState();
  }

  private broadcastState() {
    if (this.onStateChange) {
      this.onStateChange({
        mode: this.mode,
        status: this.status,
        difficulty: this.difficulty,
        playerScore: this.playerScore,
        opponentScore: this.opponentScore,
        playerTouches: this.playerTouches,
        opponentTouches: this.opponentTouches,
        rallyCount: this.rallyCount,
        comboCount: this.comboCount,
        comboMultiplier: this.comboMultiplier,
        lastSkillName: this.lastSkillName,
        isPlayerServing: this.isPlayerServing,
        isWaitingServe: this.isWaitingServe,
        serveTurn: this.serveTurn,
        serveAim: this.serveAim,
        winner: this.winner,
        highScore: this.highScore,
        matchTargetScore: this.matchTargetScore,
        autoRunAssist: this.autoRunAssist,
        isReadyToStrike: this.isReadyToStrike,
        spMeter: this.spMeter,
        isSpReady: this.spMeter >= 100,
        servePower: this.servePower,
        arcadeBanner: this.arcadeBanner,
        bannerType: this.bannerType,
      });
    }
  }

  private startLoop() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTime) * 0.001;
      this.lastTime = now;
      // Clamp frame delta time for stable 60fps simulation
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();

      this.reqId = requestAnimationFrame(tick);
    };
    this.reqId = requestAnimationFrame(tick);
  }

  private update(dt: number) {
    const time = performance.now() * 0.001;

    // Crowd animation
    this.arena.update(time, dt, this.rallyCount > 5 || this.comboCount > 4);

    // In Menu: cinematic smooth orbit camera
    if (this.status === 'menu') {
      const orbitSpeed = 0.25;
      const camX = Math.sin(time * orbitSpeed) * 8.5;
      const camZ = Math.cos(time * orbitSpeed) * 8.5;
      this.camera.position.set(camX, 4.2, camZ);
      this.camera.lookAt(0, 1.2, 0);

      // Keep ball gently bouncing in center
      this.ball.update(dt);
      if (this.ball.position.y <= this.ball.radius + 0.02) {
        this.ball.velocity.y = 5.2;
      }
      this.player.update(dt, { x: 0, z: 0 }, this.ball.position);
      return;
    }

    if (this.status === 'paused') {
      return;
    }

    // Hitstop freeze frame
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // 0. Manual Serve State: Ball hovers in front of server ready for strike
    if (this.isWaitingServe) {
      if (this.serveTurn === 'player') {
        this.servePower = (Math.sin(time * 4.2) * 0.5 + 0.5) * 100;
        this.ball.position.set(this.player.position.x + 0.15, 1.35 + Math.sin(time * 4) * 0.04, this.player.position.z - 0.45);
        this.ball.velocity.set(0, 0, 0);
      } else {
        this.ball.position.set(this.opponent.position.x - 0.15, 1.35 + Math.sin(time * 4) * 0.04, this.opponent.position.z + 0.45);
        this.ball.velocity.set(0, 0, 0);
      }
      this.ball.update(0);
      this.player.update(dt, { x: 0, z: 0 }, this.ball.position);
      this.opponent.update(dt, { x: 0, z: 0 }, this.ball.position);
      this.updateCamera(dt);
      this.broadcastState();
      return;
    }

    // Banner countdown
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.arcadeBanner = null;
        this.bannerType = null;
        this.broadcastState();
      }
    }

    // Post-serve recovery timer to prevent rushing into the net
    if (this.postServeTimer > 0) {
      this.postServeTimer -= dt;
    }

    // 1. Player movement controls (Continuous held keys + virtual joystick)
    const move = { x: 0, z: 0 };
    if (this.heldKeys['KeyA'] || this.heldKeys['ArrowLeft']) move.x -= 1;
    if (this.heldKeys['KeyD'] || this.heldKeys['ArrowRight']) move.x += 1;
    if (this.heldKeys['KeyW'] || this.heldKeys['ArrowUp']) move.z -= 1;
    if (this.heldKeys['KeyS'] || this.heldKeys['ArrowDown']) move.z += 1;

    // Combine with touch controls
    move.x += this.virtualMove.x;
    move.z += this.virtualMove.z;

    const manualInputLength = Math.hypot(move.x, move.z);
    const isManualInput = manualInputLength > 0.05;

    let finalMoveX = move.x;
    let finalMoveZ = move.z;

    // 2. Semi-Auto Run / Intercept Assist (ระบบวิ่งไปดักรับลูกแบบกึ่งอัตโนมัติ)
    if (this.autoRunAssist && this.status === 'playing' && this.player.currentAction !== 'serve') {
      const predicted = this.ball.getPredictedLanding();
      const isBallLive = this.ball.isInPlay;

      // Ball is heading to player side ONLY IF predicted landing is genuinely on player's half (z >= 0.4)
      // AND either ball is traveling towards player (velocity.z > 0.05) or opponent touched it,
      // or player juggled/set it into own court
      const isBallHeadedToPlayer =
        isBallLive &&
        predicted.z >= 0.4 &&
        (
          this.ball.velocity.z > 0.05 ||
          this.ball.lastHitter === 'opponent' ||
          (this.ball.lastHitter === 'player' && this.playerTouches < 3 && this.ball.position.z > 0.8 && this.ball.velocity.z >= -0.5)
        );

      if (isBallHeadedToPlayer && this.postServeTimer <= 0) {
        // Calculate optimal striking position (slightly behind landing point so character can kick cleanly)
        const targetX = THREE.MathUtils.clamp(predicted.x, -2.6, 2.6);
        // Ensure character does not run right into the net cords (min 1.15m from net for ground receiving)
        const targetZ = THREE.MathUtils.clamp(predicted.z + 0.35, 1.15, 6.2);

        const dx = targetX - this.player.position.x;
        const dz = targetZ - this.player.position.z;
        const dist = Math.hypot(dx, dz);

        if (!isManualInput) {
          // Player is not touching movement keys -> Jog automatically to intercept the ball!
          if (dist > 0.3) {
            const autoSpeedMultiplier = Math.min(1.0, dist * 1.5);
            finalMoveX = (dx / dist) * autoSpeedMultiplier;
            finalMoveZ = (dz / dist) * autoSpeedMultiplier;
          } else {
            finalMoveX = 0;
            finalMoveZ = 0;
          }
        } else {
          // Manual input is active -> Give gentle assist magnetic pull (35%) towards ball
          if (dist > 0.4) {
            const assistWeight = 0.35;
            finalMoveX = finalMoveX * (1 - assistWeight) + (dx / dist) * assistWeight;
            finalMoveZ = finalMoveZ * (1 - assistWeight) + (dz / dist) * assistWeight;
          }
        }
      } else if (!isManualInput) {
        // Ball is on opponent court, traveling away, or player is recovering from serve ->
        // Return or maintain athletic defensive backcourt position (z ≈ 4.15m), NEVER rush forward into the net!
        const defaultDefensiveZ = 4.15;
        const targetDefensiveX = THREE.MathUtils.clamp(this.ball.position.x * 0.35, -1.6, 1.6);
        const dz = defaultDefensiveZ - this.player.position.z;
        const dx = targetDefensiveX - this.player.position.x;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.35) {
          // Smoothly jog back to defensive ready position
          const returnSpeed = Math.min(0.7, dist * 0.85);
          finalMoveX = (dx / dist) * returnSpeed;
          finalMoveZ = (dz / dist) * returnSpeed;
        } else {
          finalMoveX = 0;
          finalMoveZ = 0;
        }
      }
    }

    // While performing serve animation, supporting foot stays anchored in service circle
    if (this.player.currentAction === 'serve') {
      finalMoveX = 0;
      finalMoveZ = 0;
    }

    // Normalize final movement vector
    const totalLen = Math.hypot(finalMoveX, finalMoveZ);
    if (totalLen > 1) {
      finalMoveX /= totalLen;
      finalMoveZ /= totalLen;
    }

    const playerSpeed = 5.6;
    this.player.position.x += finalMoveX * playerSpeed * dt;
    this.player.position.z += finalMoveZ * playerSpeed * dt;

    // Clamp player to official ISTAF court half (Width: 6.1m, Length: 13.4m)
    // Only allow player close to net (0.55m) if executing aerial spike or block
    const isNetAction =
      this.player.currentAction === 'block' ||
      this.player.currentAction === 'roll_spike' ||
      this.player.currentAction === 'super_roll_spike' ||
      this.player.currentAction === 'sunback';
    const minZ = isNetAction ? 0.55 : 1.15;
    const sideLimit = 2.7;
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -sideLimit, sideLimit);
    if (this.mode === 'freestyle') {
      this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, 0.8, 6.2);
    } else {
      this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, minZ, 6.3);
    }

    // Check if player is in prime strike range for visual HUD cue
    const distToBall = this.player.position.distanceTo(this.ball.position);
    this.isReadyToStrike = distToBall < 2.0 && this.ball.position.y >= 0.25 && this.ball.position.y <= 3.8;

    // Process buffered player actions
    this.tryExecutePlayerAction();

    // Update Player & Opponent
    this.player.update(dt, { x: finalMoveX, z: finalMoveZ }, this.ball.position);
    this.updateAI(dt);

    // Update Ball Physics
    this.ball.update(dt);

    // Update Particles
    this.particles.update(dt);

    // Update Camera
    this.updateCamera(dt);
  }

  private updateCamera(dt: number) {
    if (this.cameraMode === 'broadcast') {
      // ✦ Roll Spike Android Broadcast Camera: Dynamic side-view tracking net & ball ✦
      const ballZ = THREE.MathUtils.clamp(this.ball.position.z, -4.5, 4.5);
      this.cameraTargetPos.set(8.8, 4.5, ballZ * 0.35);
      this.cameraLookTarget.set(0, 1.4, ballZ * 0.6);
    } else if (this.cameraMode === 'aerial') {
      // Tactical top-down view - locked & stable
      this.cameraTargetPos.set(0, 14.5, 6.8);
      this.cameraLookTarget.set(0, 0, 0);
    } else {
      // Action View: Fixed stadium elevated viewpoint behind South baseline with subtle ball tracking
      const ballX = THREE.MathUtils.clamp(this.ball.position.x, -2.5, 2.5);
      this.cameraTargetPos.set(this.player.position.x * 0.25, 4.2, 10.2);
      this.cameraLookTarget.set(ballX * 0.18, 1.35, -0.4);
    }

    // Exponential damping for silky smooth camera transitions
    this.camera.position.lerp(this.cameraTargetPos, Math.min(1, 4 * dt));
    this.camera.lookAt(this.cameraLookTarget);

    // Screen Shake on impact
    if (this.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.0);
    }
  }

  private render() {
    this.renderer.render(this.scene, this.camera);
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public destroy() {
    if (this.reqId) cancelAnimationFrame(this.reqId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
