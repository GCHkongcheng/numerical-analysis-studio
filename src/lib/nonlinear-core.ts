import { all, create } from "mathjs";

import type {
  FunctionSample,
  RootIterationRecord,
  RootMethod,
  RootSolveOptions,
  RootSolveResult,
} from "@/types/nonlinear";

const math = create(all, {});

const EPS = 1e-12;
const DEFAULT_TOLERANCE = 1e-8;
const DEFAULT_MAX_ITERATIONS = 80;
const MAX_DAMPING_HALVES = 24;

type ScalarFunction = (x: number) => number;

function normalizeNearZero(value: number): number {
  return Math.abs(value) < EPS ? 0 : value;
}

function finiteOrThrow(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`${label} 的计算结果不是有限实数`);
}

export function createScalarFunction(expression: string): ScalarFunction {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new Error("函数表达式不能为空");
  }

  const compiled = math.compile(trimmed);
  return (x: number) => finiteOrThrow(compiled.evaluate({ x }), "函数");
}

function createDerivativeFunction(expression: string): ScalarFunction {
  const derivative = math.derivative(expression, "x").compile();
  return (x: number) => finiteOrThrow(derivative.evaluate({ x }), "导函数");
}

function sanitizeTolerance(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value as number : DEFAULT_TOLERANCE;
}

function sanitizeMaxIterations(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) >= 1
    ? Math.floor(value as number)
    : DEFAULT_MAX_ITERATIONS;
}

function pushRecord(
  history: RootIterationRecord[],
  record: RootIterationRecord
): void {
  history.push({
    ...record,
    x: normalizeNearZero(record.x),
    fx: normalizeNearZero(record.fx),
    error: record.error === null ? null : normalizeNearZero(record.error),
  });
}

function finishResult(
  method: RootMethod,
  history: RootIterationRecord[],
  converged: boolean,
  message?: string
): RootSolveResult {
  const tail = history[history.length - 1];
  const residual = tail ? Math.abs(tail.fx) : Number.POSITIVE_INFINITY;

  return {
    method,
    converged,
    root: converged && tail ? tail.x : tail?.x ?? null,
    iterations: Math.max(0, tail?.iteration ?? 0),
    residual,
    history,
    message,
  };
}

function requireNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value as number : fallback;
}

function solveFixedPoint(
  f: ScalarFunction,
  g: ScalarFunction,
  options: Required<Pick<RootSolveOptions, "method">> & RootSolveOptions
): RootSolveResult {
  const tolerance = sanitizeTolerance(options.tolerance);
  const maxIterations = sanitizeMaxIterations(options.maxIterations);
  let current = requireNumber(options.x0, 1);
  const history: RootIterationRecord[] = [];

  pushRecord(history, {
    iteration: 0,
    x: current,
    fx: f(current),
    error: null,
  });

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const next = g(current);
    const fx = f(next);
    const error = Math.abs(next - current);

    pushRecord(history, { iteration, x: next, fx, error });

    if (Math.abs(fx) <= tolerance || error <= tolerance) {
      return finishResult(options.method, history, true, "迭代已满足容差要求");
    }

    current = next;
  }

  return finishResult(options.method, history, false, "达到最大迭代次数后仍未收敛");
}

function solveSteffensen(
  f: ScalarFunction,
  g: ScalarFunction,
  options: Required<Pick<RootSolveOptions, "method">> & RootSolveOptions
): RootSolveResult {
  const tolerance = sanitizeTolerance(options.tolerance);
  const maxIterations = sanitizeMaxIterations(options.maxIterations);
  let current = requireNumber(options.x0, 1);
  const history: RootIterationRecord[] = [];

  pushRecord(history, {
    iteration: 0,
    x: current,
    fx: f(current),
    error: null,
  });

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const x1 = g(current);
    const x2 = g(x1);
    const denominator = x2 - 2 * x1 + current;

    if (Math.abs(denominator) < EPS) {
      return finishResult(options.method, history, false, "Steffensen 分母过小，迭代提前停止");
    }

    const next = current - ((x1 - current) ** 2) / denominator;
    const fx = f(next);
    const error = Math.abs(next - current);
    pushRecord(history, { iteration, x: next, fx, error });

    if (Math.abs(fx) <= tolerance || error <= tolerance) {
      return finishResult(options.method, history, true, "Steffensen 加速迭代已收敛");
    }

    current = next;
  }

  return finishResult(options.method, history, false, "达到最大迭代次数后仍未收敛");
}

function solveNewtonLike(
  f: ScalarFunction,
  df: ScalarFunction,
  options: Required<Pick<RootSolveOptions, "method">> & RootSolveOptions
): RootSolveResult {
  const tolerance = sanitizeTolerance(options.tolerance);
  const maxIterations = sanitizeMaxIterations(options.maxIterations);
  let current = requireNumber(options.x0, 1);
  const history: RootIterationRecord[] = [];

  pushRecord(history, {
    iteration: 0,
    x: current,
    fx: f(current),
    error: null,
  });

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const currentFx = f(current);
    const derivative = df(current);
    if (Math.abs(derivative) < EPS) {
      return finishResult(options.method, history, false, "导数过小，无法稳定执行牛顿步");
    }

    const step = -currentFx / derivative;
    let lambda = 1;
    let next = current + step;
    let nextFx = f(next);

    if (options.method === "dampedNewton") {
      while (
        Math.abs(nextFx) >= Math.abs(currentFx) &&
        lambda > 2 ** -MAX_DAMPING_HALVES
      ) {
        lambda /= 2;
        next = current + lambda * step;
        nextFx = f(next);
      }

      if (Math.abs(nextFx) >= Math.abs(currentFx) && Math.abs(currentFx) > tolerance) {
        return finishResult(options.method, history, false, "下山搜索未找到能降低残差的步长");
      }
    }

    const error = Math.abs(next - current);
    pushRecord(history, { iteration, x: next, fx: nextFx, error, lambda });

    if (Math.abs(nextFx) <= tolerance || error <= tolerance) {
      return finishResult(
        options.method,
        history,
        true,
        options.method === "dampedNewton" ? "牛顿下山法已收敛" : "牛顿迭代已收敛"
      );
    }

    current = next;
  }

  return finishResult(options.method, history, false, "达到最大迭代次数后仍未收敛");
}

function solveBisection(
  f: ScalarFunction,
  options: Required<Pick<RootSolveOptions, "method">> & RootSolveOptions
): RootSolveResult {
  const tolerance = sanitizeTolerance(options.tolerance);
  const maxIterations = sanitizeMaxIterations(options.maxIterations);
  let left = requireNumber(options.intervalStart, 0);
  let right = requireNumber(options.intervalEnd, 2);

  if (left === right) {
    return finishResult(options.method, [], false, "区间端点不能相同");
  }

  if (left > right) {
    [left, right] = [right, left];
  }

  let fLeft = f(left);
  const fRight = f(right);

  if (Math.abs(fLeft) <= tolerance) {
    return finishResult(options.method, [{ iteration: 0, x: left, fx: fLeft, error: null, interval: [left, right] }], true);
  }

  if (Math.abs(fRight) <= tolerance) {
    return finishResult(options.method, [{ iteration: 0, x: right, fx: fRight, error: null, interval: [left, right] }], true);
  }

  if (fLeft * fRight > 0) {
    return finishResult(options.method, [], false, "二分法要求 f(a) 与 f(b) 异号");
  }

  const history: RootIterationRecord[] = [];
  let previousMid: number | null = null;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const mid = (left + right) / 2;
    const fMid = f(mid);
    const error = previousMid === null ? Math.abs(right - left) / 2 : Math.abs(mid - previousMid);

    pushRecord(history, {
      iteration,
      x: mid,
      fx: fMid,
      error,
      interval: [left, right],
    });

    if (Math.abs(fMid) <= tolerance || Math.abs(right - left) / 2 <= tolerance) {
      return finishResult(options.method, history, true, "二分区间已压缩到容差范围内");
    }

    if (fLeft * fMid < 0) {
      right = mid;
    } else {
      left = mid;
      fLeft = fMid;
    }
    previousMid = mid;
  }

  return finishResult(options.method, history, false, "达到最大迭代次数后仍未收敛");
}

function solveSecant(
  f: ScalarFunction,
  options: Required<Pick<RootSolveOptions, "method">> & RootSolveOptions
): RootSolveResult {
  const tolerance = sanitizeTolerance(options.tolerance);
  const maxIterations = sanitizeMaxIterations(options.maxIterations);
  let previous = requireNumber(options.x0, 0);
  let current = requireNumber(options.x1, 1);
  let previousFx = f(previous);
  let currentFx = f(current);
  const history: RootIterationRecord[] = [];

  pushRecord(history, { iteration: 0, x: previous, fx: previousFx, error: null });
  pushRecord(history, { iteration: 1, x: current, fx: currentFx, error: Math.abs(current - previous) });

  for (let iteration = 2; iteration <= maxIterations; iteration += 1) {
    const denominator = currentFx - previousFx;
    if (Math.abs(denominator) < EPS) {
      return finishResult(options.method, history, false, "割线法分母过小，迭代提前停止");
    }

    const next = current - currentFx * (current - previous) / denominator;
    const nextFx = f(next);
    const error = Math.abs(next - current);
    pushRecord(history, { iteration, x: next, fx: nextFx, error });

    if (Math.abs(nextFx) <= tolerance || error <= tolerance) {
      return finishResult(options.method, history, true, "割线法已收敛");
    }

    previous = current;
    previousFx = currentFx;
    current = next;
    currentFx = nextFx;
  }

  return finishResult(options.method, history, false, "达到最大迭代次数后仍未收敛");
}

export function solveRoot(options: RootSolveOptions): RootSolveResult {
  try {
    const method = options.method;
    const f = createScalarFunction(options.fExpression);

    if (method === "fixedPoint" || method === "steffensen") {
      const g = createScalarFunction(options.gExpression ?? "");
      return method === "fixedPoint"
        ? solveFixedPoint(f, g, { ...options, method })
        : solveSteffensen(f, g, { ...options, method });
    }

    if (method === "newton" || method === "dampedNewton") {
      const df = createDerivativeFunction(options.fExpression);
      return solveNewtonLike(f, df, { ...options, method });
    }

    if (method === "bisection") {
      return solveBisection(f, { ...options, method });
    }

    return solveSecant(f, { ...options, method });
  } catch (error) {
    return {
      method: options.method,
      converged: false,
      root: null,
      iterations: 0,
      residual: Number.POSITIVE_INFINITY,
      history: [],
      message: error instanceof Error ? error.message : "表达式解析失败",
    };
  }
}

export function formatRootNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1e5 || (Math.abs(value) > 0 && Math.abs(value) < 1e-5)) {
    return value.toExponential(6);
  }
  return value.toFixed(10).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function sampleFunction(
  expression: string,
  minX: number,
  maxX: number,
  count = 160
): FunctionSample[] {
  try {
    const f = createScalarFunction(expression);
    const left = Number.isFinite(minX) ? minX : -5;
    const right = Number.isFinite(maxX) && maxX > left ? maxX : left + 10;
    const steps = Math.max(12, count);

    return Array.from({ length: steps }, (_, index) => {
      const x = left + (right - left) * (index / (steps - 1));
      try {
        const y = f(x);
        return { x, y: Number.isFinite(y) ? y : null };
      } catch {
        return { x, y: null };
      }
    });
  } catch {
    return [];
  }
}
