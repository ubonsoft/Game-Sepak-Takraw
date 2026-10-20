import * as THREE from 'three';

export interface FloatingTarget {
  group: THREE.Group;
  position: THREE.Vector3;
  radius: number;
  points: number;
  isActive: boolean;
}

export class ParticleSystem {
  public group: THREE.Group;
  private sparkPoints: THREE.Points;
  private sparkCount = 80;
  private sparkPositions: Float32Array;
  private sparkVelocities: Float32Array;
  private sparkLifetimes: Float32Array;

  // Expanding impact rings
  private rings: THREE.Mesh[] = [];

  // Floating targets for Freestyle mode
  public targets: FloatingTarget[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();

    // 1. Spark Particles
    const sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.sparkCount * 3);
    this.sparkVelocities = new Float32Array(this.sparkCount * 3);
    this.sparkLifetimes = new Float32Array(this.sparkCount);

    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));

    // Create glowing spark texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 200, 50, 0.9)');
    grad.addColorStop(0.8, 'rgba(255, 100, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const sparkTex = new THREE.CanvasTexture(canvas);

    const sparkMat = new THREE.PointsMaterial({
      map: sparkTex,
      size: 0.35,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.group.add(this.sparkPoints);

    // 2. Pre-create 6 impact rings
    const ringGeo = new THREE.RingGeometry(0.1, 0.22, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffb703,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMat.clone());
      ring.visible = false;
      this.rings.push(ring);
      this.group.add(ring);
    }

    scene.add(this.group);
  }

  public burstSparks(origin: THREE.Vector3, count: number = 24, isHeavy: boolean = false, sparkColor?: string) {
    let spawned = 0;
    for (let i = 0; i < this.sparkCount; i++) {
      if (this.sparkLifetimes[i] <= 0) {
        this.sparkPositions[i * 3] = origin.x;
        this.sparkPositions[i * 3 + 1] = origin.y;
        this.sparkPositions[i * 3 + 2] = origin.z;

        const speed = (isHeavy ? 6.5 : 3.5) * (0.6 + Math.random() * 0.8);
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI;

        this.sparkVelocities[i * 3] = Math.cos(theta) * Math.cos(phi) * speed;
        this.sparkVelocities[i * 3 + 1] = Math.sin(phi) * speed + 2.5;
        this.sparkVelocities[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * speed;

        this.sparkLifetimes[i] = isHeavy ? 0.65 : 0.35;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  public triggerBlockEffect(origin: THREE.Vector3) {
    this.burstSparks(origin, 28, true);
    const ring = this.rings.find((r) => !r.visible);
    if (!ring) return;

    ring.position.copy(origin);
    ring.rotation.x = 0; // Vertical barrier ring for block!
    ring.scale.set(1, 1, 1);
    ring.visible = true;

    const mat = ring.material as THREE.MeshBasicMaterial;
    mat.color.setHex(0x38bdf8); // Sky blue neon barrier
    mat.opacity = 0.95;

    const startTime = performance.now();
    const duration = 350;
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const curScale = 1 + progress * 6;
      ring.scale.set(curScale, curScale, curScale);
      mat.opacity = (1 - progress) * 0.95;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ring.visible = false;
        ring.rotation.x = -Math.PI / 2; // Restore flat orientation
      }
    };
    requestAnimationFrame(animate);
  }

  public triggerShockwave(origin: THREE.Vector3, isSpike: boolean = false, isSuper: boolean = false) {
    const ring = this.rings.find((r) => !r.visible);
    if (!ring) return;

    ring.position.copy(origin);
    ring.position.y = 0.02;
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(1, 1, 1);
    ring.visible = true;

    const mat = ring.material as THREE.MeshBasicMaterial;
    mat.color.setHex(isSuper ? 0xff0044 : isSpike ? 0xf59e0b : 0x10b981);
    mat.opacity = 0.9;

    // Animate ring expansion and fade
    const startTime = performance.now();
    const duration = isSuper ? 550 : isSpike ? 420 : 300;
    const maxScale = isSuper ? 12 : isSpike ? 8 : 5;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const curScale = 1 + progress * maxScale;
      ring.scale.set(curScale, curScale, curScale);
      mat.opacity = (1 - progress) * 0.9;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ring.visible = false;
      }
    };
    requestAnimationFrame(animate);
  }

  public createFreestyleHoops(scene: THREE.Scene) {
    this.clearTargets(scene);

    const hoopPositions = [
      new THREE.Vector3(-1.8, 2.4, 2.5),
      new THREE.Vector3(1.8, 2.6, 2.5),
      new THREE.Vector3(0, 3.2, 3.5),
      new THREE.Vector3(0, 2.0, 1.5),
    ];

    hoopPositions.forEach((pos, idx) => {
      const group = new THREE.Group();
      group.position.copy(pos);

      // Glowing Torus
      const torusGeo = new THREE.TorusGeometry(0.65, 0.05, 12, 28);
      const torusMat = new THREE.MeshStandardMaterial({
        color: idx % 2 === 0 ? 0xff007f : 0x00f5d4,
        emissive: idx % 2 === 0 ? 0xff007f : 0x00f5d4,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      });
      const torusMesh = new THREE.Mesh(torusGeo, torusMat);
      group.add(torusMesh);

      scene.add(group);
      this.targets.push({
        group,
        position: pos.clone(),
        radius: 0.65,
        points: (idx + 1) * 200,
        isActive: true,
      });
    });
  }

  public clearTargets(scene: THREE.Scene) {
    this.targets.forEach((t) => scene.remove(t.group));
    this.targets = [];
  }

  public update(dt: number) {
    // Update sparks
    const posAttr = this.sparkPoints.geometry.attributes.position as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    for (let i = 0; i < this.sparkCount; i++) {
      if (this.sparkLifetimes[i] > 0) {
        this.sparkLifetimes[i] -= dt;

        // Apply velocity & gravity
        positions[i * 3] += this.sparkVelocities[i * 3] * dt;
        this.sparkVelocities[i * 3 + 1] -= 9.8 * dt;
        positions[i * 3 + 1] += this.sparkVelocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += this.sparkVelocities[i * 3 + 2] * dt;

        // Bounce on floor
        if (positions[i * 3 + 1] < 0.02) {
          positions[i * 3 + 1] = 0.02;
          this.sparkVelocities[i * 3 + 1] *= -0.4;
        }
      } else {
        // Hide inactive particles underground
        positions[i * 3 + 1] = -100;
      }
    }
    posAttr.needsUpdate = true;

    // Bob & rotate freestyle hoops
    const t = performance.now() * 0.002;
    this.targets.forEach((target, i) => {
      if (target.isActive) {
        target.group.rotation.y = t * 1.5 + i;
        target.group.position.y = target.position.y + Math.sin(t * 3 + i) * 0.15;
      }
    });
  }
}
