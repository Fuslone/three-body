// 渲染模块 - Canvas绘制所有视觉元素

// ===== 渲染常量 =====
const TRAIL_FADE_START = 0.15;
const TRAIL_FULL_ALPHA_HEX = "b3";       // full模式轨迹透明度 (~70%)
const TRAIL_FULL_LINE_WIDTH = 1.5;       // full模式轨迹线宽
const TRAIL_LINE_WIDTH_SCALE = 2;        // partial模式线宽随透明度缩放系数
const TRAIL_LINE_WIDTH_MIN = 0.5;        // partial模式最小线宽
const TRAIL_ALPHA_MAX = 255;             // alpha通道最大值（十六进制转换）

const MIN_BODY_HIT_RADIUS_SCREEN = 15;   // 最小点击命中半径（屏幕像素）

const STAR_DENSITY = 3000;               // 星空密度：每N像素一颗星
const STAR_MAX_SIZE = 1.8;               // 星星最大尺寸（含偏移量0.3，即最大1.8）
const STAR_MIN_SIZE = 0.3;               // 星星最小尺寸
const STAR_MAX_BRIGHTNESS = 0.8;         // 星星最大亮度（含偏移0.3）
const STAR_MIN_BRIGHTNESS = 0.3;         // 星星最小亮度

const SELECTION_RING_MULTIPLIER = 2;     // 选中圈半径为天体半径的倍数
const SELECTION_RING_LINE_WIDTH = 2;     // 选中圈线宽
const SELECTION_RING_COLOR = "rgba(255,255,255,0.6)"; // 选中圈颜色
const SELECTION_RING_DASH = [4, 4];      // 选中圈虚线样式

const GLOW_RADIUS_MULTIPLIER = 3;        // 发光范围为天体半径的倍数
const GLOW_MID_STOP = 0.3;               // 发光渐变中间点位置
const GLOW_MID_ALPHA_HEX = "aa";         // 发光渐变中间点透明度 (~67%)
const GLOW_END_ALPHA_HEX = "00";         // 发光渐变终点透明度（完全透明）

const HIGHLIGHT_ALPHA = 0.3;             // 高亮点透明度
const HIGHLIGHT_OFFSET_RATIO = 0.3;      // 高亮点偏移比例（相对半径）
const HIGHLIGHT_SIZE_RATIO = 0.3;        // 高亮点大小比例（相对半径）

const BODY_NAME_FONT_SIZE = 12;          // 天体名称字号（px）
const BODY_NAME_COLOR = "rgba(255,255,255,0.85)"; // 天体名称颜色
const BODY_NAME_OFFSET = 8;              // 名称距天体顶部偏移（px）

const VELOCITY_ARROW_COLOR = "rgba(255,255,255,0.8)"; // 速度箭头颜色
const VELOCITY_ARROW_LINE_WIDTH = 2;     // 速度箭头线宽
const VELOCITY_ARROW_LENGTH = 30;        // 速度箭头长度（屏幕像素）
const VELOCITY_ARROW_HEAD_LEN = 8;       // 箭头头部长度
const VELOCITY_ARROW_HEAD_ANGLE = Math.PI / 6; // 箭头头部张开角度（30°）

function screenToWorld(sx, sy) {
  return {
    x: (sx - State.centerX) / State.scale - State.offsetX,
    y: (sy - State.centerY) / State.scale - State.offsetY,
  };
}

function worldToScreen(x, y) {
  return {
    x: State.centerX + (x + State.offsetX) * State.scale,
    y: State.centerY + (y + State.offsetY) * State.scale,
  };
}

function getBodyAtMouse(mx, my) {
  const world = screenToWorld(mx, my);
  const minHitRadius = MIN_BODY_HIT_RADIUS_SCREEN / State.scale;
  for (let i = State.bodies.length - 1; i >= 0; i--) {
    const b = State.bodies[i];
    const dx = world.x - b.x;
    const dy = world.y - b.y;
    const hitRadius = b.radius > minHitRadius ? b.radius : minHitRadius;
    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      return i;
    }
  }
  return -1;
}

function generateStars() {
  State.stars = [];
  const count = Math.floor((State.width * State.height) / STAR_DENSITY);
  for (let i = 0; i < count; i++) {
    State.stars.push({
      x: Math.random() * State.width,
      y: Math.random() * State.height,
      size: Math.random() * (STAR_MAX_SIZE - STAR_MIN_SIZE) + STAR_MIN_SIZE,
      brightness: Math.random() * (STAR_MAX_BRIGHTNESS - STAR_MIN_BRIGHTNESS) + STAR_MIN_BRIGHTNESS,
    });
  }
}

function drawStars() {
  const ctx = State.ctx;
  for (let i = 0; i < State.stars.length; i++) {
    const s = State.stars[i];
    ctx.fillStyle = `rgba(255,255,255,${s.brightness})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrails() {
  if (!State.showTrail) return;

  const ctx = State.ctx;
  const bodies = State.bodies;
  const isFull = State.trailMode === "full";
  const cutoffTime = isFull ? 0 : State.simulationTime - State.trailDuration;

  for (let bi = 0; bi < bodies.length; bi++) {
    const body = bodies[bi];
    const trail = body.trail;
    const len = trail.length;
    if (len < 2) continue;

    let startIdx = 0;
    if (!isFull) {
      while (startIdx < len && trail[startIdx].t < cutoffTime) startIdx++;
      if (startIdx > 0) startIdx--;
    }

    const visibleCount = len - startIdx;
    if (visibleCount < 2) continue;

    const baseColor = body.color;

    if (isFull) {
      ctx.strokeStyle = baseColor + TRAIL_FULL_ALPHA_HEX;
      ctx.lineWidth = TRAIL_FULL_LINE_WIDTH;
      ctx.beginPath();
      const p0 = worldToScreen(trail[startIdx].x, trail[startIdx].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = startIdx + 1; i < len; i++) {
        const p = worldToScreen(trail[i].x, trail[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    } else {
      for (let i = startIdx + 1; i < len; i++) {
        const localIdx = i - startIdx;
        const alpha = TRAIL_FADE_START + (1 - TRAIL_FADE_START) * (localIdx / visibleCount);
        const p1 = worldToScreen(trail[i - 1].x, trail[i - 1].y);
        const p2 = worldToScreen(trail[i].x, trail[i].y);

        ctx.strokeStyle = baseColor + Math.floor(alpha * TRAIL_ALPHA_MAX).toString(16).padStart(2, "0");
        ctx.lineWidth = alpha * TRAIL_LINE_WIDTH_SCALE + TRAIL_LINE_WIDTH_MIN;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }
}

function drawBodies() {
  const ctx = State.ctx;
  const bodies = State.bodies;
  const selected = State.selectedBodyIndex;

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    const pos = worldToScreen(body.x, body.y);
    const r = body.radius * State.scale;

    if (i === selected) {
      ctx.strokeStyle = SELECTION_RING_COLOR;
      ctx.lineWidth = SELECTION_RING_LINE_WIDTH;
      ctx.setLineDash(SELECTION_RING_DASH);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r * SELECTION_RING_MULTIPLIER, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const glowR = r * GLOW_RADIUS_MULTIPLIER;
    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
    gradient.addColorStop(0, body.color);
    gradient.addColorStop(GLOW_MID_STOP, body.color + GLOW_MID_ALPHA_HEX);
    gradient.addColorStop(1, body.color + GLOW_END_ALPHA_HEX);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${HIGHLIGHT_ALPHA})`;
    ctx.beginPath();
    ctx.arc(
      pos.x - r * HIGHLIGHT_OFFSET_RATIO,
      pos.y - r * HIGHLIGHT_OFFSET_RATIO,
      r * HIGHLIGHT_SIZE_RATIO,
      0, Math.PI * 2
    );
    ctx.fill();
  }

  if (State.showBodyNames) {
    ctx.font = `${BODY_NAME_FONT_SIZE}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = BODY_NAME_COLOR;
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const pos = worldToScreen(body.x, body.y);
      ctx.fillText(body.name, pos.x, pos.y - body.radius * State.scale - BODY_NAME_OFFSET);
    }
  }

  if (State.showVelocity) {
    ctx.strokeStyle = VELOCITY_ARROW_COLOR;
    ctx.fillStyle = VELOCITY_ARROW_COLOR;
    ctx.lineWidth = VELOCITY_ARROW_LINE_WIDTH;
    const arrowLen = VELOCITY_ARROW_LENGTH;
    const headLen = VELOCITY_ARROW_HEAD_LEN;
    const headAngle = VELOCITY_ARROW_HEAD_ANGLE;

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const pos = worldToScreen(body.x, body.y);
      const angle = Math.atan2(body.vy, body.vx);
      const endX = pos.x + Math.cos(angle) * arrowLen;
      const endY = pos.y + Math.sin(angle) * arrowLen;

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle - headAngle),
        endY - headLen * Math.sin(angle - headAngle)
      );
      ctx.lineTo(
        endX - headLen * Math.cos(angle + headAngle),
        endY - headLen * Math.sin(angle + headAngle)
      );
      ctx.closePath();
      ctx.fill();
    }
  }
}
