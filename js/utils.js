// 工具函数模块

// ===== 工具常量 =====
const COLOR_HUE_RANGE = 360;          // HSL色相范围（度）
const COLOR_SAT_MIN = 70;             // 随机颜色饱和度最小值（%）
const COLOR_SAT_RANGE = 25;           // 随机颜色饱和度范围（%）
const COLOR_LIGHT_MIN = 55;           // 随机颜色亮度最小值（%）
const COLOR_LIGHT_RANGE = 15;         // 随机颜色亮度范围（%）

const BASE_BODY_RADIUS = 8;           // 天体基础半径（像素）
const BODY_RADIUS_VAR = 8;            // 天体半径随质量增加的最大增量
const MASS_RADIUS_EXPONENT = 0.4;     // 质量-半径关系指数：r = base + var * (m/m0)^k

const $ = (id) => document.getElementById(id);

function parseNumber(value, defaultValue, min, max) {
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  let result = num;
  if (min !== undefined && min !== null) result = Math.max(min, result);
  if (max !== undefined && max !== null) result = Math.min(max, result);
  return result;
}

function randomColor() {
  const h = Math.floor(Math.random() * COLOR_HUE_RANGE);
  const s = Math.floor(COLOR_SAT_MIN + Math.random() * COLOR_SAT_RANGE);
  const l = Math.floor(COLOR_LIGHT_MIN + Math.random() * COLOR_LIGHT_RANGE);
  return hslToHex(h, s, l);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getBodyRadius(mass) {
  return BASE_BODY_RADIUS + Math.pow(mass / State.baseMass, MASS_RADIUS_EXPONENT) * BODY_RADIUS_VAR;
}

function cloneBodies(bodies) {
  return bodies.map((b) => ({ ...b, trail: [], ax: 0, ay: 0 }));
}

function createBody(params) {
  return {
    name: params.name,
    x: params.x,
    y: params.y,
    vx: params.vx,
    vy: params.vy,
    mass: params.mass,
    radius: getBodyRadius(params.mass),
    color: params.color,
    trail: [],
    ax: 0,
    ay: 0,
  };
}

function getRandomParams() {
  let massMin = State.randomMassMin;
  let massMax = State.randomMassMax;
  if (massMin > massMax) [massMin, massMax] = [massMax, massMin];

  let speedMin = State.randomSpeedMin;
  let speedMax = State.randomSpeedMax;
  if (speedMin > speedMax) [speedMin, speedMax] = [speedMax, speedMin];

  const posRange = State.randomPosRange;

  return { massMin, massMax, speedMin, speedMax, posRange };
}
