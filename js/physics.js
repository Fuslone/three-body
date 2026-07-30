// 物理引擎 - N体引力计算与运动积分（速度Verlet，二阶精度，辛守恒）

function computeAccelerations(bodies) {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    bodies[i].ax = 0;
    bodies[i].ay = 0;
  }

  const G = State.G;
  const eps2 = State.softening * State.softening;

  for (let i = 0; i < n; i++) {
    const bi = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const bj = bodies[j];
      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;
      const distSq = dx * dx + dy * dy + eps2;
      const invDist = 1 / Math.sqrt(distSq);
      const invDist3 = invDist / distSq;
      const f = G * invDist3;

      const fx = f * dx;
      const fy = f * dy;

      bi.ax += fx * bj.mass;
      bi.ay += fy * bj.mass;
      bj.ax -= fx * bi.mass;
      bj.ay -= fy * bi.mass;
    }
  }
}

function initAccelerations() {
  for (const b of State.bodies) {
    b.ax = 0;
    b.ay = 0;
  }
  computeAccelerations(State.bodies);
}

function updatePhysics() {
  const bodies = State.bodies;
  const dt = State.dt;
  const dtHalf = dt * 0.5;

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    b.x += b.vx * dt + b.ax * dtHalf * dt;
    b.y += b.vy * dt + b.ay * dtHalf * dt;
    b._oldAx = b.ax;
    b._oldAy = b.ay;
  }

  computeAccelerations(bodies);

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    b.vx += (b._oldAx + b.ax) * dtHalf;
    b.vy += (b._oldAy + b.ay) * dtHalf;
    b.trail.push({ x: b.x, y: b.y, t: State.simulationTime });
  }

  State.simulationTime += dt;
}
