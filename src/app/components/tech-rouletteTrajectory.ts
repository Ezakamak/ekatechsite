export type RouletteTrajectoryPlan = {
  targetAngleDeg: number;
  targetPocketCenterDeg: number;
  durationMs: number;
  lockMs: number;
  fixedStepMs: number;
  subSteps: number;
  initialAngularVelocityDegPerSecond: number;
  nonlinearDragCoefficient: number;
  preLockAngleDeg: number;
};

export type RouletteTrajectoryFrame = {
  angleDeg: number;
  radiusCss: string;
  scale: number;
};

const OUTER_RADIUS = "clamp(-12.55rem, -50vw, -9.15rem)";
const MID_RADIUS = "clamp(-10.75rem, -43vw, -7.85rem)";
const POCKET_RADIUS = "clamp(-9.25rem, -38vw, -6.65rem)";

export const ROULETTE_FIXED_STEP_MS = 1000 / 120;
export const ROULETTE_MAX_SUB_STEPS = 6;
export const ROULETTE_BEZIER_LOCK_MS = 500;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function cubicBezierY(t: number, y1: number, y2: number) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t;
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function buildInverseRouletteTrajectory({
  targetPocketCenterDeg,
  orbitTurns,
  durationMs,
}: {
  targetPocketCenterDeg: number;
  orbitTurns: number;
  durationMs: number;
}): RouletteTrajectoryPlan {
  const lockMs = Math.min(ROULETTE_BEZIER_LOCK_MS, durationMs * 0.2);
  const physicsMs = Math.max(1, durationMs - lockMs);
  const targetAngleDeg = 360 * orbitTurns + targetPocketCenterDeg;
  const preLockAngleDeg = targetAngleDeg - Math.min(18, 360 / 37);
  const nonlinearDragCoefficient = 4.85 / (physicsMs / 1000);
  const initialAngularVelocityDegPerSecond =
    (preLockAngleDeg * nonlinearDragCoefficient) /
    (1 - Math.exp(-nonlinearDragCoefficient * (physicsMs / 1000)));

  return {
    targetAngleDeg,
    targetPocketCenterDeg,
    durationMs,
    lockMs,
    fixedStepMs: ROULETTE_FIXED_STEP_MS,
    subSteps: ROULETTE_MAX_SUB_STEPS,
    initialAngularVelocityDegPerSecond,
    nonlinearDragCoefficient,
    preLockAngleDeg,
  };
}

export function sampleInverseRouletteTrajectory(
  plan: RouletteTrajectoryPlan,
  elapsedMs: number,
): RouletteTrajectoryFrame {
  const elapsed = clamp01(elapsedMs / plan.durationMs) * plan.durationMs;
  const physicsMs = plan.durationMs - plan.lockMs;

  if (elapsed >= physicsMs) {
    const lockProgress = clamp01((elapsed - physicsMs) / plan.lockMs);
    const smoothLock = cubicBezierY(lockProgress, 0.84, 1);
    return {
      angleDeg: mix(plan.preLockAngleDeg, plan.targetAngleDeg, smoothLock),
      radiusCss: POCKET_RADIUS,
      scale: mix(0.94, 0.9, smoothLock),
    };
  }

  const t = elapsed / 1000;
  const physicsSeconds = physicsMs / 1000;
  const drag = plan.nonlinearDragCoefficient;
  const normalizedDrag =
    (1 - Math.exp(-drag * t)) / (1 - Math.exp(-drag * physicsSeconds));
  const progress = clamp01(normalizedDrag);
  const speedRatio = Math.exp(-drag * t);
  const nonlinearFriction = 1 - 0.16 * speedRatio * speedRatio;
  const radiusProgress = Math.pow(progress * nonlinearFriction, 1.45);

  return {
    angleDeg: plan.preLockAngleDeg * progress,
    radiusCss: radiusProgress > 0.72 ? MID_RADIUS : OUTER_RADIUS,
    scale: mix(1, 0.94, radiusProgress),
  };
}
