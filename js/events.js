// UI事件绑定模块 - 弹窗管理、绑定辅助、控件事件

// ===== 弹窗管理 =====

// .settings-group-content 展开后的 padding-top（见 component.css），测量展开高度时需补偿
const SETTINGS_GROUP_PAD_TOP = 16;

function toggleSettingsGroup(toggleEl) {
  const content = toggleEl.nextElementSibling;
  if (!content) return;
  const isActive = toggleEl.classList.toggle("active");

  if (isActive) {
    content.style.maxHeight = (content.scrollHeight + SETTINGS_GROUP_PAD_TOP) + "px";
    content.addEventListener("transitionend", function handler(e) {
      if (e.propertyName !== "max-height") return;
      content.removeEventListener("transitionend", handler);
      if (toggleEl.classList.contains("active")) {
        content.style.maxHeight = "none";
      }
    });
  } else {
    if (content.style.maxHeight === "none") {
      content.style.maxHeight = (content.scrollHeight + SETTINGS_GROUP_PAD_TOP) + "px";
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
        clearSelection();
        renderBodyList();
      }
    }
  });
}

// ===== 绑定辅助 =====

// 参数输入框配置（HTML 中只保留 type/class/id，初始值与范围统一在此维护）
// guard: 模拟开始后禁止修改；recompute: 变更后重算加速度；persist: 变更后持久化设置
const PARAM_INPUTS = [
  { id: "speedInput", key: "speed", def: 1, min: 0.01, max: null, guard: true, persist: true },
  { id: "dtInput", key: "dt", def: 0.01, min: 0.01, max: null, guard: true, persist: true }, // 模拟精度
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
  // --- 播放控制 ---
  $("playBtn").addEventListener("click", function () {
    State.isRunning = !State.isRunning;
    updatePlayButton();
    updateResetButton();
    if (State.isRunning) {
      if (State.simulationTime === 0) clearSelection();
      hideBodyDetailModal();
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
        toggleSettingsGroup(this);
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
