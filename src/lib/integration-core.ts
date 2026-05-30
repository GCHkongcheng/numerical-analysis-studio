import { all, create } from "mathjs";

import type {
  IntegrationMethod,
  IntegrationNode,
  IntegrationOptions,
  IntegrationResult,
  IntegrationSample,
  IntegrationTableRow,
} from "@/types/integration";

const math = create(all, {});
const EPS = 1e-12;

type ScalarFunction = (x: number) => number;

function normalizeNearZero(value: number): number {
  return Math.abs(value) < EPS ? 0 : value;
}

export function formatIntegrationNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 1e-6)) {
    return value.toExponential(8);
  }
  return value.toFixed(12).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function createIntegrationFunction(expression: string): ScalarFunction {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error("函数表达式不能为空");
  const compiled = math.compile(trimmed);

  return (x: number) => {
    const value = compiled.evaluate({ x });
    if (typeof value === "number" && Number.isFinite(value)) return value;
    throw new Error("函数值不是有限实数");
  };
}

function validateInterval(start: number, end: number): [number, number] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
    throw new Error("积分区间端点必须是不同的有限实数");
  }
  return start < end ? [start, end] : [end, start];
}

function sanitizeSubdivisions(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value ?? 0) < 1) return fallback;
  return Math.floor(value as number);
}

function sampleFunction(fn: ScalarFunction, start: number, end: number, count: number): IntegrationSample[] {
  const safeCount = Math.max(24, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => {
    const x = start + ((end - start) * index) / (safeCount - 1);
    try {
      const y = fn(x);
      return { x, y: Number.isFinite(y) ? y : null };
    } catch {
      return { x, y: null };
    }
  });
}

function compositeTrapezoid(fn: ScalarFunction, start: number, end: number, subdivisions: number) {
  const n = sanitizeSubdivisions(subdivisions, 20);
  const h = (end - start) / n;
  const nodes: IntegrationNode[] = [];
  let sum = 0;

  for (let index = 0; index <= n; index += 1) {
    const x = start + index * h;
    const fx = fn(x);
    const weight = index === 0 || index === n ? 0.5 : 1;
    sum += weight * fx;
    nodes.push({ x, fx, weight });
  }

  return { value: normalizeNearZero(h * sum), nodes, subdivisions: n };
}

function compositeSimpson(fn: ScalarFunction, start: number, end: number, subdivisions: number) {
  let n = sanitizeSubdivisions(subdivisions, 20);
  if (n % 2 !== 0) n += 1;
  const h = (end - start) / n;
  const nodes: IntegrationNode[] = [];
  let sum = 0;

  for (let index = 0; index <= n; index += 1) {
    const x = start + index * h;
    const fx = fn(x);
    const weight = index === 0 || index === n ? 1 : index % 2 === 0 ? 2 : 4;
    sum += weight * fx;
    nodes.push({ x, fx, weight });
  }

  return { value: normalizeNearZero((h / 3) * sum), nodes, subdivisions: n };
}

function rombergIntegration(fn: ScalarFunction, start: number, end: number, levels: number) {
  const safeLevels = Math.max(2, Math.min(Math.floor(levels), 8));
  const table: number[][] = Array.from({ length: safeLevels }, () =>
    Array.from({ length: safeLevels }, () => 0)
  );

  for (let level = 0; level < safeLevels; level += 1) {
    const n = 2 ** level;
    table[level][0] = compositeTrapezoid(fn, start, end, n).value;
    for (let col = 1; col <= level; col += 1) {
      const factor = 4 ** col;
      table[level][col] =
        (factor * table[level][col - 1] - table[level - 1][col - 1]) / (factor - 1);
    }
  }

  const rows: IntegrationTableRow[] = table.map((row, level) => ({
    level,
    values: row.map((value, index) => (index <= level ? normalizeNearZero(value) : null)),
  }));
  const value = normalizeNearZero(table[safeLevels - 1][safeLevels - 1]);
  const previous = table[safeLevels - 2][safeLevels - 2];

  return {
    value,
    table: rows,
    subdivisions: 2 ** (safeLevels - 1),
    errorEstimate: Math.abs(value - previous),
  };
}

function gaussLegendreRule(count: number, start: number, end: number): Array<{ x: number; weight: number }> {
  const safeCount = Math.max(2, Math.min(Math.floor(count), 16));
  const eps = 1e-14;
  const halfCount = Math.floor((safeCount + 1) / 2);
  const mid = 0.5 * (start + end);
  const half = 0.5 * (end - start);
  const nodes = Array.from({ length: safeCount }, () => ({ x: 0, weight: 0 }));

  for (let index = 0; index < halfCount; index += 1) {
    let z = Math.cos((Math.PI * (index + 0.75)) / (safeCount + 0.5));
    let previousZ: number;
    let derivative = 0;

    do {
      let p1 = 1;
      let p2 = 0;
      for (let order = 1; order <= safeCount; order += 1) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * order - 1) * z * p2 - (order - 1) * p3) / order;
      }
      derivative = (safeCount * (z * p1 - p2)) / (z * z - 1);
      previousZ = z;
      z = previousZ - p1 / derivative;
    } while (Math.abs(z - previousZ) > eps);

    nodes[index] = {
      x: mid - half * z,
      weight: (2 * half) / ((1 - z * z) * derivative * derivative),
    };
    nodes[safeCount - 1 - index] = {
      x: mid + half * z,
      weight: nodes[index].weight,
    };
  }

  return nodes.sort((left, right) => left.x - right.x);
}

function gaussLegendreIntegration(fn: ScalarFunction, start: number, end: number, points: number) {
  const rule = gaussLegendreRule(points, start, end);
  const nodes = rule.map((node) => ({ ...node, fx: fn(node.x) }));
  const value = nodes.reduce((sum, node) => sum + (node.weight ?? 0) * node.fx, 0);
  return { value: normalizeNearZero(value), nodes, subdivisions: rule.length };
}

export function solveIntegration(options: IntegrationOptions): IntegrationResult {
  const interval = validateInterval(options.intervalStart, options.intervalEnd);
  const [start, end] = interval;
  const fn = createIntegrationFunction(options.expression);
  const sampleCount = options.sampleCount ?? 180;
  const method: IntegrationMethod = options.method;
  let solved: {
    value: number;
    nodes?: IntegrationNode[];
    table?: IntegrationTableRow[];
    subdivisions: number;
    errorEstimate?: number | null;
  };

  if (method === "trapezoid") {
    solved = compositeTrapezoid(fn, start, end, options.subdivisions ?? 20);
  } else if (method === "simpson") {
    solved = compositeSimpson(fn, start, end, options.subdivisions ?? 20);
  } else if (method === "romberg") {
    solved = rombergIntegration(fn, start, end, options.rombergLevels ?? 5);
  } else {
    solved = gaussLegendreIntegration(fn, start, end, options.gaussPoints ?? 8);
  }

  return {
    method,
    expression: options.expression,
    interval,
    value: solved.value,
    subdivisions: solved.subdivisions,
    samples: sampleFunction(fn, start, end, sampleCount),
    nodes: solved.nodes ?? [],
    table: solved.table,
    errorEstimate: solved.errorEstimate ?? null,
    message:
      method === "simpson" && (options.subdivisions ?? 20) % 2 !== 0
        ? "Simpson 复化公式要求偶数等分，已自动加 1"
        : undefined,
  };
}
