//状态管理 - 所有模拟状态变量集中在此

const State = {
  // Canvas
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  centerX: 0,
  centerY: 0,

  // 视图
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  lastPointerX: 0,
  lastPointerY: 0,
  resetBtnEnabled: false,

  // 天体
  bodies: [],
  stars: [],
  starsInitialized: false,
  initialBodies: [],
  bodyNameCounter: 3,

  // 运行状态
  isRunning: false,
  simulationTime: 0,

  // 参数
  speed: 1,
  G: 500,
  dt: 0.01,
  softening: 20,

  // 显示选项
  showTrail: true,
  trailMode: "partial",
  trailDuration: 10,
  showVelocity: false,
  showBodyNames: false,

  // 随机生成选项
  randomMass: true,
  randomSpeed: true,
  randomPosition: true,
  randomMassMin: 500,
  randomMassMax: 1500,
  randomSpeedMin: 25,
  randomSpeedMax: 50,
  randomPosRange: 200,

  // 选中/跟踪
  selectedBodyIndex: -1,
  trackingBodyIndex: -1,

  // 交互
  isDraggingBody: false,
  draggedBodyIndex: -1,
  isPanning: false,
  dragStartX: 0,
  dragStartY: 0,
  dragMoved: false,

  // 常量
  baseMass: 1000,

  // FPS
  lastTime: performance.now(),
  frameCount: 0,
  fps: 60,

  // 触摸
  touchStartDist: 0,
  touchStartScale: 1,

  // 倒带功能
  isRewindMode: false,
  rewindSnapshot: [],         // 进入倒带时的 trail 快照（每个 body 各自的 trail 数组副本）
  rewindSnapshotLen: 0,       // 快照长度（追上后截断 trail 用）
  rewindSnapshotTimeSpan: 0,  // 快照的时间跨度（最后一个点的 t - 第一个点的 t）
  rewindTargetTime: 0,        // 快照最后一个点的 t（点击倒带时刻）
  rewindCurrentTime: 0,       // 当前回放时间
}

// 可持久化的设置项（"恢复默认设置"、localStorage、导入导出都用这一份）
const SETTINGS_KEYS = [
  "speed",
  "dt",
  "showTrail",
  "trailMode",
  "trailDuration",
  "showVelocity",
  "showBodyNames",
  "randomMass",
  "randomSpeed",
  "randomPosition",
  "randomMassMin",
  "randomMassMax",
  "randomSpeedMin",
  "randomSpeedMax",
  "randomPosRange",
];

// 在 State 尚未被运行时修改前，立即快照默认值；改默认值只需改上面的 State
const DEFAULT_SETTINGS = Object.freeze(
  SETTINGS_KEYS.reduce((acc, key) => {
    acc[key] = State[key];
    return acc;
  }, {})
);
