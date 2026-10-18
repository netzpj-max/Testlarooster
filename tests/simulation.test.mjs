import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, LEVELS, WORLD } from '../src/simulation.js';
import { wallPose } from '../src/maneuvers.js';

const advance = (sim, seconds, input = {}) => { for (let t = 0; t < seconds; t += 1 / 120) sim.update(1 / 120, input); };
const steerTo = (car, x, z) => {
  const desired = Math.atan2(-(x - car.x), -(z - car.z));
  const error = Math.atan2(Math.sin(desired - car.yaw), Math.cos(desired - car.yaw));
  return Math.max(-1, Math.min(1, -error * 2));
};
const sideRoute = (sim, x, roll = false) => sim.car.airborne
  ? { throttle: 1, roll: roll && !sim.objectives.roll ? 1 : 0 }
  : { throttle: 1, steer: steerTo(sim.car, x, sim.car.z > 0 ? -10 : -180) };
const approachWall = sim => {
  for (let frame = 0; frame < 1800 && !sim.car.wallRide; frame++) sim.update(1 / 120, sideRoute(sim, -28));
  assert.equal(sim.car.wallRide, true);
};

test('all five stages have distinct objectives and plan score targets', () => {
  assert.deepEqual(LEVELS.map(l => l.target), [810, 1800, 3600, 6000, 8100]);
  assert.ok(LEVELS.every(l => l.objectives.length > 1));
  assert.equal(new Simulation(99).levelIndex, 4);
});

test('idle produces no points; throttle drives toward negative Z; boost accelerates faster', () => {
  const idle = new Simulation(); advance(idle, 3); assert.equal(idle.score + idle.pending, 0);
  const normal = new Simulation(), fast = new Simulation();
  advance(normal, 1.4, { throttle: 1 }); advance(fast, 1.4, { throttle: 1, boost: true });
  assert.ok(normal.car.z < 55); assert.ok(normal.car.speed > 20); assert.ok(fast.car.speed > normal.car.speed); assert.ok(fast.car.boost < 100);
});

test('simulation is deterministic for identical inputs and frame steps', () => {
  const a = new Simulation(), b = new Simulation();
  for (let frame = 0; frame < 800; frame++) {
    const input = { throttle: 1, steer: Math.sin(frame / 80) * .3, jump: frame === 180, roll: frame > 180 && frame < 320 ? 1 : 0 };
    a.update(1 / 120, input); b.update(1 / 120, input);
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test('jump is edge triggered and airborne roll accumulates an actual complete turn', () => {
  const sim = new Simulation(2); advance(sim, 1, { throttle: 1 });
  sim.update(1 / 120, { jump: true }); assert.equal(sim.car.airborne, true);
  // A long flight is set up to isolate the angular detector from the terrain.
  Object.assign(sim.car, { y: 22, vy: 1, vx: 0, vz: -12 });
  advance(sim, 1.8, { roll: 1 });
  assert.equal(sim.objectives.roll, true); assert.ok(sim.pending >= 1800);
  assert.ok(sim.drainEvents().some(e => e.label.includes('360')));
});

test('clean landing waits for stable wheels before banking pending stunt points', () => {
  const sim = new Simulation(2);
  Object.assign(sim.car, { y: .7, airborne: true, vy: -2, pitch: 0, roll: 0, vx: 0, vz: 0 });
  sim._airTime = 2; sim.pending = 1000;
  sim.update(1 / 120, {}); advance(sim, .1);
  assert.equal(sim.score, 0); assert.ok(sim.pending > 0);
  advance(sim, .6); assert.ok(sim.score >= 1000); assert.equal(sim.pending, 0); assert.equal(sim.objectives.land, true);
});

test('crashes discard pending points and preserve banked points and completed challenges', () => {
  const sim = new Simulation(); sim.score = 600; sim.pending = 900; sim.objectives.drift = true;
  sim.car.x = WORLD.bounds.maxX + 1; sim.update(1 / 60, {});
  assert.equal(sim.score, 600); assert.equal(sim.pending, 0); assert.equal(sim.objectives.drift, true);
  assert.equal(sim.car.x, 0); assert.ok(sim.drainEvents().some(e => e.type === 'crash'));
});

test('reset key costs time only on the rising edge and leaves score intact', () => {
  const sim = new Simulation(); sim.score = 300; sim.pending = 250;
  const before = sim.timeLeft; advance(sim, .5, { reset: true });
  assert.ok(before - sim.timeLeft < 4); assert.ok(before - sim.timeLeft >= 3.5 - .02);
  assert.equal(sim.score, 300); assert.equal(sim.pending, 0);
});

test('ring crossing checks height and lateral position, not proximity alone', () => {
  const sim = new Simulation(3), ring = WORLD.rings[0];
  Object.assign(sim.car, { x: ring.x, y: ring.y, z: ring.z + .1, airborne: true, vz: -25, vy: 0 });
  sim.update(1 / 60, {}); assert.equal(sim.rings[0], true);
  const miss = new Simulation(3);
  Object.assign(miss.car, { x: ring.x + ring.radius + 1, y: ring.y, z: ring.z + .1, airborne: true, vz: -25, vy: 0 });
  miss.update(1 / 60, {}); assert.equal(miss.rings[0], false);
});

test('timeout fails, terminal states freeze, and reset starts a clean new round', () => {
  const sim = new Simulation(); sim.timeLeft = .01; sim.update(1 / 30, { throttle: 1 });
  assert.equal(sim.status, 'failed'); const snapshot = sim.snapshot(); sim.update(.1, { throttle: 1 }); assert.deepEqual(sim.snapshot(), snapshot);
  sim.reset(3); assert.equal(sim.status, 'playing'); assert.equal(sim.score, 0); assert.equal(sim.levelIndex, 3);
});

test('large or invalid frame deltas are bounded and never introduce NaN', () => {
  const sim = new Simulation(); sim.update(100, { throttle: NaN, steer: Infinity }); sim.update(NaN, {});
  assert.ok(Object.values(sim.car).every(v => typeof v !== 'number' || Number.isFinite(v))); assert.ok(sim.elapsed <= .101);
});

test('first stage is completable with driving controls from the actual start position', () => {
  const sim = new Simulation(0);
  for (let frame = 0; frame < 1200 && sim.status === 'playing'; frame++) {
    const t = frame / 120;
    const input = t < 1.4 ? { throttle: 1 } : t < 2.6
      ? { throttle: 1, brake: true, steer: Math.floor((t - 1.4) * 4) % 2 ? .36 : -.36 }
      : { throttle: 1 };
    sim.update(1 / 120, input);
  }
  assert.equal(sim.status, 'passed'); assert.ok(sim.score >= 810);
});

test('central ramp is calibrated to all three rings and landing pad without hidden position changes', () => {
  const sim = new Simulation(3);
  advance(sim, 9, { throttle: 1 });
  assert.equal(sim.status, 'passed'); assert.deepEqual(sim.rings, [true, true, true]);
  assert.equal(sim.objectives.land, true); assert.ok(sim.score >= 6000);
  assert.ok(sim.car.z > WORLD.bounds.minZ);
});

test('wall stage is completable using steering and throttle from the actual starting grid', () => {
  const sim = new Simulation(1);
  for (let frame = 0; frame < 2400 && sim.status === 'playing'; frame++) sim.update(1 / 120, sideRoute(sim, -28));
  assert.equal(sim.status, 'passed'); assert.ok(sim.score >= 1800);
  assert.ok(sim.drainEvents().every(e => e.type !== 'crash'));
});

test('truck stage allows a genuine full airborne roll, clearance, and stable landing', () => {
  const sim = new Simulation(2);
  // Aim slightly inside the ramp to compensate for lateral momentum on takeoff.
  for (let frame = 0; frame < 2400 && sim.status === 'playing'; frame++) sim.update(1 / 120, sideRoute(sim, 22, true));
  assert.equal(sim.status, 'passed'); assert.equal(sim.objectives.truck, true); assert.equal(sim.objectives.roll, true);
  assert.ok(sim.drainEvents().every(e => e.type !== 'crash'));
});

test('truck clearance requires overlapping the footprint and clearing the roof with the wheels', () => {
  const truck = WORLD.trucks[0];
  const cross = (x, y) => {
    const sim = new Simulation(2);
    Object.assign(sim.car, { x, y, z: truck.z + .1, airborne: true, vz: -25, vy: 0 });
    sim.update(1 / 60, {});
    return sim;
  };
  assert.equal(cross(truck.x + 6, truck.height + 3).objectives.truck, false);
  assert.equal(cross(truck.x, truck.height + .3).objectives.truck, false);
  assert.equal(cross(truck.x, truck.height + .8).objectives.truck, true);
});

test('final stage combines three controlled stunt runs and two permitted resets within the clock', () => {
  const sim = new Simulation(4); let phase = 0, beforeWallScore = 0;
  for (let frame = 0; frame < 4800 && sim.status === 'playing'; frame++) {
    const t = frame / 120; let input = { throttle: 1 };
    if (phase === 0) {
      input = t < 1.4 ? { throttle: 1 } : t < 2.6
        ? { throttle: 1, brake: true, steer: Math.floor((t - 1.4) * 4) % 2 ? .36 : -.36 } : { throttle: 1 };
      if (sim.score > 0) { phase = 1; beforeWallScore = sim.score; input = { reset: true }; }
    } else if (phase === 1) {
      input = sideRoute(sim, -28, true);
      if (sim.objectives.wall && sim.objectives.roll && sim.score > beforeWallScore && sim.pending === 0) { phase = 2; input = { reset: true }; }
    }
    sim.update(1 / 120, input);
  }
  assert.equal(sim.status, 'passed'); assert.ok(Object.values(sim.objectives).every(Boolean));
  assert.ok(sim.timeLeft > 120); assert.equal(sim.pending, 0);
  assert.equal(sim.drainEvents().filter(e => e.type === 'reset').length, 2);
});

test('shared wall samples keep wheels on the same surface and forward direction on its tangent', () => {
  const wall = WORLD.wall;
  for (let step = 0; step <= 100; step++) {
    const theta = step / 100 * Math.PI, pose = wallPose(theta, wall);
    assert.ok(Math.abs(Math.hypot(pose.y - pose.surface.y, pose.z - pose.surface.z) - wall.wheelOffset) < 1e-9);
    assert.ok(Math.abs((pose.y - pose.surface.y) * pose.normal.y + (pose.z - pose.surface.z) * pose.normal.z - wall.wheelOffset) < 1e-9);
    assert.ok(Math.abs(Math.hypot(pose.tangent.y, pose.tangent.z) - 1) < 1e-12);
    assert.ok(Math.abs(pose.normal.y * pose.tangent.y + pose.normal.z * pose.tangent.z) < 1e-12);
    if (step < 100) {
      const next = wallPose(theta + .00001, wall), dy = next.y - pose.y, dz = next.z - pose.z;
      const dot = (dy * pose.tangent.y + dz * pose.tangent.z) / Math.hypot(dy, dz);
      assert.ok(dot > .99999999);
    }
  }
  const lip = wallPose(Math.PI, wall);
  assert.ok(Math.abs(lip.y - (2 * wall.radius - wall.wheelOffset)) < 1e-12);
  assert.equal(lip.tangent.z, 1); assert.equal(lip.normal.y, -1);
});

test('wall objective waits for the inverted lip and launches continuously toward the approach', () => {
  const sim = new Simulation(1); approachWall(sim);
  assert.equal(sim.objectives.wall, false);
  const laneX = sim.car.x;
  let previous;
  for (let frame = 0; frame < 1200 && sim.car.wallRide; frame++) {
    previous = { ...sim.car }; sim.update(1 / 120, {});
    const pose = wallPose(sim._wallProgress, WORLD.wall), c = sim.car;
    assert.equal(c.x, laneX);
    assert.ok(Math.abs(c.y - pose.y) < 1e-9); assert.ok(Math.abs(c.z - pose.z) < 1e-9);
    assert.ok(Math.hypot(c.y - previous.y, c.z - previous.z) <= sim._wallSpeed / 120 + .001);
    if (c.wallRide) assert.equal(sim.objectives.wall, false);
  }
  const c = sim.car;
  assert.equal(c.airborne, true); assert.equal(sim.objectives.wall, true);
  assert.ok(c.vz > 0); assert.ok(Math.abs(c.vy) < 1e-10);
  assert.equal(c.yaw, Math.PI); assert.equal(c.pitch, 0); assert.equal(c.roll, Math.PI);
  assert.ok(c.jetLift > 0);
  // The final wall pose Rx(PI) equals the release pose Ry(PI) * Rz(PI):
  // both have nose +Z and roof -Y, so the Euler representation is not a flip.
  assert.ok(Math.cos(previous.pitch) < -.999); assert.ok(c.z >= previous.z);
});

test('inverted launch hangs briefly then rolls upright at a bounded rate with visible control jets', () => {
  const sim = new Simulation(1); approachWall(sim);
  while (sim.car.wallRide) sim.update(1 / 120, {});
  const releaseZ = sim.car.z;
  advance(sim, .14);
  assert.equal(sim.car.roll, Math.PI); assert.equal(sim.car.jetRoll, 0); assert.ok(sim.car.z > releaseZ);
  for (let frame = 0; frame < 230; frame++) {
    const before = sim.car.roll; sim.update(1 / 120, {});
    assert.ok(Math.abs(sim.car.roll - before) <= 2.6 / 120 + .00001);
    assert.ok(sim.car.jetRoll <= 0);
  }
  assert.ok(Math.abs(sim.car.roll) < .2); assert.ok(sim.car.vz > 0);
});

test('Space can depart either half of the wall along its current tangent without earning the full-wall objective', () => {
  for (const departureTheta of [.65, 2.2]) {
    const sim = new Simulation(1); approachWall(sim);
    while (sim._wallProgress < departureTheta) sim.update(1 / 120, {});
    sim.update(1 / 120, { jump: true });
    const pose = wallPose(sim._wallProgress, WORLD.wall);
    assert.equal(sim.car.wallRide, false); assert.equal(sim.car.airborne, true); assert.equal(sim.objectives.wall, false);
    assert.ok(Math.abs(sim.car.vy - pose.tangent.y * sim._wallSpeed) < 1e-9);
    assert.ok(Math.abs(sim.car.vz - pose.tangent.z * sim._wallSpeed) < 1e-9);
    assert.ok(sim.car.jetLift > 0);
  }
});

test('jump and natural ramp takeoff emit time-based lift pulses and manual rotation drives telemetry', () => {
  const jump = new Simulation(2); jump.update(1 / 120, { jump: true });
  assert.equal(jump.car.jetLift, 1); advance(jump, .1); assert.ok(jump.car.jetLift > 0 && jump.car.jetLift < 1);
  advance(jump, .2); assert.equal(jump.car.jetLift, 0);
  jump.update(1 / 120, { roll: 1, pitch: -1, boost: true });
  assert.equal(jump.car.jetRoll, 1); assert.equal(jump.car.jetPitch, -1); assert.equal(jump.car.jetRear, 1); assert.equal(jump.car.jetLift, 1);
  const ramp = new Simulation(3);
  for (let frame = 0; frame < 1200 && !ramp.car.airborne; frame++) ramp.update(1 / 120, { throttle: 1 });
  assert.equal(ramp.car.airborne, true); assert.equal(ramp.car.jetLift, 1);
});
