const scene = document.querySelector('.scene');

// 900px 기준으로 설계된 모빌을 화면 크기에 맞춰 축소/확대한다(반응형 대응).
// 개체 자체가 눌리지 않도록 가로세로 항상 같은 비율(uniform)로만 축소한다.
// 모바일(세로 화면)에서는 화면을 덜 채워서 가로 여백을 확실히 남긴다.
const SCENE_DESIGN_SIZE = 900;
const RESPONSIVE_FILL_RATIO = 0.8;
const MOBILE_RESPONSIVE_FILL_RATIO = 1.3;
let currentResponsiveScale = 1;
function updateResponsiveScale() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fillRatio = w < h ? MOBILE_RESPONSIVE_FILL_RATIO : RESPONSIVE_FILL_RATIO;
  const scale = Math.min(1, (Math.min(w, h) * fillRatio) / SCENE_DESIGN_SIZE);
  currentResponsiveScale = scale;
  scene.style.setProperty('--rs', scale.toFixed(4));
}
updateResponsiveScale();

// 화면 비율(가로/세로)에 맞춰 개체들의 "배치 위치"만 재구성한다(개체 자체 크기/모양은 그대로).
// - 데스크톱(가로 화면): 세로 퍼짐이 너무 좁아지지 않도록 축소 폭에 하한을 둔다.
// - 모바일(세로 화면): 세로 퍼짐을 크게 늘리되, 상단/하단에 여백이 남도록 살짝 덜 채운다.
const viewportAspect = window.innerWidth / window.innerHeight; // 1보다 작으면 세로가 더 긴 화면
const isPortraitViewport = viewportAspect < 1;

// 모바일에서 위아래 여백으로 남겨둘 비율(퍼센트 기반이라 화면 크기가 바뀌어도 항상 비율로 유지된다).
const MOBILE_VERTICAL_MARGIN_RATIO = 0.86;
// 모바일에서 개체들이 더 뭉쳐 보이도록 가로/세로 퍼짐을 한 번 더 줄이는 배율.
const MOBILE_COHESION_FACTOR = 0.72;

function computeSpreadFactors() {
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect < 1) {
    const aspectClamped = Math.max(0.4, aspect);
    const h = Math.max(0.25, Math.sqrt(aspectClamped)) * MOBILE_COHESION_FACTOR;
    // 상단 버튼 아래부터 화면 하단 가까이까지 채우되, 위아래 여백만큼은 덜 채운다.
    const v = Math.min(5, Math.sqrt(1 / aspectClamped) * 3) * MOBILE_VERTICAL_MARGIN_RATIO * MOBILE_COHESION_FACTOR;
    return { horizontalSpreadFactor: h, verticalSpreadFactor: v };
  }
  const aspectClamped = Math.min(1.8, aspect);
  // 가로는 더 좁혀서 좌우 여백을 넓히고, 세로는 더 늘려서 간격을 넓힌다.
  const h = Math.sqrt(aspectClamped) * 0.8;
  const v = Math.max(1.15, Math.sqrt(1 / aspectClamped) * 1.2);
  return { horizontalSpreadFactor: h, verticalSpreadFactor: v };
}

function computeGeometryConstants(spread) {
  return {
    BASE_RADIUS: 400 * MOBILE_SCALE * spread.horizontalSpreadFactor,
    RADIUS_VARIANCE: 220 * MOBILE_SCALE * spread.horizontalSpreadFactor,
    HEIGHT_RANGE: 320 * MOBILE_SCALE * 0.9 * spread.verticalSpreadFactor,
  };
}

let { horizontalSpreadFactor, verticalSpreadFactor } = computeSpreadFactors();

const toneButtonsEl = document.querySelector('.tone-buttons');

// 개체가 화면 밖으로 넘어가거나 상단 톤 버튼 텍스트 영역까지 올라오지 않도록,
// 위/아래로 이동 가능한 최대 폭(디자인 단위)을 화면 크기에 맞춰 항상 다시 계산해서 못박아 둔다.
function computeVerticalYOffsetLimits() {
  const viewportH = window.innerHeight;
  const centerY = viewportH / 2;
  const topRect = toneButtonsEl ? toneButtonsEl.getBoundingClientRect() : null;
  const topSafePx = (topRect && topRect.height > 0 ? topRect.bottom : 60) + 20; // 버튼 아래 + 여유
  const bottomSafePx = 28; // 화면 하단 여백

  // 원근 투영 때문에 카메라에 가까운 개체는 같은 yOffset이라도 화면에서 더 크게 움직여 보이므로
  // 넉넉한 안전 계수를 곱해 어떤 경우에도 여백을 넘지 않게 한다.
  const SAFETY = 0.78;
  const rs = Math.max(0.05, currentResponsiveScale);

  const maxUp = Math.max(30, ((centerY - topSafePx) / rs) * SAFETY);
  const maxDown = Math.max(30, ((viewportH - centerY - bottomSafePx) / rs) * SAFETY);
  return { maxUp, maxDown };
}

function clampYOffset(yOffset, limits) {
  return Math.max(-limits.maxUp, Math.min(limits.maxDown, yOffset));
}

// 확대→축소는 CSS @keyframes 애니메이션(introZoom)이 담당한다. intro 클래스가 붙어있는
// 동안 애니메이션이 재생되고, 재생이 끝난 뒤(1.4초) 클래스를 떼면서 마무리한다.
scene.classList.add('intro');
let introSpeed = true;
// 인트로 동안에는 깊이에 따른 채도/명도 조절을 끄고 원색 그대로 보여준다.
let introActive = true;

// 인트로(확대→축소) 동안에는 상단 톤 버튼과 겹치지 않도록 숨겨뒀다가,
// 인트로가 끝나는 시점에 자연스럽게 나타나게 한다.
setTimeout(() => {
  scene.classList.remove('intro');
  introSpeed = false;
  introActive = false;
  braking = true;
  if (toneButtonsEl) toneButtonsEl.style.opacity = '1';
}, 1500);

const stage = document.getElementById('stage');

const colors = [
  // ===== 봄 웜톤 (Spring Warm) =====
  '#FFB6A3', '#FF9F7A', '#FFCC70', '#FFE066', '#FFD93D',
  '#C6E86A', '#8FD694', '#5FD3BC', '#6EC6CA', '#F6A6C1',
  '#FF8FA3', '#FFA57D', '#F4C95D', '#B4E197', '#FFCF9C',
  '#FF7F50', '#FFB84D', '#E8E288', '#7ED6A5', '#FF9AA2',
  '#FFC93C', '#FF6F61', '#F9DC5C', '#8ED1B0', '#FFAE8A',

  // ===== 여름 쿨톤 (Summer Cool) =====
  '#D8C9E8', '#C3B1D9', '#AEC6E8', '#9FB8D9', '#B5D6D6',
  '#F0B8C8', '#E3A6C0', '#C7B8DB', '#A9C4D6', '#CBDDE8',
  '#DDBFD8', '#B9AFD9', '#9ECAD6', '#E6C2D0', '#C0C9E0',
  '#A8B9D6', '#D4B8C8', '#B0CFCF', '#C9B8DE', '#9BB8CC',
  '#E0C3D3', '#AABBD1', '#C6D3E0', '#B7A9CC', '#D3B8C4',

  // ===== 가을 웜톤 (Autumn Warm) =====
  '#B5651D', '#8B5E34', '#6E4B2A', '#A97142', '#C68642',
  '#7C6A46', '#9C7A3C', '#5C4A2E', '#D2A24C', '#B08D57',
  '#8A5A44', '#6B4226', '#A6763E', '#7A6240', '#4E3B26',
  '#C97C5D', '#9C5A3C', '#7A6F55', '#BC6C25', '#DDA15E',
  '#606C38', '#3E5641', '#734F30', '#8C6239', '#D08C4B',

  // ===== 겨울 쿨톤 (Winter Cool) =====
  '#0A0A0A', '#FFFFFF', '#E60039', '#001489', '#7B2D8E',
  '#0057B8', '#C8102E', '#1E3A5F', '#8E0038', '#2E0854',
  '#003049', '#5A189A', '#A4133C', '#03045E', '#240046',
  '#D90429', '#000814', '#3A0CA3', '#560BAD', '#F72585',
  '#001233', '#7209B7', '#4361EE', '#B5179E', '#212529',
];

const count = colors.length;

// 모든 개체를 씨글래스/자갈처럼 하나하나 다른 유기적인 돌멩이 모양으로 그린다.
// 데스크톱에서는 화면이 넓은 만큼 개체 크기를 조금 키운다.
const SHAPE_BASE_SIZE = isPortraitViewport ? 60 : 72;

function seeded(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453
          + Math.sin(i * 78.233)  * 12345.6789;
  return x - Math.floor(x);
}

// 모빌 전체 크기(반지름/높이 퍼짐)를 줄이는 배율.
// 화면 비율(horizontalSpreadFactor/verticalSpreadFactor)에 맞춰 가로/세로 퍼짐만 재분배한다.
const MOBILE_SCALE = 1.15;
let { BASE_RADIUS, RADIUS_VARIANCE, HEIGHT_RANGE } = computeGeometryConstants({
  horizontalSpreadFactor,
  verticalSpreadFactor,
});

// 8개의 서로 다른 코너 반경(border-radius)을 섞어 완벽하지 않은 돌멩이 윤곽을 만든다.
// 하한을 높게 잡아(45%) 뾰족하게 각진 모서리가 생기지 않도록 한다.
function pebbleBorderRadius(seedBase) {
  const pick = (offset) => Math.round(45 + seeded(seedBase + offset) * 25); // 45~70%
  return `${pick(1)}% ${pick(2)}% ${pick(3)}% ${pick(4)}% / ${pick(5)}% ${pick(6)}% ${pick(7)}% ${pick(8)}%`;
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createCard(color, w, h, borderRadius, hoverTwistDeg) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.color = color;
  card.style.width = w + 'px';
  card.style.height = h + 'px';
  card.style.top = (-h / 2) + 'px';
  card.style.left = (-w / 2) + 'px';
  card.style.borderRadius = borderRadius;
  card.style.setProperty('--hover-twist', `${hoverTwistDeg}deg`);

  // 내부 0~60%는 60% 불투명도로 평평하게 유지하다가, 60%~외부(100%)에서 0%(완전 투명)까지 서서히 빠진다.
  const faceStyle =
    `background: radial-gradient(circle, ${hexToRgba(color, 0.6)} 0%, ${hexToRgba(color, 0.6)} 60%, ${hexToRgba(color, 0)} 100%);`;

  // 뒤에 같은 모양·같은 색으로 거리 0인 그림자(글로우)를 더 넓고 흐릿하게 깔아 은은하게 번지게 한다.
  // (깊이에 따른 opacity/blur가 이미 뒤쪽 개체는 흐리게 만들어주므로, 화면 앞쪽 개체일수록 더 진하게 보인다.)
  const glowSize = Math.max(w, h) * 0.7;
  card.style.boxShadow = `0 0 ${glowSize.toFixed(1)}px ${hexToRgba(color, 0.8)}`;

  card.innerHTML = `
    <div class="card-front" style="${faceStyle}"></div>
    <div class="card-back" style="${faceStyle}"></div>
    <div class="card-side-top" style="background:${color}"></div>
    <div class="card-side-bottom" style="background:${color}"></div>
    <div class="card-side-left" style="background:${color}"></div>
    <div class="card-side-right" style="background:${color}"></div>
  `;
  return card;
}

function addObject(baseAngle, radius, yOffset, card, section, seedBase) {
  const pivot = document.createElement('div');
  pivot.className = 'pivot';
  pivot.dataset.baseAngle = baseAngle;
  pivot.dataset.radius = radius;
  pivot.dataset.section = section;
  pivot.dataset.seedBase = seedBase;

  const arm = document.createElement('div');
  arm.className = 'arm';
  arm.style.transform = `translateZ(${radius}px) translateY(${yOffset}px)`;

  arm.appendChild(card);
  pivot.appendChild(arm);
  stage.appendChild(pivot);
}

// 화면 크기가 바뀔 때마다(리사이즈/회전) 개체들의 반지름·높이 퍼짐을 현재 화면 비율에 맞게
// 다시 계산해서 위치만 부드럽게 재배치한다(모양·크기는 그대로).
function updateObjectPositions() {
  const spread = computeSpreadFactors();
  horizontalSpreadFactor = spread.horizontalSpreadFactor;
  verticalSpreadFactor = spread.verticalSpreadFactor;
  ({ BASE_RADIUS, RADIUS_VARIANCE, HEIGHT_RANGE } = computeGeometryConstants(spread));

  const yLimits = computeVerticalYOffsetLimits();

  stage.querySelectorAll('.pivot').forEach((pivot) => {
    const seedBase = parseFloat(pivot.dataset.seedBase);
    const radiusSeed = seeded(seedBase + 53);
    const radius = BASE_RADIUS + (radiusSeed - 0.5) * RADIUS_VARIANCE;

    const isOuterLayer = radiusSeed > 0.66;
    const heightScale = isOuterLayer ? 0.35 : 1;
    const rawYOffset =
      ((seeded(seedBase) - 0.5) * HEIGHT_RANGE +
       (seeded(seedBase + 137) - 0.5) * (HEIGHT_RANGE * 0.4)) * heightScale;
    const yOffset = clampYOffset(rawYOffset, yLimits);

    pivot.dataset.radius = radius;
    const arm = pivot.querySelector('.arm');
    if (arm) arm.style.transform = `translateZ(${radius}px) translateY(${yOffset}px)`;
  });
}

// 리사이즈 중 과도한 연산을 피하면서도 실시간으로 여백/배치가 계속 따라오도록 rAF로 묶는다.
let responsiveUpdateRAF = null;
function scheduleResponsiveUpdate() {
  if (responsiveUpdateRAF) return;
  responsiveUpdateRAF = requestAnimationFrame(() => {
    responsiveUpdateRAF = null;
    updateResponsiveScale();
    updateObjectPositions();
  });
}
window.addEventListener('resize', scheduleResponsiveUpdate);

// 색상 하나당 OBJECTS_PER_COLOR개의 개체를 만들고, 모양은 SHAPES 풀에서 골고루 순환시킨다.
const OBJECTS_PER_COLOR = 2;
const initialYLimits = computeVerticalYOffsetLimits();

for (let i = 0; i < count; i++) {
  for (let k = 0; k < OBJECTS_PER_COLOR; k++) {
    const seedBase = i * 31 + k * 977;
    const baseAngle = (360 / count) * i + (seeded(seedBase + 3) - 0.5) * (360 / count) * 1.6;
    const radiusSeed = seeded(seedBase + 53);
    const radius = BASE_RADIUS + (radiusSeed - 0.5) * RADIUS_VARIANCE;

    // 반지름이 가장 큰(가장 겉의) 개체들은 높낮이 퍼짐을 줄이고 크기도 작게.
    const isOuterLayer = radiusSeed > 0.66;
    const heightScale = isOuterLayer ? 0.35 : 1;
    const rawYOffset =
      ((seeded(seedBase) - 0.5) * HEIGHT_RANGE +
       (seeded(seedBase + 137) - 0.5) * (HEIGHT_RANGE * 0.4)) * heightScale;
    const yOffset = clampYOffset(rawYOffset, initialYLimits);

    const sizeJitter = 0.55 + seeded(seedBase + 71) * 1.0; // 0.55~1.55(평균은 이전과 동일): 편차 폭만 넓힘
    const outerSizeScale = isOuterLayer ? 0.65 : 1;
    const size = SHAPE_BASE_SIZE * sizeJitter * outerSizeScale;

    // 완벽한 원이 아니라 조금씩 길쭉하거나 눌린 자갈 비율로.
    const aspect = 0.75 + seeded(seedBase + 91) * 0.5; // 0.75~1.25
    const w = size * Math.sqrt(aspect);
    const h = size / Math.sqrt(aspect);
    const borderRadius = pebbleBorderRadius(seedBase + 300);

    // 마우스를 올렸을 때 틀어지는 방향(좌/우)을 개체마다 다르게.
    const hoverTwistDeg = (seeded(seedBase + 211) < 0.5 ? -1 : 1) * (16 + seeded(seedBase + 233) * 10);

    const card = createCard(colors[i], w, h, borderRadius, hoverTwistDeg);
    const section = Math.floor(i / (count / 4));
    addObject(baseAngle, radius, yOffset, card, section, seedBase);
  }
}

function hexToHSL(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: hh = ((g - b) / d) % 6; break;
      case g: hh = (b - r) / d + 2; break;
      case b: hh = (r - g) / d + 4; break;
    }
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  return { h: hh, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// 클릭한 색이 속한 톤 계열(봄/여름/가을/겨울)의 실제 팔레트 색상들을 그대로 반환한다.
function familyPaletteFor(hex) {
  const idx = colors.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
  if (idx === -1) return [hex];
  const segment = count / 4;
  const section = Math.floor(idx / segment);
  return colors.slice(section * segment, (section + 1) * segment);
}

function darkenHex(hex, factor) {
  const h = hex.replace('#', '');
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp(Math.round(parseInt(h.slice(0, 2), 16) * factor));
  const g = clamp(Math.round(parseInt(h.slice(2, 4), 16) * factor));
  const b = clamp(Math.round(parseInt(h.slice(4, 6), 16) * factor));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lightenHex(hex, factor) {
  const h = hex.replace('#', '');
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp(Math.round(parseInt(h.slice(0, 2), 16) * factor));
  const g = clamp(Math.round(parseInt(h.slice(2, 4), 16) * factor));
  const b = clamp(Math.round(parseInt(h.slice(4, 6), 16) * factor));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRGB(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

let rotationOffset = 0;
let isDragging = false;
let startX = 0;
let startRotation = 0;
let autoRotate = true;
let dragDistance = 0;

const colorOverlay = document.createElement('div');
colorOverlay.style.position = 'fixed';
colorOverlay.style.inset = '0';
colorOverlay.style.zIndex = '999';
colorOverlay.style.pointerEvents = 'none';
colorOverlay.style.transitionProperty = 'clip-path';
colorOverlay.style.transitionDuration = '0.7s';
colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
colorOverlay.style.clipPath = 'circle(0px at 50% 50%)';
document.body.appendChild(colorOverlay);

colorOverlay.style.background = '#ffffff';

const curlCanvas = document.createElement('canvas');
curlCanvas.style.position = 'absolute';
curlCanvas.style.inset = '0';
curlCanvas.style.width = '100%';
curlCanvas.style.height = '100%';
colorOverlay.appendChild(curlCanvas);
const curlCtx = curlCanvas.getContext('2d');

function resizeCurlCanvas() {
  const dpr = window.devicePixelRatio || 1;
  curlCanvas.width = window.innerWidth * dpr;
  curlCanvas.height = window.innerHeight * dpr;
  curlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCurlCanvas();
window.addEventListener('resize', resizeCurlCanvas);

let currentColor = '#ffffff';
let currentPalette = [];
let currentPaletteIndex = 0;

const backButton = document.createElement('button');
backButton.className = 'back-button';
backButton.textContent = '← Back';
backButton.style.position = 'fixed';
backButton.style.top = '28px';
backButton.style.left = '28px';
backButton.style.zIndex = '1001';
backButton.style.background = 'transparent';
backButton.style.border = 'none';
backButton.style.color = '#111111';
backButton.style.padding = '8px 16px';
backButton.style.borderRadius = '999px';
backButton.style.fontSize = '12px';
backButton.style.fontWeight = '300';
backButton.style.cursor = 'pointer';
backButton.style.opacity = '0';
backButton.style.pointerEvents = 'none';
backButton.style.transition = 'opacity 0.4s ease';
document.body.appendChild(backButton);

const paletteBar = document.createElement('div');
paletteBar.style.position = 'fixed';
paletteBar.style.bottom = '32px';
paletteBar.style.left = '50%';
paletteBar.style.transform = 'translateX(-50%)';
paletteBar.style.zIndex = '1001';
paletteBar.style.display = 'flex';
paletteBar.style.flexWrap = 'wrap';
paletteBar.style.justifyContent = 'center';
paletteBar.style.maxWidth = '90vw';
paletteBar.style.gap = '10px';
paletteBar.style.opacity = '0';
paletteBar.style.pointerEvents = 'none';
paletteBar.style.transition = 'opacity 0.4s ease';
document.body.appendChild(paletteBar);

let lastClickPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

function renderPalette(baseColor) {
  paletteBar.innerHTML = '';
  currentPalette = familyPaletteFor(baseColor);
  const matchIndex = currentPalette.findIndex((c) => c.toLowerCase() === baseColor.toLowerCase());
  currentPaletteIndex = matchIndex >= 0 ? matchIndex : 0;
  currentPalette.forEach((swatchColor, idx) => {
    const swatch = document.createElement('button');
    swatch.style.width = '36px';
    swatch.style.height = '36px';
    swatch.style.borderRadius = pebbleBorderRadius(idx * 137 + 5000);
    swatch.style.background = swatchColor;
    swatch.style.border = 'none';
    swatch.style.cursor = 'pointer';
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      currentPaletteIndex = idx;
      changeOverlayColor(swatchColor);
    });
    paletteBar.appendChild(swatch);
  });
}

// 배경색 명도에 따라 뒤로가기 버튼 글씨를 자연스럽게 흰색/검정으로 바꾼다.
function updateBackButtonContrast(color) {
  const { l } = hexToHSL(color);
  backButton.style.color = l < 50 ? '#ffffff' : '#111111';
}

function changeOverlayColor(color) {
  currentColor = color;
  colorOverlay.style.transition = colorOverlay.style.transition
    ? colorOverlay.style.transition
    : '';
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  renderPalette(color);
}

function showColorOverlay(color, x, y) {
  lastClickPoint = { x, y };
  currentColor = color;
  curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  colorOverlay.style.pointerEvents = 'auto';

  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  colorOverlay.style.transitionProperty = 'clip-path';
  colorOverlay.style.transitionDuration = '0s';
  colorOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  void colorOverlay.offsetWidth;
  colorOverlay.style.transitionDuration = '0.7s';
  colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
  colorOverlay.style.clipPath = `circle(${maxRadius}px at ${x}px ${y}px)`;

  renderPalette(color);
  backButton.style.opacity = '1';
  backButton.style.pointerEvents = 'auto';
  paletteBar.style.opacity = '1';
  paletteBar.style.pointerEvents = 'auto';
}

function hideColorOverlay() {
  const { x, y } = lastClickPoint;
  colorOverlay.style.transitionProperty = 'clip-path';
  colorOverlay.style.transitionDuration = '0.6s';
  colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
  colorOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  colorOverlay.style.pointerEvents = 'none';

  backButton.style.opacity = '0';
  backButton.style.pointerEvents = 'none';
  paletteBar.style.opacity = '0';
  paletteBar.style.pointerEvents = 'none';
}

backButton.addEventListener('click', hideColorOverlay);

const CORNER_GRAB_RADIUS = 160;
const COMMIT_PROGRESS = 0.35;

let pageDrag = null;

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function getNextColor() {
  const nextIndex = (currentPaletteIndex + 1) % currentPalette.length;
  return { color: currentPalette[nextIndex], index: nextIndex };
}

function edgeVectorsForCorner(id) {
  switch (id) {
    case 'tl': return { e1: { x: 1, y: 0 }, e2: { x: 0, y: 1 } };
    case 'tr': return { e1: { x: -1, y: 0 }, e2: { x: 0, y: 1 } };
    case 'bl': return { e1: { x: 1, y: 0 }, e2: { x: 0, y: -1 } };
    case 'br': return { e1: { x: -1, y: 0 }, e2: { x: 0, y: -1 } };
    default: return { e1: { x: 1, y: 0 }, e2: { x: 0, y: 1 } };
  }
}

const CURVE_BULGE_MIN = 0.06;
const CURVE_BULGE_MAX = 0.48;
const CURVE_RAMP = 1.7;

function curveBulgeForProgress(progress) {
  const p = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - Math.min(1, p * CURVE_RAMP), 2);
  return CURVE_BULGE_MIN + (CURVE_BULGE_MAX - CURVE_BULGE_MIN) * eased;
}

function renderCurl(C, P, e1, e2, frontColor, shrinkT = 0, shrinkTarget = C, baseColor = frontColor) {
  const w = window.innerWidth, h = window.innerHeight;
  curlCtx.clearRect(0, 0, w, h);

  curlCtx.fillStyle = baseColor;
  curlCtx.fillRect(0, 0, w, h);

  const dx = P.x - C.x, dy = P.y - C.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return;

  const nx = dx / d, ny = dy / d;
  const mx = (C.x + P.x) / 2, my = (C.y + P.y) / 2;

  let A;
  if (Math.abs(nx) < 0.001) {
    A = { x: C.x, y: C.y };
  } else {
    const ax = mx - (ny * (C.y - my)) / nx;
    A = { x: e1.x > 0 ? Math.min(Math.max(ax, C.x), w) : Math.max(Math.min(ax, C.x), 0), y: C.y };
  }

  let B;
  if (Math.abs(ny) < 0.001) {
    B = { x: C.x, y: C.y };
  } else {
    const by = my - (nx * (C.x - mx)) / ny;
    B = { x: C.x, y: e2.y > 0 ? Math.min(Math.max(by, C.y), h) : Math.max(Math.min(by, C.y), 0) };
  }

  const GAP_RATIO = 0.97;
  const distCA = distance(C.x, C.y, A.x, A.y);
  const distCB = distance(C.x, C.y, B.x, B.y);
  const gapA = {
    x: C.x + e1.x * (distCA * GAP_RATIO),
    y: C.y + e1.y * (distCA * GAP_RATIO),
  };
  const gapB = {
    x: C.x + e2.x * (distCB * GAP_RATIO),
    y: C.y + e2.y * (distCB * GAP_RATIO),
  };

  const TANGENT_STRENGTH_A = -0.1;
  const TANGENT_STRENGTH_B = -0.1;
  const HOOK_SIDE_A = 0;
  const HOOK_SIDE_B = 0;

  const dAP = distance(A.x, A.y, P.x, P.y);
  const dPB = distance(B.x, B.y, P.x, P.y);

  const perpA = { x: -e1.y, y: e1.x };
  const cp1 = {
    x: A.x + e1.x * (dAP * TANGENT_STRENGTH_A) + perpA.x * (dAP * HOOK_SIDE_A),
    y: A.y + e1.y * (dAP * TANGENT_STRENGTH_A) + perpA.y * (dAP * HOOK_SIDE_A),
  };

  const perpB = { x: -e2.y, y: e2.x };
  const cp2 = {
    x: B.x + e2.x * (dPB * TANGENT_STRENGTH_B) + perpB.x * (dPB * HOOK_SIDE_B),
    y: B.y + e2.y * (dPB * TANGENT_STRENGTH_B) + perpB.y * (dPB * HOOK_SIDE_B),
  };

  const shiftX = (shrinkTarget.x - C.x) * shrinkT;
  const shiftY = (shrinkTarget.y - C.y) * shrinkT;
  const shiftToTarget = (pt) => ({ x: pt.x + shiftX, y: pt.y + shiftY });

  const gapA_raw = shiftToTarget(gapA);
  const gapB_raw = shiftToTarget(gapB);
  const A_raw = shiftToTarget(A);
  const B_raw = shiftToTarget(B);

  const gapA_ = { x: gapA_raw.x, y: C.y };
  const gapB_ = { x: C.x, y: gapB_raw.y };
  const A_ = { x: A_raw.x, y: C.y };
  const B_ = { x: C.x, y: B_raw.y };

  const P_ = shiftToTarget(P);
  const cp1_ = shiftToTarget(cp1);
  const cp2_ = shiftToTarget(cp2);

  const { color: nextColorForGap } = getNextColor();
  curlCtx.save();
  curlCtx.shadowColor = 'transparent';
  curlCtx.shadowBlur = 0;
  curlCtx.shadowOffsetX = 0;
  curlCtx.shadowOffsetY = 0;
  curlCtx.fillStyle = nextColorForGap;
  curlCtx.beginPath();
  curlCtx.moveTo(C.x, C.y);
  curlCtx.lineTo(gapA_.x, gapA_.y);
  curlCtx.lineTo(gapB_.x, gapB_.y);
  curlCtx.closePath();
  curlCtx.fill();
  curlCtx.restore();

  curlCtx.save();

  const flapPath = new Path2D();
  flapPath.moveTo(gapA_.x, gapA_.y);
  flapPath.lineTo(A_.x, A_.y);
  flapPath.quadraticCurveTo(cp1_.x, cp1_.y, P_.x, P_.y);
  flapPath.quadraticCurveTo(cp2_.x, cp2_.y, B_.x, B_.y);
  flapPath.lineTo(gapB_.x, gapB_.y);
  flapPath.closePath();

  const backTone = darkenHex(frontColor, 0.55);

  curlCtx.shadowColor = 'rgba(0,0,0,0.45)';
  curlCtx.shadowBlur = 55;
  curlCtx.shadowOffsetX = nx * 22;
  curlCtx.shadowOffsetY = ny * 22;
  curlCtx.fillStyle = backTone;
  curlCtx.fill(flapPath);

  curlCtx.restore();
}

function startPageDrag(x, y) {
  if (colorOverlay.style.pointerEvents !== 'auto') return null;
  const w = window.innerWidth, h = window.innerHeight;
  const cornerDefs = [
    { id: 'tl', cx: 0, cy: 0 },
    { id: 'tr', cx: w, cy: 0 },
    { id: 'bl', cx: 0, cy: h },
    { id: 'br', cx: w, cy: h },
  ];
  let nearest = cornerDefs[0];
  let minDist = Infinity;
  cornerDefs.forEach((c) => {
    const dd = distance(x, y, c.cx, c.cy);
    if (dd < minDist) { minDist = dd; nearest = c; }
  });
  if (minDist > CORNER_GRAB_RADIUS) return null;

  const centerX = w / 2, centerY = h / 2;
  const centerDist = distance(nearest.cx, nearest.cy, centerX, centerY);

  const oppositeCornerMap = {
    tl: { x: w, y: h },
    tr: { x: 0, y: h },
    bl: { x: w, y: 0 },
    br: { x: 0, y: 0 },
  };
  const oppositeCorner = oppositeCornerMap[nearest.id];

  const { color: nextColor } = getNextColor();
  const { e1, e2 } = edgeVectorsForCorner(nearest.id);

  return {
    C: { x: nearest.cx, y: nearest.cy },
    e1, e2,
    centerX, centerY, centerDist,
    oppositeCorner,
    nextColor,
    lastP: { x: nearest.cx, y: nearest.cy },
    lastProgress: 0,
  };
}

function updatePageDrag(x, y) {
  if (!pageDrag) return;
  const { C, e1, e2 } = pageDrag;
  const P = { x, y };

  const distToCenter = distance(x, y, pageDrag.centerX, pageDrag.centerY);
  const progress = Math.min(1, Math.max(0, 1 - distToCenter / pageDrag.centerDist));

  pageDrag.lastP = P;
  pageDrag.lastProgress = progress;

  renderCurl(C, P, e1, e2, currentColor);
}

function animateCurl(C, e1, e2, fromP, toP, frontColor, onDone, shrinkFrom = 0, shrinkTo = 0, duration = 480, shrinkTarget = C, baseColor = frontColor) {
  const start = performance.now();
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(t);
    const P = {
      x: fromP.x + (toP.x - fromP.x) * eased,
      y: fromP.y + (toP.y - fromP.y) * eased,
    };
    const shrinkT = shrinkFrom + (shrinkTo - shrinkFrom) * eased;
    renderCurl(C, P, e1, e2, frontColor, shrinkT, shrinkTarget, baseColor);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      onDone && onDone();
    }
  }
  requestAnimationFrame(step);
}

function endPageDrag() {
  if (!pageDrag) return;
  const { C, e1, e2, lastP, lastProgress, nextColor, oppositeCorner } = pageDrag;

  if (lastProgress > COMMIT_PROGRESS) {
    // 종이가 반대 모서리까지 이동하는 동작은 생략하고, 접힌 부분이 반대 모서리로
    // 빨려들어가는(shrink) 연출만 남긴다.
    animateCurl(C, e1, e2, oppositeCorner, oppositeCorner, currentColor, () => {
      currentColor = nextColor;
      colorOverlay.style.background = currentColor;
      updateBackButtonContrast(currentColor);
      curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
      renderPalette(currentColor);
      const idx = currentPalette.findIndex(c => c.toLowerCase() === nextColor.toLowerCase());
      currentPaletteIndex = idx >= 0 ? idx : 0;
    }, 0, 1, 340, oppositeCorner, nextColor);
  } else {
    animateCurl(C, e1, e2, lastP, C, currentColor, () => {
      curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
    });
  }

  pageDrag = null;
}

colorOverlay.addEventListener('mousedown', (e) => {
  pageDrag = startPageDrag(e.clientX, e.clientY);
});
window.addEventListener('mousemove', (e) => {
  if (pageDrag) updatePageDrag(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => {
  if (pageDrag) endPageDrag();
});

colorOverlay.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  pageDrag = startPageDrag(t.clientX, t.clientY);
});
window.addEventListener('touchmove', (e) => {
  if (pageDrag) updatePageDrag(e.touches[0].clientX, e.touches[0].clientY);
});
window.addEventListener('touchend', () => {
  if (pageDrag) endPageDrag();
});

const TONE_FAMILY_COUNT = 4;
const TONE_BG_LIGHTNESS = 92;
const TONE_BG_SAT_CAP = 45;

function averageFamilyHSL(hexArray) {
  let sumSin = 0, sumCos = 0, sumS = 0;
  hexArray.forEach((hex) => {
    const { h, s } = hexToHSL(hex);
    const rad = (h * Math.PI) / 180;
    const w = Math.max(s, 1); // 무채색(검/흰)이 평균 색상(hue)을 왜곡하지 않도록 채도로 가중치를 준다.
    sumSin += Math.sin(rad) * w;
    sumCos += Math.cos(rad) * w;
    sumS += s;
  });
  let avgH = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (avgH < 0) avgH += 360;
  return { h: avgH, s: sumS / hexArray.length };
}

function paleFamilyColor(hexArray) {
  const { h, s } = averageFamilyHSL(hexArray);
  return hslToHex(h, Math.min(s, TONE_BG_SAT_CAP), TONE_BG_LIGHTNESS);
}

// 각 톤 구간(봄/여름/가을/겨울)에 실제로 쓰인 색상들을 평균 내 연한 배경색을 만든다.
const familySegment = count / TONE_FAMILY_COUNT;
const toneColors = Array.from({ length: TONE_FAMILY_COUNT }, (_, i) =>
  paleFamilyColor(colors.slice(i * familySegment, (i + 1) * familySegment))
);

const sections = toneColors.map((color, i) => {
  const segment = count / toneColors.length;
  const start = Math.round(segment * i);
  const end = Math.round(segment * (i + 1)) - 1;
  return { start, end, color };
});
sections[sections.length - 1].end = count - 1;

function lerpColor(a, b, t) {
  const parse = (hex) => {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0,2),16),
      g: parseInt(h.slice(2,4),16),
      b: parseInt(h.slice(4,6),16),
      a: h.length === 8 ? parseInt(h.slice(6,8),16) / 255 : 1
    };
  };
  const ac = parse(a), bc = parse(b);
  const r = Math.round(ac.r + (bc.r - ac.r) * t);
  const g = Math.round(ac.g + (bc.g - ac.g) * t);
  const bl = Math.round(ac.b + (bc.b - ac.b) * t);
  const al = (ac.a + (bc.a - ac.a) * t).toFixed(3);
  return `rgba(${r},${g},${bl},${al})`;
}

function updateToneButtons(frontValue) {
  const buttons = document.querySelectorAll('.tone-buttons button');
  buttons.forEach((btn, i) => {
    let raw = i - frontValue;
    raw = ((raw + 2) % 4 + 4) % 4 - 2;
    const isCenter = Math.abs(raw) < 0.5;

    btn.style.color = isCenter ? '#0a0a0a' : '#999999';
  });
}

function updateBg() {
  const normalized = ((rotationOffset % 360) + 360) % 360;
  // 카드 pivot은 baseAngle + rotationOffset 이 0°일 때 정면에 오므로,
  // 정면에 와 있는 카드의 인덱스는 rotationOffset의 반대 방향(360 - normalized)으로 구한다.
  const frontAngle = (360 - normalized) % 360;
  const pos = (frontAngle / 360) * count;
  const index = Math.floor(pos) % count;
  const t = pos - Math.floor(pos);

  const curSection = sections.findIndex(s => index >= s.start && index <= s.end);
  const nextIndex = (index + 1) % count;
  const nextSection = sections.findIndex(s => nextIndex >= s.start && nextIndex <= s.end);

  if (curSection === -1 || nextSection === -1) return;

  if (curSection === nextSection) {
    document.body.style.background = lerpColor(sections[curSection].color, sections[curSection].color, 0);
  } else {
    document.body.style.background = lerpColor(sections[curSection].color, sections[nextSection].color, t);
  }

  // 톤 버튼은 goToTone()이 각 구간의 "가운데 카드"를 정면으로 가져오므로,
  // 그 가운데 카드 인덱스를 기준으로 삼아야 frontValue가 정수(=완전 중앙)로 떨어진다.
  const segment = count / toneColors.length;
  const midOffset = Math.floor((sections[0].start + sections[0].end) / 2);
  const frontValue = (((pos - midOffset) / segment) % toneColors.length + toneColors.length) % toneColors.length;
  updateToneButtons(frontValue);
}

const MAX_DEPTH_BLUR = 10;
const MIN_DEPTH_OPACITY = 0.15;
const MIN_DEPTH_SATURATION = 0.02;
const MIN_DEPTH_BRIGHTNESS = 0.45;
// 중앙에서 조금만 벗어나도 빠르게 흐려지도록 거리 반응 범위를 좁힌다.
const DEPTH_T_SCALE = 1.8;

const TARGET_THETA_DEG = 330;
const LIT_COUNT = 3;

// 한 톤 계열이 "딱" 정중앙에 왔다고 볼 허용 오차(작을수록 더 정확히 맞아야 잠김).
const SECTION_LOCK_THRESHOLD = 0.08;

function applyLayout() {
  const litCandidates = [];

  // 톤 버튼과 같은 연속값(frontValue, 0~4)으로 지금 어느 구간이 정중앙에 가장 가까운지 구한다.
  const normalizedFront = ((rotationOffset % 360) + 360) % 360;
  const frontAngleNow = (360 - normalizedFront) % 360;
  const posNow = (frontAngleNow / 360) * count;
  const segmentNow = count / TONE_FAMILY_COUNT;
  const midOffsetNow = Math.floor((sections[0].start + sections[0].end) / 2);
  const frontValueNow =
    (((posNow - midOffsetNow) / segmentNow) % TONE_FAMILY_COUNT + TONE_FAMILY_COUNT) % TONE_FAMILY_COUNT;
  const nearestSection = Math.round(frontValueNow) % TONE_FAMILY_COUNT;
  const sectionIsLocked = Math.abs(frontValueNow - Math.round(frontValueNow)) < SECTION_LOCK_THRESHOLD;

  stage.querySelectorAll('.pivot').forEach((pivot) => {
    const angle = parseFloat(pivot.dataset.baseAngle) + rotationOffset;
    pivot.style.transform = `rotateY(${angle}deg)`;

    const radius = parseFloat(pivot.dataset.radius);
    const rad = (angle % 360) * Math.PI / 180;
    const effectiveZ = radius * Math.cos(rad);

    const t = Math.min(1, Math.max(0, ((radius - effectiveZ) / (2 * radius)) * DEPTH_T_SCALE));
    const blur = t * MAX_DEPTH_BLUR;
    // 중앙에서 멀어질수록(t 증가) 투명도·채도·명도가 함께 낮아지되, 채도는 더 낮은 바닥까지 떨어진다.
    const opacity = 1 - t * (1 - MIN_DEPTH_OPACITY);
    let saturation = introActive ? 1 : 1 - t * (1 - MIN_DEPTH_SATURATION);
    let brightness = introActive ? 1 : 1 - t * (1 - MIN_DEPTH_BRIGHTNESS);

    const card = pivot.querySelector('.card');
    if (card) {
      // 한 계열이 딱 정중앙에 왔을 때는 그 계열이 아닌 개체는 채도를 완전히 0으로.
      // 단, 원래 색이 어두우면 회색조가 너무 새까매져 눈에 띄므로 명도가 90% 밑으로 떨어지지 않게 보정한다.
      // (인트로 동안에는 이 조정도 하지 않는다.)
      if (!introActive && sectionIsLocked && pivot.dataset.section !== undefined) {
        const pivotSection = parseInt(pivot.dataset.section, 10);
        if (pivotSection !== nearestSection) {
          saturation = 0;
          const originalLightness = hexToHSL(card.dataset.color).l; // 0~100
          const grayLightness = originalLightness * brightness;
          if (grayLightness < 90) {
            brightness *= 90 / Math.max(1, originalLightness);
          }
        }
      }

      card.style.filter = `blur(${blur.toFixed(2)}px) saturate(${saturation.toFixed(3)}) brightness(${brightness.toFixed(3)})`;
      card.style.opacity = opacity.toFixed(3);

      const normalizedAngle = ((angle % 360) + 360) % 360;
      let diff = Math.abs(normalizedAngle - TARGET_THETA_DEG);
      if (diff > 180) diff = 360 - diff;
      litCandidates.push({ card, diff });
    }
  });

  litCandidates.sort((a, b) => a.diff - b.diff);
  litCandidates.forEach((entry, idx) => {
    entry.card.classList.toggle('lit', idx < LIT_COUNT);
  });

  updateBg();
}

applyLayout();

// 인트로 동안(약 1.5초, braking이 켜지기 전까지)은 더 빠르게 돌다가, 이후 빠르게 감속해 멈춘다.
let speed = 5;
let braking = false;
const brakingRate = 0.92;

function tick() {
  if (!isDragging && (autoRotate || braking)) {
    if (braking) {
      speed *= brakingRate;
      if (speed < 0.1) {
        speed = 0.1;
      }
    }
    rotationOffset += speed;
    applyLayout();
  }
  requestAnimationFrame(tick);
}
tick();

stage.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.clientX;
  startRotation = rotationOffset;
  dragDistance = 0;
});
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const delta = e.clientX - startX;
  dragDistance = Math.abs(delta);
  rotationOffset = startRotation + delta * 0.3;
  applyLayout();
});
window.addEventListener('mouseup', () => { isDragging = false; });

stage.addEventListener('touchstart', (e) => {
  isDragging = true;
  startX = e.touches[0].clientX;
  startRotation = rotationOffset;
  dragDistance = 0;
});
window.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const delta = e.touches[0].clientX - startX;
  dragDistance = Math.abs(delta);
  rotationOffset = startRotation + delta * 0.3;
  applyLayout();
});
window.addEventListener('touchend', () => { isDragging = false; });

window.addEventListener('wheel', (e) => {
  rotationOffset += e.deltaY * 0.05;
  applyLayout();
}, { passive: true });

const CLICK_DRAG_THRESHOLD = 6;
stage.addEventListener('click', (e) => {
  if (dragDistance > CLICK_DRAG_THRESHOLD) return;
  const card = e.target.closest('.card');
  if (!card) return;
  showColorOverlay(card.dataset.color, e.clientX, e.clientY);
});

// 개체 자체가 빛나는 게 아니라, 카메라 렌즈 플레어처럼 화면 전체에 빛이 번지는 효과.
// 호버한 개체 위치 → 화면 중심을 지나 반대편까지 이어지는 선을 따라 옅은 빛 번짐들을 배치한다.
const lensFlare = document.createElement('div');
lensFlare.style.position = 'fixed';
lensFlare.style.inset = '0';
lensFlare.style.zIndex = '5';
lensFlare.style.pointerEvents = 'none';
lensFlare.style.opacity = '0';
lensFlare.style.transition = 'opacity 0.5s ease';
lensFlare.style.mixBlendMode = 'screen';
document.body.appendChild(lensFlare);

// 프리즘에 빛이 반사되듯 무지개 순서(빨-주-노-초-파-보)로 배치한다.
// 색이 잘 보이도록 채도/불투명도를 높이고 블러는 줄였다.
const LENS_FLARE_STEPS = [
  { frac: -0.3, size: 200, blur: 30, color: 'hsla(0, 70%, 78%, 0.24)' },
  { frac: 0.05, size: 50,  blur: 8,  color: 'hsla(30, 75%, 68%, 0.2)' },
  { frac: 0.5,  size: 120, blur: 16, color: 'hsla(55, 70%, 70%, 0.17)' },
  { frac: 0.95, size: 32,  blur: 5,  color: 'hsla(150, 65%, 65%, 0.2)' },
  { frac: 1.4,  size: 84,  blur: 12, color: 'hsla(210, 70%, 70%, 0.18)' },
  { frac: 1.85, size: 160, blur: 20, color: 'hsla(280, 65%, 72%, 0.16)' },
];

const lensFlareEls = LENS_FLARE_STEPS.map((step) => {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.width = step.size + 'px';
  el.style.height = step.size + 'px';
  el.style.borderRadius = '50%';
  el.style.background = step.color;
  el.style.filter = `blur(${step.blur}px)`;
  el.style.transform = 'translate(-50%, -50%)';
  lensFlare.appendChild(el);
  return el;
});

function showLensFlareAt(hx, hy) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const mx = 2 * cx - hx; // 화면 중심을 기준으로 개체 반대편 지점
  const my = 2 * cy - hy;

  LENS_FLARE_STEPS.forEach((step, i) => {
    lensFlareEls[i].style.left = (hx + (mx - hx) * step.frac) + 'px';
    lensFlareEls[i].style.top = (hy + (my - hy) * step.frac) + 'px';
  });

  lensFlare.style.opacity = '1';
}

function hideLensFlare() {
  lensFlare.style.opacity = '0';
}

stage.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  showLensFlareAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
});
stage.addEventListener('mouseout', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  hideLensFlare();
});

function goToTone(sectionIndex) {
  const s = sections[sectionIndex];
  const midCard = Math.floor((s.start + s.end) / 2);
  const targetAngle = -(360 / count) * midCard;

  const current = rotationOffset % 360;
  let delta = (targetAngle - current) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  rotationOffset += delta;
  braking = false;
  autoRotate = false;

  stage.classList.add('animating');
  applyLayout();

  setTimeout(() => {
    stage.classList.remove('animating');
    speed = 0.1;
    autoRotate = true;
  }, 1200);
}