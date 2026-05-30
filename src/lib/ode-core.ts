import { all, create } from "mathjs";

import type { OdeMethod, OdeResult, OdeSolveOptions, OdeStep } from "@/types/ode";

const math = create(all, {});
const EPS = 1e-12;
const MAX_STEPS = 5000;

type OdeFunction = (x: number, y: number) => number;
type ExactFunction = (x: number) => number;

function normalizeNearZero(value: number): number {
  return Math.abs(value) < EPS ? 0 : value;
}

export function formatOdeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 1e-6)) {
    return value.toExponential(8);
  }
  return value.toFixed(12).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function createOdeFunction(expression: string): OdeFunction {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error("微分方程右端 f(x,y) 不能为空");
  const compiled = math.compile(trimmed);
  return (x: number, y: number) => {
    const value = compiled.evaluate({ x, y });
    if (typeof value === "number" && Number.isFinite(value)) return value;
    throw new Error("f(x,y) 的计算结果不是有限实数");
  };
}

function createExactFunction(expression?: string): ExactFunction | null {
  const trimmed = expression?.trim();
  if (!trimmed) return null;
  const compiled = math.compile(trimmed);
  return (x: number) => {
    const value = compiled.evaluate({ x });
    if (typeof value === "number" && Number.isFinite(value)) return value;
    throw new Error("精确解 y(x) 的计算结果不是有限实数");
  };
}

function methodStep(method: OdeMethod, fn: OdeFunction, x: number, y: number, h: number): number {
  if (method === "euler") {
    return y + h * fn(x, y);
  }

  if (method === "improvedEuler") {
    const k1 = fn(x, y);
    const predictor = y + h * k1;
    const k2 = fn(x + h, predictor);
    return y + (h / 2) * (k1 + k2);
  }

  if (method === "midpoint") {
    const k1 = fn(x, y);
    const k2 = fn(x + h / 2, y + (h / 2) * k1);
    return y + h * k2;
  }

  const k1 = fn(x, y);
  const k2 = fn(x + h / 2, y + (h / 2) * k1);
  const k3 = fn(x + h / 2, y + (h / 2) * k2);
  const k4 = fn(x + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

function buildStep(
  index: number,
  x: number,
  y: number,
  slope: number,
  exactFn: ExactFunction | null
): OdeStep {
  const exact = exactFn ? exactFn(x) : null;
  return {
    index,
    x: normalizeNearZero(x),
    y: normalizeNearZero(y),
    exact: exact === null ? null : normalizeNearZero(exact),
    error: exact === null ? null : normalizeNearZero(Math.abs(y - exact)),
    slope: normalizeNearZero(slope),
  };
}

export function solveOde(options: OdeSolveOptions): OdeResult {
  const { method, expression, exactExpression } = options;
  const fn = createOdeFunction(expression);
  const exactFn = createExactFunction(exactExpression);

  if (!Number.isFinite(options.x0) || !Number.isFinite(options.y0) || !Number.isFinite(options.xEnd)) {
    throw new Error("初值和终点必须是有限实数");
  }

  if (!Number.isFinite(options.stepSize) || Math.abs(options.stepSize) < EPS) {
    throw new Error("步长 h 必须是非零有限实数");
  }

  const direction = options.xEnd >= options.x0 ? 1 : -1;
  const hAbs = Math.abs(options.stepSize);
  let h = direction * hAbs;
  let x = options.x0;
  let y = options.y0;
  const totalDistance = Math.abs(options.xEnd - options.x0);
  const nominalSteps = Math.ceil(totalDistance / hAbs - EPS);
  if (nominalSteps > MAX_STEPS) {
    throw new Error(`步数过多（>${MAX_STEPS}），请增大步长`);
  }

  const steps: OdeStep[] = [buildStep(0, x, y, fn(x, y), exactFn)];
  let message: string | undefined;

  for (let index = 1; index <= nominalSteps; index += 1) {
    const remaining = options.xEnd - x;
    if (Math.abs(remaining) < EPS) break;
    if (Math.abs(remaining) < Math.abs(h)) {
      h = remaining;
      message = "最后一步已自动缩短以到达终点";
    }

    y = methodStep(method, fn, x, y, h);
    x += h;
    steps.push(buildStep(index, x, y, fn(x, y), exactFn));
  }

  const errors = steps
    .map((step) => step.error)
    .filter((value): value is number => value !== null && value !== undefined);

  return {
    method,
    expression,
    exactExpression: exactExpression?.trim() || undefined,
    x0: options.x0,
    y0: options.y0,
    xEnd: options.xEnd,
    stepSize: hAbs,
    steps,
    maxError: errors.length ? Math.max(...errors) : null,
    message,
  };
}
