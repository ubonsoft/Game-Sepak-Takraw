import * as THREE from 'three';

/**
 * Creates a procedural texture for the traditional woven rattan ball (ลูกตะกร้อหวาย).
 * Features authentic rattan bands, interlocking woven gaps, and natural woody fiber textures.
 */
export function createRattanTexture(skin: 'traditional' | 'modern' | 'neon' = 'traditional'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base background
  if (skin === 'neon') {
    ctx.fillStyle = '#0a0d18';
  } else if (skin === 'modern') {
    ctx.fillStyle = '#1e3a2f'; // Modern synthetic dark green/tan
  } else {
    ctx.fillStyle = '#2b1d0c'; // Traditional deep rattan shadow
  }
  ctx.fillRect(0, 0, size, size);

  // Draw woven rattan bands intersecting diagonally and horizontally
  const bandCount = 12;
  const bandWidth = size / bandCount;

  // Diagonal strips /
  for (let i = -bandCount; i < bandCount * 2; i++) {
    const x0 = i * bandWidth * 1.5;
    const y0 = 0;
    const x1 = x0 + size;
    const y1 = size;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + bandWidth * 0.75, y0);
    ctx.lineTo(x1 + bandWidth * 0.75, y1);
    ctx.lineTo(x1, y1);
    ctx.closePath();

    if (skin === 'neon') {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, '#00ffcc');
      grad.addColorStop(0.5, '#ff007f');
      grad.addColorStop(1, '#ffea00');
      ctx.fillStyle = grad;
    } else if (skin === 'modern') {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, '#e8f5e9');
      grad.addColorStop(0.5, '#81c784');
      grad.addColorStop(1, '#ffb74d');
      ctx.fillStyle = grad;
    } else {
      // Authentic Thai rattan tan/gold with grain highlights
      const grad = ctx.createLinearGradient(x0, y0, x0 + bandWidth, y0);
      grad.addColorStop(0, '#be8e4a');
      grad.addColorStop(0.3, '#f2d184');
      grad.addColorStop(0.7, '#deb164');
      grad.addColorStop(1, '#9a6b2d');
      ctx.fillStyle = grad;
    }
    ctx.fill();

    // Rattan fibrous ribs
    ctx.strokeStyle = skin === 'neon' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Opposite diagonal strips \
  for (let i = -bandCount; i < bandCount * 2; i++) {
    const x0 = i * bandWidth * 1.5;
    const y0 = size;
    const x1 = x0 + size;
    const y1 = 0;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + bandWidth * 0.75, y0);
    ctx.lineTo(x1 + bandWidth * 0.75, y1);
    ctx.lineTo(x1, y1);
    ctx.closePath();

    if (skin === 'neon') {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 150, 0.85)' : 'rgba(0, 229, 255, 0.85)';
    } else if (skin === 'modern') {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, '#ffcc80');
      grad.addColorStop(0.5, '#ffe082');
      grad.addColorStop(1, '#a5d6a7');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(x0, y0, x0 + bandWidth, y0);
      grad.addColorStop(0, '#a37130');
      grad.addColorStop(0.4, '#e7c57b');
      grad.addColorStop(0.8, '#c99645');
      grad.addColorStop(1, '#7e501b');
      ctx.fillStyle = grad;
    }
    ctx.fill();

    ctx.strokeStyle = skin === 'neon' ? 'rgba(0, 255, 200, 0.5)' : 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Draw 12 characteristic pentagonal woven ventilation holes
  const holes = [
    { x: 128, y: 128 }, { x: 384, y: 128 },
    { x: 256, y: 256 },
    { x: 128, y: 384 }, { x: 384, y: 384 },
    { x: 64, y: 256 }, { x: 448, y: 256 },
    { x: 256, y: 64 }, { x: 256, y: 448 }
  ];

  ctx.fillStyle = '#0f0a04';
  holes.forEach(({ x, y }) => {
    ctx.beginPath();
    const radius = 22;
    for (let s = 0; s < 5; s++) {
      const angle = (s * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Dark woven hole inner rim
    ctx.strokeStyle = skin === 'neon' ? '#ff007f' : '#61401a';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Creates procedural texture for the official ISTAF Takraw court surface.
 * Standard International dimensions: 13.4m length x 6.1m width (Aspect ratio ~2.2 : 1).
 * Orientation: Canvas X = Court Width (6.1m), Canvas Y = Court Length (13.4m).
 */
export function createCourtTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Synthetic competition mat green (Deep emerald Taraflex surface)
  ctx.fillStyle = '#17653c';
  ctx.fillRect(0, 0, width, height);

  // Micro-parquet non-slip athletic grip pattern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.024)';
  const tileSize = 20;
  for (let x = 0; x < width; x += tileSize) {
    for (let y = 0; y < height; y += tileSize) {
      if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  // Margin around lines (apron padding)
  const padX = 50;
  const padY = 70;
  const courtW = width - padX * 2;
  const courtH = height - padY * 2;

  // Real world dimensions (meters)
  const courtWidthMeters = 6.1;
  const courtLengthMeters = 13.4;

  // Scale factors (pixels per meter)
  const scaleX = courtW / courtWidthMeters;
  const scaleY = courtH / courtLengthMeters;

  // 2. White Boundary Lines (5cm official line width)
  const lineWidthPixels = Math.max(6, Math.round(0.05 * scaleX));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lineWidthPixels;
  ctx.strokeRect(padX, padY, courtW, courtH);

  // 3. Center line dividing the court directly beneath the net (Y = height / 2)
  const centerY = height / 2;
  ctx.beginPath();
  ctx.moveTo(padX, centerY);
  ctx.lineTo(padX + courtW, centerY);
  ctx.stroke();

  // 4. Quarter circles at net corners (radius 0.9m)
  const quarterRx = 0.9 * scaleX;
  const quarterRy = 0.9 * scaleY;

  // Top-left and Top-right quarter circles (Opponent side)
  ctx.beginPath();
  ctx.ellipse(padX, centerY, quarterRx, quarterRy, 0, -Math.PI / 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(padX + courtW, centerY, quarterRx, quarterRy, 0, Math.PI, Math.PI * 1.5);
  ctx.stroke();

  // Bottom-left and Bottom-right quarter circles (Player side)
  ctx.beginPath();
  ctx.ellipse(padX, centerY, quarterRx, quarterRy, 0, 0, Math.PI / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(padX + courtW, centerY, quarterRx, quarterRy, 0, Math.PI * 0.5, Math.PI);
  ctx.stroke();

  // 5. Official Service Circles (Tekong circle: radius 0.3m, 2.45m from baseline)
  const serveDistFromBaseline = 2.45 * scaleY;
  const opponentServeY = padY + serveDistFromBaseline;
  const playerServeY = (padY + courtH) - serveDistFromBaseline;
  const centerX = width / 2;

  const serveRx = 0.3 * scaleX;
  const serveRy = 0.3 * scaleY;

  // Opponent service circle
  ctx.beginPath();
  ctx.ellipse(centerX, opponentServeY, serveRx, serveRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Player service circle
  ctx.beginPath();
  ctx.ellipse(centerX, playerServeY, serveRx, serveRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Center dots for server foot placement
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(centerX, opponentServeY, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, playerServeY, 5, 0, Math.PI * 2);
  ctx.fill();

  // 6. Subtle court center branding text (Non-intrusive tournament prestige)
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.font = 'bold 24px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ISTAF SEPAK TAKRAW', centerX, centerY - 80);
  ctx.fillText('WORLD CHAMPIONSHIP', centerX, centerY + 80);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates procedural texture for stadium sponsor banners and digital boards
 */
export function createBannerTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0b1626';
  ctx.fillRect(0, 0, width, height);

  // Gradient accent line
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#f97316');
  grad.addColorStop(0.5, '#eab308');
  grad.addColorStop(1, '#06b6d4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 6);
  ctx.fillRect(0, height - 6, width, 6);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Chakra Petch", "Kanit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🇹🇭 THAILAND TAKRAW GRAND PRIX 2026 ✦ KING’S CUP ✦ ISTAF SUPER SERIES', width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

/**
 * Creates landing shadow reticle texture on the floor beneath the ball
 */
export function createReticleTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, 2, center, center, center - 6);
  grad.addColorStop(0, 'rgba(255, 215, 0, 0.9)');
  grad.addColorStop(0.4, 'rgba(255, 165, 0, 0.6)');
  grad.addColorStop(0.8, 'rgba(255, 80, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, center - 4, 0, Math.PI * 2);
  ctx.fill();

  // Precision crosshairs
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(center - 16, center);
  ctx.lineTo(center + 16, center);
  ctx.moveTo(center, center - 16);
  ctx.lineTo(center, center + 16);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
