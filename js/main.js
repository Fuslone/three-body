// 主逻辑模块 - 核心状态操作、模拟生成、动画循环、初始化

// ===== 主逻辑常量 =====
const DEFAULT_BODY_COUNT = 3;           // 默认天体数量
const BG_COLOR = "#0a0a1a";             // 画布背景色

const RANDOM_POS_ANGLE_SPREAD = 0.5;    // 随机位置角度偏移范围（±0.25rad ≈ ±14°）
const RANDOM_POS_DIST_MIN_RATIO = 0.5;  // 随机位置最小距离比例
const RANDOM_POS_DIST_RANGE = 0.5;      // 随机位置距离随机范围
const RANDOM_VEL_ANGLE_SPREAD = 0.6;    // 随机速度角度偏移（±0.3rad ≈ ±17°）
const ORBITAL_SPEED_DIVISOR = 4;        // 初始圆轨道速度计算公式分母
const ORBITAL_ANGLE_OFFSET = Math.PI / 2; // 轨道速度方向垂直于径向（90°）

const PHYSICS_STEPS_PER_SPEED = 3;      // 每单位模拟速度对应的每帧物理步数
const FPS_UPDATE_INTERVAL_MS = 500;     // FPS显示刷新间隔（毫秒）
const MS_PER_SEC = 1000;                // 毫秒/秒换算

// ===== 核心状态操作 =====

function clearSelection() {
  State.selectedBodyIndex = -1;
  State.trackingBodyIndex = -1;
}

function refreshAfterBodiesChanged() {
  saveInitialBodies();
  initAccelerations();
  renderBodyList();
}

function updateSelectedBodyInputs() {
  if (!State.isRunning) return;
  const body = State.bodies[State.selectedBodyIndex];
  if (!body) return;
  const speedVal = Math.hypot(body.vx, body.vy);
  $("bodySpeedInput").value = speedVal.toFixed(2);
  let angle = (Math.atan2(body.vy, body.vx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  $("bodyAngleInput").value = angle.toFixed(2);
}

function zeroMomentum() {
  let px = 0, py = 0, m = 0;
  for (const b of State.bodies) {
    px += b.vx * b.mass;
    py += b.vy * b.mass;
    m += b.mass;
  }
  const vcx = px / m, vcy = py / m;
  for (const b of State.bodies) {
    b.vx -= vcx;
    b.vy -= vcy;
  }
}

function enterInitialState() {
  State.simulationTime = 0;
  State.isRunning = false;
  State.selectedBodyIndex = -1;
  State.trackingBodyIndex = -1;
  State.resetBtnEnabled = false;
  updatePlayButton();
  updateResetButton();
  setControlsEnabled(true);
  hideBodyDetailModal();
  renderBodyList();
}

function randomBodies() {
  const oldBodies = cloneBodies(State.bodies);
  const count = oldBodies.length > 0 ? oldBodies.length : DEFAULT_BODY_COUNT;
  const oldNames = oldBodies.map((b) => b.name);
  const oldColors = oldBodies.map((b) => b.color);
  State.bodies = [];

  const { massMin, massMax, speedMin, speedMax, posRange } = getRandomParams();

  for (let i = 0; i < count; i++) {
    const old = oldBodies[i];
    const baseAngle = ((Math.PI * 2) / count) * i;

    let x, y, vx, vy, mass;

    if (State.randomPosition) {
      const angle = baseAngle + Math.random() * RANDOM_POS_ANGLE_SPREAD - RANDOM_POS_ANGLE_SPREAD / 2;
      const dist = posRange * (RANDOM_POS_DIST_MIN_RATIO + Math.random() * RANDOM_POS_DIST_RANGE);
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
    } else if (old) {
      x = old.x;
      y = old.y;
    } else {
      const angle = baseAngle;
      x = Math.cos(angle) * posRange;
      y = Math.sin(angle) * posRange;
    }

    if (State.randomMass) {
      mass = massMin + Math.random() * (massMax - massMin);
    } else if (old) {
      mass = old.mass;
    } else {
      mass = State.baseMass;
    }

    if (State.randomSpeed) {
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      let velAngle;
      if (State.randomPosition) {
        const posAngle = Math.atan2(y, x);
        velAngle = posAngle + ORBITAL_ANGLE_OFFSET + (Math.random() - 0.5) * RANDOM_VEL_ANGLE_SPREAD;
      } else {
        velAngle = Math.random() * Math.PI * 2;
      }
      vx = Math.cos(velAngle) * speed;
      vy = Math.sin(velAngle) * speed;
    } else if (old) {
      vx = old.vx;
      vy = old.vy;
    } else {
      const posAngle = Math.atan2(y, x);
      const orbSpeed = Math.sqrt((State.G * State.baseMass * (count - 1)) / (ORBITAL_SPEED_DIVISOR * Math.hypot(x, y)));
      vx = Math.cos(posAngle + ORBITAL_ANGLE_OFFSET) * orbSpeed;
      vy = Math.sin(posAngle + ORBITAL_ANGLE_OFFSET) * orbSpeed;
    }

    State.bodies.push(createBody({
      name: oldNames[i] || "天体" + (i + 1),
      x, y, vx, vy, mass,
      color: oldColors[i] || randomColor(),
    }));
  }

  if (State.randomSpeed) zeroMomentum();
  State.bodyNameCounter = State.bodies.length;
  State.initialBodies = cloneBodies(State.bodies);
  initAccelerations();
  enterInitialState();
}

function reset() {
  State.bodies = cloneBodies(State.initialBodies);
  State.bodyNameCounter = State.bodies.length;
  initAccelerations();
  enterInitialState();
}

// ===== 画布与渲染循环 =====

function resize() {
  State.width = State.canvas.width = window.innerWidth;
  State.height = State.canvas.height = window.innerHeight;
  State.centerX = State.width / 2;
  State.centerY = State.height / 2;
  if (!State.starsInitialized) {
    generateStars();
    State.starsInitialized = true;
  }
}

function animate() {
  const ctx = State.ctx;
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, State.width, State.height);

  drawStars();

  if (State.isRunning) {
    const steps = Math.max(1, Math.floor(State.speed * PHYSICS_STEPS_PER_SPEED));
    for (let i = 0; i < steps; i++) {
      updatePhysics();
    }
  }

  if (State.simulationTime > 0 && !State.resetBtnEnabled) {
    State.resetBtnEnabled = true;
    updateResetButton();
  }

  if (State.trackingBodyIndex >= 0 && State.bodies[State.trackingBodyIndex]) {
    const body = State.bodies[State.trackingBodyIndex];
    State.offsetX = -body.x;
    State.offsetY = -body.y;
  }

  drawTrails();
  drawBodies();

  State.frameCount++;
  const now = performance.now();
  if (now - State.lastTime >= FPS_UPDATE_INTERVAL_MS) {
    State.fps = Math.round((State.frameCount * MS_PER_SEC) / (now - State.lastTime));
    State.frameCount = 0;
    State.lastTime = now;
    $("fpsDisplay").textContent = State.fps;
  }

  $("timeDisplay").textContent = State.simulationTime.toFixed(2);
  updateSelectedBodyInputs();
  requestAnimationFrame(animate);
}

// ===== 初始化 =====

(function init() {
  State.canvas = $("canvas");
  State.ctx = State.canvas.getContext("2d");

  resize();
  loadSettingsFromBrowser();
  randomBodies();
  refreshLoadSelect();
  bindCanvasEvents();
  bindEvents();
  animate();
})();
