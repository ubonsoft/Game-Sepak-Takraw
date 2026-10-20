import * as THREE from 'three';
import { createRattanTexture, createReticleTexture } from './textures.ts';
import { sound } from './audio.ts';

export interface BallContactCallback {
  onFloorBounce: (pos: THREE.Vector3, vel: number) => void;
  onNetHit: () => void;
}

export class TakrawBall {
  public mesh: THREE.Mesh;
  public group: THREE.Group;
  public shadowMesh: THREE.Mesh;
  public trailMesh: THREE.Line;
  public position: THREE.Vector3 = new THREE.Vector3(0, 2.5, 3.5);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public radius: number = 0.22; // Scaled for visible 3D readability (~22cm)
  public lastHitter: 'player' | 'opponent' | null = null;
  public touchCount: number = 0;
  public isInPlay: boolean = true;
  public isSmash: boolean = false;
  public isSuperSpike: boolean = false;

  private squashScale = new THREE.Vector3(1, 1, 1);
  private targetScale = new THREE.Vector3(1, 1, 1);
  private trailPositions: THREE.Vector3[] = [];
  private trailMax = 18;
  private trailGeometry: THREE.BufferGeometry;
  private callbacks: BallContactCallback;

  // Physics constants (tuned for floaty athletic arc with generous hang-time)
  private readonly gravity = -8.8; // Floatier, comfortable reaction time
  private readonly floorRestitution = 0.68; // Controlled rattan bounce
  private readonly airDrag = 0.988;
  private readonly courtSurfaceY = 0.035;

  constructor(scene: THREE.Scene, callbacks: BallContactCallback, skin: 'traditional' | 'modern' | 'neon' = 'traditional') {
    this.callbacks = callbacks;
    this.group = new THREE.Group();

    // 1. Procedural Rattan Ball Mesh
    const ballGeo = new THREE.SphereGeometry(this.radius, 32, 24);
    const ballTex = createRattanTexture(skin);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      roughness: 0.55,
      metalness: skin === 'neon' ? 0.4 : 0.08,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });
    this.mesh = new THREE.Mesh(ballGeo, ballMat);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    // 2. Floor Landing Reticle & Contact Shadow
    const reticleTex = createReticleTexture();
    const reticleGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const reticleMat = new THREE.MeshBasicMaterial({
      map: reticleTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(reticleGeo, reticleMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.042; // Sits cleanly over court (y=0.035)
    this.group.add(this.shadowMesh);

    // 3. Roll Spike Speed Trail (Fiery Gold / Red)
    this.trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(this.trailMax * 3);
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
    });
    this.trailMesh = new THREE.Line(this.trailGeometry, trailMat);
    this.trailMesh.frustumCulled = false;
    scene.add(this.trailMesh);

    scene.add(this.group);
    this.reset(0, 2.5, 4.5);
  }

  public setSkin(skin: 'traditional' | 'modern' | 'neon') {
    const ballTex = createRattanTexture(skin);
    (this.mesh.material as THREE.MeshStandardMaterial).map = ballTex;
    (this.mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }

  public reset(x: number, y: number, z: number) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.isSmash = false;
    this.isSuperSpike = false;
    this.lastHitter = null;
    this.touchCount = 0;
    this.isInPlay = true;
    this.squashScale.set(1, 1, 1);
    this.trailPositions = [];
    if (this.mesh && this.mesh.material) {
      const mat = this.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
    this.updateTransform();
  }

  public launchServe(fromZ: number, targetZ: number, archHeight: number = 3.6) {
    this.reset(0, 1.2, fromZ);
    const dz = targetZ - fromZ;
    // Slower, graceful arc giving the player ample time to read the shot
    const time = 1.6;
    this.velocity.x = (Math.random() - 0.5) * 0.8;
    this.velocity.z = dz / time;
    this.velocity.y = archHeight + 2.0;
    this.isInPlay = true;
    sound.playKick('instep', 0.8);
  }

  public applyKick(
    impulse: THREE.Vector3,
    type: 'inside' | 'instep' | 'knee' | 'header' | 'sunback' | 'roll_spike' | 'super_spike' | 'block' | 'dive',
    hitter: 'player' | 'opponent'
  ) {
    this.velocity.copy(impulse);
    this.lastHitter = hitter;
    this.isSmash = type === 'sunback' || type === 'roll_spike' || type === 'super_spike';
    this.isSuperSpike = type === 'super_spike';

    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    const trailMat = this.trailMesh.material as THREE.LineBasicMaterial;

    if (this.isSuperSpike) {
      mat.emissive.setHex(0xff3300);
      mat.emissiveIntensity = 0.9;
      trailMat.color.setHex(0xff1100);
      trailMat.opacity = 0.95;
      this.squashScale.set(0.55, 1.45, 0.55);
      sound.playKick('super_spike', 1.4);
    } else if (this.isSmash) {
      mat.emissive.setHex(0xf59e0b);
      mat.emissiveIntensity = 0.4;
      trailMat.color.setHex(0xf59e0b);
      trailMat.opacity = 0.8;
      this.squashScale.set(0.65, 1.35, 0.65);
      sound.playKick(type === 'roll_spike' ? 'roll_spike' : 'sunback', 1.2);
    } else {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      this.squashScale.set(0.82, 1.18, 0.82);
      sound.playKick(type, 0.8);
    }
  }

  public update(dt: number) {
    const floorLimit = this.courtSurfaceY + this.radius;
    if (!this.isInPlay && this.position.y <= floorLimit + 0.01) {
      // Resting on court
      this.velocity.set(0, 0, 0);
      this.updateTransform();
      return;
    }

    // Gravity & Drag
    this.velocity.y += this.gravity * dt;
    this.velocity.x *= Math.pow(this.airDrag, dt * 60);
    this.velocity.z *= Math.pow(this.airDrag, dt * 60);

    // Apply Velocity
    const prevZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Net Collision (Net at Z = 0, Width = 6.7m, Height = 1.55m)
    const netHalfWidth = 3.35;
    const netTop = 1.55 + this.courtSurfaceY;
    const crossedZ = (prevZ > 0 && this.position.z <= 0) || (prevZ < 0 && this.position.z >= 0);

    if (crossedZ && Math.abs(this.position.x) <= netHalfWidth && this.position.y <= netTop + this.radius) {
      if (this.position.y >= netTop - 0.1) {
        this.velocity.y = Math.abs(this.velocity.y) * 0.4 + 1.2;
        this.velocity.z = -this.velocity.z * 0.35;
      } else {
        this.position.z = prevZ > 0 ? 0.08 : -0.08;
        this.velocity.z = -this.velocity.z * 0.3;
        this.velocity.x *= 0.5;
      }
      this.isSmash = false;
      this.callbacks.onNetHit();
      sound.playNetHit();
    }

    // Floor Collision
    if (this.position.y <= floorLimit) {
      this.position.y = floorLimit;
      const speed = Math.abs(this.velocity.y);

      if (speed > 1.0) {
        this.velocity.y = speed * this.floorRestitution;
        this.velocity.x *= 0.82;
        this.velocity.z *= 0.82;
        this.squashScale.set(1.22, 0.75, 1.22);
        this.callbacks.onFloorBounce(this.position.clone(), speed);
        sound.playBounce(speed / 8);
      } else {
        this.velocity.y = 0;
        this.velocity.x *= 0.75;
        this.velocity.z *= 0.75;
        if (Math.abs(this.velocity.x) < 0.1 && Math.abs(this.velocity.z) < 0.1) {
          this.isInPlay = false;
        }
      }
      this.isSmash = false;
    }

    // Ball Spin Rotation based on ground velocity & flight
    const spinSpeed = 2.5;
    this.mesh.rotation.x += this.velocity.z * dt * spinSpeed;
    this.mesh.rotation.z -= this.velocity.x * dt * spinSpeed;
    this.mesh.rotation.y += (this.velocity.x + this.velocity.z) * dt * 0.5;

    // Smoothly restore squash and stretch
    this.squashScale.lerp(this.targetScale, 10 * dt);
    this.mesh.scale.copy(this.squashScale);

    // Update Trail
    this.updateTrail();

    // Update transforms
    this.updateTransform();
  }

  private updateTrail() {
    const speed = this.velocity.length();
    if (this.isSmash && speed > 9.0) {
      this.trailPositions.unshift(this.position.clone());
      if (this.trailPositions.length > this.trailMax) {
        this.trailPositions.pop();
      }
    } else {
      if (this.trailPositions.length > 0) {
        this.trailPositions.pop();
      }
    }

    const posArray = this.trailGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < this.trailMax; i++) {
      if (i < this.trailPositions.length) {
        posArray[i * 3] = this.trailPositions[i].x;
        posArray[i * 3 + 1] = this.trailPositions[i].y;
        posArray[i * 3 + 2] = this.trailPositions[i].z;
      } else {
        posArray[i * 3] = this.position.x;
        posArray[i * 3 + 1] = this.position.y;
        posArray[i * 3 + 2] = this.position.z;
      }
    }
    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  private updateTransform() {
    this.mesh.position.copy(this.position);

    // Reticle stays on floor directly beneath ball
    this.shadowMesh.position.x = this.position.x;
    this.shadowMesh.position.z = this.position.z;

    // Reticle scale & opacity change with height (tighter and brighter when close to landing)
    const height = Math.max(0, this.position.y - this.radius);
    const scale = Math.max(0.4, Math.min(1.8, 0.5 + height * 0.18));
    this.shadowMesh.scale.set(scale, scale, 1);

    const opacity = Math.max(0.2, Math.min(0.9, 1.0 - height * 0.12));
    (this.shadowMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }

  /**
   * Calculates estimated landing position on floor (y = radius)
   */
  public getPredictedLanding(): THREE.Vector3 {
    const currentY = this.position.y - this.radius;
    const vy = this.velocity.y;
    const g = this.gravity;

    // y(t) = currentY + vy*t + 0.5*g*t^2 = 0
    // 0.5*g*t^2 + vy*t + currentY = 0
    const a = 0.5 * g;
    const b = vy;
    const c = currentY;
    const discriminant = b * b - 4 * a * c;

    let timeToGround = 0.5;
    if (discriminant >= 0) {
      const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
      const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
      timeToGround = Math.max(t1, t2);
      if (timeToGround < 0) timeToGround = 0.5;
    }

    return new THREE.Vector3(
      this.position.x + this.velocity.x * timeToGround,
      0,
      this.position.z + this.velocity.z * timeToGround
    );
  }
}
