/** One circular wall definition shared by the road mesh and vehicle trajectory. */
export const WALL_DEFAULTS = Object.freeze({ x: -28, z: -100, width: 16, radius: 14, entryZ: -83, wheelOffset: .6 });

export function wallPose(theta, wall = WALL_DEFAULTS) {
  const t = Math.max(0, Math.min(Math.PI, theta));
  const radius = wall.radius ?? WALL_DEFAULTS.radius;
  const entryZ = wall.entryZ ?? WALL_DEFAULTS.entryZ;
  const offset = wall.wheelOffset ?? WALL_DEFAULTS.wheelOffset;
  const sin = Math.sin(t), cos = Math.cos(t);
  const surface = { x: wall.x ?? WALL_DEFAULTS.x, y: radius * (1 - cos), z: entryZ - radius * sin };
  const normal = { x: 0, y: cos, z: sin };
  return { x: surface.x, y: surface.y + offset * cos, z: surface.z + offset * sin,
    yaw: 0, pitch: t, roll: 0, theta: t, surface, normal,
    tangent: { x: 0, y: sin, z: -cos } };
}
