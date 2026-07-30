// UI界面管理模块 - 弹窗、控件、天体列表、天体管理

// ===== 按钮状态 =====

function updatePlayButton() {
  const btn = $("playBtn");
  if (!btn) return;
  btn.textContent = State.isRunning ? "暂停" : "开始";
  btn.classList.toggle("primary", !State.isRunning);
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
  const inputIds = [
    "gravityInput", "dtInput", "softeningInput",
    "massMinInput", "massMaxInput", "speedMinInput", "speedMaxInput", "posRangeInput",
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
  $("bodyMassInput").value = Math.round(body.mass);

  const speedVal = Math.hypot(body.vx, body.vy);
  $("bodySpeedInput").value = speedVal.toFixed(2);

  let angle = (Math.atan2(body.vy, body.vx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  $("bodyAngleInput").value = Math.round(angle);

  renderBodyList();
}

function hideBodyDetailPopup() {
  $("bodyDetailModal").classList.remove("active");
}

function updateBodyDetailPopup() {
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
  defocus();
  renderBodyList();
  hideBodyDetailPopup();
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
  updateBodyDetailPopup();
}

function saveInitialBodies() {
  State.initialBodies = cloneBodies(State.bodies);
}

// ===== 存档管理 =====

const STORAGE_KEY = "three-body-saves";

function getAllSaves() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveCurrentState(name) {
  if (!name || !name.trim()) return false;
  name = name.trim();
  const saves = getAllSaves();

  const bodiesData = State.bodies.map((b) => ({
    name: b.name, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
    mass: b.mass, radius: b.radius, color: b.color,
  }));

  saves[name] = {
    version: 1,
    bodies: bodiesData,
    bodyNameCounter: State.bodyNameCounter,
    G: State.G, dt: State.dt, softening: State.softening, speed: State.speed,
    showTrail: State.showTrail, trailMode: State.trailMode, trailDuration: State.trailDuration,
    showVelocity: State.showVelocity, showBodyNames: State.showBodyNames,
    randomMass: State.randomMass, randomSpeed: State.randomSpeed, randomPosition: State.randomPosition,
    randomMassMin: State.randomMassMin, randomMassMax: State.randomMassMax,
    randomSpeedMin: State.randomSpeedMin, randomSpeedMax: State.randomSpeedMax,
    randomPosRange: State.randomPosRange,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    return true;
  } catch {
    return false;
  }
}

function loadState(name) {
  const saves = getAllSaves();
  const data = saves[name];
  if (!data) return false;

  State.bodies = cloneBodies(data.bodies);
  State.initialBodies = cloneBodies(data.bodies);
  State.bodyNameCounter = data.bodyNameCounter || State.bodies.length;
  State.G = data.G;
  State.dt = data.dt;
  State.softening = data.softening;
  State.speed = data.speed;
  State.showTrail = data.showTrail;
  State.trailMode = data.trailMode;
  State.trailDuration = data.trailDuration;
  State.showVelocity = data.showVelocity;
  State.showBodyNames = data.showBodyNames;
  State.randomMass = data.randomMass !== undefined ? data.randomMass : true;
  State.randomSpeed = data.randomSpeed !== undefined ? data.randomSpeed : true;
  State.randomPosition = data.randomPosition !== undefined ? data.randomPosition : true;
  State.randomMassMin = data.randomMassMin !== undefined ? data.randomMassMin : 500;
  State.randomMassMax = data.randomMassMax !== undefined ? data.randomMassMax : 1500;
  State.randomSpeedMin = data.randomSpeedMin !== undefined ? data.randomSpeedMin : 0.5;
  State.randomSpeedMax = data.randomSpeedMax !== undefined ? data.randomSpeedMax : 1.3;
  State.randomPosRange = data.randomPosRange !== undefined ? data.randomPosRange : 200;

  $("speedInput").value = data.speed.toFixed(1);
  $("gravityInput").value = Math.round(data.G);
  $("dtInput").value = data.dt.toFixed(3);
  $("softeningInput").value = Math.round(data.softening);
  $("trailDurationInput").value = Math.round(data.trailDuration);
  $("massMinInput").value = Math.round(State.randomMassMin * 1000) / 1000;
  $("massMaxInput").value = Math.round(State.randomMassMax * 1000) / 1000;
  $("speedMinInput").value = State.randomSpeedMin.toFixed(2);
  $("speedMaxInput").value = State.randomSpeedMax.toFixed(2);
  $("posRangeInput").value = Math.round(State.randomPosRange);

  $("trailToggle").classList.toggle("active", data.showTrail);
  $("velocityToggle").classList.toggle("active", data.showVelocity);
  $("bodyNameToggle").classList.toggle("active", data.showBodyNames);
  $("randomMassToggle").classList.toggle("active", State.randomMass);
  $("randomSpeedToggle").classList.toggle("active", State.randomSpeed);
  $("randomPositionToggle").classList.toggle("active", State.randomPosition);

  document.querySelectorAll('input[name="trailMode"]').forEach((r) => {
    r.checked = r.value === data.trailMode;
  });

  initAccelerations();
  updateTrailControlsVisibility();
  updateRandomControlsVisibility();
  enterInitialState();

  return true;
}

function deleteSave(name) {
  const saves = getAllSaves();
  if (!saves[name]) return false;
  delete saves[name];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    return true;
  } catch {
    return false;
  }
}

function refreshLoadSelect() {
  const select = $("loadSelect");
  if (!select) return;
  const saves = getAllSaves();
  const names = Object.keys(saves);

  select.innerHTML = '<option value="" disabled selected>选择存档</option>';

  if (names.length === 0) {
    select.disabled = true;
    $("loadBtn").disabled = true;
    return;
  }

  select.disabled = false;
  $("loadBtn").disabled = false;

  names.sort((a, b) => a.localeCompare(b, "zh"));
  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

// ===== 导出/导入 =====

function openExportModal() {
  const modal = $("exportModal");
  const list = $("exportList");
  const saves = getAllSaves();
  const names = Object.keys(saves);

  list.innerHTML = "";

  if (names.length === 0) {
    list.innerHTML = '<div class="export-empty">暂无存档可导出</div>';
    $("exportCount").textContent = "已选 0 项";
    $("exportConfirmBtn").disabled = true;
    $("exportSelectAll").checked = false;
    modal.classList.add("active");
    return;
  }

  names.sort((a, b) => a.localeCompare(b, "zh"));

  names.forEach((name) => {
    const item = document.createElement("div");
    item.className = "export-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "export-checkbox";
    cb.value = name;
    cb.style.display = "none";

    const custom = document.createElement("span");
    custom.className = "checkbox-custom";

    const nameSpan = document.createElement("span");
    nameSpan.className = "export-item-name";
    nameSpan.textContent = name;

    item.appendChild(cb);
    item.appendChild(custom);
    item.appendChild(nameSpan);

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      cb.checked = !cb.checked;
      updateExportCount();
    });

    list.appendChild(item);
  });

  $("exportSelectAll").checked = false;
  updateExportCount();
  modal.classList.add("active");
}

function closeExportModal() {
  $("exportModal").classList.remove("active");
}

function updateExportCount() {
  const cbs = document.querySelectorAll(".export-checkbox");
  const checked = Array.from(cbs).filter((cb) => cb.checked).length;
  $("exportCount").textContent = `已选 ${checked} 项`;
  $("exportConfirmBtn").disabled = checked === 0;
  $("exportSelectAll").checked = cbs.length > 0 && checked === cbs.length;
}

function selectAllExportItems(checked) {
  document.querySelectorAll(".export-checkbox").forEach((cb) => { cb.checked = checked; });
  updateExportCount();
}

function exportSelectedSaves() {
  const selected = Array.from(document.querySelectorAll(".export-checkbox"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
  if (selected.length === 0) return;

  const saves = getAllSaves();
  const exportData = {};
  selected.forEach((name) => { if (saves[name]) exportData[name] = saves[name]; });

  const blob = new Blob([JSON.stringify({ version: 1, saves: exportData }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "three-body-saves.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  closeExportModal();
  showToast(`已导出 ${selected.length} 个存档`, "success");
}

// ===== 删除存档弹窗 =====

function openDeleteModal() {
  const modal = $("deleteModal");
  const list = $("deleteList");
  const saves = getAllSaves();
  const names = Object.keys(saves);

  list.innerHTML = "";

  if (names.length === 0) {
    list.innerHTML = '<div class="export-empty">暂无存档可删除</div>';
    $("deleteCount").textContent = "已选 0 项";
    $("deleteConfirmBtn").disabled = true;
    $("deleteSelectAll").checked = false;
    modal.classList.add("active");
    return;
  }

  names.sort((a, b) => a.localeCompare(b, "zh"));

  names.forEach((name) => {
    const item = document.createElement("div");
    item.className = "export-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "delete-checkbox";
    cb.value = name;
    cb.style.display = "none";

    const custom = document.createElement("span");
    custom.className = "checkbox-custom";

    const nameSpan = document.createElement("span");
    nameSpan.className = "export-item-name";
    nameSpan.textContent = name;

    item.appendChild(cb);
    item.appendChild(custom);
    item.appendChild(nameSpan);

    item.addEventListener("click", (e) => {
      e.stopPropagation();
      cb.checked = !cb.checked;
      updateDeleteCount();
    });

    list.appendChild(item);
  });

  $("deleteSelectAll").checked = false;
  updateDeleteCount();
  modal.classList.add("active");
}

function closeDeleteModal() {
  $("deleteModal").classList.remove("active");
}

function updateDeleteCount() {
  const cbs = document.querySelectorAll(".delete-checkbox");
  const checked = Array.from(cbs).filter((cb) => cb.checked).length;
  $("deleteCount").textContent = `已选 ${checked} 项`;
  $("deleteConfirmBtn").disabled = checked === 0;
  $("deleteSelectAll").checked = cbs.length > 0 && checked === cbs.length;
}

function selectAllDeleteItems(checked) {
  document.querySelectorAll(".delete-checkbox").forEach((cb) => { cb.checked = checked; });
  updateDeleteCount();
}

function deleteSelectedSaves() {
  const selected = Array.from(document.querySelectorAll(".delete-checkbox"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
  if (selected.length === 0) return;

  const msg = selected.length === 1
    ? `确定删除存档"${selected[0]}"吗？此操作不可恢复`
    : `确定删除 ${selected.length} 个存档吗？此操作不可恢复`;

  showConfirm(msg, () => {
    const saves = getAllSaves();
    let deleted = 0;
    selected.forEach((name) => {
      if (saves[name]) { delete saves[name]; deleted++; }
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
      refreshLoadSelect();
      closeDeleteModal();
      showToast(`已删除 ${deleted} 个存档`, "success");
    } catch {
      showToast("删除失败", "error");
    }
  });
}

function importSavesFromFiles(files) {
  if (!files || files.length === 0) return;

  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const saves = {};
        if (data.saves && typeof data.saves === "object") {
          Object.keys(data.saves).forEach((name) => { saves[name] = data.saves[name]; });
        } else if (data.bodies) {
          saves[file.name.replace(/\.json$/i, "")] = data;
        } else {
          reject(new Error("无效的存档文件格式"));
          return;
        }
        resolve(saves);
      } catch {
        reject(new Error("文件解析失败"));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });

  Promise.allSettled(Array.from(files).map(readFile)).then((results) => {
    const existingSaves = getAllSaves();
    const mergedSaves = {};
    const overwriteNames = [];
    let totalImport = 0, failCount = 0;

    results.forEach((result) => {
      if (result.status !== "fulfilled") { failCount++; return; }
      Object.keys(result.value).forEach((name) => {
        if (mergedSaves[name] !== undefined) return;
        if (existingSaves[name] && overwriteNames.indexOf(name) === -1) {
          overwriteNames.push(name);
        }
        mergedSaves[name] = result.value[name];
        totalImport++;
      });
    });

    if (totalImport === 0) {
      showToast(failCount > 0 ? `导入失败：${failCount} 个文件格式无效` : "没有可导入的存档", "error");
      return;
    }

    const buildToast = (added, overwritten, skipped) => {
      const parts = [`成功导入 ${added} 个存档`];
      if (overwritten > 0) parts.push(`覆盖 ${overwritten} 个`);
      if (skipped > 0) parts.push(`跳过 ${skipped} 个`);
      if (failCount > 0) parts.push(`${failCount} 个文件无效`);
      const isPartial = failCount > 0 || skipped > 0;
      showToast(parts.join("，"), isPartial ? "info" : "success");
    };

    const applyImport = (overwrite) => {
      let added = 0;
      Object.keys(mergedSaves).forEach((name) => {
        if (overwrite || !existingSaves[name]) { existingSaves[name] = mergedSaves[name]; added++; }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingSaves));
      refreshLoadSelect();
      const skipped = totalImport - added;
      buildToast(added, overwrite ? overwriteNames.length : 0, skipped);
    };

    if (overwriteNames.length > 0) {
      const namesStr = overwriteNames.slice(0, 3).join("、");
      const moreStr = overwriteNames.length > 3 ? ` 等${overwriteNames.length}个` : "";
      const warnSuffix = failCount > 0 ? `（另有 ${failCount} 个文件无效将被跳过）` : "";
      showConfirm(
        `发现 ${overwriteNames.length} 个同名存档（${namesStr}${moreStr}），是否覆盖？${warnSuffix}`,
        () => applyImport(true),
        () => applyImport(false)
      );
    } else {
      applyImport(true);
    }
  });
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
