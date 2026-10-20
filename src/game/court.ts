import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCourtTexture, createBannerTexture } from './textures.ts';

export interface CourtDimensions {
  courtLength: number; // Official ISTAF length: 13.4m
  courtWidth: number;  // Official ISTAF width: 6.1m (Aspect ratio ~2.2 : 1)
  netHeight: number;   // 1.55m at posts
}

export class TakrawArena {
  public group: THREE.Group;
  public dimensions: CourtDimensions = {
    courtLength: 13.4,
    courtWidth: 6.1,
    netHeight: 1.55,
  };

  private netGroup!: THREE.Group;
  private netMesh!: THREE.Mesh;
  private netTopTape!: THREE.Mesh;
  private netWobble = 0;
  private crowdInstances!: THREE.InstancedMesh;
  private crowdCount = 180;
  private crowdBasePositions: { x: number; y: number; z: number }[] = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Setup Environment Map via PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm & cool arena lighting rig
    this.setupLighting(scene);

    // Build court elements
    this.buildCourtFloor();
    this.buildNetSystem();
    this.buildSurroundingArena();
    this.buildCrowd();
  }

  private setupLighting(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0x0c1322, 0.016);

    // 1. Cool sky / Warm ground Hemisphere fill
    const hemiLight = new THREE.HemisphereLight(0xbad7ff, 0x1f2e22, 0.95);
    hemiLight.position.set(0, 24, 0);
    scene.add(hemiLight);

    // 2. Main Key Light (Directional shadow caster)
    const keyLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    keyLight.position.set(9, 18, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 45;
    const d = 15;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    // 3. Rim / Fill Light from back court
    const rimLight = new THREE.DirectionalLight(0x5ca8ff, 1.4);
    rimLight.position.set(-9, 16, -14);
    scene.add(rimLight);

    // 4. Center court spotlight
    const netSpot = new THREE.SpotLight(0xfff1cf, 2.0, 30, Math.PI / 4, 0.4);
    netSpot.position.set(0, 12, 0);
    netSpot.target.position.set(0, 0, 0);
    scene.add(netSpot);
    scene.add(netSpot.target);
  }

  private buildCourtFloor() {
    // 1. Official ISTAF Playing Court (13.4m x 6.1m Emerald Taraflex Mat)
    const courtTex = createCourtTexture();
    const courtGeo = new THREE.PlaneGeometry(this.dimensions.courtWidth, this.dimensions.courtLength);

    const courtMat = new THREE.MeshStandardMaterial({
      map: courtTex,
      roughness: 0.55,
      metalness: 0.04,
    });
    courtMat.polygonOffset = true;
    courtMat.polygonOffsetFactor = -2;
    courtMat.polygonOffsetUnits = -2;

    const courtMesh = new THREE.Mesh(courtGeo, courtMat);
    courtMesh.rotation.x = -Math.PI / 2;
    courtMesh.position.y = 0.035; // Elevated 3.5cm above apron
    courtMesh.receiveShadow = true;
    this.group.add(courtMesh);

    // 2. Proportioned Stadium Apron / Outer wooden court
    const apronW = 9.2;
    const apronL = 18.0;
    const apronGeo = new THREE.PlaneGeometry(apronW, apronL);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x122436, // Rich deep stadium navy-slate blue
      roughness: 0.45,
      metalness: 0.1,
    });
    const apronMesh = new THREE.Mesh(apronGeo, apronMat);
    apronMesh.rotation.x = -Math.PI / 2;
    apronMesh.position.y = 0.01;
    apronMesh.receiveShadow = true;
    this.group.add(apronMesh);

    // 3. Stadium Concrete Floor extending out
    const stadiumFloorGeo = new THREE.PlaneGeometry(45, 60);
    const stadiumFloorMat = new THREE.MeshStandardMaterial({
      color: 0x090e17,
      roughness: 0.85,
      metalness: 0.0,
    });
    const stadiumFloor = new THREE.Mesh(stadiumFloorGeo, stadiumFloorMat);
    stadiumFloor.rotation.x = -Math.PI / 2;
    stadiumFloor.position.y = -0.05;
    stadiumFloor.receiveShadow = true;
    this.group.add(stadiumFloor);
  }

  private buildNetSystem() {
    this.netGroup = new THREE.Group();
    const postHeight = this.dimensions.netHeight;
    const postRadius = 0.045;
    const postOffset = this.dimensions.courtWidth / 2 + 0.3; // 0.3m outside sideline = 3.35m

    const postMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Competition yellow posts
      roughness: 0.25,
      metalness: 0.8,
    });

    // Left and Right Posts
    const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 20);
    postGeo.translate(0, postHeight / 2, 0);

    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-postOffset, 0.035, 0);
    leftPost.castShadow = true;
    this.netGroup.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(postOffset, 0.035, 0);
    rightPost.castShadow = true;
    this.netGroup.add(rightPost);

    // Steel base mounts
    const baseGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.06, 20);
    const leftBase = new THREE.Mesh(baseGeo, postMat);
    leftBase.position.set(-postOffset, 0.065, 0);
    const rightBase = new THREE.Mesh(baseGeo, postMat);
    rightBase.position.set(postOffset, 0.065, 0);
    this.netGroup.add(leftBase, rightBase);

    // Official Net Mesh: 0.7m deep (From 0.85m to 1.55m height)
    const netMeshH = 0.7;
    const netW = postOffset * 2;
    const netMeshGeo = new THREE.PlaneGeometry(netW, netMeshH);

    const netCanvas = document.createElement('canvas');
    netCanvas.width = 256;
    netCanvas.height = 128;
    const nCtx = netCanvas.getContext('2d')!;
    nCtx.clearRect(0, 0, 256, 128);
    nCtx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    nCtx.lineWidth = 2;
    const cell = 8;
    for (let x = 0; x <= 256; x += cell) {
      nCtx.beginPath();
      nCtx.moveTo(x, 0);
      nCtx.lineTo(x, 128);
      nCtx.stroke();
    }
    for (let y = 0; y <= 128; y += cell) {
      nCtx.beginPath();
      nCtx.moveTo(0, y);
      nCtx.lineTo(256, y);
      nCtx.stroke();
    }
    const netTex = new THREE.CanvasTexture(netCanvas);
    netTex.wrapS = THREE.RepeatWrapping;
    netTex.wrapT = THREE.RepeatWrapping;
    netTex.repeat.set(16, 8);

    const netMat = new THREE.MeshStandardMaterial({
      map: netTex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      roughness: 0.85,
    });

    this.netMesh = new THREE.Mesh(netMeshGeo, netMat);
    this.netMesh.position.set(0, 0.035 + postHeight - netMeshH / 2, 0);
    this.netGroup.add(this.netMesh);

    // Official 5cm White Top Tape (Containing steel cable)
    const tapeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });
    const topTapeGeo = new THREE.BoxGeometry(netW, 0.05, 0.03);
    this.netTopTape = new THREE.Mesh(topTapeGeo, tapeMat);
    this.netTopTape.position.set(0, 0.035 + postHeight, 0);
    this.netTopTape.castShadow = true;
    this.netGroup.add(this.netTopTape);

    // White Bottom Tape (5cm)
    const bottomTapeGeo = new THREE.BoxGeometry(netW, 0.04, 0.025);
    const bottomTape = new THREE.Mesh(bottomTapeGeo, tapeMat);
    bottomTape.position.set(0, 0.035 + postHeight - netMeshH, 0);
    this.netGroup.add(bottomTape);

    // Sideline vertical boundary bands on net (5cm wide exactly at sideline x = ±3.05m)
    const sidelineX = this.dimensions.courtWidth / 2;
    const sideBandGeo = new THREE.BoxGeometry(0.05, netMeshH, 0.032);
    const leftBand = new THREE.Mesh(sideBandGeo, tapeMat);
    leftBand.position.set(-sidelineX, 0.035 + postHeight - netMeshH / 2, 0);
    const rightBand = new THREE.Mesh(sideBandGeo, tapeMat);
    rightBand.position.set(sidelineX, 0.035 + postHeight - netMeshH / 2, 0);
    this.netGroup.add(leftBand, rightBand);

    // ✦ OFFICIAL ISTAF ANTENNAS (Vertical indicator rods striped Red and White) ✦
    // Fastened to the outer edge of each sideline band, extending 0.8m above the net!
    const antennaH = 1.5; // Total rod length
    const antennaGeo = new THREE.CylinderGeometry(0.012, 0.012, antennaH, 12);
    const antennaCanvas = document.createElement('canvas');
    antennaCanvas.width = 32;
    antennaCanvas.height = 128;
    const aCtx = antennaCanvas.getContext('2d')!;
    // Alternating 10cm red and white stripes
    for (let i = 0; i < 8; i++) {
      aCtx.fillStyle = i % 2 === 0 ? '#ef4444' : '#ffffff';
      aCtx.fillRect(0, i * 16, 32, 16);
    }
    const antennaTex = new THREE.CanvasTexture(antennaCanvas);
    const antennaMat = new THREE.MeshStandardMaterial({ map: antennaTex, roughness: 0.3 });

    const leftAntenna = new THREE.Mesh(antennaGeo, antennaMat);
    leftAntenna.position.set(-sidelineX, 0.035 + postHeight + 0.4 - antennaH / 2 + 0.35, 0);
    leftAntenna.castShadow = true;

    const rightAntenna = new THREE.Mesh(antennaGeo, antennaMat);
    rightAntenna.position.set(sidelineX, 0.035 + postHeight + 0.4 - antennaH / 2 + 0.35, 0);
    rightAntenna.castShadow = true;

    this.netGroup.add(leftAntenna, rightAntenna);

    // Elevated Referee Chair & 3D Referee on post side
    this.buildRefereeChair(this.netGroup, -postOffset - 0.7);

    this.group.add(this.netGroup);
  }

  private buildRefereeChair(parent: THREE.Group, xPos: number) {
    const chairGroup = new THREE.Group();
    chairGroup.position.set(xPos, 0.035, 0);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7, roughness: 0.3 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });

    // Ladder Legs
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 12);
    const leftLeg = new THREE.Mesh(legGeo, steelMat);
    leftLeg.position.set(-0.25, 1.2, 0);
    const rightLeg = new THREE.Mesh(legGeo, steelMat);
    rightLeg.position.set(0.25, 1.2, 0);
    chairGroup.add(leftLeg, rightLeg);

    // Rungs
    for (let y = 0.4; y < 2.0; y += 0.3) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 10), steelMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, y, 0);
      chairGroup.add(rung);
    }

    // Chair Seat & Back
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.5), seatMat);
    seat.position.set(0, 1.9, 0);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.06), seatMat);
    seatBack.position.set(0.26, 2.15, 0);
    chairGroup.add(seat, seatBack);

    // ✦ 3D Official Match Referee seated attentively! ✦
    const refGroup = new THREE.Group();
    refGroup.position.set(0, 1.93, 0);
    refGroup.rotation.y = -Math.PI / 2; // Looking onto court

    // Referee Torso (Official ISTAF Yellow shirt)
    const refTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.16, 0.45, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    refTorso.position.y = 0.28;
    refGroup.add(refTorso);

    // Referee Trousers
    const refPants = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    refPants.position.set(0, 0.08, 0.1);
    refGroup.add(refPants);

    // Referee Head & Cap
    const refHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.6 })
    );
    refHead.position.y = 0.6;
    const refCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    refCap.position.y = 0.66;
    refGroup.add(refHead, refCap);

    chairGroup.add(refGroup);
    parent.add(chairGroup);
  }

  private buildSurroundingArena() {
    const bannerTex = createBannerTexture();
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.4,
      metalness: 0.2,
    });

    const bannerH = 1.0;

    // Sleek, authentic Side Banners (at x = ±4.8m, along 18m apron)
    const sideBannerGeo = new THREE.BoxGeometry(0.2, bannerH, 18.2);
    const leftBanner = new THREE.Mesh(sideBannerGeo, bannerMat);
    leftBanner.position.set(-4.8, bannerH / 2 + 0.01, 0);
    leftBanner.castShadow = true;
    leftBanner.receiveShadow = true;

    const rightBanner = new THREE.Mesh(sideBannerGeo, bannerMat);
    rightBanner.position.set(4.8, bannerH / 2 + 0.01, 0);
    rightBanner.castShadow = true;
    rightBanner.receiveShadow = true;

    // End Banners (at z = ±9.3m)
    const endBannerGeo = new THREE.BoxGeometry(9.8, bannerH, 0.2);
    const northBanner = new THREE.Mesh(endBannerGeo, bannerMat);
    northBanner.position.set(0, bannerH / 2 + 0.01, -9.3);
    northBanner.castShadow = true;
    northBanner.receiveShadow = true;

    const southBanner = new THREE.Mesh(endBannerGeo, bannerMat);
    southBanner.position.set(0, bannerH / 2 + 0.01, 9.3);
    southBanner.castShadow = true;
    southBanner.receiveShadow = true;

    this.group.add(leftBanner, rightBanner, northBanner, southBanner);

    // Grandstands (North and South at z = ±11.5m)
    this.buildGrandstandTiers(11.5, 1);
    this.buildGrandstandTiers(-11.5, -1);
  }

  private buildGrandstandTiers(zCenter: number, facing: number) {
    const tierGroup = new THREE.Group();
    const stepCount = 5;
    const tierMat = new THREE.MeshStandardMaterial({
      color: 0x1a2638,
      roughness: 0.8,
    });

    for (let i = 0; i < stepCount; i++) {
      const stepY = (i + 1) * 0.7;
      const stepZ = zCenter + facing * (i * 1.2);
      const stepGeo = new THREE.BoxGeometry(18, 0.7, 1.4);
      const step = new THREE.Mesh(stepGeo, tierMat);
      step.position.set(0, stepY - 0.35, stepZ);
      step.receiveShadow = true;
      tierGroup.add(step);
    }
    this.group.add(tierGroup);
  }

  private buildCrowd() {
    const personGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.9, 8);
    personGeo.translate(0, 0.45, 0);

    const personMat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.1,
    });

    this.crowdInstances = new THREE.InstancedMesh(personGeo, personMat, this.crowdCount);
    this.crowdInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crowdBasePositions = [];

    const dummy = new THREE.Object3D();
    const colors = [
      new THREE.Color(0xef4444),
      new THREE.Color(0x2563eb),
      new THREE.Color(0xffffff),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0x10b981),
    ];

    let idx = 0;
    const tiers = 4;
    const peoplePerTier = Math.floor(this.crowdCount / (tiers * 2));

    for (let side = -1; side <= 1; side += 2) {
      const zBase = side * 17;
      for (let t = 0; t < tiers; t++) {
        const y = (t + 1) * 0.7 + 0.1;
        const z = zBase + side * (t * 1.2);
        for (let p = 0; p < peoplePerTier; p++) {
          if (idx >= this.crowdCount) break;
          const x = (p - peoplePerTier / 2) * 1.1 + (Math.random() - 0.5) * 0.35;
          const finalY = y;
          const finalZ = z + (Math.random() - 0.5) * 0.2;

          this.crowdBasePositions.push({ x, y: finalY, z: finalZ });

          dummy.position.set(x, finalY, finalZ);
          dummy.rotation.y = side > 0 ? Math.PI : 0;
          dummy.scale.set(0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.25, 0.9 + Math.random() * 0.2);
          dummy.updateMatrix();

          this.crowdInstances.setMatrixAt(idx, dummy.matrix);
          this.crowdInstances.setColorAt(idx, colors[idx % colors.length]);
          idx++;
        }
      }
    }

    this.crowdInstances.computeBoundingSphere();
    this.group.add(this.crowdInstances);
  }

  public triggerNetWobble() {
    this.netWobble = 0.15;
  }

  public update(time: number, dt: number, isExcited: boolean) {
    // Physical net cord wobble with spring damping
    if (this.netWobble > 0.001) {
      const wobbleAngle = Math.sin(time * 30) * this.netWobble;
      this.netMesh.rotation.x = wobbleAngle;
      this.netTopTape.rotation.x = wobbleAngle;
      this.netWobble = THREE.MathUtils.damp(this.netWobble, 0, 8, dt);
    } else if (this.netWobble !== 0) {
      this.netWobble = 0;
      this.netMesh.rotation.x = 0;
      this.netTopTape.rotation.x = 0;
    }

    // Crowd cheer wave
    if (!this.crowdInstances || this.crowdBasePositions.length === 0) return;
    const dummy = new THREE.Object3D();
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    const speed = isExcited ? 6 : 2.0;
    const amp = isExcited ? 0.06 : 0.02;

    for (let i = 0; i < this.crowdCount; i += 3) {
      if (!this.crowdBasePositions[i]) continue;
      this.crowdInstances.getMatrixAt(i, mat);
      mat.decompose(pos, rot, scl);

      const base = this.crowdBasePositions[i];
      const bounce = Math.sin(time * speed + i * 0.7) * amp;
      dummy.position.set(base.x, base.y + Math.max(0, bounce), base.z);
      dummy.quaternion.copy(rot);
      dummy.scale.copy(scl);
      dummy.updateMatrix();

      this.crowdInstances.setMatrixAt(i, dummy.matrix);
    }
    this.crowdInstances.instanceMatrix.needsUpdate = true;
  }
}
