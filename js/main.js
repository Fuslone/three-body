// 主逻辑与事件模块 - 视图控制、核心操作、动画循环、事件绑定

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

const MOUSE_DRAG_THRESHOLD = 3;         // 鼠标拖拽判断阈值（像素）
const TOUCH_DRAG_THRESHOLD = 6;         // 触摸拖拽判断阈值（像素）

const ZOOM_OUT_FACTOR = 0.9;            // 滚轮缩小系数
const ZOOM_IN_FACTOR = 1.1;             // 滚轮放大系数

// ===== 核心状态操作 =====

function defocus() {
  State.selectedBodyIndex = -1;
  State.trackingBodyIndex = -1;
}

function refreshAfterBodiesChanged() {
  saveInitialBodies();
  initAccelerations();
  renderBodyList();
}

function updateSelectedBodyHUD() {
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
  hideBodyDetailPopup();
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
  updateSelectedBodyHUD();
  requestAnimationFrame(animate);
}

// ===== 拖拽交互 =====

function handleBodyPress(index, clientX, clientY) {
  State.selectedBodyIndex = index;
  if (State.simulationTime === 0) {
    State.isDraggingBody = true;
    State.draggedBodyIndex = index;
    State.dragStartX = clientX;
    State.dragStartY = clientY;
    State.dragMoved = false;
    State.trackingBodyIndex = -1;
    hideBodyDetailPopup();
  } else {
    State.trackingBodyIndex = index;
  }
  renderBodyList();
}

function handleBackgroundPress(clientX, clientY) {
  State.selectedBodyIndex = -1;
  State.trackingBodyIndex = -1;
  State.isPanning = true;
  hideBodyDetailPopup();
  renderBodyList();
  State.lastMouseX = clientX;
  State.lastMouseY = clientY;
}

function handleDragMove(clientX, clientY, threshold = MOUSE_DRAG_THRESHOLD) {
  if (State.isDraggingBody && State.draggedBodyIndex >= 0) {
    const dx = clientX - State.dragStartX;
    const dy = clientY - State.dragStartY;
    if (!State.dragMoved && dx * dx + dy * dy > threshold * threshold) {
      State.dragMoved = true;
    }
    const world = screenToWorld(clientX, clientY);
    const b = State.bodies[State.draggedBodyIndex];
    b.x = world.x;
    b.y = world.y;
    b.trail = [];
    if (State.simulationTime === 0) {
      initAccelerations();
    }
    return true;
  }
  if (State.isPanning) {
    State.offsetX += (clientX - State.lastMouseX) / State.scale;
    State.offsetY += (clientY - State.lastMouseY) / State.scale;
    State.lastMouseX = clientX;
    State.lastMouseY = clientY;
    return true;
  }
  return false;
}

function handleDragEnd() {
  if (State.isDraggingBody && !State.isRunning) {
    if (State.dragMoved) {
      defocus();
      refreshAfterBodiesChanged();
      hideBodyDetailPopup();
    } else {
      State.trackingBodyIndex = State.draggedBodyIndex;
      showBodyDetailModal();
    }
  }
  State.isDraggingBody = false;
  State.draggedBodyIndex = -1;
  State.isPanning = false;
}

// ===== 弹窗管理 =====

// .advanced-content 展开后的 padding-top（见 component.css），测量展开高度时需补偿
const ADVANCED_PAD_TOP = 16;

function toggleAdvancedSection(toggleEl) {
  const content = toggleEl.nextElementSibling;
  if (!content) return;
  const isActive = toggleEl.classList.toggle("active");

  if (isActive) {
    content.style.maxHeight = (content.scrollHeight + ADVANCED_PAD_TOP) + "px";
    content.addEventListener("transitionend", function handler(e) {
      if (e.propertyName !== "max-height") return;
      content.removeEventListener("transitionend", handler);
      if (toggleEl.classList.contains("active")) {
        content.style.maxHeight = "none";
      }
    });
  } else {
    if (content.style.maxHeight === "none") {
      content.style.maxHeight = (content.scrollHeight + ADVANCED_PAD_TOP) + "px";
      void content.offsetHeight; // 强制回流，确保从当前高度过渡
    }
    content.style.maxHeight = "0";
  }
}

function closeAllModals() {
  ["helpModal", "settingsModal", "bodyDetailModal", "exportModal", "deleteModal", "confirmModal"].forEach((id) => {
    $(id)?.classList.remove("active");
  });
}

function closeModalOnOverlayClick(modalId) {
  $(modalId).addEventListener("click", function (e) {
    if (e.target === this) {
      this.classList.remove("active");
      if (modalId === "bodyDetailModal") {
        defocus();
        renderBodyList();
      }
    }
  });
}

// ===== 事件绑定辅助 =====

// 参数输入框配置（HTML 中只保留 type/class/id，初始值与范围统一在此维护）
// guard: 模拟开始后禁止修改；recompute: 变更后重算加速度；persist: 变更后持久化设置
const PARAM_INPUTS = [
  { id: "speedInput", key: "speed", def: 1, min: 0.01, max: null, guard: true, persist: true },
  { id: "dtInput", key: "dt", def: 0.01, min: 0.01, max: null, guard: true, persist: true },
  { id: "gravityInput", key: "G", def: 500, min: 0.01, max: 100000, guard: true, recompute: true },
  { id: "softeningInput", key: "softening", def: 20, min: 0, max: 200, guard: true, recompute: true },
  { id: "trailDurationInput", key: "trailDuration", def: 10, min: 0.01, max: 10000, persist: true },
  { id: "posRangeInput", key: "randomPosRange", def: 200, min: 0.01, max: 10000, persist: true },
];

function formatParam(v) {
  return v.toFixed(2);
}

function bindParamInputs() {
  PARAM_INPUTS.forEach(({ id, key, def, min, max, guard, recompute, persist }) => {
    $(id).addEventListener("change", function () {
      if (guard && State.simulationTime !== 0) {
        this.value = formatParam(State[key]);
        return;
      }
      const val = parseNumber(this.value, def, min, max);
      State[key] = val;
      this.value = formatParam(val);
      if (recompute) initAccelerations();
      if (persist) persistSettings();
    });
  });
}

function bindToggle(id, stateKey, onChange) {
  $(id).addEventListener("click", function () {
    State[stateKey] = !State[stateKey];
    this.classList.toggle("active", State[stateKey]);
    if (onChange) onChange();
  });
}

function getSelectedBody() {
  return State.bodies[State.selectedBodyIndex] || null;
}

function bindBodyParamInput(id, handler) {
  $(id).addEventListener("change", function () {
    const body = getSelectedBody();
    if (!body) return;
    const formatted = handler(body, this);
    if (formatted !== undefined) this.value = formatted;
    refreshAfterBodiesChanged();
  });
}

// ===== 事件绑定 =====

function bindEvents() {
  const canvas = State.canvas;

  // --- 播放控制 ---
  $("playBtn").addEventListener("click", function () {
    State.isRunning = !State.isRunning;
    updatePlayButton();
    updateResetButton();
    if (State.isRunning) {
      if (State.simulationTime === 0) defocus();
      hideBodyDetailPopup();
    }
    setControlsEnabled(false);
    renderBodyList();
  });

  $("resetBtn").addEventListener("click", reset);
  $("randomBtn").addEventListener("click", randomBodies);

  // --- 模拟/宇宙/随机参数（统一配置表绑定） ---
  bindParamInputs();

  // --- 设置面板折叠栏 ---
  ["runParamsToggle", "randomParamsToggle", "universeParamsToggle", "saveSectionToggle", "settingsMgmtToggle"]
    .forEach((id) => {
      $(id).addEventListener("click", function () {
        toggleAdvancedSection(this);
      });
    });

  // 质量范围
  setupMinMaxInputs(
    "massMinInput", "massMaxInput",
    State.randomMassMin, State.randomMassMax,
    0.01, 1e6,
    (v) => v.toFixed(2),
    (min, max) => {
      State.randomMassMin = min; State.randomMassMax = max;
      persistSettings();
    }
  );
  // 速度范围
  setupMinMaxInputs(
    "speedMinInput", "speedMaxInput",
    State.randomSpeedMin, State.randomSpeedMax,
    0, 1000,
    (v) => v.toFixed(2),
    (min, max) => {
      State.randomSpeedMin = min; State.randomSpeedMax = max;
      persistSettings();
    }
  );

  // --- 显示选项 ---
  bindToggle("velocityToggle", "showVelocity", persistSettings);
  bindToggle("bodyNameToggle", "showBodyNames", persistSettings);
  bindToggle("trailToggle", "showTrail", () => {
    updateTrailControlsVisibility();
    persistSettings();
  });

  // --- 随机生成选项 ---
  bindToggle("randomMassToggle", "randomMass", () => {
    updateRandomControlsVisibility();
    persistSettings();
  });
  bindToggle("randomSpeedToggle", "randomSpeed", () => {
    updateRandomControlsVisibility();
    persistSettings();
  });
  bindToggle("randomPositionToggle", "randomPosition", () => {
    updateRandomControlsVisibility();
    persistSettings();
  });

  document.querySelectorAll('input[name="trailMode"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      State.trailMode = this.value;
      updateTrailControlsVisibility();
      persistSettings();
    });
  });

  // --- 天体编辑 ---
  bindBodyParamInput("bodyNameInput", (body, input) => {
    const val = input.value.trim() || body.name;
    body.name = val;
    return val;
  });

  bindBodyParamInput("bodyMassInput", (body, input) => {
    const val = parseNumber(input.value, 1000, 0.01, 1e6);
    body.mass = val;
    body.radius = getBodyRadius(val);
    return val.toFixed(2);
  });

  bindBodyParamInput("bodySpeedInput", (body, input) => {
    const val = parseNumber(input.value, 1, 0, 1000);
    const currentAngle = Math.atan2(body.vy, body.vx);
    body.vx = Math.cos(currentAngle) * val;
    body.vy = Math.sin(currentAngle) * val;
    return val.toFixed(2);
  });

  bindBodyParamInput("bodyAngleInput", (body, input) => {
    const raw = parseFloat(input.value);
    if (isNaN(raw) || !isFinite(raw)) {
      const ca = (Math.atan2(body.vy, body.vx) * 180) / Math.PI;
      return (ca < 0 ? ca + 360 : ca).toFixed(2);
    }
    let val = raw;
    while (val < 0) val += 360;
    while (val >= 360) val -= 360;
    const angle = (val * Math.PI) / 180;
    const currentSpeed = Math.hypot(body.vx, body.vy);
    body.vx = Math.cos(angle) * currentSpeed;
    body.vy = Math.sin(angle) * currentSpeed;
    return val.toFixed(2);
  });

  $("colorRandomBtn").addEventListener("click", function () {
    const body = getSelectedBody();
    if (!body) return;
    body.color = randomColor();
    $("bodyColor").value = body.color;
    refreshAfterBodiesChanged();
  });

  $("bodyColor").addEventListener("input", function () {
    const body = getSelectedBody();
    if (!body) return;
    body.color = this.value;
    renderBodyList();
    saveInitialBodies();
  });

  // --- 鼠标交互 ---
  canvas.addEventListener("mousedown", function (e) {
    const hit = getBodyAtMouse(e.clientX, e.clientY);
    if (hit >= 0) {
      handleBodyPress(hit, e.clientX, e.clientY);
    } else {
      handleBackgroundPress(e.clientX, e.clientY);
    }
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("mousemove", function (e) {
    if (!handleDragMove(e.clientX, e.clientY, MOUSE_DRAG_THRESHOLD)) {
      canvas.style.cursor = "grab";
    }
  });

  canvas.addEventListener("mouseup", function () {
    handleDragEnd();
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("mouseleave", function () {
    if (State.isDraggingBody && !State.isRunning) {
      refreshAfterBodiesChanged();
    }
    State.isDraggingBody = false;
    State.draggedBodyIndex = -1;
    State.isPanning = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    State.scale *= e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
  }, { passive: false });

  // --- 触摸交互 ---
  canvas.addEventListener("touchstart", function (e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const hit = getBodyAtMouse(t.clientX, t.clientY);
      if (hit >= 0) {
        handleBodyPress(hit, t.clientX, t.clientY);
      } else {
        handleBackgroundPress(t.clientX, t.clientY);
      }
    } else if (e.touches.length === 2) {
      State.isDraggingBody = false;
      State.isPanning = false;
      State.touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      State.touchStartScale = State.scale;
    }
  }, { passive: true });

  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY, TOUCH_DRAG_THRESHOLD);
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      State.scale = State.touchStartScale * (dist / State.touchStartDist);
    }
  }, { passive: false });

  canvas.addEventListener("touchend", handleDragEnd);
  window.addEventListener("resize", resize);

  // --- UI按钮 ---
  $("toggleUiBtn").addEventListener("click", function () {
    const hidden = document.body.classList.toggle("ui-hidden");
    this.textContent = hidden ? "🙈" : "👁";
    if (hidden) {
      closeAllModals();
      renderBodyList();
    }
  });

  $("helpBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    $("helpModal").classList.add("active");
  });

  // --- 弹窗遮罩关闭 ---
  ["helpModal", "bodyDetailModal", "settingsModal", "exportModal", "deleteModal"].forEach((id) => {
    closeModalOnOverlayClick(id);
  });

  // --- 天体列表横向滚动 ---
  $("bodyList").addEventListener("wheel", function (e) {
    e.preventDefault();
    this.scrollLeft += e.deltaY;
  }, { passive: false });

  // --- 设置面板 ---
  $("settingsBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    $("settingsModal").classList.add("active");
    refreshLoadSelect();
  });

  // --- 存档操作 ---
  $("saveBtn").addEventListener("click", function () {
    const name = $("saveNameInput").value;
    if (!name || !name.trim()) {
      showToast("请输入存档名称", "error");
      return;
    }
    if (saveCurrentState(name)) {
      $("saveNameInput").value = "";
      refreshLoadSelect();
      showToast(`已保存存档"${name}"`, "success");
    } else {
      showToast("保存失败", "error");
    }
  });

  $("loadBtn").addEventListener("click", function () {
    const name = $("loadSelect").value;
    if (!name) { showToast("请选择存档", "error"); return; }
    showConfirm(`确定加载存档"${name}"吗？当前状态将被覆盖`, () => {
      if (loadState(name)) {
        $("settingsModal").classList.remove("active");
        showToast(`已加载存档"${name}"`, "success");
      } else {
        showToast("加载失败", "error");
      }
    });
  });

  $("deleteSaveBtn").addEventListener("click", openDeleteModal);

  $("exportBtn").addEventListener("click", openExportModal);
  $("exportSelectAll").addEventListener("change", function () { selectAllExportItems(this.checked); });
  $("exportConfirmBtn").addEventListener("click", exportSelectedSaves);

  $("deleteSelectAll").addEventListener("change", function () { selectAllDeleteItems(this.checked); });
  $("deleteConfirmBtn").addEventListener("click", deleteSelectedSaves);

  $("importBtn").addEventListener("click", () => $("importFileInput").click());
  $("importFileInput").addEventListener("change", function (e) {
    if (e.target.files.length > 0) importSavesFromFiles(e.target.files);
    this.value = "";
  });

  // --- 设置管理 ---
  $("exportSettingsBtn").addEventListener("click", exportSettingsFile);
  $("importSettingsBtn").addEventListener("click", () => $("settingsImportFileInput").click());
  $("settingsImportFileInput").addEventListener("change", function (e) {
    if (e.target.files.length > 0) importSettingsFile(e.target.files[0]);
    this.value = "";
  });
  $("resetSettingsBtn").addEventListener("click", () => {
    showConfirm("确定恢复默认设置吗？", resetSettingsToDefault);
  });

  // --- 下拉选择框箭头 ---
  const loadWrapper = $("loadSelectWrapper");
  $("loadSelect").addEventListener("focus", () => loadWrapper.classList.add("open"));
  $("loadSelect").addEventListener("blur", () => loadWrapper.classList.remove("open"));
  $("loadSelect").addEventListener("change", () => loadWrapper.classList.remove("open"));
}

// ===== 初始化 =====

(function init() {
  State.canvas = $("canvas");
  State.ctx = State.canvas.getContext("2d");

  resize();
  loadSettingsFromBrowser();
  randomBodies();
  refreshLoadSelect();
  bindEvents();
  animate();
})();
