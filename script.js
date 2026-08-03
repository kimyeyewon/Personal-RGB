const scene = document.querySelector('.scene');

// 900px 기준으로 설계된 모빌을 화면 크기에 맞춰 축소/확대한다(반응형 대응).
// 개체 자체가 눌리지 않도록 가로세로 항상 같은 비율(uniform)로만 축소한다.
// 모바일(세로 화면)에서는 화면을 덜 채워서 가로 여백을 확실히 남긴다.
const SCENE_DESIGN_SIZE = 900;
const RESPONSIVE_FILL_RATIO = 0.8;
const MOBILE_RESPONSIVE_FILL_RATIO = 1.18;
let currentResponsiveScale = 1;
function updateResponsiveScale() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fillRatio = w < h ? MOBILE_RESPONSIVE_FILL_RATIO : RESPONSIVE_FILL_RATIO;
  const scale = Math.min(1, (Math.min(w, h) * fillRatio) / SCENE_DESIGN_SIZE);
  currentResponsiveScale = scale;
  scene.style.setProperty('--rs', scale.toFixed(4));

  // 모바일(세로 화면)에서는 상단 톤 버튼 아래부터 하단 튜토리얼 버튼 위까지의
  // 정중앙을 기준으로 삼되, 조금 더 위로 올려 보이도록 살짝 띄운다.
  // (toneButtonsEl/tutorialButtonEl은 이 함수보다 뒤에서 선언되므로 직접 조회한다.)
  const MOBILE_VERTICAL_NUDGE = 30; // 이 값만큼 위로 더 올린다(px).
  if (w < h) {
    const toneEl = document.querySelector('.tone-buttons');
    const tutEl = document.getElementById('tutorialButton');
    if (toneEl && tutEl) {
      const topBound = toneEl.getBoundingClientRect().bottom;
      const bottomBound = tutEl.getBoundingClientRect().top;
      const centerY = (topBound + bottomBound) / 2 - MOBILE_VERTICAL_NUDGE;
      scene.style.setProperty('--rest-top', `${((centerY / h) * 100).toFixed(2)}%`);
    }
  } else {
    scene.style.removeProperty('--rest-top');
  }
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
  // 모바일에서는 모빌 자체를 화면 중앙(50%)이 아니라 위/아래 여백에 맞춰 살짝
  // 옮겨두므로(--rest-top), 그 실제 렌더링 중심을 기준으로 위/아래 여유를
  // 계산해야 한다. 50%로 고정해두면 실제 중심이 더 위로 올라간 만큼 위쪽으로
  // 더 움직일 수 있다고 잘못 계산되어 개체들이 상단에 몰려 보인다.
  const sceneRect = scene.getBoundingClientRect();
  const centerY = sceneRect.height > 0 ? sceneRect.top + sceneRect.height / 2 : viewportH / 2;
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
// 모바일/태블릿(터치 기기)은 200개 개체를 그리는 것만으로도 부담이 커서, 확대 연출(가장 무거운
// 부분)은 생략하고 바로 제자리 크기로 보여준다 — 최종 모습(정지 상태)은 동일하다.
const isLikelyMobile =
  (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
  Math.min(window.innerWidth, window.innerHeight) <= 1366;
if (!isLikelyMobile) {
  scene.classList.add('intro');
}
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
  if (tutorialButtonEl) tutorialButtonEl.style.opacity = '1';
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

  // 뒤에 같은 모양·같은 색으로 거리 0인 그림자(글로우)를 깔아 은은하게 번지게 한다.
  // (깊이에 따른 opacity/blur가 이미 뒤쪽 개체는 흐리게 만들어주므로, 화면 앞쪽 개체일수록 더 진하게 보인다.)
  // box-shadow 블러는 비용이 커서, 200개가 계속 움직이는 모바일/태블릿에서는 반경을 크게 줄인다.
  const glowSize = Math.max(w, h) * (isLikelyMobile ? 0.22 : 0.7);
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

// 개체를 하나씩 stage에 바로 붙이면 200개만큼 레이아웃/리플로우가 반복돼 저사양 기기(특히
// 모바일)에서 초기 로딩이 무거워진다. DocumentFragment에 모아뒀다가 한 번에 붙인다.
const objectsFragment = document.createDocumentFragment();

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
  objectsFragment.appendChild(pivot);
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
stage.appendChild(objectsFragment); // 모아둔 개체를 한 번에 붙여서 리플로우를 한 번으로 줄인다.

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

// 봄·가을은 웜톤, 여름·겨울은 쿨톤 계열이라 두 계절씩 묶어 큰 톤 단위 팔레트를 만든다.
const FAMILY_SEGMENT = count / 4;
const WARM_COLORS = [
  ...colors.slice(0, FAMILY_SEGMENT),
  ...colors.slice(FAMILY_SEGMENT * 2, FAMILY_SEGMENT * 3),
];
const COOL_COLORS = [
  ...colors.slice(FAMILY_SEGMENT, FAMILY_SEGMENT * 2),
  ...colors.slice(FAMILY_SEGMENT * 3, FAMILY_SEGMENT * 4),
];
const ALL_COLORS = colors;

// 명도(Value) 단계: 전체 100색을 밝기(HSL lightness) 순으로 정렬해 4단계로 나눈다
// (어두운 쪽부터 Deepest → Deep → Light → Lightest).
const VALUE_LEVEL_LABELS = ['Deepest', 'Deep', 'Light', 'Lightest'];
const VALUE_LEVELS = (() => {
  const sorted = [...ALL_COLORS].sort((a, b) => hexToHSL(a).l - hexToHSL(b).l);
  const levelSize = Math.ceil(sorted.length / VALUE_LEVEL_LABELS.length);
  return VALUE_LEVEL_LABELS.map((_, i) => sorted.slice(i * levelSize, (i + 1) * levelSize));
})();

// 채도·대비(Chroma) 단계: 전체 100색을 채도(HSL saturation) 순으로 정렬해 3단계로 나눈다
// (탁한 쪽부터 Grayish → Muted → High Chroma).
const CHROMA_LEVEL_LABELS = ['Grayish', 'Muted', 'High Chroma'];
const CHROMA_LEVELS = (() => {
  const sorted = [...ALL_COLORS].sort((a, b) => hexToHSL(a).s - hexToHSL(b).s);
  const levelSize = Math.ceil(sorted.length / CHROMA_LEVEL_LABELS.length);
  return CHROMA_LEVEL_LABELS.map((_, i) => sorted.slice(i * levelSize, (i + 1) * levelSize));
})();

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
// 'family'(클릭한 색의 계절 팔레트) | 'warm' | 'cool' | 'all' | 'confirmed'
let currentPaletteMode = 'family';
// 튜토리얼을 끝내고 들어온 실전 모드일 때만 true. 카드를 직접 클릭한 평소 흐름에서는 false로 유지된다.
let isPracticeMode = false;
// "확정한 색" 화면(팔레트 아이콘)으로 들어가기 직전의 모드/색. 뒤로가기를 누르면
// 화면 전체를 나가는 대신 이 상태로 되돌아간다.
let previousPaletteMode = null;
let previousPaletteColor = null;

// 튜토리얼 아이콘(문서 모양)은 첫 화면(메인 모빌)에서만 보이고, 색을 클릭해 들어간
// 화면(실전 모드 포함)에서는 숨긴다. 실전 모드에서는 대신 팔레트(확정 색 목록) 아이콘이 그 자리를 대신한다.
const tutorialButtonEl = document.getElementById('tutorialButton');
// 모바일에서는 작은 아이콘 대신 "튜토리얼" 텍스트 버튼으로 대체한다(터치로는
// 아이콘보다 글자가 있는 쪽이 무엇을 누르는 건지 더 분명하다).
if (isLikelyMobile) {
  tutorialButtonEl.textContent = 'Tutorial';
  // 아이콘(작은 정사각형)에서 텍스트(더 넓은 버튼)로 바뀌면 버튼의 실제 세로
  // 위치/크기가 달라지므로, 모빌 세로 중앙 정렬을 다시 계산한다.
  updateResponsiveScale();
}

// 실전 모드에서 체크 표시로 "확정"한 색들의 목록. 세션 동안 계속 쌓인다.
const confirmedColors = [];

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

// 카메라 앱의 모드 선택 바처럼, 가운데는 선명하고 좌우로 갈수록 좁아지며 흐려지는
// 원통형(코브플로우) 휠로 색을 고른다.
const paletteBar = document.createElement('div');
paletteBar.style.position = 'fixed';
paletteBar.style.bottom = '44px';
paletteBar.style.left = '50%';
paletteBar.style.transform = 'translateX(-50%)';
paletteBar.style.zIndex = '1001';
// 모바일은 5개, 데스크톱/태블릿은 10개 정도가 중앙에 선명하게 보이도록 폭을 다르게 둔다.
paletteBar.style.width = isLikelyMobile ? '240px' : '460px';
// mask-image는 overflow:visible이어도 엘리먼트 박스 높이 안으로 렌더링을 가둔다.
// 그림자가 잘리지 않도록 스와치(40px)보다 넉넉하게 높이를 준다.
paletteBar.style.height = '72px';
paletteBar.style.overflow = 'visible';
// 좌우 끝은 그라데이션으로 자연스럽게 사라지도록 마스킹한다.
paletteBar.style.maskImage = 'linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)';
paletteBar.style.webkitMaskImage = paletteBar.style.maskImage;
paletteBar.style.opacity = '0';
paletteBar.style.pointerEvents = 'none';
paletteBar.style.transition = 'opacity 0.4s ease';
document.body.appendChild(paletteBar);

// 중앙 스와치 뒤에 깔리는 그림자. box-shadow는 블렌드 모드를 따로 줄 수 없어서 별도
// 엘리먼트로 만들고 mix-blend-mode: multiply로 배경과 곱해지게 한다.
// paletteBar는 자체 z-index(1001)로 스태킹 컨텍스트를 만들어서, 그 "안"에 넣으면
// 먼저 그려진 게 아무것도 없어 곱할 대상이 없어져 안 보이게 된다. 그래서 paletteBar
// 바깥(body 바로 아래, z-index만 한 단계 낮게)에 형제로 두고 같은 좌표에 겹쳐놓는다.
// 코브플로우일 때는 선택된 스와치가 항상 화면 중앙(오프셋 0)에 오지만, 그리드로
// 펼쳐지면 선택된 스와치가 그리드 안 자기 칸 위치로 옮겨간다. 그림자가 그 자리를
// 계속 따라가도록 기준 위치(중앙)에 오프셋만 transform으로 더해서 이동시킨다.
const paletteCenterShadow = document.createElement('div');
paletteCenterShadow.style.position = 'fixed';
// paletteBar(bottom:32px, height:72px)의 스와치 중심은 화면 하단에서 68px 지점.
// 그보다 6px 아래로 살짝 내려서 그림자처럼 보이게(76px 높이의 절반=38px를 뺀 값).
paletteCenterShadow.style.bottom = '36px';
paletteCenterShadow.style.left = '50%';
paletteCenterShadow.style.width = '76px';
paletteCenterShadow.style.height = '76px';
paletteCenterShadow.style.borderRadius = '50%';
paletteCenterShadow.style.transform = 'translate(-50%, 0)';
paletteCenterShadow.style.background = 'rgba(0, 0, 0, 0.6)';
paletteCenterShadow.style.filter = 'blur(24px)';
paletteCenterShadow.style.mixBlendMode = 'multiply';
paletteCenterShadow.style.pointerEvents = 'none';
paletteCenterShadow.style.zIndex = '1000';
paletteCenterShadow.style.opacity = '0';
paletteCenterShadow.style.transition = 'opacity 0.4s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
document.body.appendChild(paletteCenterShadow);

let lastClickPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// 스와치 사이 간격(px, 항상 동일)과, 크기/흐림/투명도 변화에 쓰는 각도(도).
// 각도 간격이 좁을수록 더 많은 스와치가 90도(사라지는 지점) 안쪽에 들어와 선명하게 보인다.
// 모바일: 5개(±2) / 데스크톱·태블릿: 10개(±4~5) 정도가 선명하게 보이도록 값을 다르게 둔다.
const PALETTE_SLOT_WIDTH = 46;
const PALETTE_ANGLE_STEP = isLikelyMobile ? 16 : 9;

// 재렌더링할 때마다 DOM을 통째로 새로 만들면(innerHTML='') 트랜지션이 걸릴 "이전 상태"가
// 없어서 스르륵 움직이는 모션이 재생되지 않는다. 같은 팔레트일 때는 기존 스와치 엘리먼트를
// 재사용하고 위치/크기만 갱신해야 부드럽게 슬라이드된다.
let paletteSwatchEls = [];
let paletteColorsKey = null;
let isPaletteGridOpen = false;

// 코브플로우(중앙 강조) 배치.
function positionSwatchCoverflow(swatch, idx) {
  // 좌우 간격은 항상 동일(px)하게 두고, 크기·흐림·투명도만 각도(cos)로 계산해서
  // 입체적으로 멀어지는 느낌을 준다.
  const raw = idx - currentPaletteIndex;
  const x = raw * PALETTE_SLOT_WIDTH;
  const angleDeg = Math.max(-100, Math.min(100, raw * PALETTE_ANGLE_STEP));
  const angleRad = (angleDeg * Math.PI) / 180;
  const depth = Math.cos(angleRad); // 1(정중앙)~0(옆면)~음수(휠 뒤로 넘어감)
  const visible = depth > 0;
  const scale = Math.max(0.15, depth);
  const blur = visible ? (1 - depth) * 5 : 6;
  const opacity = visible ? Math.max(0, depth) : 0;

  swatch.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px) scale(${scale.toFixed(3)})`;
  swatch.style.filter = `blur(${blur.toFixed(2)}px)`;
  swatch.style.opacity = opacity.toFixed(3);
  swatch.style.zIndex = String(Math.round(depth * 100));
  swatch.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none';
}

// 펼침 배치: 새 배경을 따로 만들지 않고, 코브플로우에 쓰던 같은 스와치 엘리먼트를
// 같은 바(paletteBar) 위에서 그리드로 늘어놓는다. 맨 아래 줄이 코브플로우가 있던
// 자리(오프셋 0)에 오고, 위 줄일수록 위로 쌓이는 방식이라 "펼쳐지는" 느낌을 준다.
const PALETTE_GRID_SLOT = 50;
// 모바일은 항상 정확히 5줄, 데스크톱·태블릿은 항상 정확히 2줄로만 펼친다.
const PALETTE_GRID_MOBILE_ROWS = 5;
const PALETTE_GRID_ROWS = 2;

function computePaletteGridDims() {
  const total = currentPalette.length;
  const rows = isLikelyMobile ? PALETTE_GRID_MOBILE_ROWS : PALETTE_GRID_ROWS;
  return { cols: Math.ceil(total / rows), rows };
}

function positionSwatchGrid(swatch, idx) {
  const { cols, rows } = computePaletteGridDims();
  const col = idx % cols;
  const rowFromTop = Math.floor(idx / cols);
  const x = (col - (cols - 1) / 2) * PALETTE_GRID_SLOT;
  const y = (rowFromTop - (rows - 1)) * PALETTE_GRID_SLOT;

  swatch.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(1)`;
  swatch.style.filter = 'blur(0px)';
  swatch.style.opacity = '1';
  swatch.style.zIndex = '10';
  swatch.style.pointerEvents = 'auto';
}

// 코브플로우에서는 선택된 스와치가 항상 오프셋 0(정중앙)에 있지만, 그리드에서는
// 자기 칸(col/row) 위치로 이동해 있으므로 그림자를 그 위치로 옮기기 위해 재사용한다.
function getSelectedSwatchOffset() {
  if (!isPaletteGridOpen) return { x: 0, y: 0 };
  const { cols, rows } = computePaletteGridDims();
  const col = currentPaletteIndex % cols;
  const rowFromTop = Math.floor(currentPaletteIndex / cols);
  const x = (col - (cols - 1) / 2) * PALETTE_GRID_SLOT;
  const y = (rowFromTop - (rows - 1)) * PALETTE_GRID_SLOT;
  return { x, y };
}

function updatePaletteShadowPosition() {
  const { x, y } = getSelectedSwatchOffset();
  paletteCenterShadow.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px)`;
}

function applyPaletteLayout() {
  paletteSwatchEls.forEach((swatch, idx) => {
    if (isPaletteGridOpen) positionSwatchGrid(swatch, idx);
    else positionSwatchCoverflow(swatch, idx);
  });
  updatePaletteShadowPosition();
}

// 계절(family) 팔레트든 톤(warm/cool/all) 팔레트든 같은 방식으로 스와치를 만들고 배치한다.
function renderPaletteFromList(palette, baseColor) {
  const key = palette.join(',');

  if (key !== paletteColorsKey) {
    // 완전히 다른 팔레트일 때만 스와치를 새로 만든다.
    paletteColorsKey = key;
    currentPalette = palette;
    paletteBar.innerHTML = '';
    paletteSwatchEls = currentPalette.map((swatchColor, idx) => {
      const swatch = document.createElement('button');
      swatch.style.position = 'absolute';
      swatch.style.top = '50%';
      swatch.style.left = '50%';
      swatch.style.width = '40px';
      swatch.style.height = '40px';
      swatch.style.borderRadius = pebbleBorderRadius(idx * 137 + 5000);
      swatch.style.border = 'none';
      swatch.style.padding = '0';
      // 버튼 기본 배경(브라우저별 회색/흰색)이 구멍 사이로 비치지 않도록 완전히 투명하게 둔다.
      // 실제 뚫려 보여야 할 색은 안쪽 hole 레이어가 맡는다.
      swatch.style.background = 'transparent';
      swatch.style.cursor = 'pointer';
      swatch.style.transition =
        'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.55s ease, opacity 0.55s ease, box-shadow 0.3s ease';
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        // 이미 중앙에 와 있는(선명해진) 스와치를 한 번 더 선택하면 "확정"으로 취급하고,
        // 아니면 평소처럼 그 색을 중앙으로 가져온다.
        if (isPracticeMode && idx === currentPaletteIndex) {
          confirmSwatchColor(swatchColor, swatch);
          return;
        }
        currentPaletteIndex = idx;
        changeOverlayColor(swatchColor);
      });

      // 실제 색과 체크(또는 확정 시 원형) 구멍을 담는 아래쪽 레이어.
      // mask는 이 레이어에만 걸어서, 위에 얹는 "마개"가 그 마스크의 영향을 받지 않게 한다
      // (같은 엘리먼트에 걸면 자식까지 뚫려버려 마개로 가릴 수 없기 때문).
      const hole = document.createElement('div');
      hole.style.position = 'absolute';
      hole.style.inset = '0';
      hole.style.borderRadius = 'inherit';
      hole.style.background = swatchColor;
      // 마스크로 뚫린 부분은 뒤쪽(화면 색)이 비치되, 뿌옇게 흐려 보이도록 반투명
      // 유리처럼 처리한다. 뒤쪽 색이 스와치 색과 거의 같아 구멍이 안 보이는 경우가
      // 많아서, 살짝 어둡게(brightness) 눌러 색이 같아도 구멍이 티가 나게 한다.
      hole.style.backdropFilter = 'blur(7px) brightness(0.78)';
      hole.style.webkitBackdropFilter = 'blur(7px) brightness(0.78)';
      swatch.appendChild(hole);
      swatch.holeEl = hole;

      // 체크 구멍을 평소엔 같은 색으로 덮어 가려두는 "마개". 중앙으로 오면 이 마개가
      // 스르륵 사라지면서(opacity transition) 체크 표시가 자연스럽게 드러난다.
      const plug = document.createElement('div');
      plug.style.position = 'absolute';
      plug.style.inset = '0';
      plug.style.borderRadius = 'inherit';
      plug.style.background = swatchColor;
      plug.style.transition = 'opacity 0.35s ease';
      plug.style.pointerEvents = 'none';
      swatch.appendChild(plug);
      swatch.plugEl = plug;

      paletteBar.appendChild(swatch);
      return swatch;
    });
  }

  const matchIndex = currentPalette.findIndex((c) => c.toLowerCase() === baseColor.toLowerCase());
  currentPaletteIndex = matchIndex >= 0 ? matchIndex : 0;

  paletteSwatchEls.forEach((swatch, idx) => {
    const swatchColor = currentPalette[idx];
    updateSwatchCheckMask(swatch, swatchColor);
    updateSwatchCheckPlug(swatch, idx, swatchColor);
  });

  applyPaletteLayout();
}

// 톤(웜/쿨/전체) 모드에 맞는 색상 목록을 반환한다. family 모드는 클릭한 색의 계절 팔레트.
function paletteListForMode(mode, baseColor) {
  if (mode === 'warm') return WARM_COLORS;
  if (mode === 'cool') return COOL_COLORS;
  if (mode === 'all') return ALL_COLORS;
  if (mode === 'confirmed') return confirmedColors;
  // 확정한 색 화면 안에서 어떤 탭(웜/쿨/명도 단계)을 고르든, 전체 팔레트가 아니라
  // "확정한 색들 중" 그 탭에 해당하는 것만 걸러서 보여준다(확정 화면 밖으로 벗어나지 않는다).
  if (mode.startsWith('confirmed-')) {
    const subMode = mode.slice('confirmed-'.length);
    const subList = paletteListForMode(subMode, baseColor);
    return confirmedColors.filter((c) => subList.some((w) => w.toLowerCase() === c.toLowerCase()));
  }
  const valueLevelIndex = VALUE_LEVEL_LABELS.findIndex((_, i) => mode === `value${i}`);
  if (valueLevelIndex >= 0) return VALUE_LEVELS[valueLevelIndex];
  const chromaLevelIndex = CHROMA_LEVEL_LABELS.findIndex((_, i) => mode === `chroma${i}`);
  if (chromaLevelIndex >= 0) return CHROMA_LEVELS[chromaLevelIndex];
  return familyPaletteFor(baseColor);
}

function renderPalette(baseColor) {
  currentPaletteMode = 'family';
  renderPaletteFromList(familyPaletteFor(baseColor), baseColor);
  updateToneTabsActive();
}

// 현재 톤 모드를 기준으로 팔레트를 새로 그린다(색이 바뀌어도 웜/쿨/전체 모드는 유지).
function refreshPaletteForCurrentColor(baseColor) {
  if (currentPaletteMode === 'family') {
    renderPalette(baseColor);
  } else {
    renderPaletteFromList(paletteListForMode(currentPaletteMode, baseColor), baseColor);
  }
}

function setPaletteMode(mode) {
  currentPaletteMode = mode;
  const list = paletteListForMode(mode, currentColor);
  // 확정한 색을 웜/쿨로 걸렀을 때 한쪽이 비어 있을 수 있다 — 그럴 땐 배경색을 그대로 둔다.
  const baseColor = list.length === 0
    ? currentColor
    : (list.some((c) => c.toLowerCase() === currentColor.toLowerCase()) ? currentColor : list[0]);

  // 탭 전환도 스와치를 고른 것과 동일하게 취급해 전체 화면 배경을 새 팔레트의 기준색으로 맞춘다.
  currentColor = baseColor;
  colorOverlay.style.background = baseColor;
  updateBackButtonContrast(baseColor);
  updatePaletteShadowColor(baseColor);
  updateToneTabsContrast(baseColor);
  updatePaletteViewButtonContrast(baseColor);

  renderPaletteFromList(list, baseColor);
  updateToneTabsActive();
}

// 팔레트 바 위의 화살표: 누르면 새 배경을 만들지 않고 기존 팔레트 바(paletteBar)와
// 그 안의 스와치들을 그대로 그리드로 펼쳐서 톤 계열의 색 전체를 보여준다.
// 모양(끝이 둥근 넓적한 삼각형)과 아래로 갈수록 흐려지는 페이드를 하나의 SVG 마스크로 합쳐서 그린다.
const ARROW_MASK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 40">' +
  '<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="#fff" stop-opacity="1"/>' +
  '<stop offset="45%" stop-color="#fff" stop-opacity="0.85"/>' +
  '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
  '</linearGradient></defs>' +
  '<path d="M0,40 L32.5,5.8 Q38,0 43.5,5.8 L76,40 Z" fill="url(#f)"/>' +
  '</svg>';
const ARROW_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(ARROW_MASK_SVG)}")`;

// filter:blur()는 mask-image보다 먼저 적용되고, 그 위에 마스크가 다시 선명한 벡터
// 모양으로 잘라내 버려서 같은 엘리먼트에 둘 다 걸면 블러가 안 보인다. 그래서 도형+색을
// 담는 안쪽 엘리먼트(paletteExpandArrowFill)와, 그 결과물 전체를 블러 처리하는
// 바깥 래퍼(paletteExpandArrow)로 나눈다.
const paletteExpandArrow = document.createElement('button');
paletteExpandArrow.setAttribute('aria-label', '전체 색상 보기');
paletteExpandArrow.style.position = 'fixed';
paletteExpandArrow.style.bottom = '124px';
paletteExpandArrow.style.left = '50%';
paletteExpandArrow.style.zIndex = '1001';
paletteExpandArrow.style.width = '76px';
paletteExpandArrow.style.height = '40px';
paletteExpandArrow.style.border = 'none';
paletteExpandArrow.style.padding = '0';
paletteExpandArrow.style.background = 'transparent';
paletteExpandArrow.style.cursor = 'pointer';
paletteExpandArrow.style.opacity = '0';
paletteExpandArrow.style.pointerEvents = 'none';
paletteExpandArrow.style.transform = 'translateX(-50%) rotate(0deg)';
paletteExpandArrow.style.filter = 'blur(3.5px)';
paletteExpandArrow.style.transition = 'opacity 0.4s ease, transform 0.3s ease, bottom 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
document.body.appendChild(paletteExpandArrow);

const paletteExpandArrowFill = document.createElement('div');
paletteExpandArrowFill.style.position = 'absolute';
paletteExpandArrowFill.style.inset = '0';
// 글자(▲) 대신 도형 자체를 팔레트 그림자 색으로 채운다(색/투명도는 updatePaletteShadowColor에서 지정).
paletteExpandArrowFill.style.background = 'transparent';
paletteExpandArrowFill.style.transition = 'background 0.4s ease';
paletteExpandArrowFill.style.maskImage = ARROW_MASK_URL;
paletteExpandArrowFill.style.webkitMaskImage = ARROW_MASK_URL;
paletteExpandArrowFill.style.maskSize = '100% 100%';
paletteExpandArrowFill.style.webkitMaskSize = '100% 100%';
paletteExpandArrowFill.style.maskRepeat = 'no-repeat';
paletteExpandArrowFill.style.webkitMaskRepeat = 'no-repeat';
paletteExpandArrow.appendChild(paletteExpandArrowFill);

// 화면 맨 하단의 Warm/Cool 탭: 계절 팔레트 대신 웜톤(봄+가을) 또는 쿨톤(여름+겨울) 전체를 보여준다.
// 튜토리얼을 거쳐 실전 모드로 들어왔을 때만 보이며(isPracticeMode), 카드를 직접 클릭한
// 평소 흐름에서는 쓰지 않는다.
const paletteToneTabs = document.createElement('div');
paletteToneTabs.style.position = 'fixed';
paletteToneTabs.style.bottom = '22px';
paletteToneTabs.style.left = '50%';
paletteToneTabs.style.transform = 'translateX(-50%)';
paletteToneTabs.style.zIndex = '1001';
paletteToneTabs.style.display = 'flex';
paletteToneTabs.style.flexWrap = 'wrap';
paletteToneTabs.style.justifyContent = 'center';
// position:fixed 요소는 width:auto면 내용에 맞춰 줄어드는(shrink-to-fit) 폭을
// 갖는데, 그러면 실제로 쓸 수 있는 가로 공간을 다 활용하지 못한 채로 줄바꿈
// 여부가 정해져 짧은 탭 4개도 두 줄로 밀려날 수 있다. width:100%를 줘서
// max-width까지 실제로 넓게 펴진 뒤에만 줄바꿈이 필요할 때 일어나게 한다.
paletteToneTabs.style.width = '100%';
paletteToneTabs.style.maxWidth = 'min(640px, 92vw)';
paletteToneTabs.style.gap = '20px';
paletteToneTabs.style.opacity = '0';
paletteToneTabs.style.pointerEvents = 'none';
paletteToneTabs.style.transition = 'opacity 0.4s ease';
document.body.appendChild(paletteToneTabs);

// 'tone'(웜/쿨) | 'value'(명도 단계) — "선택" 버튼으로 넘어가는 실전 단계.
let practiceStage = 'tone';
let toneTabButtons = [];

function makeStageTabButton(label, mode) {
  const tab = document.createElement('button');
  tab.textContent = label;
  tab.dataset.mode = mode;
  tab.style.background = 'transparent';
  tab.style.border = 'none';
  tab.style.fontSize = '12px';
  tab.style.letterSpacing = '0.04em';
  tab.style.cursor = 'pointer';
  tab.style.padding = '4px 2px';
  tab.addEventListener('click', (e) => {
    e.stopPropagation();
    // 종합 단계의 계절 탭은 코브플로우 팔레트가 아니라 색 구름 배경 자체를 그 계절
    // 색으로만 다시 그린다.
    if (mode.startsWith('season')) {
      const seasonIndex = parseInt(mode.slice('season'.length), 10);
      renderSynthesisBackdrop(seasonIndex);
      setSynthesisBackgroundColor(seasonIndex);
      currentPaletteMode = mode;
      updateToneTabsActive();
      return;
    }
    // 확정한 색 화면 안에 있을 때는 어떤 탭(웜/쿨/명도 단계)을 눌러도 전체 팔레트로
    // 나가지 않고, 확정한 색들 중 그 탭에 해당하는 것만 걸러 보여준다.
    if (currentPaletteMode.startsWith('confirmed')) {
      setPaletteMode(`confirmed-${mode}`);
    } else {
      setPaletteMode(mode);
    }
  });
  paletteToneTabs.appendChild(tab);
  toneTabButtons.push(tab);
  return tab;
}

// 지금 단계(웜/쿨 또는 명도)에 맞는 탭 버튼들을 다시 그린다.
function renderStageTabs() {
  paletteToneTabs.innerHTML = '';
  toneTabButtons = [];
  // 모바일 폭에서는 "Deepest/Deep/Light/Lightest"처럼 긴 라벨 4개가 한 줄에 못
  // 들어가 둘째 줄로 밀려났다. 글자 크기와 간격을 줄여 한 줄에 들어가게 한다.
  const isNarrow = window.innerWidth < 480;
  if (practiceStage === 'value') {
    paletteToneTabs.style.gap = isNarrow ? '4px 10px' : '20px';
    VALUE_LEVEL_LABELS.forEach((label, i) => {
      const tab = makeStageTabButton(label, `value${i}`);
      if (isNarrow) {
        tab.style.fontSize = '10.5px';
        tab.style.padding = '3px 1px';
      }
    });
  } else if (practiceStage === 'chroma') {
    paletteToneTabs.style.gap = isNarrow ? '4px 10px' : '20px';
    CHROMA_LEVEL_LABELS.forEach((label, i) => {
      const tab = makeStageTabButton(label, `chroma${i}`);
      if (isNarrow) {
        tab.style.fontSize = '10.5px';
        tab.style.padding = '3px 1px';
      }
    });
  } else if (practiceStage === 'synthesis') {
    // 16타입은 한 줄에 다 못 들어가므로 줄바꿈하고, 4개(같은 계절)씩 묶어 보이도록
    // 그룹 경계에서만 간격을 살짝 더 준다.
    paletteToneTabs.style.gap = '6px 14px';
    SEASON16_TAB_LABELS.forEach((label, i) => {
      const tab = makeStageTabButton(label, `season${i}`);
      tab.style.fontSize = '10.5px';
      tab.style.padding = '3px 1px';
      if (i > 0 && i % 4 === 0) tab.style.marginLeft = '10px';
    });
  } else {
    paletteToneTabs.style.gap = '20px';
    makeStageTabButton('Warm', 'warm');
    makeStageTabButton('Cool', 'cool');
  }
  updateToneTabsActive();
  updateToneTabsContrast(currentColor);
}
renderStageTabs();

function updateToneTabsActive() {
  toneTabButtons.forEach((tab) => {
    const mode = tab.dataset.mode;
    const active = currentPaletteMode === mode || currentPaletteMode === `confirmed-${mode}`;
    tab.style.opacity = active ? '1' : '0.5';
    tab.style.fontWeight = active ? '700' : '400';
  });
}

// 배경색 명도에 맞춰 탭 글씨 색도 뒤로가기 버튼과 같은 규칙으로 바꾼다.
function updateToneTabsContrast(color) {
  const { l } = hexToHSL(color);
  const textColor = l < 50 ? '#ffffff' : '#111111';
  toneTabButtons.forEach((tab) => { tab.style.color = textColor; });
}

// 스와치 자체에 "뚫어놓은" 듯한 체크 표시(마스크)와, 확정 후의 원형 표시.
// 흰 부분은 그대로 보이고 검은 부분은 투명해지는 CSS mask 원리를 이용해, 스와치 색을
// 배경 삼아 체크 모양만 뻥 뚫려 뒤(팔레트 아래 깔린 화면색)가 비쳐 보이게 한다.
// backdrop-filter의 blur는 뒤가 단색(평평한 화면 색)이면 티가 안 나서, 마스크
// 모양 자체에 SVG 가우시안 블러를 걸어 구멍의 가장자리가 또렷한 선이 아니라
// 뿌옇게 번지도록 만든다 — 이게 실제로 눈에 보이는 "블러" 효과를 만든다.
const SWATCH_MASK_BLUR_FILTER = '<filter id="b"><feGaussianBlur stdDeviation="1.6"/></filter>';

const SWATCH_CHECK_MASK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
  `<defs>${SWATCH_MASK_BLUR_FILTER}</defs>` +
  '<rect width="40" height="40" fill="white"/>' +
  '<path d="M11 21l6.5 6.5L29 13" stroke="black" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#b)"/>' +
  '</svg>';
const SWATCH_CHECK_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(SWATCH_CHECK_MASK_SVG)}")`;

const SWATCH_CONFIRMED_MASK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
  `<defs>${SWATCH_MASK_BLUR_FILTER}</defs>` +
  '<rect width="40" height="40" fill="white"/>' +
  '<circle cx="20" cy="20" r="7" fill="black" filter="url(#b)"/>' +
  '</svg>';
const SWATCH_CONFIRMED_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(SWATCH_CONFIRMED_MASK_SVG)}")`;

// 실전 모드의 스와치에만 체크(또는 확정된 색이면 원형) 구멍을 뚫는다. 코브플로우가 이미
// 중앙으로 올수록 스와치 자체를 선명하게(블러/투명도↓) 만들어주므로, 이 구멍도 자연히
// 중앙에 올 때 또렷해지고 옆으로 갈수록 흐려진다 — 스와치와 한 몸이기 때문이다.
function updateSwatchCheckMask(swatch, color) {
  const hole = swatch.holeEl;
  if (!hole) return;
  if (!isPracticeMode) {
    hole.style.maskImage = 'none';
    hole.style.webkitMaskImage = 'none';
    return;
  }
  const isConfirmed = confirmedColors.some((c) => c.toLowerCase() === color.toLowerCase());
  const maskUrl = isConfirmed ? SWATCH_CONFIRMED_MASK_URL : SWATCH_CHECK_MASK_URL;
  hole.style.maskImage = maskUrl;
  hole.style.webkitMaskImage = maskUrl;
  hole.style.maskSize = '100% 100%';
  hole.style.webkitMaskSize = '100% 100%';
  hole.style.maskRepeat = 'no-repeat';
  hole.style.webkitMaskRepeat = 'no-repeat';
  // 기본값(alpha 모드)에서는 흰색/검은색이 전부 "불투명"이라 뚫리지 않는다.
  // 명도(luminance) 기준으로 구멍을 뚫도록 명시해야 검은 부분이 실제로 비친다.
  hole.style.maskMode = 'luminance';
  hole.style.webkitMaskMode = 'luminance';
}

// 확정된 색의 원형 표시는 위치와 무관하게 항상 드러나 있고(마개 없음), 아직 확정 전인
// 체크 표시는 그 스와치가 중앙에 와 있을 때만 마개가 사라지며 자연스럽게 나타난다.
function updateSwatchCheckPlug(swatch, idx, color) {
  if (!swatch.plugEl) return;
  if (!isPracticeMode) {
    swatch.plugEl.style.opacity = '1';
    return;
  }
  const isConfirmed = confirmedColors.some((c) => c.toLowerCase() === color.toLowerCase());
  if (isConfirmed) {
    swatch.plugEl.style.opacity = '0';
    return;
  }
  swatch.plugEl.style.opacity = idx === currentPaletteIndex ? '0' : '1';
}

// 우측 상단의 팔레트(확정 색 목록) 아이콘. 튜토리얼 아이콘과 같은 자리를 쓰되,
// 실전 모드에서만 나타난다.
const paletteViewButton = document.createElement('button');
paletteViewButton.setAttribute('aria-label', '확정한 색 보기');
paletteViewButton.style.position = 'fixed';
paletteViewButton.style.top = '28px';
paletteViewButton.style.right = '28px';
paletteViewButton.style.zIndex = '1002';
paletteViewButton.style.background = 'transparent';
paletteViewButton.style.border = 'none';
paletteViewButton.style.padding = '0';
// 정확히 정사각형으로 고정해야 발광(border-radius:50%)이 타원이 아니라 진짜 원으로 보인다
// (버튼 안 SVG를 인라인 콘텐츠로만 두면 베이스라인 여백 때문에 세로로 살짝 더 커진다).
paletteViewButton.style.width = '32px';
paletteViewButton.style.height = '32px';
paletteViewButton.style.display = 'flex';
paletteViewButton.style.alignItems = 'center';
paletteViewButton.style.justifyContent = 'center';
paletteViewButton.style.cursor = 'pointer';
paletteViewButton.style.opacity = '0';
paletteViewButton.style.pointerEvents = 'none';
paletteViewButton.style.transition = 'opacity 0.3s ease';
// PNG 아이콘은 SVG의 currentColor처럼 색을 못 받아오므로, mask-image로 아이콘
// 모양만 따와서 배경색(currentColor)을 채운다. 그러면 기존처럼 배경 명도에 따라
// 흰색/검정으로 자동으로 뒤집히는 대비 효과가 그대로 유지된다.
paletteViewButton.innerHTML =
  '<div style="width:13px;height:14px;background-color:currentColor;' +
  '-webkit-mask-image:url(\'icon-palette.png\');mask-image:url(\'icon-palette.png\');' +
  '-webkit-mask-size:contain;mask-size:contain;' +
  '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;' +
  '-webkit-mask-position:center;mask-position:center;"></div>';
document.body.appendChild(paletteViewButton);

// "선택" 텍스트: 눌러서 다음 단계(웜/쿨 → 명도)로 넘어간다. 팔레트 아이콘 왼쪽에 둔다.
const stageAdvanceButton = document.createElement('button');
stageAdvanceButton.setAttribute('aria-label', '다음 단계로');
stageAdvanceButton.textContent = 'Select';
stageAdvanceButton.style.position = 'fixed';
stageAdvanceButton.style.top = '28px';
stageAdvanceButton.style.right = '28px';
stageAdvanceButton.style.zIndex = '1002';
stageAdvanceButton.style.height = '32px';
stageAdvanceButton.style.display = 'flex';
stageAdvanceButton.style.alignItems = 'center';
stageAdvanceButton.style.background = 'transparent';
stageAdvanceButton.style.border = 'none';
stageAdvanceButton.style.padding = '0';
stageAdvanceButton.style.fontSize = '13px';
stageAdvanceButton.style.letterSpacing = '0.02em';
stageAdvanceButton.style.cursor = 'pointer';
stageAdvanceButton.style.opacity = '0';
stageAdvanceButton.style.pointerEvents = 'none';
stageAdvanceButton.style.transition = 'opacity 0.3s ease';
document.body.appendChild(stageAdvanceButton);

// 단계 전환 전에 잠깐 보여주는 안내 문구(예전 튜토리얼의 드레이핑 설명을 그대로 다시 씀).
// "Select"를 누르면 화면 전체가 어둡게+블러 처리되며 이 문구가 뜨고, 그 위(배경)를
// 누르면 실제로 다음 단계 팔레트로 넘어간다.
const STAGE_HINTS = {
  value: {
    eyebrow: '단계 3 · 2차 드레이핑',
    heading: '명도 (Light / Deep)',
    body: '밝은 컬러 앞에서 이목구비가 또렷해지는지, 어두운 컬러 앞에서도 얼굴이 살아있는지를 봅니다. 컬러가 너무 밝아 얼굴이 그늘져 보이면 딥, 컬러가 너무 어두워 얼굴이 칙칙해지면 라이트 그룹입니다.',
  },
  chroma: {
    eyebrow: '단계 4 · 3차 드레이핑',
    heading: '채도 (Clear / Soft)',
    body: '쨍한 원색 앞에서 얼굴이 생기 있게 살아나는지, 뮤트톤 앞에서 편안하고 조화로워 보이는지를 봅니다. 눈빛과 이목구비 대비가 뚜렷해지면 클리어, 부드럽게 어우러지면 소프트 그룹입니다.',
  },
  synthesis: {
    eyebrow: '단계 5 · 종합',
    heading: '4계절 / 16계절 매핑',
    body: '언더톤, 명도, 채도 세 가지 결과를 조합하면 나의 시즌이 정해집니다. 웜하고 밝고 선명하면 봄, 쿨하고 밝고 부드러우면 여름, 웜하고 깊고 부드러우면 가을, 쿨하고 깊고 선명하면 겨울에 가깝습니다. 더 세분화된 16계절 시스템에서는 같은 계절 안에서 밝기나 선명도에 따라 조금 더 나뉘기도 합니다. 마지막으로 확정된 시즌의 대표 팔레트를 다시 얼굴에 대보며 안색 투명도, 윤곽 선명도, 다크서클 변화를 교차 확인하면 결과가 더 정확해집니다.',
  },
  tone: {
    eyebrow: '단계 2 · 1차 드레이핑',
    heading: '언더톤 (Warm / Cool)',
    body: '피부가 화사해지는지, 아니면 누렇거나 칙칙하게 가라앉는지를 봅니다. 다크서클 색 변화도 중요한 단서입니다. 웜 컬러 아래서 다크서클이 브라운톤으로 자연스럽게 묻히면 웜, 쿨 컬러 아래서 오히려 옅어지면 쿨입니다.',
  },
};
// 단계 순환 순서: 웜/쿨 → 명도 → 채도 → 종합(마지막, "Select"가 결과 분석으로 특별 동작).
const STAGE_ORDER = ['tone', 'value', 'chroma', 'synthesis'];
let pendingStageIntro = null;
// 종합 단계에서 "Select"를 누르면 결과 문구가 뜨는데, 그 문구를 닫을 때(배경 클릭)
// 다음 단계로 넘어가는 대신 결과 모빌 화면을 보여줘야 하므로 별도로 기억해둔다.
let pendingFinalSeason = null;
// 메이크업 팁(결과) 화면을 보고 있는 동안만 true. "← Back"이 여기서는 종료가 아니라
// 종합(색 구름) 화면으로 되돌아가게 하는 데 쓴다.
let isShowingBeautyTips = false;

// 4계절(각 25색)을 명도 순으로 다시 4등분해 16타입으로 세분화한다. 계절별 순서는
// 밝은 쪽 끝부터 어두운 쪽 끝까지이며, 실제 16타입 진단에서 쓰는 이름을 그대로 붙였다.
const SEASON16_LABELS = [
  ['봄 페일', '봄 라이트', '봄 브라이트', '봄 비비드'],
  ['여름 페일', '여름 라이트', '여름 브라이트', '여름 뮤트'],
  ['가을 뮤트', '가을 스트롱', '가을 딥', '가을 다크'],
  ['겨울 비비드', '겨울 스트롱', '겨울 딥', '겨울 다크'],
];
const SEASON16_GROUPS = (() => {
  const segment = count / SEASON16_LABELS.length;
  const groups = [];
  SEASON16_LABELS.forEach((labels, parentIdx) => {
    const seasonColors = colors.slice(parentIdx * segment, (parentIdx + 1) * segment);
    const sorted = [...seasonColors].sort((a, b) => hexToHSL(b).l - hexToHSL(a).l);
    const chunkSize = Math.ceil(sorted.length / labels.length);
    labels.forEach((name, i) => {
      groups.push({
        name,
        parent: parentIdx,
        colors: sorted.slice(i * chunkSize, (i + 1) * chunkSize),
      });
    });
  });
  return groups;
})();
const SEASON16_NAMES = SEASON16_GROUPS.map((g) => g.name);

// 종합 단계 하단 탭에는 이 영문 이름을 쓴다(결과 화면 문구·팁 매칭은 위의 한글
// 이름을 그대로 쓰고, 탭 표시만 다른 화면들과 톤을 맞춰 영어로 보여준다).
const SEASON16_TAB_LABELS = [
  'Spring Pale', 'Spring Light', 'Spring Bright', 'Spring Vivid',
  'Summer Pale', 'Summer Light', 'Summer Bright', 'Summer Mute',
  'Autumn Mute', 'Autumn Strong', 'Autumn Deep', 'Autumn Dark',
  'Winter Vivid', 'Winter Strong', 'Winter Deep', 'Winter Dark',
];

// 지금까지 확정한 색들이 16타입 중 어디에 가장 많이 속하는지 세어 가장 많은 타입을 고른다.
function computeDominantSeason16() {
  const counts = new Array(SEASON16_GROUPS.length).fill(0);
  confirmedColors.forEach((hex) => {
    const idx = SEASON16_GROUPS.findIndex((g) =>
      g.colors.some((c) => c.toLowerCase() === hex.toLowerCase())
    );
    if (idx === -1) return;
    counts[idx] += 1;
  });
  let winner = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[winner]) winner = i;
  }
  return winner;
}

// 종합 단계의 배경: 흐릿하게 번진 원(블롭)들이 무작위로 흩뿌려진 채 왼쪽에서
// 오른쪽으로 천천히 흘러가는 화면. 16타입 중 고른 그룹의 색만 재료로 쓴다.
//
// 이전 버전은 원 하나하나를 <div>로 만들어 각각에 filter:blur를 걸었더니(개수가
// 많다 보니) 애니메이션이 매끄럽지 못하고 자꾸 끊겼다. 그래서 방식을 바꿔, 원들은
// 먼저 <canvas>에 미리 한 번 그려두고(정적 이미지), 블러도 그 이미지 전체에 딱
// 한 번만 건다. 실제로 매 프레임 움직이는 건 이 "이미 완성된 이미지" 레이어를
// transform으로 옮기는 것뿐이라, 브라우저가 GPU에서 그 레이어를 그대로 밀기만
// 하면 되어 훨씬 가볍고 끊기지 않는다.
const synthesisBackdrop = document.createElement('div');
synthesisBackdrop.style.position = 'fixed';
synthesisBackdrop.style.inset = '0';
synthesisBackdrop.style.zIndex = '1000';
synthesisBackdrop.style.overflow = 'hidden';
synthesisBackdrop.style.opacity = '0';
synthesisBackdrop.style.pointerEvents = 'none';
synthesisBackdrop.style.transition = 'opacity 0.5s ease';
document.body.appendChild(synthesisBackdrop);

let currentSynthesisSeasonIndex = 0;

// 화면 폭만큼의 "한 주기"에 해당하는 캔버스 이미지를 그린 뒤, 그 이미지를 통째로
// 오른쪽에 한 번 더 이어 붙이고 정확히 한 주기만큼 가로로 흘려보낸다. 두 이미지가
// 완전히 똑같으니 한 바퀴 돌면 이음매 없이 처음과 같아진다.
function renderSynthesisBackdrop(seasonIndex) {
  currentSynthesisSeasonIndex = seasonIndex;
  synthesisBackdrop.innerHTML = '';
  const groupColors = SEASON16_GROUPS[seasonIndex].colors;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const isSmall = W < 480;
  const minSize = isSmall ? 170 : 230;
  const maxSize = isSmall ? 340 : 480;

  // 원 중심이 화면 변에 걸리면(블러가 얕아) 반원째로 잘려 보이므로, 원 중심 자체를
  // 화면 안쪽에만 두지 않고 가장자리 바깥 여백(MARGIN)까지 넓혀 흩뿌린다. 그러면
  // 변에 걸리는 원들도 중심이 아니라 가장자리의 완만한 호만 화면 안에 들어온다.
  const MARGIN = maxSize * 0.42;
  const spreadW = W + MARGIN * 2;
  const spreadH = H + MARGIN * 2;
  const seedOffset = seasonIndex * 971;
  const BLOB_COUNT = Math.max(46, Math.round((spreadW * spreadH) / 19000));
  const EDGE_SIZE = isSmall ? 340 : 460;
  const EDGE_PUSH = EDGE_SIZE * 0.3;

  const avgSize = (minSize + maxSize) / 2;
  const BLUR_PX = Math.round(avgSize * 0.16);
  // CSS blur는 원소 "안"만이 아니라 그 원소의 바깥 경계에서도 계산되는데, 경계
  // 바로 밖에는 아무것도 그려진 게 없어 브라우저가 그 부분을 투명으로 취급한다.
  // 캔버스를 화면 크기에 딱 맞게만 만들면 이 "경계 흐림"이 하필 화면 진짜 가장
  // 자리에서 일어나 허연 얼룩으로 보인다. 그래서 캔버스 자체를 블러 반경만큼
  // 화면보다 더 크게 그려서, 흐려지는 경계가 화면 밖(안 보이는 곳)에 오게 한다.
  const OVERHANG = Math.max(MARGIN, BLUR_PX * 3);

  // 씨드가 같으면(계절 인덱스로 결정) 두 번 그려도 완전히 같은 그림이 나오므로,
  // period/periodCopy용 캔버스를 각각 그려도(clone 대신) 픽셀이 정확히 일치한다.
  function drawPeriodCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasW = W + OVERHANG * 2;
    const canvasH = H + OVERHANG * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(canvasW * dpr));
    canvas.height = Math.max(1, Math.round(canvasH * dpr));
    canvas.style.position = 'absolute';
    canvas.style.left = `${-OVERHANG}px`;
    canvas.style.top = `${-OVERHANG}px`;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // 이 지점부터는 (0,0)이 화면의 진짜 (0,0)이 되도록 좌표를 다시 원점 이동한다.
    // 그러면 아래 원 배치 코드는 캔버스가 커진 걸 신경 쓸 필요 없이 그대로 쓴다.
    ctx.translate(OVERHANG, OVERHANG);

    // 원이 화면을 완전히 못 덮는 지점이 생기면 그 자리는 캔버스의 "빈 곳"(완전
    // 투명)으로 남는데, 여기에 블러를 걸면 투명한 곳 쪽으로 색이 옅어지면서 뒤에
    // 있는 흰 배경이 비쳐 가장자리가 허옇게 뜬다. 그래서 원을 그리기 전에 이
    // 그룹 색 중 하나로 캔버스 전체(여백 포함)를 먼저 채워, 완전히 투명한 픽셀이
    // 아예 생기지 않게 한다(빈틈이 있어도 팔레트 색이 보이지, 흰색이 보이지 않는다).
    ctx.fillStyle = groupColors[Math.floor(groupColors.length / 2)];
    ctx.fillRect(-OVERHANG, -OVERHANG, canvasW, canvasH);

    function drawCircle(color, x, y, size) {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    function placeBlob(color, x, y, size) {
      drawCircle(color, x, y, size);
      // 좌우 가장자리 근처의 원은 반대쪽 가장자리에도 한 번 더 그려둔다. 가로로
      // 흐르다 한 주기를 돌아 이어질 때 이 원이 양쪽에 걸쳐 있어야 이음매에서
      // 빈틈 없이 자연스럽게 이어진다.
      if (x < size / 2) drawCircle(color, x + W, y, size);
      if (x > W - size / 2) drawCircle(color, x - W, y, size);
    }

    for (let i = 0; i < BLOB_COUNT; i++) {
      const sb = seedOffset + i * 17;
      const size = minSize + seeded(sb) * (maxSize - minSize);
      const x = -MARGIN + seeded(sb + 1) * spreadW;
      const y = -MARGIN + seeded(sb + 2) * spreadH;
      const color = groupColors[Math.floor(seeded(sb + 3) * groupColors.length) % groupColors.length];
      placeBlob(color, x, y, size);
    }

    // 화면 네 변은 무작위 배치만으로 빈틈이 남을 수 있어 큼직한 원으로 보강한다.
    // 중심을 변 위가 아니라 변 바깥으로 밀어둬서 잘린 반원 모양이 생기지 않게 한다.
    const EDGE_H_STEPS = Math.ceil(W / (EDGE_SIZE * 0.5)) + 1;
    for (let i = 0; i <= EDGE_H_STEPS; i++) {
      const x = (i / EDGE_H_STEPS) * W;
      placeBlob(groupColors[i % groupColors.length], x, -EDGE_PUSH, EDGE_SIZE);
      placeBlob(groupColors[(i + 2) % groupColors.length], x, H + EDGE_PUSH, EDGE_SIZE);
    }
    const EDGE_V_STEPS = Math.ceil(H / (EDGE_SIZE * 0.5)) + 1;
    for (let i = 0; i <= EDGE_V_STEPS; i++) {
      const y = (i / EDGE_V_STEPS) * H;
      placeBlob(groupColors[(i + 1) % groupColors.length], -EDGE_PUSH, y, EDGE_SIZE);
      placeBlob(groupColors[(i + 3) % groupColors.length], W + EDGE_PUSH, y, EDGE_SIZE);
    }

    return canvas;
  }

  const track = document.createElement('div');
  track.className = 'synthesis-track';
  track.style.position = 'absolute';
  track.style.left = '0';
  track.style.top = '0';
  track.style.width = `${W * 2}px`;
  track.style.height = '100%';
  // 블러는 개별 원이 아니라 이 트랙 전체(=이미 그려진 이미지 두 장)에 딱 한 번만
  // 걸어서, 실제 애니메이션 중에는 다시 계산할 필요 없이 GPU가 레이어만 옮기면 된다.
  track.style.filter = `blur(${BLUR_PX}px)`;
  track.style.willChange = 'transform';
  track.style.animation = `synthesisDrift ${Math.max(42, Math.round(W / 11))}s linear infinite`;

  const period = drawPeriodCanvas();
  const periodCopy = drawPeriodCanvas();
  // drawPeriodCanvas가 기본으로 준 left(-OVERHANG)에 W만 더해, 캔버스 자체의
  // 여백 오프셋은 유지한 채 "한 주기만큼 오른쪽"으로만 옮긴다.
  periodCopy.style.left = `${W - OVERHANG}px`;

  track.appendChild(period);
  track.appendChild(periodCopy);
  synthesisBackdrop.appendChild(track);
}

// 화면 크기가 바뀌면(회전, 리사이즈) 원 배치를 다시 계산해 새 크기에서도 빈틈이 없게 한다.
let synthesisResizeTimer = null;
window.addEventListener('resize', () => {
  if (synthesisBackdrop.style.opacity !== '1') return;
  clearTimeout(synthesisResizeTimer);
  synthesisResizeTimer = setTimeout(() => {
    renderSynthesisBackdrop(currentSynthesisSeasonIndex);
  }, 200);
});

// 배경색과, 그 위에 놓인 UI들의 명도 대비를 한 번에 맞춘다.
function applyBackgroundTone(color) {
  currentColor = color;
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteViewButtonContrast(color);
  updateToneTabsContrast(color);
}

// 색 구름 뒤에 깔린 화면 배경도 지금 고른 16타입 그룹의 톤(연한 평균색)으로 맞춘다.
function setSynthesisBackgroundColor(seasonIndex) {
  applyBackgroundTone(paleFamilyColor(SEASON16_GROUPS[seasonIndex].colors));
}

// 종합 단계로 들어오면 팔레트 관련 UI를 모두 걷어내고 색 구름 배경만 보여준다.
// 여기서는 아이콘 대신 "Select"만 우측 상단에 계속 남아, 누르면 결과로 이어진다.
function enterSynthesisStage() {
  paletteBar.style.opacity = '0';
  paletteBar.style.pointerEvents = 'none';
  paletteCenterShadow.style.opacity = '0';
  paletteExpandArrow.style.opacity = '0';
  paletteExpandArrow.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '0';
  paletteViewButton.style.pointerEvents = 'none';

  // 하단 탭은 숨기지 않고 계절 4개로 다시 그려서, 눌렀을 때 한 계절 색만 화면 전체에 보이게 한다.
  renderStageTabs();
  currentPaletteMode = 'season0';
  renderSynthesisBackdrop(0);
  setSynthesisBackgroundColor(0);
  updateToneTabsActive();
  paletteToneTabs.style.opacity = '1';
  paletteToneTabs.style.pointerEvents = 'auto';

  synthesisBackdrop.style.opacity = '1';
  stageAdvanceButton.style.opacity = '1';
  stageAdvanceButton.style.pointerEvents = 'auto';
}

// "← Back"이 웜/쿨 → 명도 → 채도 → 종합으로 이어지는 단계들 사이에서는 화면 전체를
// 나가지 않고 바로 이전 단계로만 돌아가게 한다(첫 단계인 웜/쿨에서만 화면을 나간다).
function goToPreviousStage() {
  const idx = STAGE_ORDER.indexOf(practiceStage);
  const prevStage = STAGE_ORDER[idx - 1];
  const wasSynthesis = practiceStage === 'synthesis';
  practiceStage = prevStage;
  renderStageTabs();

  if (wasSynthesis) {
    // 종합 단계의 색 구름 배경을 걷고, 감춰뒀던 팔레트 관련 UI를 되돌린다.
    synthesisBackdrop.style.opacity = '0';
    synthesisBackdrop.style.pointerEvents = 'none';
    paletteBar.style.opacity = '1';
    paletteBar.style.pointerEvents = 'auto';
    paletteCenterShadow.style.opacity = '1';
    paletteExpandArrow.style.opacity = '1';
    paletteExpandArrow.style.pointerEvents = 'auto';
    paletteToneTabs.style.opacity = '1';
    paletteToneTabs.style.pointerEvents = 'auto';
  }

  const startModes = { value: 'value0', chroma: 'chroma0', tone: 'warm' };
  setPaletteMode(startModes[prevStage]);

  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '1';
  paletteViewButton.style.pointerEvents = 'auto';
}

// 우측 상단 "End": 결과 모빌 화면에서만 나타나고, 누르면 첫 화면으로 돌아간다.
const endButton = document.createElement('button');
endButton.setAttribute('aria-label', '종료하고 처음 화면으로');
endButton.textContent = 'End';
endButton.style.position = 'fixed';
endButton.style.top = '28px';
endButton.style.right = '28px';
endButton.style.zIndex = '1002';
endButton.style.background = 'transparent';
endButton.style.border = 'none';
endButton.style.fontSize = '13px';
endButton.style.letterSpacing = '0.02em';
endButton.style.color = '#111111';
endButton.style.cursor = 'pointer';
endButton.style.opacity = '0';
endButton.style.pointerEvents = 'none';
endButton.style.transition = 'opacity 0.3s ease';
document.body.appendChild(endButton);

// 결과로 나온 계절에 어울리는 메이크업/화장품 팁.
// 16타입별 상세 스타일링 팁. SEASON16_LABELS와 같은 순서(계절 안에서 밝은 쪽 →
// 어두운/짙은 쪽)로 정리했다.
const SEASON16_TIPS = [
  // 봄 페일
  {
    outfit: '크림 아이보리, 페일피치, 라이트코랄, 밀크옐로우 등 흰빛이 많이 섞인 파스텔 웜이 핵심입니다. 셔츠, 블라우스, 니트 등 얼굴에 가까운 상의는 반드시 이 계열로 유지하고, 네이비나 브라운 같은 딥 컬러는 하의·아우터로 내리세요. 소재는 빛을 부드럽게 반사하는 실크, 쉬폰, 고운 니트가 투명한 피부와 잘 어울립니다. 순백보다 크림화이트가 안색에 유리합니다.',
    makeup: [
      ['베이스', '핑크 기 없는 밝은 아이보리 톤을 얇게. 커버력보다 투명함이 우선이며, 세미매트보다 은은한 글로우 마무리가 피부 장점을 살립니다. 컨실러도 밝은 피치 톤으로 최소한만.'],
      ['아이브로우', '라이트브라운. 진한 브로우는 얼굴에서 눈썹만 떠 보이게 하므로 한 톤 연하게 그리세요.'],
      ['아이섀도', '샴페인, 피치, 라이트골드 펄을 얇게. 음영은 연한 웜베이지 정도로만 넣고 짙은 브라운 음영은 피합니다.'],
      ['치크', '연한 피치를 볼 중앙에 은은하게. 크림 치크로 안에서 배어나오는 혈색처럼 표현하면 최적입니다.'],
      ['립', '시어한 코랄, 피치 틴트나 립밤 제형. 매트 풀커버 립은 립만 동동 떠 보이므로 그라데이션으로 가볍게.'],
    ],
    hair: '밀크브라운, 라이트베이지브라운, 허니 기 도는 밝은 브라운이 잘 맞습니다. 애쉬 기가 강하거나 블루블랙처럼 어두운 컬러는 안색을 창백하게 만듭니다. 탈색 후 밝은 염색도 소화하는 편이지만 잿빛보다는 노란빛 기반으로.',
    jewelry: '은은한 광택의 옐로우골드, 로즈골드 소재의 얇고 섬세한 디자인이 좋습니다. 크림펄 진주도 잘 어울립니다. 실버가 필요하면 얼굴에서 먼 손목·반지 위주로 배치하세요. 안경테는 클리어, 라이트베이지, 골드 메탈 추천.',
    nail: '밀크피치, 시어코랄, 아이보리 등 반투명 컬러가 손을 깨끗하게 만듭니다. 시럽 젤이나 그라데이션처럼 투명감 있는 아트가 잘 어울리고, 어두운 풀코트는 손이 나이 들어 보일 수 있습니다.',
  },
  // 봄 라이트
  {
    outfit: '살구, 라이트옐로우, 연민트, 라이트코랄, 밝은 캐멀이 메인 팔레트입니다. 파스텔 웜끼리의 배색이나 아이보리와의 조합이 안전하면서 화사합니다. 데님은 밝은 워싱, 트렌치는 라이트베이지가 정석. 무거운 검정 코트보다 크림·카멜 코트가 얼굴을 살립니다.',
    makeup: [
      ['베이스', '옐로우베이스의 밝은 톤으로 촉촉하게. 쿠션이라면 글로우 타입, 마무리는 윤광.'],
      ['아이브로우', '웜브라운으로 부드럽게. 회갈색보다 노란기 있는 브라운이 자연스럽습니다.'],
      ['아이섀도', '살구, 코랄, 웜베이지 음영에 골드펄 포인트. 핑크 섀도를 쓰려면 피치핑크로.'],
      ['치크', '코랄 블러셔를 볼 앞쪽에 둥글게. 파우더보다 크림 제형이 촉촉한 베이스와 잘 붙습니다.'],
      ['립', '코랄핑크, 살구 컬러의 촉촉한 제형이 기본. 글로시나 새틴 마무리가 잘 맞고, 브릭·버건디처럼 무거운 색은 피하세요.'],
    ],
    hair: '라이트브라운, 허니브라운, 오렌지 기 살짝 도는 브라운이 안색과 잘 어우러집니다. 너무 어두운 흑발은 부드러운 인상을 가리므로 다크브라운까지만.',
    jewelry: '옐로우골드가 기본이며 얇은 체인, 작은 참 같은 가벼운 디자인이 좋습니다. 진주는 화이트펄보다 크림펄. 안경·선글라스 테는 라이트브라운, 클리어베이지, 골드 메탈이 부담 없습니다.',
    nail: '코랄, 살구, 크림옐로우, 밝은 웜핑크. 프렌치 네일은 화이트 대신 아이보리 팁으로 하면 손이 한층 화사합니다.',
  },
  // 봄 브라이트
  {
    outfit: '클리어코랄, 아쿠아블루, 옐로우그린, 브라이트옐로우처럼 맑고 채도 높은 컬러가 포인트입니다. 전신 무채색은 얼굴을 밋밋하게 만드니 상의, 스카프, 가방 어디든 선명한 컬러를 하나 넣으세요. 베이스 컬러는 검정보다 네이비·아이보리가 좋고, 광택 있는 소재도 잘 소화합니다.',
    makeup: [
      ['베이스', '맑은 옐로우베이스에 세미글로우 마무리. 칙칙함 없는 투명한 표현이 관건입니다.'],
      ['아이브로우', '미디엄 웜브라운으로 또렷하게. 흐릿한 눈썹은 이 타입의 또렷한 인상을 죽입니다.'],
      ['아이섀도', '반짝이는 골드·샴페인 펄, 글리터를 적극 활용하세요. 눈동자의 반짝임이 강점인 타입이라 펄이 과해 보이지 않습니다. 탁한 매트 브라운 음영은 최소로.'],
      ['치크', '선명한 코랄을 좁은 범위에 또렷하게. 흐리게 넓게 펴 바르면 생기가 죽습니다.'],
      ['립', '선명한 코랄레드, 오렌지레드가 베스트. 흐린 MLBB는 아파 보일 수 있습니다. 새틴이나 글로시 마무리로 맑기를 유지하세요.'],
    ],
    hair: '윤기 있는 브라운, 오렌지브라운, 카퍼 기 있는 밝은 브라운. 핵심은 톤의 맑기이므로 잿빛 애쉬 계열만 피하면 폭넓게 소화합니다.',
    jewelry: '광택이 확실한 폴리시드 골드가 잘 맞습니다. 컬러 스톤은 시트린, 페리도트, 코랄 등 맑은 웜 스톤으로. 귀걸이는 빛을 받아 반짝이는 드롭형이 얼굴의 생기를 더합니다.',
    nail: '선명한 코랄, 오렌지, 클리어레드. 유광 마감이 잘 맞고, 탁한 뉴트럴 톤보다 쨍한 컬러가 손을 어려 보이게 합니다.',
  },
  // 봄 비비드
  {
    outfit: '오렌지, 코랄레드, 애플그린, 브라이트터쿼이즈 같은 비비드 웜 원색이 주인공입니다. 베이직 위주로 입더라도 아우터나 상의 한 장은 비비드로 가져가세요. 베이스는 검정 대신 네이비, 브라운, 아이보리를 쓰면 원색이 더 살아납니다. 컬러 블로킹 배색도 소화하는 타입입니다.',
    makeup: [
      ['베이스', '잡티를 정돈한 세미매트~새틴 피부. 립에 힘을 주는 만큼 피부는 균일하고 깔끔하게.'],
      ['아이브로우', '또렷한 미디엄브라운. 강한 립과 균형을 맞출 수 있도록 형태를 명확히.'],
      ['아이섀도', '웜베이지로 깔끔하게 정리하거나 골드펄 포인트 정도. 립이 주인공이므로 눈은 과하지 않게.'],
      ['치크', '오렌지코랄을 소량, 또는 생략도 가능합니다. 립이 강할 땐 치크를 덜어내는 것이 세련됩니다.'],
      ['립', '이 타입 최고의 무기. 선명한 오렌지레드, 토마토레드를 풀커버 매트로 발라도 얼굴이 립에 지지 않습니다.'],
    ],
    hair: '윤기 있는 다크브라운부터 오렌지브라운, 카퍼까지 폭넓게 소화합니다. 잿빛 도는 컬러만 피하세요. 얼굴 대비가 강한 편이라 어두운 머리도 잘 받습니다.',
    jewelry: '존재감 있는 볼드 골드, 두꺼운 체인, 큼직한 이어링이 잘 어울립니다. 컬러가 들어간 과감한 디자인, 비즈나 에나멜 소재도 시도해볼 만합니다.',
    nail: '비비드 오렌지, 레드, 핫코랄 풀코트. 아트를 넣더라도 색 자체의 선명함은 유지하는 것이 포인트입니다.',
  },
  // 여름 페일
  {
    outfit: '아주 연한 라벤더, 베이비블루, 페일핑크, 오프화이트가 투명한 피부를 극대화합니다. 다크 컬러가 필요하면 검정 대신 라이트그레이, 소프트네이비로. 대비를 줄인 밝은 원톤 코디가 가장 잘 맞으며, 쉬폰·오간자처럼 가볍고 비치는 소재와 궁합이 좋습니다.',
    makeup: [
      ['베이스', '핑크베이스의 밝은 톤을 아주 얇게. 파우더로 뽀얗게 마무리한 세미매트가 피부의 투명감을 살립니다.'],
      ['아이브로우', '애쉬브라운이나 그레이브라운으로 연하게. 진한 갈색 눈썹은 인상을 무겁게 합니다.'],
      ['아이섀도', '페일핑크, 라벤더, 실버펄을 얇게. 음영 없이 색만 살짝 얹는 원컬러 섀도가 잘 어울립니다.'],
      ['치크', '연한 로즈핑크를 볼 바깥쪽에 흐리게. 붉은기가 도드라지지 않게 소량만.'],
      ['립', '시어한 로즈핑크, 라벤더핑크 틴트. 진한 립은 얼굴을 창백하게 만드니 그라데이션으로 가볍게.'],
    ],
    hair: '라이트 애쉬브라운, 애쉬베이지처럼 붉은 기 없는 밝은 컬러가 피부의 푸른 투명감과 어우러집니다. 오렌지·구릿빛 염색은 피부를 붉고 칙칙하게 만듭니다.',
    jewelry: '실버, 화이트골드의 얇고 섬세한 디자인, 은은한 화이트펄이 기본입니다. 광택 강한 볼드 골드는 피부와 부딪힙니다. 안경테는 클리어, 라벤더, 라이트그레이 추천.',
    nail: '밀키라벤더, 베이비핑크, 시어화이트. 채도 낮고 밝을수록 손이 희고 깨끗해 보입니다.',
  },
  // 여름 라이트
  {
    outfit: '로즈핑크, 스카이블루, 라일락, 민트가 시그니처 팔레트입니다. 순백 화이트가 잘 받는 타입이라 화이트+파스텔 조합이 가장 안전하고 예쁩니다. 데님은 연청, 아우터는 라이트그레이나 소프트네이비. 골드 버튼보다 실버 버튼 디테일이 어울립니다.',
    makeup: [
      ['베이스', '핑크베이스의 밝은 톤, 은은한 광이 도는 세미글로우. 노란기 도는 베이스는 안색을 탁하게 만듭니다.'],
      ['아이브로우', '애쉬브라운으로 부드럽게. 눈썹도 붉은기·노란기를 빼는 것이 통일감의 핵심입니다.'],
      ['아이섀도', '핑크, 모브, 라벤더 계열에 은은한 실버·핑크펄. 음영이 필요하면 핑크브라운으로.'],
      ['치크', '로즈핑크를 볼 중앙에서 관자놀이 방향으로 부드럽게. 파우더 타입이 무난하게 잘 붙습니다.'],
      ['립', '로즈, 핑크베이지의 촉촉한 새틴 제형이 기본. MLBB도 반드시 푸른 기 도는 로즈 계열로 고르세요.'],
    ],
    hair: '애쉬브라운, 로즈브라운 같은 붉은 기 없는 부드러운 톤. 흑발보다 다크 애쉬브라운이 인상을 부드럽게 만듭니다.',
    jewelry: '실버, 화이트골드, 화이트펄이 기본입니다. 파스텔 컬러 스톤이나 자개 소재도 잘 어울립니다. 안경테는 라벤더, 그레이, 실버 메탈.',
    nail: '로즈핑크, 라일락, 스카이블루 등 쿨 파스텔. 투명한 시럽 네일, 오로라 파우더 아트도 잘 받는 타입입니다.',
  },
  // 여름 브라이트
  {
    outfit: '클리어핑크, 밝은 블루, 라즈베리, 밝은 퍼플처럼 맑고 선명한 쿨 컬러로 포인트를 주세요. 화이트·네이비 베이스에 선명한 쿨 컬러 하나를 얹는 배색이 효과적입니다. 같은 선명한 색이라도 노란기가 섞이는 순간 어울림이 급격히 떨어지므로 푸른 기 도는 쪽을 고르는 것이 철칙입니다.',
    makeup: [
      ['베이스', '핑크베이스의 맑은 톤에 세미글로우. 칙칙함 없이 투명하게 표현하는 것이 우선입니다.'],
      ['아이브로우', '다크 애쉬브라운으로 또렷하게. 흐린 눈썹보다 형태가 분명한 쪽이 어울립니다.'],
      ['아이섀도', '깨끗한 실버·핑크 펄로 맑게. 글리터도 소화하며, 오렌지·브릭 계열만 피하면 됩니다.'],
      ['치크', '선명한 쿨핑크를 좁게 또렷하게. 흐린 발색보다 생기 있는 발색이 잘 맞습니다.'],
      ['립', '푸른 기 도는 선명한 핑크, 라즈베리, 푸시아핑크가 베스트. 새틴~글로시 마무리로 맑기를 살리세요.'],
    ],
    hair: '다크 애쉬브라운부터 블루블랙까지 소화합니다. 맑고 차가운 톤일수록 눈빛이 또렷해집니다. 노란빛 탈색모는 피하세요.',
    jewelry: '반짝임이 확실한 실버, 화이트골드, 큐빅·다이아몬드류 클리어 스톤이 잘 맞습니다. 광택 있는 심플한 디자인이 베스트.',
    nail: '선명한 핑크, 푸시아, 클리어블루. 유광 마감으로 쨍한 발색을 살리는 것이 좋습니다.',
  },
  // 여름 뮤트
  {
    outfit: '더스티핑크, 그레이시블루, 모브, 소프트그레이처럼 회색빛 섞인 톤이 얼굴과 하나처럼 어우러집니다. 톤온톤, 그라데이션 배색이 최고의 전략이며 니트·트위드·워싱 데님 같은 부드러운 질감과 궁합이 좋습니다. 쨍한 원색과 순수 검정은 얼굴을 눌러버리므로 검정 대신 차콜그레이를.',
    makeup: [
      ['베이스', '핑크베이스의 뉴트럴 톤, 소프트매트 마무리. 과한 광은 뮤트한 분위기와 어긋납니다.'],
      ['아이브로우', '그레이브라운, 애쉬브라운으로 결을 살려 자연스럽게.'],
      ['아이섀도', '말린 장미빛 로즈브라운, 더스티핑크, 모브 계열. 펄보다 매트·새틴 질감이 잘 붙습니다.'],
      ['치크', '더스티로즈를 넓고 흐리게. 경계 없이 스며들 듯 바르는 것이 포인트입니다.'],
      ['립', '뮤트로즈, MLBB 로즈브라운이 시그니처. 블러 처리된 매트 립이나 벨벳 제형이 특히 잘 어울립니다.'],
    ],
    hair: '애쉬브라운, 애쉬그레이 등 잿빛 섞인 컬러를 가장 잘 소화하는 대표 타입입니다. 윤기 강조보다 매트한 질감 연출이 분위기를 살립니다.',
    jewelry: '무광 실버, 새틴 마감 화이트골드, 흐린 빛의 담수 진주가 세련되게 어우러집니다. 반짝임이 강한 주얼리보다 담백한 디자인이 좋습니다.',
    nail: '더스티로즈, 그레이시모브, 뮤트베이지핑크. 무광 마감이 특히 고급스럽습니다.',
  },
  // 가을 뮤트
  {
    outfit: '베이지, 카멜, 오트밀, 소프트카키 등 낮은 채도의 웜 뉴트럴이 기본입니다. 니트, 스웨이드, 코듀로이, 리넨처럼 질감이 부드러운 소재와 만나면 시너지가 큽니다. 화이트는 순백 대신 에크루·오트밀로, 검정 대신 다크브라운으로 대체하면 전체 완성도가 올라갑니다.',
    makeup: [
      ['베이스', '옐로우베이스의 뉴트럴 톤, 세미매트 마무리. 뽀얗게 띄우기보다 피부 본연의 톤에 맞추는 것이 자연스럽습니다.'],
      ['아이브로우', '카키 기 도는 브라운으로 부드럽게. 눈썹까지 낮은 채도로 맞추면 통일감이 생깁니다.'],
      ['아이섀도', '베이지, 브라운, 카키골드의 음영 메이크업 최적 타입입니다. 펄은 은은한 골드펄까지만.'],
      ['치크', '누드베이지, 뮤트코랄을 볼 바깥쪽에 흐리게. 셰이딩과 자연스럽게 연결하면 얼굴에 깊이가 생깁니다.'],
      ['립', '누드베이지, 로지브라운 같은 채도 낮은 웜 컬러. 매트보다 새틴 질감이 건조해 보이지 않습니다. 형광기 있는 핑크는 얼굴과 분리됩니다.'],
    ],
    hair: '매트한 카키브라운, 베이지브라운이 잘 맞습니다. 너무 붉거나 너무 검은 컬러보다 중간 명도의 부드러운 브라운으로.',
    jewelry: '무광 골드, 앤티크 골드, 우드·가죽·라탄 소재 액세서리가 분위기를 살립니다. 화려한 스톤보다 소재감 있는 디자인이 좋습니다.',
    nail: '밀크티베이지, 토프, 소프트카키. 뉴트럴 계열의 무광 마감, 또는 마그네틱처럼 은은한 질감 아트 추천.',
  },
  // 가을 스트롱
  {
    outfit: '머스타드, 테라코타, 올리브그린, 버건디처럼 진하고 존재감 있는 웜 컬러를 주인공으로 쓰세요. 밝은 색이 필요할 땐 크림, 카멜처럼 깊이 있는 밝은 색으로. 연한 파스텔은 얼굴을 떠 보이게 합니다. 가죽 재킷, 트위드 등 무게감 있는 소재도 잘 소화합니다.',
    makeup: [
      ['베이스', '옐로우베이스, 새틴~세미매트 마무리로 균일하게. 혈색은 치크와 립에서 만드는 것이 깔끔합니다.'],
      ['아이브로우', '짙은 웜브라운으로 또렷하게. 강한 컬러 메이크업과 균형을 이루도록 형태를 분명히.'],
      ['아이섀도', '테라코타, 브릭, 카퍼 계열이 시그니처. 카퍼 펄을 눈 중앙에 얹으면 깊이와 화사함을 동시에 잡습니다.'],
      ['치크', '테라코타, 브릭 블러셔를 광대 아래쪽에 음영처럼. 셰이딩 겸용으로 활용해도 좋습니다.'],
      ['립', '브릭오렌지, 펌킨, 시나몬 컬러가 얼굴을 확 살립니다. 매트 제형도 잘 소화합니다.'],
    ],
    hair: '카퍼브라운, 레드브라운, 다크오렌지브라운 등 따뜻하고 진한 컬러가 강점을 부각시킵니다.',
    jewelry: '광택 있는 옐로우골드, 앰버·호박·타이거아이 같은 웜 스톤이 잘 맞습니다. 스카프나 가방에 머스타드·버건디 포인트를 넣는 것도 효과적입니다.',
    nail: '테라코타, 머스타드, 브릭레드. 딥한 웜 컬러의 유광 풀코트가 손을 세련되게 합니다.',
  },
  // 가을 딥
  {
    outfit: '브릭, 다크브라운, 딥카키, 다크캐멀이 중심입니다. 상의는 딥 웜 컬러로 얼굴의 안정감을 살리고, 전체적으로 어두운 톤온톤 코디가 잘 맞습니다. 검정보다 다크브라운이 안색에 유리하며, 코트·재킷 같은 겨울 아우터에서 특히 강한 타입입니다.',
    makeup: [
      ['베이스', '옐로우베이스의 차분한 톤, 세미매트로 결점 없이. 너무 밝은 호수는 목과 분리되어 보입니다.'],
      ['아이브로우', '다크브라운으로 진하고 자연스럽게.'],
      ['아이섀도', '딥브라운, 버건디브라운으로 음영을 깊게. 겹겹이 쌓는 그라데이션 음영을 잘 소화하는 타입입니다.'],
      ['치크', '뮤트브릭을 소량, 음영에 가깝게. 화사한 치크보다 차분한 혈색이 어울립니다.'],
      ['립', 'MLBB 브릭, 브라운레드가 시그니처. 아이라인·브로우까지 브라운 계열로 통일하면 부드러우면서 또렷한 인상이 완성됩니다.'],
    ],
    hair: '다크브라운, 초콜릿브라운이 기본. 밝은 염색보다 어두운 컬러가 이목구비를 살립니다.',
    jewelry: '앤티크 골드, 브론즈 톤이 잘 어울립니다. 가넷, 스모키쿼츠 같은 딥 웜 스톤 추천. 묵직한 시계나 가죽 스트랩도 좋은 선택입니다.',
    nail: '브릭, 딥브라운, 버건디브라운. 어두운 컬러 풀코트를 무겁지 않게 소화하는 타입입니다.',
  },
  // 가을 다크
  {
    outfit: '다크초콜릿, 딥버건디, 브라운블랙 등 명도가 가장 낮은 웜 컬러가 시그니처입니다. 검정을 소화하는 드문 웜톤이지만 순수 검정보다 브라운블랙이 한 수 위입니다. 밝은 색은 이너나 하의로 소량만 쓰고, 전체를 어둡게 톤온톤으로 정리하는 것이 가장 세련됩니다.',
    makeup: [
      ['베이스', '옐로우베이스의 본연 톤, 매트~세미매트. 어두운 의상과 어울리는 균일하고 단단한 피부 표현이 좋습니다.'],
      ['아이브로우', '다크브라운~브라운블랙으로 진하게.'],
      ['아이섀도', '브라운 베이스의 스모키를 잘 소화합니다. 다크브라운, 딥버건디로 깊이 있는 눈매를.'],
      ['치크', '생략하거나 브릭을 아주 소량. 립과 눈에 무게가 실리는 만큼 치크는 덜어냅니다.'],
      ['립', '버건디, 다크브라운 립을 풀커버로 발라도 얼굴이 지지 않는 타입입니다. 매트 제형까지 소화합니다.'],
    ],
    hair: '흑갈색, 다크브라운, 딥레드브라운. 어두울수록 얼굴이 또렷해집니다. 밝은 염색은 강점인 깊이를 없앱니다.',
    jewelry: '묵직한 골드, 브론즈, 가죽 소재의 볼드한 디자인이 잘 맞습니다. 작고 반짝이는 것보다 크고 무게감 있는 쪽이 균형이 맞습니다.',
    nail: '딥버건디, 다크초콜릿, 블랙브라운. 무광 또는 새틴 마감이 고급스럽습니다.',
  },
  // 겨울 비비드
  {
    outfit: '푸시아, 코발트블루, 트루레드 같은 쿨 원색이 주인공입니다. 화이트·블랙 베이스에 비비드 컬러 하나를 얹는 배색이 가장 강력하며, 애매한 중간색은 인상을 흐립니다. 광택 있는 소재, 새틴, 레더도 잘 소화합니다.',
    makeup: [
      ['베이스', '핑크베이스의 맑은 톤, 세미매트로 결점 없이 깨끗하게. 립이 주인공이 될 수 있도록 피부는 균일하게.'],
      ['아이브로우', '다크브라운~블랙브라운으로 또렷하게.'],
      ['아이섀도', '실버펄이나 쿨그레이로 깔끔하게 정리. 립에 힘을 주는 원포인트 전략이 베스트입니다.'],
      ['치크', '생략하거나 쿨핑크를 아주 소량. 치크가 강하면 립의 임팩트가 분산됩니다.'],
      ['립', '푸른 기 도는 트루레드, 푸시아를 선명한 풀커버로. 이 타입의 메이크업은 립 하나로 완성됩니다.'],
    ],
    hair: '블루블랙, 순수 흑발이 최고의 컬러입니다. 어중간한 브라운 염색은 오히려 인상을 약하게 만듭니다.',
    jewelry: '광택 강한 실버, 화이트골드, 다이아몬드·큐빅처럼 반짝임이 확실한 소재가 잘 맞습니다. 대비가 큰 블랙×실버 조합도 좋습니다.',
    nail: '트루레드, 푸시아, 클리어한 원색. 화이트·블랙을 활용한 대비 강한 아트도 잘 어울립니다.',
  },
  // 겨울 스트롱
  {
    outfit: '로얄블루, 딥푸시아, 에메랄드처럼 진하면서 채도가 살아있는 컬러가 중심입니다. 배색은 화이트·블랙의 대비 조합이 효과적이고, 중간 명도의 애매한 색은 매력을 반감시킵니다. 테일러드 재킷, 셔츠처럼 각 잡힌 실루엣과 궁합이 좋습니다.',
    makeup: [
      ['베이스', '핑크베이스, 세미매트의 단단하고 깨끗한 피부 표현.'],
      ['아이브로우', '블랙브라운으로 형태를 분명하게.'],
      ['아이섀도', '쿨그레이, 플럼 계열로 깊이를 주고 블랙 아이라인으로 또렷하게. 눈매 대비를 살리는 것이 핵심입니다.'],
      ['치크', '쿨핑크를 가볍게, 또는 생략. 얼굴의 대비 구조를 흐리지 않는 선에서만.'],
      ['립', '선명한 쿨레드, 플럼, 딥푸시아. 새틴~매트 제형으로 발색을 확실하게.'],
    ],
    hair: '흑발, 블루블랙, 다크애쉬. 차갑고 어두운 톤이 이목구비 대비를 극대화합니다.',
    jewelry: '실버, 화이트골드에 사파이어·에메랄드 같은 진한 컬러 스톤이 잘 맞습니다. 구조적이고 모던한 디자인 추천.',
    nail: '로얄블루, 딥푸시아, 에메랄드그린. 진하고 선명한 컬러의 유광 마감이 좋습니다.',
  },
  // 겨울 딥
  {
    outfit: '네이비, 다크퍼플, 와인, 차콜이 중심입니다. 얼굴 가까이는 딥 쿨 컬러, 밝은 색은 이너나 하의로 배치하세요. 파스텔을 얼굴 옆에 두면 창백해 보입니다. 다크 톤온톤에 실버 액세서리로 포인트를 주는 조합이 정석입니다.',
    makeup: [
      ['베이스', '핑크베이스의 차분한 톤, 세미매트. 어두운 의상에 지지 않는 균일한 피부가 중요합니다.'],
      ['아이브로우', '블랙브라운으로 진하게.'],
      ['아이섀도', '차콜, 딥퍼플, 플럼으로 깊이 있는 음영. 스모키 메이크업을 세련되게 소화하는 타입입니다.'],
      ['치크', '뮤트플럼을 아주 소량, 혹은 생략.'],
      ['립', '와인, 플럼이 시그니처. 벨벳~매트 제형의 딥한 발색이 얼굴의 대비를 살립니다.'],
    ],
    hair: '블루블랙, 다크네이비블랙. 어둡고 차가운 컬러가 얼굴의 대비를 살립니다.',
    jewelry: '실버, 백금에 오닉스·자수정 같은 딥 스톤이 잘 어울립니다. 미니멀하면서 소재가 좋은 디자인 추천.',
    nail: '와인, 네이비, 딥퍼플. 딥 컬러 풀코트가 손을 시크하게 만듭니다.',
  },
  // 겨울 다크
  {
    outfit: '블랙, 차콜, 딥네이비 등 가장 낮은 명도의 컬러를 완벽하게 소화하는 타입입니다. 올블랙 코디가 가장 잘 받으며, 립이나 액세서리로 쿨 포인트 하나를 더하면 무거워 보이지 않습니다. 레더, 울 코트 등 무게감 있는 소재와 궁합이 최상입니다.',
    makeup: [
      ['베이스', '핑크베이스, 매트~세미매트의 단단한 피부 표현. 어두운 의상과의 대비로 피부가 더 깨끗해 보입니다.'],
      ['아이브로우', '블랙~블랙브라운으로 강하게.'],
      ['아이섀도', '블랙 아이라인이 핵심입니다. 섀도는 차콜·쿨그레이로 정리하고 라인으로 대비를 만드세요.'],
      ['치크', '생략이 기본. 필요하면 쿨톤 셰이딩으로 윤곽만.'],
      ['립', '다크베리, 블랙체리, 딥와인까지 소화합니다. 매트 풀커버로 발라도 얼굴이 립을 이깁니다.'],
    ],
    hair: '순수 흑발, 블루블랙이 최적. 밝은 염색은 타입의 강점인 강한 대비를 무너뜨립니다.',
    jewelry: '광택 강한 실버, 블랙 스톤, 메탈릭한 볼드 디자인이 잘 맞습니다. 체인, 하드웨어 디테일도 좋은 선택입니다.',
    nail: '블랙, 차콜, 딥와인. 유광 블랙 네일을 가장 멋있게 소화하는 타입입니다.',
  },
];

// 결과 화면: 계절/타입 이름 + 분야별(의상/메이크업/헤어/주얼리/네일) 상세 팁을 보여준다.
// 내용이 길어 화면 하나에 다 안 들어가므로 스크롤 가능한 카드로 구성한다.
const beautyTipsPanel = document.createElement('div');
beautyTipsPanel.className = 'no-scrollbar';
beautyTipsPanel.style.position = 'fixed';
beautyTipsPanel.style.top = '50%';
beautyTipsPanel.style.left = '50%';
beautyTipsPanel.style.transform = 'translate(-50%, -50%)';
beautyTipsPanel.style.zIndex = '1002';
beautyTipsPanel.style.display = 'flex';
beautyTipsPanel.style.flexDirection = 'column';
beautyTipsPanel.style.alignItems = 'center';
beautyTipsPanel.style.gap = '10px';
beautyTipsPanel.style.width = 'min(640px, 92vw)';
beautyTipsPanel.style.maxHeight = '82vh';
beautyTipsPanel.style.overflowY = 'auto';
beautyTipsPanel.style.textAlign = 'center';
beautyTipsPanel.style.padding = '24px';
beautyTipsPanel.style.opacity = '0';
beautyTipsPanel.style.pointerEvents = 'none';
beautyTipsPanel.style.transition = 'opacity 0.4s ease';
document.body.appendChild(beautyTipsPanel);

const beautyTipsEyebrow = document.createElement('p');
beautyTipsEyebrow.className = 'tutorial-eyebrow';
const beautyTipsHeading = document.createElement('h3');
beautyTipsHeading.className = 'tutorial-heading';
beautyTipsHeading.textContent = '어울리는 스타일 가이드';
// 의상/메이크업/헤어/주얼리/네일 섹션이 들어갈 자리. 짧은 안내 문구와 달리 내용이
// 많아 가운데 정렬 대신 왼쪽 정렬로 읽기 쉽게 구성한다.
const beautyTipsSections = document.createElement('div');
beautyTipsSections.style.display = 'flex';
beautyTipsSections.style.flexDirection = 'column';
beautyTipsSections.style.gap = '16px';
beautyTipsSections.style.width = '100%';
beautyTipsSections.style.textAlign = 'left';
// 타이틀과 본문(의상/메이크업/…) 사이만 따로 더 띄운다(패널 전체 gap보다 넓게).
beautyTipsSections.style.marginTop = '18px';
// 이 화면은 (블러 오버레이 없이) 옅은 계절 톤 배경 위에 바로 얹히므로, 흰 글씨 대신
// 어두운 글씨로 덮어써야 잘 읽힌다.
beautyTipsEyebrow.style.color = 'rgba(17, 17, 17, 0.65)';
beautyTipsHeading.style.color = '#111111';
beautyTipsPanel.appendChild(beautyTipsEyebrow);
beautyTipsPanel.appendChild(beautyTipsHeading);
beautyTipsPanel.appendChild(beautyTipsSections);

// 섹션 하나(제목 + 본문 한 단락)를 만들어 붙인다.
function appendTipSection(label, bodyText) {
  const wrap = document.createElement('div');
  const title = document.createElement('p');
  title.textContent = label;
  title.style.margin = '0 0 6px';
  title.style.fontSize = '13px';
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0.02em';
  title.style.color = 'rgba(17, 17, 17, 0.9)';
  const body = document.createElement('p');
  body.className = 'tutorial-body';
  body.textContent = bodyText;
  body.style.margin = '0';
  body.style.letterSpacing = '0';
  body.style.color = 'rgba(17, 17, 17, 0.78)';
  wrap.appendChild(title);
  wrap.appendChild(body);
  beautyTipsSections.appendChild(wrap);
  return wrap;
}

// 메이크업은 베이스/아이브로우/아이섀도/치크/립 다섯 항목으로 세분화해 보여준다.
function appendMakeupSection(items) {
  const wrap = document.createElement('div');
  const title = document.createElement('p');
  title.textContent = '메이크업';
  title.style.margin = '0 0 6px';
  title.style.fontSize = '13px';
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0.02em';
  title.style.color = 'rgba(17, 17, 17, 0.9)';
  wrap.appendChild(title);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';
  items.forEach(([subLabel, text]) => {
    const p = document.createElement('p');
    p.className = 'tutorial-body';
    p.style.margin = '0';
    p.style.letterSpacing = '0';
    p.style.color = 'rgba(17, 17, 17, 0.78)';
    const strong = document.createElement('strong');
    strong.textContent = `${subLabel} :`;
    strong.style.color = 'rgba(17, 17, 17, 0.95)';
    strong.style.letterSpacing = '-0.02em';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(` ${text}`));
    list.appendChild(p);
  });
  wrap.appendChild(list);
  beautyTipsSections.appendChild(wrap);
}

function renderBeautyTipSections(tip) {
  beautyTipsSections.innerHTML = '';
  appendTipSection('의상', tip.outfit);
  appendMakeupSection(tip.makeup);
  appendTipSection('헤어', tip.hair);
  appendTipSection('주얼리', tip.jewelry);
  appendTipSection('네일', tip.nail);
  // 카테고리끼리 구분되도록 첫 섹션을 뺀 나머지 위에 얇은 선을 긋는다.
  Array.from(beautyTipsSections.children).forEach((section, i) => {
    if (i === 0) return;
    section.style.borderTop = '1px solid rgba(17, 17, 17, 0.14)';
    section.style.paddingTop = '16px';
  });
}

// 색 구름과 나머지 실전 UI를 모두 걷어내고, 결정된 16타입 톤 배경 위에 분야별 팁을 보여준다.
function showBeautyTips(seasonIndex) {
  isShowingBeautyTips = true;
  applyBackgroundTone(paleFamilyColor(SEASON16_GROUPS[seasonIndex].colors));
  synthesisBackdrop.style.opacity = '0';
  synthesisBackdrop.style.pointerEvents = 'none';
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  paletteToneTabs.style.opacity = '0';
  paletteToneTabs.style.pointerEvents = 'none';
  closePaletteGrid();

  beautyTipsEyebrow.textContent = `${SEASON16_GROUPS[seasonIndex].name} 타입`;
  renderBeautyTipSections(SEASON16_TIPS[seasonIndex]);
  beautyTipsPanel.style.opacity = '1';
  beautyTipsPanel.style.pointerEvents = 'auto';

  // "← Back"은 그대로 남겨둬서, 결과를 나가지 않고 종합(색 구름) 화면으로 되돌아갈 수 있게 한다.
  endButton.style.opacity = '1';
  endButton.style.pointerEvents = 'auto';
}

// 팁 화면에서 뒤로가기를 누르면 종료하지 않고 방금 보던 종합(색 구름) 화면으로 되돌린다.
function returnToSynthesisFromTips() {
  isShowingBeautyTips = false;
  beautyTipsPanel.style.opacity = '0';
  beautyTipsPanel.style.pointerEvents = 'none';
  endButton.style.opacity = '0';
  endButton.style.pointerEvents = 'none';

  synthesisBackdrop.style.opacity = '1';
  paletteToneTabs.style.opacity = '1';
  paletteToneTabs.style.pointerEvents = 'auto';
  stageAdvanceButton.style.opacity = '1';
  stageAdvanceButton.style.pointerEvents = 'auto';
}

endButton.addEventListener('click', () => {
  endButton.style.opacity = '0';
  endButton.style.pointerEvents = 'none';
  beautyTipsPanel.style.opacity = '0';
  beautyTipsPanel.style.pointerEvents = 'none';
  // 팁 화면에서는 "← Back"을 계속 켜뒀으니, 첫 화면으로 나갈 땐 같이 꺼줘야 한다.
  backButton.style.opacity = '0';
  backButton.style.pointerEvents = 'none';

  // 지금까지는 이 화면(색 배경)을 걷어내는 코드가 없어서, 아이콘만 돌아오고 실제
  // 첫 화면(메인 모빌)은 계속 색 배경에 가려져 있었다. 배경을 걷어 첫 화면을 되돌린다.
  const { x, y } = lastClickPoint;
  colorOverlay.style.transitionProperty = 'clip-path';
  colorOverlay.style.transitionDuration = '0.6s';
  colorOverlay.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
  colorOverlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
  colorOverlay.style.pointerEvents = 'none';

  isPracticeMode = false;
  practiceStage = 'tone';
  isShowingBeautyTips = false;
  tutorialButtonEl.style.opacity = '1';
  tutorialButtonEl.style.pointerEvents = 'auto';
});

// 튜토리얼 오버레이와 같은 방식(명도를 낮추고 블러)으로 화면 전체를 덮은 뒤 그 위에 문구를 띄운다.
// 패딩·정렬은 .tutorial-overlay와, 안쪽 문구 폭/간격은 .tutorial-slide와 동일하게 맞춘다.
const stageHintOverlay = document.createElement('div');
stageHintOverlay.style.position = 'fixed';
stageHintOverlay.style.inset = '0';
stageHintOverlay.style.zIndex = '1500';
stageHintOverlay.style.display = 'flex';
stageHintOverlay.style.alignItems = 'center';
stageHintOverlay.style.justifyContent = 'center';
stageHintOverlay.style.padding = '24px';
stageHintOverlay.style.textAlign = 'center';
stageHintOverlay.style.background = 'rgba(0, 0, 0, 0.45)';
stageHintOverlay.style.backdropFilter = 'blur(10px)';
stageHintOverlay.style.webkitBackdropFilter = 'blur(10px)';
stageHintOverlay.style.opacity = '0';
stageHintOverlay.style.pointerEvents = 'none';
stageHintOverlay.style.transition = 'opacity 0.4s ease';
stageHintOverlay.style.cursor = 'pointer';

const stageHintContent = document.createElement('div');
stageHintContent.style.display = 'flex';
stageHintContent.style.flexDirection = 'column';
stageHintContent.style.alignItems = 'center';
stageHintContent.style.gap = '10px';
stageHintContent.style.maxWidth = '640px';

const stageHintEyebrow = document.createElement('p');
stageHintEyebrow.className = 'tutorial-eyebrow';
const stageHintHeading = document.createElement('h3');
stageHintHeading.className = 'tutorial-heading';
const stageHintBody = document.createElement('p');
stageHintBody.className = 'tutorial-body';

stageHintContent.appendChild(stageHintEyebrow);
stageHintContent.appendChild(stageHintHeading);
stageHintContent.appendChild(stageHintBody);
stageHintOverlay.appendChild(stageHintContent);
document.body.appendChild(stageHintOverlay);

stageAdvanceButton.addEventListener('click', (e) => {
  e.stopPropagation();
  if (pendingStageIntro || pendingFinalSeason !== null) return;

  // 종합 단계에서는 다음 단계로 넘어가는 대신, 지금까지 확정한 색의 비중을 분석해
  // 결과 문구를 보여준다.
  if (practiceStage === 'synthesis') {
    const seasonIndex = computeDominantSeason16();
    pendingFinalSeason = seasonIndex;
    stageHintEyebrow.textContent = '단계 6 · 결과 안내';
    stageHintHeading.textContent = '';
    stageHintBody.textContent =
      `오늘 진단 기준으로 ${SEASON16_GROUPS[seasonIndex].name} 타입에 가깝습니다. 다만 드레이핑 결과는 조명 조건에 민감하므로, ` +
      '다른 시간대·다른 광원에서 한 번 더 교차 확인하시길 권장드립니다.';
    stageHintOverlay.style.opacity = '1';
    stageHintOverlay.style.pointerEvents = 'auto';
    return;
  }

  const nextStage = STAGE_ORDER[(STAGE_ORDER.indexOf(practiceStage) + 1) % STAGE_ORDER.length];
  pendingStageIntro = nextStage;
  const hint = STAGE_HINTS[nextStage];
  stageHintEyebrow.textContent = hint.eyebrow;
  stageHintHeading.textContent = hint.heading;
  stageHintBody.textContent = hint.body;
  stageHintOverlay.style.opacity = '1';
  stageHintOverlay.style.pointerEvents = 'auto';
});

// 안내 문구가 떠 있을 때 화면을 누르면 실제로 다음 단계(또는 결과 화면)로 넘어간다.
stageHintOverlay.addEventListener('click', () => {
  if (pendingFinalSeason !== null) {
    const seasonIndex = pendingFinalSeason;
    pendingFinalSeason = null;
    stageHintOverlay.style.opacity = '0';
    stageHintOverlay.style.pointerEvents = 'none';
    showBeautyTips(seasonIndex);
    return;
  }

  if (!pendingStageIntro) return;
  const stage = pendingStageIntro;
  pendingStageIntro = null;
  stageHintOverlay.style.opacity = '0';
  stageHintOverlay.style.pointerEvents = 'none';
  practiceStage = stage;

  if (stage === 'synthesis') {
    enterSynthesisStage();
    return;
  }

  renderStageTabs();
  const startModes = { value: 'value0', chroma: 'chroma0', tone: 'warm' };
  setPaletteMode(startModes[stage]);
  // 다음 단계의 실제 탐색 화면으로 넘어왔으니 "Select" 대신 팔레트 아이콘을 다시 보여준다.
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '1';
  paletteViewButton.style.pointerEvents = 'auto';
});

// 아이콘 뒤에 깔리는 발광 원. box-shadow 대신 실제 blur된 원 엘리먼트를 써서 각지거나
// 이상한 모양 없이 항상 매끈한 원으로 퍼지게 한다. 버튼의 첫 자식으로 넣어 아이콘(SVG)보다
// 뒤에(DOM 순서상 먼저) 깔리게 한다.
const paletteIconGlow = document.createElement('div');
paletteIconGlow.className = 'icon-glow';
paletteIconGlow.style.top = '50%';
paletteIconGlow.style.left = '50%';
paletteViewButton.insertBefore(paletteIconGlow, paletteViewButton.firstChild);

function updatePaletteViewButtonContrast(color) {
  const { l } = hexToHSL(color);
  const textColor = l < 50 ? '#ffffff' : '#111111';
  paletteViewButton.style.color = textColor;
  stageAdvanceButton.style.color = textColor;
  // 발광은 배경 명암과 상관없이 항상 밝은(흰색) 빛으로 보이게 한다.
  paletteViewButton.style.setProperty('--glow-color', 'rgba(255, 255, 255, 0.4)');
}

// 팔레트 아이콘을 누른 자리에서 빛이 확 퍼지듯 커지며 투명해지는 전환 효과.
// 화면이 바뀌는 순간을 이 빛 뒤에 숨겨뒀다가, 빛이 커지고 옅어지면서 자연스럽게
// 다음 화면이 드러나 보이게 한다.
const paletteTransitionGlow = document.createElement('div');
paletteTransitionGlow.className = 'palette-transition-glow';
document.body.appendChild(paletteTransitionGlow);

function burstPaletteTransitionGlow(x, y) {
  paletteTransitionGlow.style.left = `${x}px`;
  paletteTransitionGlow.style.top = `${y}px`;
  paletteTransitionGlow.classList.remove('burst');
  void paletteTransitionGlow.offsetWidth; // 강제 리플로우로 애니메이션을 처음부터 재생시킨다.
  paletteTransitionGlow.classList.add('burst');
}

// 팔레트(확정 색) 아이콘을 누르면 작은 목록 대신, 지금과 같은 전체화면 방식으로
// 확정해둔 색들만 코브플로우에 띄워 그대로 둘러볼 수 있게 한다. 들어가기 직전
// 상태를 기억해뒀다가 뒤로가기를 누르면 화면을 나가지 않고 그 상태로 돌아간다.
paletteViewButton.addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirmedColors.length === 0 || currentPaletteMode.startsWith('confirmed')) return;

  const rect = paletteViewButton.getBoundingClientRect();
  burstPaletteTransitionGlow(rect.left + rect.width / 2, rect.top + rect.height / 2);

  previousPaletteMode = currentPaletteMode;
  previousPaletteColor = currentColor;
  setPaletteMode('confirmed');
  // 확정한 색 화면 안에서는 들어가는 입구(아이콘)는 숨기고, 그 자리에
  // 다음 단계로 넘어가는 "선택" 텍스트만 하나 보여준다.
  paletteViewButton.style.opacity = '0';
  paletteViewButton.style.pointerEvents = 'none';
  stageAdvanceButton.style.opacity = '1';
  stageAdvanceButton.style.pointerEvents = 'auto';
});

// 팔레트 아이콘을 눌러 "확정한 색" 화면으로 들어오기 전의 모드/색/단계로 되돌린다.
function restorePreviousPaletteView() {
  const mode = previousPaletteMode || 'warm';
  const color = previousPaletteColor || currentColor;

  practiceStage = mode.startsWith('value') ? 'value' : mode.startsWith('chroma') ? 'chroma' : 'tone';
  renderStageTabs();

  currentColor = color;
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);

  if (mode === 'family') {
    renderPalette(color);
  } else {
    currentPaletteMode = mode;
    renderPaletteFromList(paletteListForMode(mode, color), color);
    updateToneTabsActive();
  }

  // 확정 화면을 나와 다시 웜/쿨(또는 명도) 탐색 화면이니, "선택" 대신 팔레트 아이콘을 보여준다.
  paletteViewButton.style.opacity = '1';
  paletteViewButton.style.pointerEvents = 'auto';
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  previousPaletteMode = null;
  previousPaletteColor = null;
  closePaletteGrid();
}

// 팔레트에서 색을 확정할 때마다 아이콘이 벨이 울리듯 짧게 흔들리는 모션.
function bouncePaletteIconIcon() {
  paletteViewButton.classList.remove('bell');
  paletteIconGlow.classList.remove('pulse');
  void paletteViewButton.offsetWidth; // 강제 리플로우로 애니메이션을 처음부터 재생시킨다.
  paletteViewButton.classList.add('bell');
  paletteIconGlow.classList.add('pulse');
}

// 이미 중앙에 와 선명해진 체크 표시를 한 번 더 선택하면 그 색을 확정한다: 체크 구멍이
// 원형으로 바뀌고, 팔레트 아이콘이 흔들린다. 원형(확정) 상태에서 다시 선택하면
// 확정을 취소하고 체크 상태로 되돌린다.
function confirmSwatchColor(color, swatchEl) {
  const existingIndex = confirmedColors.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  if (existingIndex >= 0) {
    confirmedColors.splice(existingIndex, 1);
  } else {
    confirmedColors.push(color);
  }
  bouncePaletteIconIcon();
  // 지금 이 화면이 "확정한 색" 계열 모드(전체/웜/쿨 필터)라면, 목록이 바뀐 즉시
  // 같은 모드로 코브플로우를 새로고침한다(단, 걸러진 목록이 비면 웜톤으로 돌아간다).
  if (currentPaletteMode.startsWith('confirmed')) {
    const stillHasColors = paletteListForMode(currentPaletteMode, color).length > 0;
    setPaletteMode(stillHasColors ? currentPaletteMode : 'warm');
  }
  updateSwatchCheckMask(swatchEl, color);
  // 지금 이 함수는 항상 "중앙에 와 있는" 스와치에서만 불리므로, 체크든 원형이든
  // 마개는 계속 걷어둔 채로 둔다.
  if (swatchEl.plugEl) swatchEl.plugEl.style.opacity = '0';
}

function openPaletteGrid() {
  isPaletteGridOpen = true;
  const { rows } = computePaletteGridDims();
  // 코브플로우 양 끝을 가리던 마스크를 없애야 펼쳐진 그리드 전체가 잘리지 않고 보인다.
  paletteBar.style.maskImage = 'none';
  paletteBar.style.webkitMaskImage = 'none';
  paletteExpandArrow.style.bottom = `${124 + (rows - 1) * PALETTE_GRID_SLOT}px`;
  paletteExpandArrow.style.transform = 'translateX(-50%) rotate(180deg)';
  applyPaletteLayout();
}

function closePaletteGrid() {
  isPaletteGridOpen = false;
  paletteBar.style.maskImage = 'linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)';
  paletteBar.style.webkitMaskImage = paletteBar.style.maskImage;
  paletteExpandArrow.style.bottom = '124px';
  paletteExpandArrow.style.transform = 'translateX(-50%) rotate(0deg)';
  applyPaletteLayout();
}

paletteExpandArrow.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isPaletteGridOpen) closePaletteGrid();
  else openPaletteGrid();
});

// 배경색 명도에 따라 뒤로가기 버튼 글씨를 자연스럽게 흰색/검정으로 바꾼다.
function updateBackButtonContrast(color) {
  const { l } = hexToHSL(color);
  backButton.style.color = l < 50 ? '#ffffff' : '#111111';
}

// 팔레트 중앙 그림자를 무채색 검정이 아니라, 배경색의 명도를 살짝 낮추고
// 채도를 높인 "그 색의 짙은 버전"으로 만든다.
// 텍스트/아이콘이 어두운 배경 위에서 흰색으로 뒤집히는 것과 같은 기준(l < 50)으로,
// 배경이 밝으면 그림자를 어둡게, 이미 어두우면 오히려 밝게 틀어서 항상 보이게 한다.
function paletteShadowHexFor(hex) {
  const { h, s, l } = hexToHSL(hex);
  // screen 블렌드는 흰색에 가까울수록 밝혀 보이는 힘이 세지므로, 어두운 배경에서는
  // (multiply의 "-22"처럼 살짝만 옮기지 않고) 확실히 밝은 값으로 크게 끌어올린다.
  const shiftedL = l < 50 ? 78 : Math.max(0, l - 22);
  return hslToHex(h, Math.min(100, s + 25), shiftedL);
}

function updatePaletteShadowColor(color) {
  const shadowHex = paletteShadowHexFor(color);
  paletteCenterShadow.style.background = hexToRgba(shadowHex, 0.2);
  // 중앙 스와치를 강조할 때 쓴 것과 동일한 그림자 색으로 화살표 자체를 채우되, 더 투명하게.
  paletteExpandArrowFill.style.background = hexToRgba(shadowHex, 0.3);
  // multiply는 항상 배경을 어둡게만 만들어서, 그림자 색을 밝게 틀어봤자 어두운 배경
  // 위에서는 그대로 묻혀버린다. 배경이 어두울 때는 밝혀 보이게 screen으로 바꾼다.
  const { l } = hexToHSL(color);
  paletteCenterShadow.style.mixBlendMode = l < 50 ? 'screen' : 'multiply';
}

function changeOverlayColor(color) {
  currentColor = color;
  colorOverlay.style.transition = colorOverlay.style.transition
    ? colorOverlay.style.transition
    : '';
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);
  refreshPaletteForCurrentColor(color);
  closePaletteGrid();
}

// 튜토리얼을 거치든(연습 모드) 모빌에서 개체를 바로 클릭하든, 색을 하나씩
// 보여주는 이 화면에 처음 들어왔을 때 한 번만 "모서리를 중앙으로 당겨보라"는
// 힌트를 띄운다. 코너 드래그(모서리를 잡아 가운데로 당기면 페이지가 넘어가듯
// 다음 색으로 바뀌는 제스처)를 처음 보는 사용자를 위한 안내다.
let hasShownCornerDragHint = false;
let cornerDragHintTimer = null;
const cornerDragHint = document.createElement('p');
cornerDragHint.textContent = '화면 모서리를 잡아 가운데로 당겨보세요';
cornerDragHint.style.position = 'fixed';
cornerDragHint.style.top = '18%';
cornerDragHint.style.left = '50%';
cornerDragHint.style.transform = 'translate(-50%, -50%)';
cornerDragHint.style.margin = '0';
cornerDragHint.style.maxWidth = '240px';
cornerDragHint.style.textAlign = 'center';
cornerDragHint.style.fontSize = '13px';
cornerDragHint.style.lineHeight = '1.6';
cornerDragHint.style.zIndex = '1003';
cornerDragHint.style.opacity = '0';
cornerDragHint.style.pointerEvents = 'none';
cornerDragHint.style.transition = 'opacity 0.5s ease';
document.body.appendChild(cornerDragHint);

function hideCornerDragHint() {
  clearTimeout(cornerDragHintTimer);
  cornerDragHint.style.opacity = '0';
}

function maybeShowCornerDragHint(color) {
  if (hasShownCornerDragHint) return;
  hasShownCornerDragHint = true;
  const { l } = hexToHSL(color);
  cornerDragHint.style.color = l < 50 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(17, 17, 17, 0.75)';
  cornerDragHint.style.opacity = '1';
  clearTimeout(cornerDragHintTimer);
  cornerDragHintTimer = setTimeout(hideCornerDragHint, 4000);
}

function showColorOverlay(color, x, y) {
  lastClickPoint = { x, y };
  currentColor = color;
  closePaletteGrid();
  curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
  colorOverlay.style.background = color;
  updateBackButtonContrast(color);
  updatePaletteShadowColor(color);
  updateToneTabsContrast(color);
  updatePaletteViewButtonContrast(color);
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
  paletteCenterShadow.style.opacity = '1';
  paletteExpandArrow.style.opacity = '1';
  paletteExpandArrow.style.pointerEvents = 'auto';
  // Warm/Cool 탭, 체크 표시, 팔레트(확정 목록) 아이콘은 여기서 켜지 않는다 —
  // 튜토리얼을 거친 실전 모드(enterPracticeMode)에서만 보인다.

  // 첫 화면(메인 모빌)을 벗어났으니 튜토리얼 아이콘은 숨긴다.
  tutorialButtonEl.style.opacity = '0';
  tutorialButtonEl.style.pointerEvents = 'none';

  maybeShowCornerDragHint(color);
}

function hideColorOverlay() {
  hideCornerDragHint();
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
  paletteCenterShadow.style.opacity = '0';
  paletteExpandArrow.style.opacity = '0';
  paletteExpandArrow.style.pointerEvents = 'none';
  isPracticeMode = false;
  paletteToneTabs.style.opacity = '0';
  paletteToneTabs.style.pointerEvents = 'none';
  paletteViewButton.style.opacity = '0';
  paletteViewButton.style.pointerEvents = 'none';
  stageAdvanceButton.style.opacity = '0';
  stageAdvanceButton.style.pointerEvents = 'none';
  stageHintOverlay.style.opacity = '0';
  stageHintOverlay.style.pointerEvents = 'none';
  synthesisBackdrop.style.opacity = '0';
  synthesisBackdrop.style.pointerEvents = 'none';
  endButton.style.opacity = '0';
  endButton.style.pointerEvents = 'none';
  beautyTipsPanel.style.opacity = '0';
  beautyTipsPanel.style.pointerEvents = 'none';
  pendingStageIntro = null;
  pendingFinalSeason = null;
  isShowingBeautyTips = false;
  practiceStage = 'tone';
  closePaletteGrid();

  // 첫 화면(메인 모빌)으로 돌아왔으니 튜토리얼 아이콘을 다시 보여준다.
  tutorialButtonEl.style.opacity = '1';
  tutorialButtonEl.style.pointerEvents = 'auto';
}

// "확정한 색" 화면(과 그 안의 웜/쿨 필터) 안에서는 뒤로가기가 화면 전체를 나가지
// 않고 들어오기 직전 화면(3단계 이후의 실전 화면)으로만 되돌아간다.
backButton.addEventListener('click', () => {
  if (isShowingBeautyTips) {
    returnToSynthesisFromTips();
  } else if (currentPaletteMode.startsWith('confirmed')) {
    restorePreviousPaletteView();
  } else if (practiceStage !== 'tone') {
    goToPreviousStage();
  } else {
    hideColorOverlay();
  }
});

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

  // 사용자가 실제로 모서리를 잡아 드래그를 시작했으니, 안내 문구는 더 볼 필요가 없다.
  hideCornerDragHint();

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
      updatePaletteShadowColor(currentColor);
      updateToneTabsContrast(currentColor);
      updatePaletteViewButtonContrast(currentColor);
      curlCtx.clearRect(0, 0, curlCanvas.width, curlCanvas.height);
      refreshPaletteForCurrentColor(currentColor);
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

// filter: blur()는 개체 200개에 매 프레임 걸리는 가장 무거운 효과라 모바일/태블릿에서
// 깜빡임(리페인트 과부하)의 주 원인이 되기 쉽다. 그 기기들에서는 블러를 끈다.
const MAX_DEPTH_BLUR = isLikelyMobile ? 0 : 10;
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
// 모바일/태블릿에서는 전체적으로 조금 더 느리게 돈다.
const IDLE_SPEED = isLikelyMobile ? 0.06 : 0.1;
let speed = isLikelyMobile ? 3 : 5;
let braking = false;
const brakingRate = 0.92;

function tick() {
  if (!isDragging && (autoRotate || braking)) {
    if (braking) {
      speed *= brakingRate;
      if (speed < IDLE_SPEED) {
        speed = IDLE_SPEED;
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
    speed = IDLE_SPEED;
    autoRotate = true;
  }, 1200);
}

const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialShortcutEl = document.getElementById('tutorialShortcut');

// 사용자의 OS/브라우저에 맞는 "탭·주소창 숨김" 전체화면 단축키를 안내한다.
function getFullscreenShortcut() {
  const ua = navigator.userAgent;
  const isMac = /Mac|Macintosh/.test(navigator.platform || ua);

  if (isLikelyMobile) {
    return '주소창을 아래로 스크롤해서 숨겨보세요';
  }

  if (!isMac) {
    // 윈도우/리눅스/크롬OS는 대부분 브라우저가 F11로 동일하게 동작한다.
    return 'F11';
  }

  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;

  // 크롬(맥)만 탭·주소창을 숨기는 별도 단축키(Shift+Cmd+F)를 갖고, 그 외
  // 사파리/엣지/파이어폭스는 macOS 기본 전체화면 단축키(Ctrl+Cmd+F)를 쓴다.
  if (isChrome) return '⇧ Shift + ⌘ Command + F';
  return '⌃ Control + ⌘ Command + F';
}

tutorialShortcutEl.textContent = getFullscreenShortcut();

const tutorialSlides = Array.from(tutorialOverlay.querySelectorAll('.tutorial-slide'));
let tutorialIndex = 0;
// 전체화면 단축키 안내(첫 슬라이드)는 키보드 단축키가 있는 데스크탑에서만 의미가
// 있으므로, 모바일에서는 이 슬라이드를 건너뛰고 바로 다음 슬라이드부터 시작한다.
const TUTORIAL_START_INDEX = isLikelyMobile ? 1 : 0;

function renderTutorialSlide() {
  tutorialSlides.forEach((slide, i) => slide.classList.toggle('active', i === tutorialIndex));
}

function openTutorial() {
  tutorialIndex = TUTORIAL_START_INDEX;
  renderTutorialSlide();
  tutorialOverlay.classList.add('active');
}

function closeTutorial() {
  tutorialOverlay.classList.remove('active');
}

// 현재 회전 중인 카드들 중 정면에 와 있는 색을 그대로 실전 화면의 시작 색으로 쓴다.
function getFrontCardColor() {
  const normalized = ((rotationOffset % 360) + 360) % 360;
  const frontAngle = (360 - normalized) % 360;
  const pos = (frontAngle / 360) * count;
  const index = Math.floor(pos) % count;
  return colors[index];
}

// 마지막 슬라이드(1차 드레이핑 설명)에서 튜토리얼을 마치면, 안내한 대로 실제 컬러
// 화면을 띄우고 전체 100색을 웜/쿨 탭으로 걸러볼 수 있는 상태로 시작한다.
function enterPracticeMode() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  isPracticeMode = true;
  practiceStage = 'tone';
  renderStageTabs();
  showColorOverlay(getFrontCardColor(), cx, cy);
  setPaletteMode('warm');
  paletteToneTabs.style.opacity = '1';
  paletteToneTabs.style.pointerEvents = 'auto';
  paletteViewButton.style.opacity = '1';
  paletteViewButton.style.pointerEvents = 'auto';
  // "선택"은 팔레트 아이콘을 눌러 확정한 색 화면에 들어간 뒤에만 나타난다.
}

// 슬라이드 어디를 클릭해도 다음으로 넘어가고, 마지막 슬라이드에서는 닫히며 실전 화면으로 이어진다.
function advanceTutorial() {
  if (tutorialIndex < tutorialSlides.length - 1) {
    tutorialIndex += 1;
    renderTutorialSlide();
  } else {
    closeTutorial();
    enterPracticeMode();
  }
}

tutorialOverlay.addEventListener('click', advanceTutorial);

// 첫 슬라이드에서 더 뒤로 갈 곳이 없으면 튜토리얼을 종료한다.
function rewindTutorial() {
  if (tutorialIndex > TUTORIAL_START_INDEX) {
    tutorialIndex -= 1;
    renderTutorialSlide();
  } else {
    closeTutorial();
  }
}

const tutorialBackButton = document.getElementById('tutorialBack');
tutorialBackButton.addEventListener('click', (e) => {
  e.stopPropagation();
  rewindTutorial();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTutorial();
});