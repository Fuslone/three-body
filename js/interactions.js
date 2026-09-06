// 画布交互模块 - 拖拽、平移、缩放、鼠标与触摸事件

const MOUSE_DRAG_THRESHOLD = 3;         // 鼠标拖拽判断阈值（像素）
const TOUCH_DRAG_THRESHOLD = 6;         // 触摸拖拽判断阈值（像素）

const ZOOM_OUT_FACTOR = 0.9;            // 滚轮缩小系数
const ZOOM_IN_FACTOR = 1.1;             // 滚轮放大系数

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
    hideBodyDetailModal();
  } else {
    State.trackingBodyIndex = index;
  }
  renderBodyList();
}

function handleBackgroundPress(clientX, clientY) {
  State.selectedBodyIndex = -1;
  State.trackingBodyIndex = -1;
  State.isPanning = true;
  hideBodyDetailModal();
  renderBodyList();
  State.lastPointerX = clientX;
  State.lastPointerY = clientY;
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
    State.offsetX += (clientX - State.lastPointerX) / State.scale;
    State.offsetY += (clientY - State.lastPointerY) / State.scale;
    State.lastPointerX = clientX;
    State.lastPointerY = clientY;
    return true;
  }
  return false;
}

function handleDragEnd() {
  if (State.isDraggingBody && !State.isRunning) {
    if (State.dragMoved) {
      clearSelection();
      refreshAfterBodiesChanged();
      hideBodyDetailModal();
    } else {
      State.trackingBodyIndex = State.draggedBodyIndex;
      showBodyDetailModal();
    }
  }
  State.isDraggingBody = false;
  State.draggedBodyIndex = -1;
  State.isPanning = false;
}

// ===== 事件绑定 =====

function bindCanvasEvents() {
  const canvas = State.canvas;

  canvas.addEventListener("mousedown", function (e) {
    const hit = getBodyAtPoint(e.clientX, e.clientY);
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

  canvas.addEventListener("touchstart", function (e) {
    // 阻止浏览器在 touchend 后合成 mousedown/mouseup，
    // 避免运行中点选天体后，合成的 mousedown 因天体已移动而命中背景、触发 handleBackgroundPress 导致立刻失焦
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const hit = getBodyAtPoint(t.clientX, t.clientY);
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
  }, { passive: false });

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
}
