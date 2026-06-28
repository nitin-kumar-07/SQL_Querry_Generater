const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const assetDir = path.join(root, "src", "assets");
fs.mkdirSync(assetDir, { recursive: true });

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Easy-SQL">
  <defs>
    <linearGradient id="bg" x1="28" y1="24" x2="224" y2="232" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#102131"/>
      <stop offset="0.52" stop-color="#0D1723"/>
      <stop offset="1" stop-color="#071017"/>
    </linearGradient>
    <linearGradient id="accent" x1="60" y1="54" x2="203" y2="191" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#36C2A5"/>
      <stop offset="1" stop-color="#72A7FF"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect x="18" y="18" width="220" height="220" rx="44" fill="url(#bg)"/>
  <rect x="18" y="18" width="220" height="220" rx="44" fill="none" stroke="#26384A" stroke-width="3"/>
  <g filter="url(#shadow)">
    <ellipse cx="128" cy="76" rx="58" ry="24" fill="#101D2A" stroke="url(#accent)" stroke-width="9"/>
    <path d="M70 76v74c0 13.3 26 24 58 24s58-10.7 58-24V76" fill="none" stroke="url(#accent)" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="128" cy="150" rx="58" ry="24" fill="#101D2A" stroke="url(#accent)" stroke-width="9"/>
    <path d="M89 111c10 8 23 12 39 12s29-4 39-12" fill="none" stroke="#9CEBDD" stroke-width="7" stroke-linecap="round"/>
  </g>
  <path d="M78 197h101" stroke="#26384A" stroke-width="12" stroke-linecap="round"/>
  <text x="128" y="210" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="42" font-weight="800" letter-spacing="1" fill="#E7EDF4">SQL</text>
</svg>
`;

fs.writeFileSync(path.join(assetDir, "easy-sql-icon.svg"), svg);
fs.writeFileSync(path.join(assetDir, "easy-sql.ico"), createIco([16, 32, 48, 64, 128, 256]));
console.log(`Generated icons in ${assetDir}`);

function createIco(sizes) {
  const images = sizes.map((size) => ({ size, dib: createDib(size) }));
  const headerSize = 6 + images.length * 16;
  const totalSize = headerSize + images.reduce((sum, image) => sum + image.dib.length, 0);
  const buffer = Buffer.alloc(totalSize);
  let offset = 0;
  buffer.writeUInt16LE(0, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(images.length, offset); offset += 2;

  let imageOffset = headerSize;
  for (const image of images) {
    buffer.writeUInt8(image.size === 256 ? 0 : image.size, offset); offset += 1;
    buffer.writeUInt8(image.size === 256 ? 0 : image.size, offset); offset += 1;
    buffer.writeUInt8(0, offset); offset += 1;
    buffer.writeUInt8(0, offset); offset += 1;
    buffer.writeUInt16LE(1, offset); offset += 2;
    buffer.writeUInt16LE(32, offset); offset += 2;
    buffer.writeUInt32LE(image.dib.length, offset); offset += 4;
    buffer.writeUInt32LE(imageOffset, offset); offset += 4;
    image.dib.copy(buffer, imageOffset);
    imageOffset += image.dib.length;
  }
  return buffer;
}

function createDib(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 256;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / scale;
      const ny = y / scale;
      const index = (y * size + x) * 4;
      let rgba = [0, 0, 0, 0];
      if (roundedRect(nx, ny, 18, 18, 220, 220, 44)) {
        const t = (nx + ny) / 512;
        rgba = mix([16, 33, 49, 255], [7, 16, 23, 255], t);
      }
      if (strokeRoundedRect(nx, ny, 18, 18, 220, 220, 44, 5)) rgba = [38, 56, 74, 255];
      if (ellipseStroke(nx, ny, 128, 76, 58, 24, 9) || ellipseStroke(nx, ny, 128, 150, 58, 24, 9)) rgba = accent(nx, ny);
      if (inRect(nx, ny, 66, 76, 8, 74) || inRect(nx, ny, 182, 76, 8, 74)) rgba = accent(nx, ny);
      if (ellipseStroke(nx, ny, 128, 111, 42, 14, 6) && ny > 104) rgba = [156, 235, 221, 255];
      if (lineStroke(nx, ny, 80, 198, 176, 198, 10)) rgba = [38, 56, 74, 255];
      if (letterPixels(nx, ny)) rgba = [231, 237, 244, 255];
      pixels[index] = rgba[2];
      pixels[index + 1] = rgba[1];
      pixels[index + 2] = rgba[0];
      pixels[index + 3] = rgba[3];
    }
  }

  const maskStride = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskStride * size);
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(pixels.length, 20);

  const bottomUp = Buffer.alloc(pixels.length);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(bottomUp, y * size * 4, (size - 1 - y) * size * 4, (size - y) * size * 4);
  }

  return Buffer.concat([header, bottomUp, mask]);
}

function accent(x, y) {
  return mix([54, 194, 165, 255], [114, 167, 255, 255], (x + y - 110) / 230);
}

function mix(a, b, t) {
  const n = Math.max(0, Math.min(1, t));
  return a.map((value, index) => Math.round(value + (b[index] - value) * n));
}

function inRect(x, y, left, top, width, height) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

function roundedRect(x, y, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  return x >= left && x <= right && y >= top && y <= bottom && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function strokeRoundedRect(x, y, left, top, width, height, radius, stroke) {
  return roundedRect(x, y, left, top, width, height, radius) && !roundedRect(x, y, left + stroke, top + stroke, width - stroke * 2, height - stroke * 2, radius - stroke);
}

function ellipseStroke(x, y, cx, cy, rx, ry, stroke) {
  const outer = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const inner = ((x - cx) / (rx - stroke)) ** 2 + ((y - cy) / (ry - stroke)) ** 2 <= 1;
  return outer && !inner;
}

function lineStroke(x, y, x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return (x - px) ** 2 + (y - py) ** 2 <= (width / 2) ** 2;
}

function letterPixels(x, y) {
  const top = 186;
  const s = [
    [83, top, 22, 6], [83, top, 6, 15], [83, top + 14, 20, 6], [99, top + 14, 6, 15], [83, top + 28, 22, 6],
    [113, top, 6, 34], [113, top + 28, 22, 6],
    [143, top, 22, 6], [143, top, 6, 28], [159, top, 6, 28], [143, top + 28, 22, 6], [160, top + 26, 10, 10]
  ];
  return s.some(([left, rectTop, width, height]) => inRect(x, y, left, rectTop, width, height));
}
