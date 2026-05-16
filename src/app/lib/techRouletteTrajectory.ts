const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_SECTOR_DEGREES = 360 / ROULETTE_WHEEL.length;
const DEFAULT_SPIN_SECONDS = 16;
const BEZIER_LOCK_SECONDS = 0.5;
const FIXED_TIMESTEP_SECONDS = 1 / 120;
const SUB_STEPS = 4;
const MAX_FRAME_CATCHUP_SECONDS = 0.12;
const BALL_ORBIT_TURNS = 7;
const NON_LINEAR_DRAG_FACTOR = 0.22;
const WHEEL_UV_LOCK_REVOLUTIONS = 3;

export type RouletteTrajectoryPlan = {
  targetNumber: number;
  targetAngle: number;
  pocketCenterAngle: number;
  wheelUvOffset: number;
  spinSeconds: number;
  fixedTimestepSeconds: number;
  subSteps: number;
  bezierLockSeconds: number;
  initialAngularVelocity: number;
  dragCoefficient: number;
  physicsEndAngle: number;
  physicsEndVelocity: number;
  bezierControlA: number;
  bezierControlB: number;
};

export type RouletteTrajectoryRuntime = {
  elapsed: number;
  accumulator: number;
  angle: number;
  angularVelocity: number;
  radius: number;
};

export type RouletteTrajectoryFrame = {
  angle: number;
  radius: number;
  progress: number;
  done: boolean;
};

function sectorCenterForNumber(winningNumber: number) {
  const wheelIndex = ROULETTE_WHEEL.indexOf(winningNumber);
  if (wheelIndex < 0) return WHEEL_SECTOR_DEGREES / 2;

  return wheelIndex * WHEEL_SECTOR_DEGREES + WHEEL_SECTOR_DEGREES / 2;
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const oneMinusT = 1 - t;
  return (
    oneMinusT * oneMinusT * oneMinusT * p0 +
    3 * oneMinusT * oneMinusT * t * p1 +
    3 * oneMinusT * t * t * p2 +
    t * t * t * p3
  );
}

function easeInOut(t: number) {
  return t * t * (3 - 2 * t);
}

function solveVelocityForLinearDrag(distance: number, drag: number, seconds: number) {
  const dragTravelRatio = (1 - Math.exp(-drag * seconds)) / drag;
  return distance / Math.max(0.001, dragTravelRatio);
}

function integrateNonLinearDrag(
  initialVelocity: number,
  drag: number,
  seconds: number,
  maxVelocity: number,
) {
  let angle = 0;
  let velocity = initialVelocity;
  const totalSteps = Math.ceil(seconds / (FIXED_TIMESTEP_SECONDS / SUB_STEPS));
  const dt = seconds / totalSteps;

  for (let index = 0; index < totalSteps; index += 1) {
    const speedRatio = Math.min(1.8, Math.abs(velocity) / Math.max(1, maxVelocity));
    const dragForce = drag * velocity * (1 + NON_LINEAR_DRAG_FACTOR * speedRatio * speedRatio);
    velocity -= dragForce * dt;
    angle += velocity * dt;
  }

  return { angle, velocity };
}

function fitInverseTrajectory(distance: number, seconds: number, seed: number) {
  let drag = 0.1 + (seed % 17) * 0.003;
  let velocity = solveVelocityForLinearDrag(distance, drag, seconds);

  for (let pass = 0; pass < 5; pass += 1) {
    const simulated = integrateNonLinearDrag(velocity, drag, seconds, Math.abs(velocity));
    const correction = distance / Math.max(1, simulated.angle);
    velocity *= correction;
    drag = Math.max(0.045, Math.min(0.18, drag * (1 + (1 - correction) * 0.08)));
  }

  const fitted = integrateNonLinearDrag(velocity, drag, seconds, Math.abs(velocity));
  return { velocity, drag, fittedAngle: fitted.angle, fittedVelocity: fitted.velocity };
}

export function createRouletteTrajectoryPlan(
  winningNumber: number,
  spinSeconds = DEFAULT_SPIN_SECONDS,
): RouletteTrajectoryPlan {
  const pocketCenterAngle = sectorCenterForNumber(winningNumber);
  const targetAngle = pocketCenterAngle - 360 * BALL_ORBIT_TURNS;
  const lockSeconds = Math.min(BEZIER_LOCK_SECONDS, spinSeconds * 0.2);
  const physicsSeconds = Math.max(FIXED_TIMESTEP_SECONDS, spinSeconds - lockSeconds);
  const visualSeed = Math.abs(Math.floor(winningNumber * 131 + pocketCenterAngle * 17));
  const lockApproachDegrees = 18 + (visualSeed % 7);
  const physicsDistance = targetAngle + lockApproachDegrees;
  const fitted = fitInverseTrajectory(physicsDistance, physicsSeconds, visualSeed);
  const wheelUvOffset = -(
    pocketCenterAngle / 360 + WHEEL_UV_LOCK_REVOLUTIONS
  );

  return {
    targetNumber: winningNumber,
    targetAngle,
    pocketCenterAngle,
    wheelUvOffset,
    spinSeconds,
    fixedTimestepSeconds: FIXED_TIMESTEP_SECONDS,
    subSteps: SUB_STEPS,
    bezierLockSeconds: lockSeconds,
    initialAngularVelocity: fitted.velocity,
    dragCoefficient: fitted.drag,
    physicsEndAngle: fitted.fittedAngle,
    physicsEndVelocity: fitted.fittedVelocity,
    bezierControlA: fitted.fittedAngle + fitted.fittedVelocity * lockSeconds * 0.18,
    bezierControlB: targetAngle + lockApproachDegrees * 0.22,
  };
}

export function createRouletteTrajectoryRuntime(plan: RouletteTrajectoryPlan): RouletteTrajectoryRuntime {
  return {
    elapsed: 0,
    accumulator: 0,
    angle: 0,
    angularVelocity: plan.initialAngularVelocity,
    radius: 1,
  };
}

function stepPhysics(plan: RouletteTrajectoryPlan, runtime: RouletteTrajectoryRuntime, dt: number) {
  const subDt = dt / plan.subSteps;

  for (let index = 0; index < plan.subSteps; index += 1) {
    const speedRatio = Math.min(
      1.8,
      Math.abs(runtime.angularVelocity) / Math.max(1, Math.abs(plan.initialAngularVelocity)),
    );
    const dragForce =
      plan.dragCoefficient *
      runtime.angularVelocity *
      (1 + NON_LINEAR_DRAG_FACTOR * speedRatio * speedRatio);

    runtime.angularVelocity -= dragForce * subDt;
    runtime.angle += runtime.angularVelocity * subDt;
  }
}

function radiusForProgress(progress: number) {
  if (progress < 0.58) return 1;
  if (progress < 0.88) return 1 - easeInOut((progress - 0.58) / 0.3) * 0.14;
  return 0.86 - easeInOut((progress - 0.88) / 0.12) * 0.08;
}

export function advanceRouletteTrajectory(
  plan: RouletteTrajectoryPlan,
  runtime: RouletteTrajectoryRuntime,
  frameDeltaSeconds: number,
): RouletteTrajectoryFrame {
  const frameDelta = Math.min(Math.max(frameDeltaSeconds, 0), MAX_FRAME_CATCHUP_SECONDS);
  const physicsEndSeconds = plan.spinSeconds - plan.bezierLockSeconds;
  runtime.accumulator += frameDelta;

  while (
    runtime.accumulator >= plan.fixedTimestepSeconds &&
    runtime.elapsed < physicsEndSeconds
  ) {
    const remainingPhysics = physicsEndSeconds - runtime.elapsed;
    const dt = Math.min(plan.fixedTimestepSeconds, remainingPhysics);
    stepPhysics(plan, runtime, dt);
    runtime.elapsed += dt;
    runtime.accumulator -= plan.fixedTimestepSeconds;
  }

  if (runtime.elapsed >= physicsEndSeconds) {
    runtime.elapsed = Math.min(plan.spinSeconds, runtime.elapsed + runtime.accumulator);
    runtime.accumulator = 0;
    const lockT = Math.min(
      1,
      Math.max(0, (runtime.elapsed - physicsEndSeconds) / plan.bezierLockSeconds),
    );
    runtime.angle = cubicBezier(
      plan.physicsEndAngle,
      plan.bezierControlA,
      plan.bezierControlB,
      plan.targetAngle,
      easeInOut(lockT),
    );
  }

  const progress = Math.min(1, runtime.elapsed / plan.spinSeconds);
  runtime.radius = radiusForProgress(progress);

  return {
    angle: runtime.angle,
    radius: runtime.radius,
    progress,
    done: progress >= 1,
  };
}
