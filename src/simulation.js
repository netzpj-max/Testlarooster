/** Deterministic, dependency-free arcade driving and stunt rules. Distances are metres. */
import { WALL_DEFAULTS, wallPose } from './maneuvers.js';
export const WORLD = Object.freeze({
  bounds: { minX: -65, maxX: 65, minZ: -210, maxZ: 90 },
  gate: { x: 0, z: 12, width: 18 },
  ramp: { x: 0, z: -35, width: 15, length: 24, height: 9 },
  wall: { ...WALL_DEFAULTS },
  rings: [{ x: 0, y: 9, z: -70, radius: 8 }, { x: 0, y: 13, z: -100, radius: 8 }, { x: 0, y: 10, z: -132, radius: 8 }],
  landingPad: { x: 0, z: -160, radius: 14 },
  trucks: [{ x: 25, z: -70, width: 5, length: 12, height: 4 }],
  truckRamp: { x: 25, z: -44, width: 11, length: 18, height: 8 },
});

export const LEVELS = [
  { id: 0, title: 'ออกตัวจนไข่สั่น', subtitle: 'EGG-QUAKE LAUNCH', target: 810, duration: 90, objectives: [{ id: 'drift', label: 'ดริฟต์ด้วยเบรกมือ' }, { id: 'gate', label: 'ผ่านประตูไฟสีเขียว' }] },
  { id: 1, title: 'ไก่ติดเพดาน', subtitle: 'CEILING CHICKEN', target: 1800, duration: 110, objectives: [{ id: 'wall', label: 'ไต่ทางลาดกลับหัวด้านซ้าย' }, { id: 'land', label: 'ลงล้ออย่างปลอดภัย' }] },
  { id: 2, title: 'รูสเตอร์โรล', subtitle: 'THE ROOSTER ROLL', target: 3600, duration: 120, objectives: [{ id: 'roll', label: 'หมุน Q / E ครบหนึ่งรอบ' }, { id: 'truck', label: 'บินข้ามรถบรรทุกด้านขวา' }, { id: 'land', label: 'ลงล้ออย่างปลอดภัย' }] },
  { id: 3, title: 'ไก่หลุดน่านฟ้า', subtitle: 'UNLICENSED POULTRY', target: 6000, duration: 130, objectives: [{ id: 'rings', label: 'บินผ่านห่วงทั้ง 3 วง' }, { id: 'land', label: 'ลงบนแท่นวงกลมท้ายสนาม' }] },
  { id: 4, title: 'งานเปิดตัวที่ไม่มีใครขอ', subtitle: 'THE UNINVITED PREMIERE', target: 8100, duration: 180, objectives: [{ id: 'drift', label: 'ดริฟต์ให้ขนปลิว' }, { id: 'wall', label: 'ขึ้นทางลาดกลับหัว' }, { id: 'roll', label: 'หมุนครบหนึ่งรอบ' }, { id: 'rings', label: 'ผ่านห่วงอย่างน้อย 1 วง' }, { id: 'land', label: 'ลงบนแท่นวงกลมท้ายสนาม' }] },
];
[
  'เร่ง W แล้วกด Ctrl พร้อม A/D เพื่อดริฟต์ จากนั้นผ่านประตูสีเขียว ปล่อยเบรกเพื่อเก็บคะแนน',
  'เลี้ยวไปทางลาดกลับหัวด้านซ้าย (x −28) ขับเข้าเร็วพอ รถจะเกาะทางลาดให้ ปล่อยปุ่มกลางอากาศช่วยจัดล้อลง',
  'ไปทางลาดด้านขวาหน้ารถบรรทุก กด Q หรือ E กลางอากาศประมาณ 2 วินาที แล้วปล่อยเพื่อจัดรถลงล้อ',
  'เร่ง W ตรงเข้าทางลาดกลาง บินผ่านสามห่วงแล้วลงวงกลมท้ายสนาม ใช้ Shift ยกตัวเมื่อบินต่ำ',
  'เก็บคะแนนดริฟต์ก่อน กด R กลับต้นสนามได้ ต่อด้วยทางลาดซ้ายพร้อมหมุน Q/E แล้วกลับมาบินเส้นกลาง คะแนนที่เก็บแล้วและภารกิจจะคงอยู่',
].forEach((tip, index) => { LEVELS[index].tip = tip; });

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angle = v => Math.atan2(Math.sin(v), Math.cos(v));
const finite = v => Number.isFinite(v) ? v : 0;
const startCar = () => ({ x: 0, y: .6, z: 55, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, airborne: false, boost: 100, wallRide: false,
  jetLift: 0, jetRoll: 0, jetPitch: 0, jetRear: 0 });

export class Simulation {
  constructor(levelIndex = 0) { this.reset(levelIndex); }

  reset(levelIndex = this.levelIndex) {
    this.levelIndex = clamp(Math.floor(finite(levelIndex)), 0, LEVELS.length - 1);
    this.car = startCar(); this.score = 0; this.pending = 0; this.multiplier = 1;
    this.timeLeft = LEVELS[this.levelIndex].duration; this.status = 'playing';
    this.objectives = Object.fromEntries(LEVELS[this.levelIndex].objectives.map(o => [o.id, false]));
    this.events = []; this.elapsed = 0; this.rings = [false, false, false];
    this._repeat = {}; this._lastTrick = ''; this._stable = 0; this._drift = 0;
    this._rollTravel = 0; this._pitchTravel = 0; this._airTime = 0; this._jumpHeld = false;
    this._resetHeld = false; this._wallProgress = 0; this._wallCooldown = 0;
    this._gateDone = false; this._truckDone = false; this._crashCooldown = 0;
    this._airScored = false; this._landingPending = false; this._landingQuality = 1; this._landingEligible = false;
    this._wallSpeed = 0; this._wallX = WORLD.wall.x; this._invertedHang = 0; this._jumpPulse = 0;
    return this.snapshot();
  }

  drainEvents() { return this.events.splice(0); }
  snapshot() {
    return { car: { ...this.car }, score: this.score, pending: Math.floor(this.pending), multiplier: this.multiplier,
      timeLeft: this.timeLeft, elapsed: this.elapsed, levelIndex: this.levelIndex, status: this.status,
      objectives: { ...this.objectives }, rings: [...this.rings], world: WORLD };
  }

  _event(type, label, points) { this.events.push({ type, label, ...(points === undefined ? {} : { points }) }); if (this.events.length > 40) this.events.shift(); }
  _objective(id) { if (id in this.objectives) this.objectives[id] = true; }
  _award(kind, label, points) {
    const n = this._repeat[kind] || 0;
    const factor = [1, .5, .25, 0][Math.min(n, 3)];
    if (!factor) return;
    if (this._lastTrick && this._lastTrick !== kind) this.multiplier = Math.min(4, this.multiplier + .5);
    this._lastTrick = kind; this._repeat[kind] = n + 1;
    const award = Math.round(points * factor); this.pending += award;
    this._event('trick', label, award); this._stable = 0;
  }

  _bank(quality = 1) {
    if (this.pending > 0) {
      const points = Math.round(this.pending * this.multiplier * quality);
      this.score += points; this._event('bank', quality > 1 ? 'ลงสวย! ไข่ไม่แตก' : 'เก็บคะแนนเข้ารัง', points);
    }
    this.pending = 0; this.multiplier = 1; this._repeat = {}; this._lastTrick = ''; this._stable = 0;
  }

  _respawn(crash = false) {
    const fuel = Math.max(65, this.car.boost);
    Object.assign(this.car, startCar(), { boost: fuel });
    this.pending = 0; this.multiplier = 1; this._repeat = {}; this._lastTrick = '';
    this._stable = 0; this._drift = 0; this._airTime = 0; this._rollTravel = 0; this._pitchTravel = 0;
    this._landingPending = false; this._landingEligible = false; this._airScored = false; this._wallProgress = 0; this._wallCooldown = 1.2; this._crashCooldown = .7;
    this._invertedHang = 0; this._jumpPulse = 0;
    this.timeLeft = Math.max(0, this.timeLeft - (crash ? 2 : 3));
    this._event(crash ? 'crash' : 'reset', crash ? 'ไข่แตก! คะแนนที่เก็บแล้วยังอยู่' : 'กลับเข้ารัง • เสียเวลา 3 วินาที');
  }

  update(dt, input = {}) {
    if (this.status !== 'playing') return this.snapshot();
    const delta = clamp(finite(dt), 0, .1);
    if (input.reset && !this._resetHeld) this._respawn();
    this._resetHeld = !!input.reset;
    const jump = !!input.jump && !this._jumpHeld; this._jumpHeld = !!input.jump;
    const i = { throttle: clamp(finite(input.throttle), -1, 1), steer: clamp(finite(input.steer), -1, 1),
      pitch: clamp(finite(input.pitch), -1, 1), roll: clamp(finite(input.roll), -1, 1), brake: !!input.brake, boost: !!input.boost };
    const steps = Math.max(1, Math.ceil(delta / (1 / 120)));
    for (let step = 0; step < steps; step++) {
      this._step(delta / steps, i, jump && step === 0);
      if (this.status !== 'playing') break;
    }
    return this.snapshot();
  }

  _surface(x, z) {
    for (const ramp of [WORLD.ramp, WORLD.truckRamp]) {
      const near = ramp.z + ramp.length / 2, far = ramp.z - ramp.length / 2;
      if (Math.abs(x - ramp.x) < ramp.width / 2 && z <= near && z >= far) return .6 + ramp.height * (near - z) / ramp.length;
    }
    return .6;
  }

  _step(dt, input, jump) {
    const c = this.car, oldZ = c.z, oldX = c.x;
    this.elapsed += dt; this.timeLeft = Math.max(0, this.timeLeft - dt);
    this._wallCooldown = Math.max(0, this._wallCooldown - dt);
    this._crashCooldown = Math.max(0, this._crashCooldown - dt);
    const boosting = input.boost && c.boost > .1;
    c.boost = clamp(c.boost + (boosting ? -17 : c.airborne ? 2 : 12) * dt, 0, 100);
    this._jumpPulse = Math.max(0, this._jumpPulse - dt);
    c.jetLift = this._jumpPulse > 0 ? this._jumpPulse / .24 : 0;
    c.jetRoll = 0; c.jetPitch = 0; c.jetRear = boosting ? 1 : c.airborne && input.throttle > 0 ? .2 : 0;

    if (c.wallRide) {
      const thetaRate = this._wallSpeed / (WORLD.wall.radius - WORLD.wall.wheelOffset);
      this._wallProgress = Math.min(Math.PI, this._wallProgress + dt * thetaRate);
      const pose = wallPose(this._wallProgress, WORLD.wall);
      c.x = this._wallX; c.z = pose.z; c.y = pose.y; c.pitch = pose.pitch; c.yaw = 0; c.roll = 0;
      c.vx = 0; c.vy = pose.tangent.y * this._wallSpeed; c.vz = pose.tangent.z * this._wallSpeed;
      c.speed = this._wallSpeed; c.jetRear = boosting ? 1 : 0;
      if (this._wallProgress >= Math.PI || jump) {
        const fullyInverted = this._wallProgress >= Math.PI;
        c.wallRide = false; c.airborne = true;
        // Equivalent Euler representation retains the exact orientation while
        // letting normal yaw steering follow the outbound horizontal tangent.
        if (this._wallProgress > Math.PI / 2) { c.yaw = Math.PI; c.pitch = Math.PI - this._wallProgress; c.roll = Math.PI; }
        this._invertedHang = fullyInverted ? .2 : 0;
        this._jumpPulse = .24; c.jetLift = 1;
        this._airTime = 0; this._rollTravel = 0; this._pitchTravel = 0; this._airScored = false; this._wallCooldown = 3;
        if (fullyInverted) { this._objective('wall'); this._award('wall', 'ไก่ติดเพดาน! • กลับหัว 180°', 1350); }
        this._award('launch', fullyInverted ? 'ปล่อยตัวกลับทางเดิม • ยังกลับหัวอยู่!' : 'ปล่อยตัวก่อนถึงเพดาน', fullyInverted ? 450 : 200);
      }
    } else if (!c.airborne) {
      const forward = -c.vx * Math.sin(c.yaw) - c.vz * Math.cos(c.yaw);
      const accel = input.throttle * (boosting ? 37 : 22);
      const drag = input.brake ? .95 : input.throttle ? .3 : .8;
      let speed = clamp(forward + (accel - forward * drag) * dt, -12, boosting ? 61 : 43);
      c.yaw -= input.steer * clamp(Math.abs(speed) / 13, 0, 1) * (input.brake ? 2.3 : 1.25) * dt * (speed < 0 ? -1 : 1);
      // Integrate longitudinal acceleration once; damp lateral slip separately.
      // Blending the entire velocity into an accelerated target would multiply
      // acceleration by dt twice and make car performance frame-rate dependent.
      const lateral = (c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw)) * Math.exp(-(input.brake ? 1.25 : 10) * dt);
      c.vx = -Math.sin(c.yaw) * speed + Math.cos(c.yaw) * lateral;
      c.vz = -Math.cos(c.yaw) * speed - Math.sin(c.yaw) * lateral;
      c.x += c.vx * dt; c.z += c.vz * dt; c.speed = Math.hypot(c.vx, c.vz);
      const surface = this._surface(c.x, c.z), previousSurface = this._surface(oldX, oldZ);
      c.y = surface; c.vy = 0;
      const slope = surface > .61 ? Math.atan2(surface - previousSurface, Math.hypot(c.x - oldX, c.z - oldZ) || 1) : 0;
      c.pitch += (slope - c.pitch) * Math.min(1, dt * 12); c.roll *= Math.exp(-12 * dt);
      if (jump || previousSurface > 2 && surface < previousSurface - 1) {
        c.airborne = true; c.y = Math.max(c.y, previousSurface); c.vy = jump ? 10 : 5;
        c.vz += -Math.cos(c.yaw) * 4; c.vx += -Math.sin(c.yaw) * 4;
        this._airTime = 0; this._rollTravel = 0; this._pitchTravel = 0; this._airScored = false;
        this._jumpPulse = .24; c.jetLift = 1;
      }
      if (!c.airborne && Math.abs(c.x - WORLD.wall.x) < WORLD.wall.width / 2 && oldZ > WORLD.wall.entryZ && c.z <= WORLD.wall.entryZ && c.speed > 12 && !this._wallCooldown) {
        c.wallRide = true; c.airborne = false; this._wallProgress = 0;
        this._wallSpeed = c.speed; this._wallX = c.x;
        const pose = wallPose(0, WORLD.wall); c.y = pose.y; c.z = pose.z; c.yaw = 0; c.pitch = 0; c.roll = 0;
      }
      if (input.brake && Math.abs(input.steer) > .3 && c.speed > 8) {
        this._drift += dt;
        if (this._drift >= .55) { this._drift = 0; this._objective('drift'); this._award('drift', 'ดริฟต์จนไข่สั่น', 420); }
      } else this._drift = Math.max(0, this._drift - dt);
    } else {
      this._airTime += dt;
      this._invertedHang = Math.max(0, this._invertedHang - dt);
      c.yaw -= input.steer * 1.15 * dt;
      const autoRollRate = this._invertedHang > 0 ? 0 : -clamp(angle(c.roll) * 2.4, -2.6, 2.6);
      const rollRate = input.roll ? input.roll * 3.6 : autoRollRate;
      const pitchRate = input.pitch ? input.pitch * 2.5 : -angle(c.pitch) * 3.2;
      const rollStep = rollRate * dt, pitchStep = pitchRate * dt;
      if (input.roll) { c.roll += rollStep; this._rollTravel += rollStep; }
      else c.roll += rollStep;
      if (input.pitch) { c.pitch += pitchStep; this._pitchTravel += pitchStep; }
      else c.pitch += pitchStep;
      c.jetRoll = clamp(rollRate / 3.6, -1, 1); c.jetPitch = clamp(pitchRate / 2.5, -1, 1);
      if (boosting) c.jetLift = 1;
      if (Math.abs(this._rollTravel) >= TAU) {
        this._rollTravel -= Math.sign(this._rollTravel) * TAU; this._objective('roll'); this._award('roll', 'ROOSTER ROLL • 360°', 1800);
      }
      if (Math.abs(this._pitchTravel) >= TAU) {
        this._pitchTravel -= Math.sign(this._pitchTravel) * TAU; this._award('flip', 'ตีลังกาข้ามเล้า • 360°', 1900);
      }
      const horizontalSpeed = Math.hypot(c.vx, c.vz);
      const thrust = boosting ? 17 : input.throttle > 0 ? 3 : 0;
      const airGrip = 1 - Math.exp(-.65 * dt);
      c.vx += (-Math.sin(c.yaw) * horizontalSpeed - c.vx) * airGrip;
      c.vz += (-Math.cos(c.yaw) * horizontalSpeed - c.vz) * airGrip;
      c.vx += (-Math.sin(c.yaw) * thrust - c.vx * .06) * dt;
      c.vz += (-Math.cos(c.yaw) * thrust - c.vz * .06) * dt;
      c.vy += (-12 + Math.min(4.5, horizontalSpeed * .1) + (boosting ? 10 : 0) + input.pitch * 5) * dt;
      c.vy = clamp(c.vy, -24, 18); c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.speed = Math.hypot(c.vx, c.vz);
      if (this._airTime > 1 && !this._airScored && c.y > 3) { this._airScored = true; this._award('air', 'ไก่มีใบอนุญาตบินไหม?', 350); }
      this._checkRings(oldZ);
      for (const truck of WORLD.trucks) {
        if (!this._truckDone && oldZ >= truck.z && c.z < truck.z && Math.abs(c.x - truck.x) < truck.width / 2 + .8 && c.y > truck.height + .6) {
          this._truckDone = true; this._objective('truck'); this._award('truck', 'ข้ามรถขนไข่!', 1350);
        }
      }
      const surface = this._surface(c.x, c.z);
      if (c.y <= surface && c.vy <= 0) {
        const rough = Math.abs(angle(c.roll)) > 1.05 || Math.abs(angle(c.pitch)) > 1.15 || c.vy < -23.5;
        if (rough) { this._respawn(true); }
        else {
          c.y = surface; c.vy = 0; c.airborne = false; this._landingPending = true;
          const pad = Math.hypot(c.x - WORLD.landingPad.x, c.z - WORLD.landingPad.z) <= WORLD.landingPad.radius;
          this._landingQuality = pad ? 1.4 : 1.15;
          if (this._airTime > .3) {
            this._landingEligible = this.levelIndex < 3 || pad;
            this._award('landing', pad ? 'ลงแท่นไข่ทองคำ' : 'ล้อลงครบ! ไข่รอด', pad ? 850 : 350);
          }
        }
      }
    }
    if (!this._gateDone && oldZ > WORLD.gate.z && c.z <= WORLD.gate.z && Math.abs(c.x) <= WORLD.gate.width / 2 && c.y < 5) {
      this._gateDone = true; this._objective('gate'); this._award('gate', 'ผ่านประตูแรงไก่', 500);
    }
    if (!c.airborne && !c.wallRide && !input.brake && Math.abs(c.roll) < .4 && Math.abs(c.pitch) < .8) {
      this._stable += dt;
      if (this._stable > (this._landingPending ? .5 : .85)) {
        this._bank(this._landingPending ? this._landingQuality : 1);
        if (this._landingPending && this._landingEligible) this._objective('land');
        this._landingPending = false; this._landingEligible = false;
      }
    } else this._stable = 0;

    const bounds = WORLD.bounds;
    if (c.x < bounds.minX || c.x > bounds.maxX || c.z < bounds.minZ || c.z > bounds.maxZ || c.y > 110) this._respawn(true);
    if (!this._crashCooldown && !c.wallRide) for (const truck of WORLD.trucks) {
      if (Math.abs(c.x - truck.x) < truck.width / 2 + 1.3 && Math.abs(c.z - truck.z) < truck.length / 2 + 1.8 && c.y < truck.height + .6) { this._respawn(true); break; }
    }
    if (this.score >= LEVELS[this.levelIndex].target && Object.values(this.objectives).every(Boolean)) {
      this.status = 'passed'; this._event('finish', 'ภารกิจสำเร็จ • ไก่เหนือโลก', this.score);
    } else if (this.timeLeft <= 0) { this.status = 'failed'; this._event('finish', 'หมดเวลา! ไก่ยังไม่ยอมแพ้', this.score); }
  }

  _checkRings(oldZ) {
    const c = this.car;
    WORLD.rings.forEach((ring, index) => {
      if (this.rings[index] || (oldZ - ring.z) * (c.z - ring.z) > 0 || oldZ === c.z) return;
      if (Math.hypot(c.x - ring.x, c.y - ring.y) < ring.radius) {
        this.rings[index] = true; this._award(`ring${index}`, `ลอดห่วง ${index + 1} • เอ้กอี๊เอ้ก!`, 1100);
        if (this.rings.filter(Boolean).length >= (this.levelIndex === 4 ? 1 : 3)) this._objective('rings');
      }
    });
  }
}
