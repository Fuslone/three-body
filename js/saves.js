// 存档管理模块 - 存档读写、导出、导入、删除

// ===== 存档管理 =====

const SAVES_STORAGE_KEY = "three-body-saves";

function getAllSaves() {
  try {
    const data = localStorage.getItem(SAVES_STORAGE_KEY);
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
    G: State.G,
    softening: State.softening,
  };

  try {
    localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(saves));
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
  State.softening = data.softening;

  $("gravityInput").value = data.G.toFixed(2);
  $("softeningInput").value = data.softening.toFixed(2);

  initAccelerations();
  enterInitialState();

  return true;
}

function deleteSave(name) {
  const saves = getAllSaves();
  if (!saves[name]) return false;
  delete saves[name];
  try {
    localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(saves));
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

// ===== 导出 =====

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
    const item = createSaveCheckboxItem(name, "export-checkbox", updateExportCount);
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
    const item = createSaveCheckboxItem(name, "delete-checkbox", updateDeleteCount);
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
      localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(saves));
      refreshLoadSelect();
      closeDeleteModal();
      showToast(`已删除 ${deleted} 个存档`, "success");
    } catch {
      showToast("删除失败", "error");
    }
  });
}

// ===== 导入 =====

// 导出/删除弹窗共用的存档选择项（隐藏原生checkbox + 自定义样式）
function createSaveCheckboxItem(name, checkboxClass, onChanged) {
  const item = document.createElement("div");
  item.className = "export-item";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = checkboxClass;
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
    onChanged();
  });

  return item;
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
      localStorage.setItem(SAVES_STORAGE_KEY, JSON.stringify(existingSaves));
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
