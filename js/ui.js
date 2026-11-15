// UI界面管理模块 - 控件状态、天体列表、天体管理、设置管理

// ===== 控件状态 =====

function updatePlayButton() {
  const btn = $("playBtn");
  if (!btn) return;
  const playIcon = btn.querySelector(".icon-play");
  const pauseIcon = btn.querySelector(".icon-pause");
  if (State.isRunning) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "";
  } else {
    playIcon.style.display = "";
    pauseIcon.style.display = "none";
  }
}

function updateResetButton() {
  const btn = $("resetBtn");
  if (!btn) return;
  btn.disabled = !State.resetBtnEnabled;
}

function updateTrailControlsVisibility() {
  const show = State.showTrail;
  $("trailModeRow").style.display = show ? "" : "none";
  $("trailDurationRow").style.display = show && State.trailMode === "partial" ? "" : "none";
}

function updateRandomControlsVisibility() {
  $("massRandomGroup").style.display = State.randomMass ? "" : "none";
  $("speedRandomGroup").style.display = State.randomSpeed ? "" : "none";
  $("posRandomGroup").style.display = State.randomPosition ? "" : "none";
  const allOff = !State.randomMass && !State.randomSpeed && !State.randomPosition;
  $("randomBtn").disabled = allOff;
  $("randomBtn").classList.toggle("disabled", allOff);
}

function setControlsEnabled(enabled) {
  // 运行中禁用的输入框（随机参数可随时修改，不在此列）
  const inputIds = [
    "gravityInput", "dtInput", "softeningInput",
    "bodyMassInput", "bodySpeedInput", "bodyAngleInput", "bodyNameInput",
  ];
  inputIds.forEach((id) => {
    const el = $(id);
    if (el) el.disabled = !enabled;
  });

  const btnIds = ["randomBtn", "colorRandomBtn", "saveBtn"];
  btnIds.forEach((id) => {
    const el = $(id);
    if (el) el.disabled = !enabled;
  });

  const toggleIds = ["bodyColor"];
  toggleIds.forEach((id) => {
    const el = $(id);
    if (el) el.disabled = !enabled;
  });
}

// ===== 参数输入辅助 =====

function setupMinMaxInputs(minId, maxId, defaultMin, defaultMax, minLimit, maxLimit, formatter, onChanged) {
  const minInput = $(minId);
  const maxInput = $(maxId);

  minInput.addEventListener("change", function () {
    const minVal = parseNumber(this.value, defaultMin, minLimit, maxLimit);
    const maxVal = parseNumber(maxInput.value, defaultMax, minLimit, maxLimit);
    const finalMin = Math.min(minVal, maxVal);
    this.value = formatter(finalMin);
    maxInput.value = formatter(Math.max(minVal, maxVal));
    if (onChanged) onChanged(finalMin, Math.max(minVal, maxVal));
  });

  maxInput.addEventListener("change", function () {
    const minVal = parseNumber(minInput.value, defaultMin, minLimit, maxLimit);
    const maxVal = parseNumber(this.value, defaultMax, minLimit, maxLimit);
    const finalMax = Math.max(minVal, maxVal);
    minInput.value = formatter(Math.min(minVal, maxVal));
    this.value = formatter(finalMax);
    if (onChanged) onChanged(Math.min(minVal, maxVal), finalMax);
  });
}

// ===== 天体详情弹窗 =====

function showBodyDetailModal() {
  const modal = $("bodyDetailModal");
  const body = State.bodies[State.selectedBodyIndex];

  if (document.body.classList.contains("ui-hidden")) return;
  if (!body || State.simulationTime > 0) {
    modal.classList.remove("active");
    return;
  }

  modal.classList.add("active");
  setControlsEnabled(State.simulationTime === 0);

  $("bodyNameInput").value = body.name;
  $("bodyColor").value = body.color;
  $("bodyMassInput").value = body.mass.toFixed(2);

  const speedVal = Math.hypot(body.vx, body.vy);
  $("bodySpeedInput").value = speedVal.toFixed(2);

  let angle = (Math.atan2(body.vy, body.vx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  $("bodyAngleInput").value = angle.toFixed(2);

  renderBodyList();
}

function hideBodyDetailModal() {
  $("bodyDetailModal").classList.remove("active");
}

function updateBodyDetailModal() {
  if ($("bodyDetailModal").classList.contains("active")) {
    showBodyDetailModal();
  }
}

// ===== 天体列表 =====

function renderBodyList() {
  const list = $("bodyList");
  list.innerHTML = "";
  const canEdit = State.simulationTime === 0 && !State.isRunning;

  for (let i = 0; i < State.bodies.length; i++) {
    const item = document.createElement("div");
    item.className = "body-item" + (i === State.selectedBodyIndex ? " active" : "");
    const deleteBtnHtml = canEdit && State.bodies.length > 1
      ? `<div class="body-delete-btn" data-index="${i}">×</div>`
      : "";
    item.innerHTML = `
      ${deleteBtnHtml}
      <div class="body-color-dot" style="background:${State.bodies[i].color}"></div>
      <div class="body-item-name">${State.bodies[i].name}</div>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("body-delete-btn")) return;
      e.stopPropagation();
      State.selectedBodyIndex = i;
      State.trackingBodyIndex = i;
      if (State.simulationTime === 0) {
        showBodyDetailModal();
      }
      renderBodyList();
    });
    const delBtn = item.querySelector(".body-delete-btn");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (State.simulationTime === 0) deleteBody(i);
      });
    }
    list.appendChild(item);
  }

  const addItem = document.createElement("div");
  addItem.className = "body-item body-add-item" + (canEdit ? "" : " disabled");
  addItem.innerHTML = '<div class="body-add-icon">+</div>';
  addItem.addEventListener("click", (e) => {
    e.stopPropagation();
    if (State.simulationTime === 0) addBody();
  });
  list.appendChild(addItem);
}

function addBody() {
  const { massMin, massMax, speedMin, speedMax } = getRandomParams();
  const mass = State.randomMass ? massMin + Math.random() * (massMax - massMin) : State.baseMass;
  const speed = State.randomSpeed ? speedMin + Math.random() * (speedMax - speedMin) : 0;
  const velAngle = Math.random() * Math.PI * 2;
  const centerWorld = screenToWorld(State.centerX, State.centerY);

  State.bodyNameCounter++;
  State.bodies.push(createBody({
    name: "天体" + State.bodyNameCounter,
    x: centerWorld.x,
    y: centerWorld.y,
    vx: Math.cos(velAngle) * speed,
    vy: Math.sin(velAngle) * speed,
    mass: mass,
    color: randomColor(),
  }));

  saveInitialBodies();
  initAccelerations();
  clearSelection();
  renderBodyList();
  hideBodyDetailModal();
}

function deleteBody(index) {
  if (State.bodies.length <= 1) return;
  State.bodies.splice(index, 1);

  const adjustIdx = (idx) => {
    if (idx === -1) return -1;
    if (idx >= State.bodies.length) return State.bodies.length - 1;
    return idx > index ? idx - 1 : idx;
  };

  State.selectedBodyIndex = adjustIdx(State.selectedBodyIndex);
  State.trackingBodyIndex = adjustIdx(State.trackingBodyIndex);

  if (State.simulationTime > 0 && State.selectedBodyIndex >= 0) {
    State.trackingBodyIndex = State.selectedBodyIndex;
  }

  if (State.simulationTime === 0) {
    saveInitialBodies();
    initAccelerations();
  }
  renderBodyList();
  updateBodyDetailModal();
}

function saveInitialBodies() {
  State.initialBodies = cloneBodies(State.bodies);
}

// ===== 设置管理 =====

const SETTINGS_STORAGE_KEY = "three-body-settings";

// DEFAULT_SETTINGS / SETTINGS_KEYS 由 state.js 基于 State 初始值派生
function getSettingsSnapshot() {
  const snapshot = {};
  for (const key in DEFAULT_SETTINGS) {
    snapshot[key] = State[key];
  }
  return snapshot;
}

function persistSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getSettingsSnapshot()));
  } catch {}
}

function applyParamsToUI() {
  $("speedInput").value = State.speed.toFixed(2);
  $("dtInput").value = State.dt.toFixed(2);
  $("gravityInput").value = State.G.toFixed(2);
  $("softeningInput").value = State.softening.toFixed(2);
  $("trailDurationInput").value = State.trailDuration.toFixed(2);
  $("massMinInput").value = State.randomMassMin.toFixed(2);
  $("massMaxInput").value = State.randomMassMax.toFixed(2);
  $("speedMinInput").value = State.randomSpeedMin.toFixed(2);
  $("speedMaxInput").value = State.randomSpeedMax.toFixed(2);
  $("posRangeInput").value = State.randomPosRange.toFixed(2);

  $("trailToggle").classList.toggle("active", State.showTrail);
  $("velocityToggle").classList.toggle("active", State.showVelocity);
  $("bodyNameToggle").classList.toggle("active", State.showBodyNames);
  $("randomMassToggle").classList.toggle("active", State.randomMass);
  $("randomSpeedToggle").classList.toggle("active", State.randomSpeed);
  $("randomPositionToggle").classList.toggle("active", State.randomPosition);

  document.querySelectorAll('input[name="trailMode"]').forEach((r) => {
    r.checked = r.value === State.trailMode;
  });

  updateTrailControlsVisibility();
  updateRandomControlsVisibility();
}

function loadSettingsFromBrowser() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    data = null;
  }
  if (data && typeof data === "object") {
    for (const key in DEFAULT_SETTINGS) {
      if (data[key] !== undefined) State[key] = data[key];
    }
  }
  applyParamsToUI();
}

function exportSettingsFile() {
  const blob = new Blob(
    [JSON.stringify({ version: 1, settings: getSettingsSnapshot() }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "three-body-settings.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("已导出设置", "success");
}

function importSettingsFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      showToast("文件解析失败", "error");
      return;
    }
    const settings = data && typeof data === "object" && data.settings && typeof data.settings === "object"
      ? data.settings
      : data;
    if (!settings || typeof settings !== "object") {
      showToast("无效的设置文件格式", "error");
      return;
    }
    let applied = 0;
    for (const key in DEFAULT_SETTINGS) {
      if (settings[key] !== undefined) {
        State[key] = settings[key];
        applied++;
      }
    }
    if (applied === 0) {
      showToast("没有可应用的设置项", "error");
      return;
    }
    applyParamsToUI();
    persistSettings();
    showToast("已导入设置", "success");
  };
  reader.onerror = () => showToast("文件读取失败", "error");
  reader.readAsText(file);
}

function resetSettingsToDefault() {
  Object.assign(State, DEFAULT_SETTINGS);
  applyParamsToUI();
  persistSettings();
  showToast("已恢复默认设置", "success");
}

// ===== Toast与确认弹窗 =====

function showToast(message, type = "info", duration = 2500) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), duration);
}

function showConfirm(message, onConfirm, onCancel) {
  const modal = $("confirmModal");
  $("confirmMessage").textContent = message;
  modal.classList.add("active");

  const close = () => {
    modal.classList.remove("active");
    $("confirmOkBtn").onclick = null;
    $("confirmCancelBtn").onclick = null;
  };

  $("confirmOkBtn").onclick = () => { close(); if (onConfirm) onConfirm(); };
  $("confirmCancelBtn").onclick = () => { close(); if (onCancel) onCancel(); };
}

// ===== 倒带功能 =====

function updateRewindButton() {
  const btn = $("rewindBtn");
  if (!btn) return;
  const hasTrail = State.bodies.length > 0 && State.bodies[0].trail.length > 1;
  btn.disabled = State.isRunning || State.isRewindMode || !hasTrail;
}

let _rewindHideTimer = null;

function showRewindSlider() {
  const wrapper = $("rewindSliderWrapper");
  if (!wrapper) return;
  if (_rewindHideTimer) {
    clearTimeout(_rewindHideTimer);
    _rewindHideTimer = null;
  }
  wrapper.classList.remove("hiding");
  wrapper.classList.add("visible");
  const slider = $("rewindSlider");
  if (slider) slider.disabled = false;
}

function hideRewindSlider() {
  const wrapper = $("rewindSliderWrapper");
  if (!wrapper) return;
  wrapper.classList.remove("visible");
  wrapper.classList.add("hiding");
  if (_rewindHideTimer) clearTimeout(_rewindHideTimer);
  _rewindHideTimer = setTimeout(() => {
    wrapper.classList.remove("hiding");
    _rewindHideTimer = null;
  }, 360);
}

function setRewindSliderDisabled(disabled) {
  const slider = $("rewindSlider");
  if (slider) slider.disabled = disabled;
}

function updateRewindSliderFromTime() {
  const slider = $("rewindSlider");
  if (!slider) return;
  const span = State.rewindSnapshotTimeSpan;
  const startTime = State.rewindSnapshot[0] ? State.rewindSnapshot[0][0].t : 0;
  let pct = 100;
  if (span > 0) {
    pct = Math.min(100, Math.max(0, (State.rewindCurrentTime - startTime) / span * 100));
  }
  slider.value = Math.round(pct);
}

// 二分查找快照中 t <= targetTime 的最后一个点
function findSnapshotIndex(snapshot, targetTime) {
  const len = snapshot.length;
  if (len === 0) return -1;
  if (targetTime <= snapshot[0].t) return 0;
  if (targetTime >= snapshot[len - 1].t) return len - 1;
  let lo = 0, hi = len - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (snapshot[mid].t <= targetTime) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// 覆盖所有天体的 x/y/vx/vy 到快照中 rewindCurrentTime 对应的点
function applyRewindToBodies() {
  const bodies = State.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const snapshot = State.rewindSnapshot[i];
    if (!snapshot || snapshot.length === 0) continue;
    const idx = findSnapshotIndex(snapshot, State.rewindCurrentTime);
    if (idx < 0) continue;
    const p = snapshot[idx];
    bodies[i].x = p.x;
    bodies[i].y = p.y;
    bodies[i].vx = p.vx;
    bodies[i].vy = p.vy;
  }
}

// 初始化倒带模式（点击倒带按钮时调用）
function enterRewindMode(pct) {
  const bodies = State.bodies;
  if (bodies.length === 0 || bodies[0].trail.length < 2) return false;

  // 保存每个 body 的 trail 快照（深拷贝）
  State.rewindSnapshot = bodies.map(b => b.trail.map(p => ({ ...p })));
  for (let i = 0; i < bodies.length; i++) {
    if (State.rewindSnapshot[i].length === 0) return false;
  }
  State.rewindSnapshotLen = State.rewindSnapshot[0].length;

  const firstPoint = State.rewindSnapshot[0][0];
  const lastPoint = State.rewindSnapshot[0][State.rewindSnapshotLen - 1];
  State.rewindTargetTime = lastPoint.t;
  State.rewindSnapshotTimeSpan = lastPoint.t - firstPoint.t;

  // 根据百分比计算起始时间
  if (State.rewindSnapshotTimeSpan > 0) {
    State.rewindCurrentTime = firstPoint.t + State.rewindSnapshotTimeSpan * pct / 100;
  } else {
    State.rewindCurrentTime = lastPoint.t;
  }

  State.isRewindMode = true;
  applyRewindToBodies();
  updateRewindSliderFromTime();
  updateRewindButton();
  return true;
}

function exitRewindMode(skipRestore) {
  if (!State.isRewindMode) {
    // 虽然没在倒带，但 UI 状态可能残留（比如快照/滑块还在），也要清干净
    State.rewindSnapshot = [];
    State.rewindSnapshotLen = 0;
    State.rewindSnapshotTimeSpan = 0;
    State.rewindTargetTime = 0;
    State.rewindCurrentTime = 0;
    hideRewindSlider();
    updateRewindButton();
    return;
  }

  if (!skipRestore) {
    // 把快照最后一个点保存到局部变量
    const snapLen = State.rewindSnapshotLen;
    const finalPoints = [];
    for (let i = 0; i < State.bodies.length; i++) {
      const snap = State.rewindSnapshot[i];
      if (snap && snap.length > 0) {
        finalPoints.push(snap[snap.length - 1]);
      } else {
        finalPoints.push(null);
      }
    }
    for (let i = 0; i < State.bodies.length; i++) {
      if (State.bodies[i].trail.length > snapLen) {
        State.bodies[i].trail.length = snapLen;
      }
      const last = finalPoints[i];
      if (last) {
        State.bodies[i].x = last.x;
        State.bodies[i].y = last.y;
        State.bodies[i].vx = last.vx;
        State.bodies[i].vy = last.vy;
      }
    }
    State.simulationTime = State.rewindTargetTime;
  }

  State.isRewindMode = false;
  State.rewindSnapshot = [];
  State.rewindSnapshotLen = 0;
  State.rewindSnapshotTimeSpan = 0;
  State.rewindTargetTime = 0;
  State.rewindCurrentTime = 0;

  hideRewindSlider();
  updateRewindButton();
}
