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
  lastMouseX: 0,
  lastMouseY: 0,
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
  randomSpeedMin: 0.5,
  randomSpeedMax: 1.3,
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
};
