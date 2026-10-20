import * as THREE from 'three';

export type ActionType =
  | 'idle'
  | 'run'
  | 'inside_kick'
  | 'knee_bump'
  | 'header'
  | 'sunback'
  | 'roll_spike'
  | 'super_roll_spike'
  | 'block'
  | 'dive'
  | 'serve';

export interface CharacterConfig {
  jerseyColor: number;
  shortsColor: number;
  skinColor: number;
  headbandColor: number;
  jerseyNumber: string;
  isAI?: boolean;
}

// Safe angle interpolation avoiding ±π wrap-around spinning
function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * THREE.MathUtils.clamp(t, 0, 1);
}

export class TakrawPlayer {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public currentAction: ActionType = 'idle';
  public actionTimer: number = 0;
  public actionDuration: number = 0.45;
  public isAirborne: boolean = false;
  public facing: number = -1; // -1 faces North towards opponent, 1 faces South
  public config: CharacterConfig;

  // Seamless movement animation blending state
  private runPhase: number = 0;
  private moveBlend: number = 0;
  private bodyLeanX: number = 0;

  // Body parts for procedural animation
  private pelvis: THREE.Group;
  private torso: THREE.Group;
  private head: THREE.Group;
  private leftThigh: THREE.Group;
  private rightThigh: THREE.Group;
  private leftShin: THREE.Group;
  private rightShin: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private shadowPlane: THREE.Mesh;

  constructor(scene: THREE.Scene, config: CharacterConfig) {
    this.config = config;
    this.group = new THREE.Group();

    // 1. Pelvis / Hip root
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.95;
    this.group.add(this.pelvis);

    // Shared PBR materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: config.skinColor,
      roughness: 0.55,
      metalness: 0.05,
    });

    const jerseyMat = new THREE.MeshStandardMaterial({
      color: config.jerseyColor,
      roughness: 0.4,
      metalness: 0.08,
    });

    const shortsMat = new THREE.MeshStandardMaterial({
      color: config.shortsColor,
      roughness: 0.45,
      metalness: 0.05,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });

    // 2. Smooth Contoured Torso (No sharp boxy edges!)
    this.torso = new THREE.Group();
    this.torso.position.y = 0.32;

    // Athletic chest & abdomen (smooth cylinder with 24 radial segments)
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.19, 0.54, 24);
    const torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
    torsoMesh.castShadow = true;
    this.torso.add(torsoMesh);

    // Rounded shoulders (capsules/spheres on left & right)
    const shoulderGeo = new THREE.SphereGeometry(0.095, 16, 16);
    const leftShoulder = new THREE.Mesh(shoulderGeo, jerseyMat);
    leftShoulder.position.set(-0.25, 0.22, 0);
    leftShoulder.castShadow = true;

    const rightShoulder = new THREE.Mesh(shoulderGeo, jerseyMat);
    rightShoulder.position.set(0.25, 0.22, 0);
    rightShoulder.castShadow = true;
    this.torso.add(leftShoulder, rightShoulder);

    // V-neck jersey collar ring
    const collarGeo = new THREE.TorusGeometry(0.11, 0.018, 12, 24);
    collarGeo.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeo, trimMat);
    collarMesh.position.set(0, 0.28, 0.02);
    this.torso.add(collarMesh);

    this.pelvis.add(this.torso);

    // 3. Smooth Athletic Shorts
    const shortsGroup = new THREE.Group();
    shortsGroup.position.y = 0.02;

    // Pelvis shorts base (rounded tapered cylinder)
    const hipGeo = new THREE.CylinderGeometry(0.21, 0.23, 0.22, 24);
    const hipMesh = new THREE.Mesh(hipGeo, shortsMat);
    hipMesh.castShadow = true;
    shortsGroup.add(hipMesh);

    // Left and Right shorts leg cuffs
    const cuffGeo = new THREE.CylinderGeometry(0.12, 0.125, 0.18, 20);
    const leftCuff = new THREE.Mesh(cuffGeo, shortsMat);
    leftCuff.position.set(-0.14, -0.09, 0);
    leftCuff.castShadow = true;

    const rightCuff = new THREE.Mesh(cuffGeo, shortsMat);
    rightCuff.position.set(0.14, -0.09, 0);
    rightCuff.castShadow = true;

    // White racing stripes along the sides of the shorts
    const stripeGeo = new THREE.BoxGeometry(0.015, 0.22, 0.24);
    const leftStripe = new THREE.Mesh(stripeGeo, trimMat);
    leftStripe.position.set(-0.22, -0.02, 0);
    const rightStripe = new THREE.Mesh(stripeGeo, trimMat);
    rightStripe.position.set(0.22, -0.02, 0);
    shortsGroup.add(leftCuff, rightCuff, leftStripe, rightStripe);

    this.pelvis.add(shortsGroup);

    // 4. Smooth Stylized Athletic Head & Headband
    this.head = new THREE.Group();
    this.head.position.y = 0.84;

    // High-poly smooth head (32 x 28 segments)
    const headGeo = new THREE.SphereGeometry(0.185, 32, 28);
    headGeo.scale(1, 1.14, 1.05);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    // Stylized facial features: Eyes & Eyebrows for life and charisma
    const eyeGeo = new THREE.SphereGeometry(0.025, 12, 12);
    eyeGeo.scale(1, 0.7, 0.5);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.065, 0.02, 0.17);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.065, 0.02, 0.17);
    this.head.add(leftEye, rightEye);

    // Headband / Mongkhon (high-poly smooth torus)
    const bandGeo = new THREE.TorusGeometry(0.188, 0.026, 16, 32);
    bandGeo.rotateX(Math.PI / 2);
    const bandMat = new THREE.MeshStandardMaterial({
      color: config.headbandColor,
      roughness: 0.35,
      metalness: 0.2,
    });
    const bandMesh = new THREE.Mesh(bandGeo, bandMat);
    bandMesh.position.y = 0.065;
    this.head.add(bandMesh);

    // Contoured athletic modern hair
    const hairGeo = new THREE.SphereGeometry(0.192, 24, 20);
    hairGeo.scale(1.02, 0.72, 1.06);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x181412, roughness: 0.85 });
    const hairMesh = new THREE.Mesh(hairGeo, hairMat);
    hairMesh.position.set(0, 0.11, -0.02);
    hairMesh.castShadow = true;
    this.head.add(hairMesh);

    this.pelvis.add(this.head);

    // 5. Smooth Articulated Arms
    const sleeveGeo = new THREE.CylinderGeometry(0.082, 0.076, 0.16, 20);
    const limbGeo = new THREE.CylinderGeometry(0.062, 0.052, 0.52, 20);
    limbGeo.translate(0, -0.26, 0);

    // Left Arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.31, 0.52, 0);
    const leftSleeve = new THREE.Mesh(sleeveGeo, jerseyMat);
    leftSleeve.position.y = -0.06;
    const leftArmMesh = new THREE.Mesh(limbGeo, skinMat);
    leftArmMesh.castShadow = true;
    this.leftArm.add(leftSleeve, leftArmMesh);
    this.pelvis.add(this.leftArm);

    // Right Arm
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.31, 0.52, 0);
    const rightSleeve = new THREE.Mesh(sleeveGeo, jerseyMat);
    rightSleeve.position.y = -0.06;
    const rightArmMesh = new THREE.Mesh(limbGeo, skinMat);
    rightArmMesh.castShadow = true;
    this.rightArm.add(rightSleeve, rightArmMesh);
    this.pelvis.add(this.rightArm);

    // 6. Smooth Contoured Legs & Aerodynamic Sneakers
    const thighGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.44, 20);
    thighGeo.translate(0, -0.22, 0);
    const shinGeo = new THREE.CylinderGeometry(0.072, 0.058, 0.46, 20);
    shinGeo.translate(0, -0.23, 0);

    // Smooth Aerodynamic Takraw Sneaker
    const shoeGroup = new THREE.Group();

    // Curved Upper Shoe Body (Capsule geometry)
    const shoeBodyGeo = new THREE.CapsuleGeometry(0.068, 0.16, 12, 16);
    shoeBodyGeo.rotateX(Math.PI / 2);
    const shoeUpper = new THREE.Mesh(
      shoeBodyGeo,
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
    );
    shoeUpper.position.set(0, -0.03, 0.06);
    shoeUpper.castShadow = true;

    // Curved Amber Gum Rubber Sole
    const soleGeo = new THREE.CylinderGeometry(0.076, 0.082, 0.036, 20);
    soleGeo.scale(1, 1, 1.6);
    const shoeSole = new THREE.Mesh(
      soleGeo,
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 }) // Amber gum sole
    );
    shoeSole.position.set(0, -0.088, 0.06);
    shoeGroup.add(shoeUpper, shoeSole);

    // Left Leg
    this.leftThigh = new THREE.Group();
    this.leftThigh.position.set(-0.15, -0.08, 0);
    const leftThighMesh = new THREE.Mesh(thighGeo, skinMat);
    leftThighMesh.castShadow = true;
    this.leftThigh.add(leftThighMesh);

    this.leftShin = new THREE.Group();
    this.leftShin.position.set(0, -0.42, 0);
    const leftShinMesh = new THREE.Mesh(shinGeo, skinMat);
    leftShinMesh.castShadow = true;
    const leftShoe = shoeGroup.clone();
    leftShoe.position.y = -0.44;
    this.leftShin.add(leftShinMesh, leftShoe);
    this.leftThigh.add(this.leftShin);
    this.pelvis.add(this.leftThigh);

    // Right Leg (Primary Kicking Leg)
    this.rightThigh = new THREE.Group();
    this.rightThigh.position.set(0.15, -0.08, 0);
    const rightThighMesh = new THREE.Mesh(thighGeo, skinMat);
    rightThighMesh.castShadow = true;
    this.rightThigh.add(rightThighMesh);

    this.rightShin = new THREE.Group();
    this.rightShin.position.set(0, -0.42, 0);
    const rightShinMesh = new THREE.Mesh(shinGeo, skinMat);
    rightShinMesh.castShadow = true;
    const rightShoe = shoeGroup.clone();
    rightShoe.position.y = -0.44;
    this.rightShin.add(rightShinMesh, rightShoe);
    this.rightThigh.add(this.rightShin);
    this.pelvis.add(this.rightThigh);

    // 7. Ground Contact Shadow (Elevated cleanly above court to prevent z-fighting)
    const shadowGeo = new THREE.CircleGeometry(0.48, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = 0.045; // Elevated flush over court (y=0.04)
    this.group.add(this.shadowPlane);

    scene.add(this.group);
  }

  public triggerAction(action: ActionType, duration: number = 0.5) {
    this.currentAction = action;
    this.actionTimer = 0;
    this.actionDuration = duration;
  }

  public update(dt: number, moveDir: { x: number; z: number }, ballPos?: THREE.Vector3) {
    // 1. Position update
    this.group.position.copy(this.position);

    // 2. Action progress
    if (this.currentAction !== 'idle' && this.currentAction !== 'run') {
      this.actionTimer += dt;
      if (this.actionTimer >= this.actionDuration) {
        this.currentAction = 'idle';
        this.actionTimer = 0;
        this.isAirborne = false;
        this.pelvis.position.y = 0.95;
        this.pelvis.rotation.set(0, 0, 0);
      }
    }

    const t = this.actionTimer / (this.actionDuration || 0.45);
    const speed = Math.hypot(moveDir.x, moveDir.z);
    const isMoving = speed > 0.04;

    // Smooth movement blend weight (0 = idle, 1 = moving)
    const targetBlend = isMoving ? Math.min(1.0, speed) : 0;
    this.moveBlend = THREE.MathUtils.lerp(this.moveBlend, targetBlend, 12 * dt);

    // Continuous footstep phase accumulator - proportional to real movement speed
    if (isMoving) {
      const stepFreq = 9.5 * Math.max(0.3, Math.min(1.2, speed));
      this.runPhase += dt * stepFreq;
    }

    // Face towards net or ball with wrap-around safe angle interpolation
    if (this.currentAction === 'idle' || this.currentAction === 'run') {
      if (ballPos) {
        const dx = ballPos.x - this.position.x;
        const dy = ballPos.y - 1.6;
        const dz = ballPos.z - this.position.z;
        const targetAngle = Math.atan2(dx, dz);
        this.group.rotation.y = lerpAngle(this.group.rotation.y, targetAngle, 8.5 * dt);

        // Head tracks ball elevation realistically!
        const dist = Math.hypot(dx, dz);
        const pitch = THREE.MathUtils.clamp(Math.atan2(dy, dist), -0.4, 0.85);
        this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, -pitch, 10 * dt);
      } else {
        const targetRot = this.facing === -1 ? Math.PI : 0;
        this.group.rotation.y = lerpAngle(this.group.rotation.y, targetRot, 8.5 * dt);
        this.head.rotation.x = THREE.MathUtils.lerp(this.head.rotation.x, 0, 8 * dt);
      }
    }

    // 3. Animation state machine
    if (this.currentAction === 'roll_spike' || this.currentAction === 'super_roll_spike') {
      // ✦ ICONIC ROLL SPIKE (ฟาดม้วนตัว 360° กลางอากาศ - ROLL SPIKE HALLMARK) ✦
      this.isAirborne = true;
      const isSuper = this.currentAction === 'super_roll_spike';
      const jumpApex = isSuper ? 2.3 : 1.95;
      const jumpY = Math.sin(t * Math.PI) * jumpApex;
      this.pelvis.position.y = 0.95 + jumpY;

      // Acrobatic 360° mid-air lateral barrel-roll flip
      const rollAngle = t * Math.PI * 2;
      this.pelvis.rotation.y = this.facing === -1 ? Math.PI + rollAngle : rollAngle;
      this.pelvis.rotation.z = Math.sin(t * Math.PI) * 1.35;
      this.pelvis.rotation.x = -Math.sin(t * Math.PI) * 1.15;

      // Vicious overhead instep whip
      const whip = Math.sin(t * Math.PI);
      this.rightThigh.rotation.x = -Math.PI * 0.92 * whip;
      this.rightThigh.rotation.y = 0.3 * whip;
      this.rightShin.rotation.x = Math.PI * 0.65 * (1 - whip);
      this.leftThigh.rotation.x = Math.PI * 0.45 * whip;
      this.leftShin.rotation.x = Math.PI * 0.5 * whip;

      this.leftArm.rotation.z = -1.4;
      this.rightArm.rotation.z = 1.4;

      this.shadowPlane.scale.setScalar(Math.max(0.25, 1 - jumpY * 0.32));
      (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 0.38 - jumpY * 0.14);

    } else if (this.currentAction === 'sunback') {
      // ✦ ACROBATIC SUNBACK SPIKE (ฟาดซันแบ็ค) ✦
      this.isAirborne = true;
      const jumpApex = 1.65;
      const jumpY = Math.sin(t * Math.PI) * jumpApex;
      this.pelvis.position.y = 0.95 + jumpY;

      // Full acrobatic back-roll rotation
      const flipAngle = t * Math.PI * 2;
      this.pelvis.rotation.x = -flipAngle;
      this.pelvis.rotation.z = Math.sin(t * Math.PI) * 0.35;

      // Kicking leg whips overhead
      const kickWhip = Math.sin(t * Math.PI);
      this.rightThigh.rotation.x = -Math.PI * 0.8 * kickWhip;
      this.rightShin.rotation.x = Math.PI * 0.7 * (1 - kickWhip);
      this.leftThigh.rotation.x = Math.PI * 0.3 * kickWhip;

      this.leftArm.rotation.z = -1.2;
      this.rightArm.rotation.z = 1.2;

      this.shadowPlane.scale.setScalar(Math.max(0.3, 1 - jumpY * 0.35));
      (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.38 - jumpY * 0.15);

    } else if (this.currentAction === 'block') {
      // ✦ JUMP NET BLOCK (บล็อกหน้าตาข่าย - ยกขาบล็อกหน้าเน็ต) ✦
      this.isAirborne = true;
      const jumpApex = 1.45;
      const jumpY = Math.sin(t * Math.PI) * jumpApex;
      this.pelvis.position.y = 0.95 + jumpY;

      this.pelvis.rotation.set(0, 0, 0);
      this.torso.rotation.set(-0.15, 0, 0);

      // Raise right leg straight up vertically above net tape to form an impenetrable wall!
      const blockPhase = Math.sin(t * Math.PI);
      this.rightThigh.rotation.x = -Math.PI * 0.88 * blockPhase;
      this.rightShin.rotation.x = 0.15 * (1 - blockPhase);
      this.leftThigh.rotation.x = 0.35 * blockPhase;
      this.leftShin.rotation.x = 0.8 * blockPhase;

      // Wide outstretched arms for balance
      this.leftArm.rotation.z = -1.3 * blockPhase;
      this.rightArm.rotation.z = 1.3 * blockPhase;

      this.shadowPlane.scale.setScalar(Math.max(0.3, 1 - jumpY * 0.35));
      (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 0.38 - jumpY * 0.15);

    } else if (this.currentAction === 'dive') {
      // ✦ EMERGENCY DIVE / SLIDE DIG (พุ่งสไลด์รับลูก) ✦
      const slidePhase = Math.sin(t * Math.PI);
      this.pelvis.position.y = 0.42 + (1 - slidePhase) * 0.3;
      this.torso.rotation.x = 1.28 * slidePhase; // Prone horizontal slide
      this.head.rotation.x = -0.75 * slidePhase; // Lift head to track ball

      // Arms extended forward to cushion and scoop ball up
      this.leftArm.rotation.x = -1.45 * slidePhase;
      this.rightArm.rotation.x = -1.45 * slidePhase;
      this.leftArm.rotation.z = -0.2;
      this.rightArm.rotation.z = 0.2;

      // Trailing legs
      this.leftThigh.rotation.x = 0.9 * slidePhase;
      this.rightThigh.rotation.x = 1.05 * slidePhase;
      this.leftShin.rotation.x = 0.3 * slidePhase;
      this.rightShin.rotation.x = 0.3 * slidePhase;

      this.shadowPlane.scale.set(1.5, 0.8, 1);
      (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = 0.45;

    } else if (this.currentAction === 'inside_kick') {
      // ✦ INSIDE KICK (ลูกแป) ✦
      const kickPhase = Math.sin(t * Math.PI);
      this.rightThigh.rotation.x = -1.1 * kickPhase;
      this.rightThigh.rotation.y = 1.2 * kickPhase; // Turn inside foot outward
      this.rightThigh.rotation.z = 0.3 * kickPhase;
      this.rightShin.rotation.x = 0.9 * kickPhase;

      this.leftThigh.rotation.x = 0.2 * kickPhase;
      this.pelvis.position.y = 0.95 - 0.08 * kickPhase;

      this.leftArm.rotation.x = 0.5 * kickPhase;
      this.rightArm.rotation.x = -0.7 * kickPhase;

      this.shadowPlane.scale.setScalar(1);
      (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = 0.38;

    } else if (this.currentAction === 'knee_bump') {
      // ✦ KNEE BUMP (ลูกเข่า / ลูกยก) ✦
      const kneePhase = Math.sin(t * Math.PI);
      this.rightThigh.rotation.x = -1.55 * kneePhase;
      this.rightThigh.rotation.y = 0;
      this.rightShin.rotation.x = 1.6 * kneePhase;

      this.pelvis.position.y = 0.95 - 0.05 * kneePhase;
      this.leftArm.rotation.z = -0.6 * kneePhase;
      this.rightArm.rotation.z = 0.6 * kneePhase;

    } else if (this.currentAction === 'header') {
      // ✦ HEADER (ลูกโหม่ง) ✦
      const headPhase = Math.sin(t * Math.PI);
      this.pelvis.position.y = 0.95 + 0.4 * headPhase;
      this.head.rotation.x = -0.6 * headPhase;
      this.torso.rotation.x = -0.3 * headPhase;
      this.leftThigh.rotation.x = -0.3 * headPhase;
      this.rightThigh.rotation.x = -0.3 * headPhase;

    } else if (this.currentAction === 'serve') {
      // ✦ AUTHENTIC TEKONG HORSE-KICK SERVE (ลูกเสิร์ฟหลังเท้าตะกร้อ) ✦
      const servePhase = Math.sin(t * Math.PI);
      const isWindup = t < 0.4;
      const strikePhase = isWindup ? t / 0.4 : (1 - (t - 0.4) / 0.6);

      // Deep athletic arch and high leg extension
      this.pelvis.position.y = 0.95 + 0.3 * servePhase;
      this.torso.rotation.x = -0.45 * servePhase;
      this.torso.rotation.y = 0.35 * servePhase;

      // Kicking leg whip
      this.rightThigh.rotation.x = -Math.PI * 0.72 * servePhase;
      this.rightThigh.rotation.y = 0.3 * servePhase;
      this.rightShin.rotation.x = isWindup ? 1.0 * strikePhase : -0.2 * strikePhase;

      // Plant leg (supporting foot)
      this.leftThigh.rotation.x = 0.22 * servePhase;

      // Balancing arms outstretched
      this.leftArm.rotation.z = -1.1 * servePhase;
      this.leftArm.rotation.x = 0.5 * servePhase;
      this.rightArm.rotation.z = 1.1 * servePhase;
      this.rightArm.rotation.x = -0.5 * servePhase;

    } else {
      // ✦ SEAMLESS BLEND: ATHLETIC IDLE <-> FLUID TAKRAW FOOTWORK (เดินเข้า-ออกหาลูกเนียนตา) ✦
      const w = this.moveBlend; // 0 = full idle ready bounce, 1 = full movement

      // 1. Idle bounce components (softens as player starts moving)
      const idleTime = performance.now() * 0.001 * 3.5;
      const idleBounce = Math.sin(idleTime) * 0.02 * (1 - w);

      // 2. Continuous footstep cycle driven by speed-accumulated runPhase
      const legSwing = Math.sin(this.runPhase) * 0.62 * w;
      const armSwing = -legSwing * 0.58;
      const stepBounce = Math.abs(Math.sin(this.runPhase * 2)) * 0.038 * w;

      // 3. Athletic torso lean: banks subtly into lateral movement & tilts into approach/backpedal
      this.bodyLeanX = THREE.MathUtils.lerp(this.bodyLeanX, -moveDir.x * 0.12 * w, 10 * dt);
      const forwardLean = (moveDir.z * this.facing > 0 ? 0.09 : 0.03) * w;

      this.pelvis.position.y = 0.95 + idleBounce + stepBounce;
      this.pelvis.rotation.set(0, 0, 0);
      this.torso.rotation.set(forwardLean, 0, this.bodyLeanX);

      // 4. Smoothly blended leg motions (no popping or snapping on stop/start)
      this.leftThigh.rotation.set(
        THREE.MathUtils.lerp(0.08, legSwing, w),
        0.08 * (1 - w),
        -0.04 * (1 - w)
      );
      this.rightThigh.rotation.set(
        THREE.MathUtils.lerp(0.08, -legSwing, w),
        -0.08 * (1 - w),
        0.04 * (1 - w)
      );

      this.leftShin.rotation.set(
        THREE.MathUtils.lerp(0.08, Math.max(0, -legSwing * 0.72), w),
        0,
        0
      );
      this.rightShin.rotation.set(
        THREE.MathUtils.lerp(0.08, Math.max(0, legSwing * 0.72), w),
        0,
        0
      );

      // 5. Athletic balancing arms
      this.leftArm.rotation.set(
        THREE.MathUtils.lerp(0.12, armSwing, w),
        0,
        THREE.MathUtils.lerp(-0.18, -0.26, w)
      );
      this.rightArm.rotation.set(
        THREE.MathUtils.lerp(0.12, -armSwing, w),
        0,
        THREE.MathUtils.lerp(0.18, 0.26, w)
      );

      this.shadowPlane.scale.setScalar(1);
      (this.shadowPlane.material as THREE.MeshBasicMaterial).opacity = 0.38;
    }
  }

  public getKickingPosition(): THREE.Vector3 {
    const offset = new THREE.Vector3(0.2, 0.6, this.facing * 0.4);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
    return this.position.clone().add(offset);
  }
}
