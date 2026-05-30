import { all, create } from "mathjs";

import type {
  ApproximationMetrics,
  ApproximationOptions,
  ApproximationResidual,
  ApproximationResult,
  ApproximationSample,
  CurveSeries,
  DataPoint,
  FunctionExperimentKind,
  FunctionExperimentMetric,
  FunctionExperimentOptions,
  FunctionExperimentResult,
  SplineSegment,
} from "@/types/approximation";

const math = create(all, {});
const EPS = 1e-12;

const SERIES_COLORS = {
  truth: "#0f172a",
  lagrange: "#2563eb",
  newton: "#ea580c",
  least: "#16a34a",
  remez: "#7c3aed",
  c1: "#0891b2",
  c2: "#be123c",
  c3: "#9333ea",
};

function normalizeNearZero(value: number): number {
  return Math.abs(value) < EPS ? 0 : value;
}

function addPolynomials(left: number[], right: number[]): number[] {
  const size = Math.max(left.length, right.length);
  return Array.from({ length: size }, (_, index) =>
    normalizeNearZero((left[index] ?? 0) + (right[index] ?? 0))
  );
}

function multiplyPolynomials(left: number[], right: number[]): number[] {
  const result = Array.from({ length: left.length + right.length - 1 }, () => 0);

  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      result[i + j] += left[i] * right[j];
    }
  }

  return result.map(normalizeNearZero);
}

function scalePolynomial(poly: number[], scalar: number): number[] {
  return poly.map((value) => normalizeNearZero(value * scalar));
}

function derivativePolynomial(poly: number[]): number[] {
  if (poly.length <= 1) return [0];
  return poly.slice(1).map((value, index) => normalizeNearZero(value * (index + 1)));
}

export function evaluatePolynomial(coefficients: number[], x: number): number {
  let result = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    result = result * x + coefficients[index];
  }
  return normalizeNearZero(result);
}

export function formatApproxNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1e5 || (Math.abs(value) > 0 && Math.abs(value) < 1e-5)) {
    return value.toExponential(6);
  }
  return value.toFixed(10).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatPolynomial(coefficients: number[]): string {
  const terms: string[] = [];

  coefficients.forEach((coefficient, degree) => {
    if (Math.abs(coefficient) < EPS) return;
    const abs = Math.abs(coefficient);
    const value = formatApproxNumber(abs);
    const variable =
      degree === 0 ? "" : degree === 1 ? "x" : `x^${degree}`;
    const body =
      degree === 0
        ? value
        : Math.abs(abs - 1) < 1e-10
          ? variable
          : `${value}*${variable}`;
    const sign = coefficient < 0 ? "-" : "+";
    terms.push(`${sign} ${body}`);
  });

  if (!terms.length) return "0";
  return terms.join(" ").replace(/^\+ /, "");
}

function preparePoints(points: DataPoint[]): DataPoint[] {
  const clean = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: point.x,
      y: point.y,
      derivative: Number.isFinite(point.derivative) ? point.derivative : undefined,
    }))
    .sort((left, right) => left.x - right.x);

  if (clean.length < 2) {
    throw new Error("至少需要 2 个有效数据点");
  }

  for (let index = 1; index < clean.length; index += 1) {
    if (Math.abs(clean[index].x - clean[index - 1].x) < EPS) {
      throw new Error("x 节点不能重复");
    }
  }

  return clean;
}

function calculateMetrics(
  points: DataPoint[],
  predict: (x: number) => number | null
): { residuals: ApproximationResidual[]; metrics: ApproximationMetrics } {
  const residuals = points.map((point) => {
    const predicted = predict(point.x) ?? Number.NaN;
    return {
      x: point.x,
      y: point.y,
      predicted,
      residual: normalizeNearZero(point.y - predicted),
    };
  });

  const sse = residuals.reduce((sum, item) => sum + item.residual ** 2, 0);
  const meanY = points.reduce((sum, item) => sum + item.y, 0) / points.length;
  const sst = points.reduce((sum, item) => sum + (item.y - meanY) ** 2, 0);

  return {
    residuals,
    metrics: {
      sse: normalizeNearZero(sse),
      mse: normalizeNearZero(sse / points.length),
      rmse: normalizeNearZero(Math.sqrt(sse / points.length)),
      r2: sst < EPS ? null : normalizeNearZero(1 - sse / sst),
    },
  };
}

function sampleRange(points: DataPoint[]): { minX: number; maxX: number } {
  const min = points[0].x;
  const max = points[points.length - 1].x;
  const span = Math.max(max - min, 1);
  return { minX: min - span * 0.08, maxX: max + span * 0.08 };
}

function sampleApproximation(
  points: DataPoint[],
  predict: (x: number) => number | null,
  count = 180
): ApproximationSample[] {
  const { minX, maxX } = sampleRange(points);
  return Array.from({ length: count }, (_, index) => {
    const x = minX + (maxX - minX) * (index / (count - 1));
    const y = predict(x);
    return { x, y: y !== null && Number.isFinite(y) ? y : null };
  });
}

export function createApproximationFunction(expression: string): (x: number) => number {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error("函数表达式不能为空");
  const compiled = math.compile(trimmed);

  return (x: number) => {
    const value = compiled.evaluate({ x });
    if (typeof value === "number" && Number.isFinite(value)) return value;
    throw new Error("函数值不是有限实数");
  };
}

export function linspace(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start];
  return Array.from(
    { length: count },
    (_, index) => start + ((end - start) * index) / (count - 1)
  );
}

export function uniformNodes(parts: number, start: number, end: number): number[] {
  return linspace(start, end, Math.max(1, Math.floor(parts)) + 1);
}

export function chebyshevZeros(count: number, start: number, end: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const mid = (start + end) / 2;
  const half = (end - start) / 2;

  return Array.from({ length: safeCount }, (_, index) => {
    const t = Math.cos(((2 * index + 1) * Math.PI) / (2 * safeCount));
    return mid + half * t;
  }).sort((left, right) => left - right);
}

export function pointsFromFunction(
  expression: string,
  xs: number[]
): DataPoint[] {
  const fn = createApproximationFunction(expression);
  return xs.map((x) => ({ x, y: fn(x) }));
}

function barycentricWeights(xs: number[]): number[] {
  return xs.map((x, index) => {
    let product = 1;
    for (let other = 0; other < xs.length; other += 1) {
      if (index !== other) product *= x - xs[other];
    }
    if (Math.abs(product) < 1e-300) {
      throw new Error("插值节点过近，无法稳定计算");
    }
    return 1 / product;
  });
}

function lagrangeEvaluator(points: DataPoint[]): (x: number) => number {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const weights = barycentricWeights(xs);

  return (x: number) => {
    let numerator = 0;
    let denominator = 0;
    for (let index = 0; index < xs.length; index += 1) {
      const diff = x - xs[index];
      if (Math.abs(diff) < EPS) return ys[index];
      const term = weights[index] / diff;
      numerator += term * ys[index];
      denominator += term;
    }
    return normalizeNearZero(numerator / denominator);
  };
}

function newtonCoefficientsForPoints(points: DataPoint[]): number[] {
  const xs = points.map((point) => point.x);
  const coeffs = points.map((point) => point.y);
  for (let order = 1; order < points.length; order += 1) {
    for (let index = points.length - 1; index >= order; index -= 1) {
      coeffs[index] =
        (coeffs[index] - coeffs[index - 1]) / (xs[index] - xs[index - order]);
    }
  }
  return coeffs.map(normalizeNearZero);
}

function newtonEvaluatorForPoints(points: DataPoint[], coeffs: number[]): (x: number) => number {
  const xs = points.map((point) => point.x);
  return (x: number) => {
    let value = coeffs[coeffs.length - 1];
    for (let index = coeffs.length - 2; index >= 0; index -= 1) {
      value = value * (x - xs[index]) + coeffs[index];
    }
    return normalizeNearZero(value);
  };
}

function solveLagrange(points: DataPoint[]): {
  coefficients: number[];
  expression: string;
} {
  let coefficients = [0];

  points.forEach((point, index) => {
    let basis = [1];
    let denominator = 1;

    points.forEach((other, otherIndex) => {
      if (index === otherIndex) return;
      basis = multiplyPolynomials(basis, [-other.x, 1]);
      denominator *= point.x - other.x;
    });

    coefficients = addPolynomials(
      coefficients,
      scalePolynomial(basis, point.y / denominator)
    );
  });

  return {
    coefficients,
    expression: `P(x) = ${formatPolynomial(coefficients)}`,
  };
}

function buildDividedDifferenceTable(points: DataPoint[]): Array<Array<number | null>> {
  const size = points.length;
  const table: Array<Array<number | null>> = Array.from({ length: size }, () =>
    Array.from({ length: size }, (): number | null => null)
  );

  for (let row = 0; row < size; row += 1) {
    table[row][0] = points[row].y;
  }

  for (let col = 1; col < size; col += 1) {
    for (let row = 0; row < size - col; row += 1) {
      const numerator = (table[row + 1][col - 1] ?? 0) - (table[row][col - 1] ?? 0);
      const denominator = points[row + col].x - points[row].x;
      table[row][col] = normalizeNearZero(numerator / denominator);
    }
  }

  return table;
}

function solveNewton(points: DataPoint[]): {
  coefficients: number[];
  dividedDifferenceTable: Array<Array<number | null>>;
  expression: string;
} {
  const table = buildDividedDifferenceTable(points);
  let coefficients = [0];
  let basis = [1];

  for (let order = 0; order < points.length; order += 1) {
    coefficients = addPolynomials(
      coefficients,
      scalePolynomial(basis, table[0][order] ?? 0)
    );
    basis = multiplyPolynomials(basis, [-points[order].x, 1]);
  }

  const newtonTerms = points
    .map((point, order) => {
      const coefficient = table[0][order] ?? 0;
      if (order === 0) return formatApproxNumber(coefficient);
      const factors = points
        .slice(0, order)
        .map((factorPoint) => `(x - ${formatApproxNumber(factorPoint.x)})`)
        .join("*");
      return `${formatApproxNumber(coefficient)}*${factors}`;
    })
    .join(" + ");

  return {
    coefficients,
    dividedDifferenceTable: table,
    expression: `P(x) = ${newtonTerms}`,
  };
}

function evaluatePiecewiseLinear(points: DataPoint[], x: number): number | null {
  if (x < points[0].x - EPS || x > points[points.length - 1].x + EPS) {
    return null;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (x >= left.x - EPS && x <= right.x + EPS) {
      const ratio = (x - left.x) / (right.x - left.x);
      return normalizeNearZero(left.y + ratio * (right.y - left.y));
    }
  }

  return null;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < size; col += 1) {
    let pivotRow = col;
    let pivotAbs = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < size; row += 1) {
      const candidate = Math.abs(augmented[row][col]);
      if (candidate > pivotAbs) {
        pivotAbs = candidate;
        pivotRow = row;
      }
    }

    if (pivotAbs < EPS) return null;

    if (pivotRow !== col) {
      [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];
    }

    const pivot = augmented[col][col];
    for (let c = col; c <= size; c += 1) {
      augmented[col][c] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let c = col; c <= size; c += 1) {
        augmented[row][c] -= factor * augmented[col][c];
      }
    }
  }

  return augmented.map((row) => normalizeNearZero(row[size]));
}

function solveLeastSquares(points: DataPoint[], degree: number): {
  coefficients: number[];
  normalMatrix: number[][];
  expression: string;
} {
  const safeDegree = Math.max(0, Math.min(Math.floor(degree), points.length - 1));
  const size = safeDegree + 1;
  const sums = Array.from({ length: size * 2 - 1 }, (_, power) =>
    points.reduce((sum, point) => sum + point.x ** power, 0)
  );

  const normalMatrix = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => sums[row + col])
  );
  const rhs = Array.from({ length: size }, (_, row) =>
    points.reduce((sum, point) => sum + point.y * point.x ** row, 0)
  );
  const coefficients = solveLinearSystem(normalMatrix, rhs);

  if (!coefficients) {
    throw new Error("正规方程奇异，无法完成最小二乘拟合");
  }

  return {
    coefficients,
    normalMatrix: normalMatrix.map((row, index) => [...row, rhs[index]]),
    expression: `p_${safeDegree}(x) = ${formatPolynomial(coefficients)}`,
  };
}

function gaussLegendre(count: number, start: number, end: number): {
  x: number[];
  w: number[];
} {
  const eps = 1e-14;
  const halfCount = Math.floor((count + 1) / 2);
  const mid = 0.5 * (end + start);
  const half = 0.5 * (end - start);
  const x = Array.from({ length: count }, () => 0);
  const w = Array.from({ length: count }, () => 0);

  for (let index = 0; index < halfCount; index += 1) {
    let z = Math.cos((Math.PI * (index + 0.75)) / (count + 0.5));
    let previousZ: number;
    let derivative = 0;

    do {
      let p1 = 1;
      let p2 = 0;
      for (let order = 1; order <= count; order += 1) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * order - 1) * z * p2 - (order - 1) * p3) / order;
      }
      derivative = (count * (z * p1 - p2)) / (z * z - 1);
      previousZ = z;
      z = previousZ - p1 / derivative;
    } while (Math.abs(z - previousZ) > eps);

    x[index] = mid - half * z;
    x[count - 1 - index] = mid + half * z;
    w[index] = (2 * half) / ((1 - z * z) * derivative * derivative);
    w[count - 1 - index] = w[index];
  }

  return { x, w };
}

function continuousLeastSquaresApproximation(
  fn: (x: number) => number,
  start: number,
  end: number,
  degree: number
): { coefficients: number[]; evaluate: (x: number) => number } {
  const safeDegree = Math.max(0, Math.floor(degree));
  const order = safeDegree + 1;
  const quad = gaussLegendre(140, start, end);
  const matrix = Array.from({ length: order }, () =>
    Array.from({ length: order }, () => 0)
  );
  const rhs = Array.from({ length: order }, () => 0);

  for (let q = 0; q < quad.x.length; q += 1) {
    const x = quad.x[q];
    const weight = quad.w[q];
    const powers = Array.from({ length: 2 * safeDegree + 1 }, () => 1);
    for (let power = 1; power < powers.length; power += 1) {
      powers[power] = powers[power - 1] * x;
    }

    const fx = fn(x);
    for (let row = 0; row < order; row += 1) {
      rhs[row] += weight * fx * powers[row];
      for (let col = 0; col < order; col += 1) {
        matrix[row][col] += weight * powers[row + col];
      }
    }
  }

  const coefficients = solveLinearSystem(matrix, rhs);
  if (!coefficients) {
    throw new Error("连续最佳平方逼近方程组奇异");
  }

  return {
    coefficients,
    evaluate: (x: number) => evaluatePolynomial(coefficients, x),
  };
}

type AlternatingCandidate = {
  x: number;
  e: number;
  abs: number;
  sign: number;
};

function chooseAlternatingExtrema(
  candidates: AlternatingCandidate[],
  count: number
): AlternatingCandidate[] {
  const candidateCount = candidates.length;
  if (candidateCount < count) return candidates.slice(0, count);

  const dp: Array<Array<{
    seq: number[];
    minAbs: number;
    sumAbs: number;
  } | null>> = Array.from({ length: candidateCount }, () =>
    Array.from({ length: count }, () => null)
  );

  for (let index = 0; index < candidateCount; index += 1) {
    dp[index][0] = {
      seq: [index],
      minAbs: candidates[index].abs,
      sumAbs: candidates[index].abs,
    };
  }

  const better = (
    left: { minAbs: number; sumAbs: number },
    right: { minAbs: number; sumAbs: number } | null
  ) => {
    if (!right) return true;
    if (Math.abs(left.minAbs - right.minAbs) > 1e-12) {
      return left.minAbs > right.minAbs;
    }
    return left.sumAbs > right.sumAbs;
  };

  for (let length = 1; length < count; length += 1) {
    for (let index = 0; index < candidateCount; index += 1) {
      let best: {
        seq: number[];
        minAbs: number;
        sumAbs: number;
      } | null = null;

      for (let previous = 0; previous < index; previous += 1) {
        const prior = dp[previous][length - 1];
        if (!prior) continue;
        if (candidates[previous].sign === candidates[index].sign) continue;
        const next = {
          seq: [...prior.seq, index],
          minAbs: Math.min(prior.minAbs, candidates[index].abs),
          sumAbs: prior.sumAbs + candidates[index].abs,
        };
        if (better(next, best)) best = next;
      }

      dp[index][length] = best;
    }
  }

  let best: { seq: number[]; minAbs: number; sumAbs: number } | null = null;
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = dp[index][count - 1];
    if (candidate && better(candidate, best)) best = candidate;
  }

  if (!best) {
    return candidates
      .slice()
      .sort((left, right) => right.abs - left.abs)
      .slice(0, count)
      .sort((left, right) => left.x - right.x);
  }

  return best.seq.map((index) => candidates[index]);
}

function remezApproximation(
  fn: (x: number) => number,
  start: number,
  end: number,
  degree: number
): {
  coefficients: number[];
  exchangePoints: number[];
  evaluate: (x: number) => number;
} {
  const safeDegree = Math.max(0, Math.floor(degree));
  const count = safeDegree + 2;
  let exchangePoints = Array.from({ length: count }, (_, index) => {
    const t = Math.cos(((count - 1 - index) * Math.PI) / (count - 1));
    return (start + end) / 2 + ((end - start) * t) / 2;
  }).sort((left, right) => left - right);
  let coefficients = Array.from({ length: safeDegree + 1 }, () => 0);

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const matrix: number[][] = [];
    const rhs: number[] = [];

    for (let rowIndex = 0; rowIndex < exchangePoints.length; rowIndex += 1) {
      const row: number[] = [];
      let power = 1;
      for (let col = 0; col <= safeDegree; col += 1) {
        row.push(power);
        power *= exchangePoints[rowIndex];
      }
      row.push(rowIndex % 2 === 0 ? 1 : -1);
      matrix.push(row);
      rhs.push(fn(exchangePoints[rowIndex]));
    }

    const solution = solveLinearSystem(matrix, rhs);
    if (!solution) break;
    coefficients = solution.slice(0, safeDegree + 1);

    const sampleCount = 2600;
    const xs = linspace(start, end, sampleCount);
    const errors = xs.map((x) => fn(x) - evaluatePolynomial(coefficients, x));
    const candidates: AlternatingCandidate[] = [
      {
        x: xs[0],
        e: errors[0],
        abs: Math.abs(errors[0]),
        sign: Math.sign(errors[0]) || 1,
      },
    ];

    for (let index = 1; index < sampleCount - 1; index += 1) {
      const prev = Math.abs(errors[index - 1]);
      const current = Math.abs(errors[index]);
      const next = Math.abs(errors[index + 1]);
      if (current >= prev && current >= next) {
        candidates.push({
          x: xs[index],
          e: errors[index],
          abs: current,
          sign: Math.sign(errors[index]) || 1,
        });
      }
    }

    candidates.push({
      x: xs[sampleCount - 1],
      e: errors[sampleCount - 1],
      abs: Math.abs(errors[sampleCount - 1]),
      sign: Math.sign(errors[sampleCount - 1]) || 1,
    });

    const nextExchange = chooseAlternatingExtrema(candidates, count);
    if (nextExchange.length !== count) break;
    const maxShift = Math.max(
      ...nextExchange.map((point, index) => Math.abs(point.x - exchangePoints[index]))
    );
    exchangePoints = nextExchange.map((point) => point.x);
    if (maxShift < (end - start) * 1e-5) break;
  }

  return {
    coefficients,
    exchangePoints,
    evaluate: (x: number) => evaluatePolynomial(coefficients, x),
  };
}

function sampleFunctionSeries(
  label: string,
  color: string,
  fn: (x: number) => number,
  start: number,
  end: number,
  count: number,
  dashed = false
): CurveSeries {
  return {
    label,
    color,
    dashed,
    samples: linspace(start, end, count)
      .map((x) => {
        try {
          const y = fn(x);
          return { x, y: Number.isFinite(y) ? y : null };
        } catch {
          return { x, y: null };
        }
      }),
  };
}

function maxError(
  fn: (x: number) => number,
  approximation: (x: number) => number,
  start: number,
  end: number
): number {
  return linspace(start, end, 1600).reduce((max, x) => {
    const error = Math.abs(fn(x) - approximation(x));
    return Number.isFinite(error) && error > max ? error : max;
  }, 0);
}

function rmsError(
  fn: (x: number) => number,
  approximation: (x: number) => number,
  start: number,
  end: number
): number {
  const quad = gaussLegendre(120, start, end);
  let sum = 0;
  for (let index = 0; index < quad.x.length; index += 1) {
    const error = fn(quad.x[index]) - approximation(quad.x[index]);
    sum += quad.w[index] * error * error;
  }
  return Math.sqrt(sum / (end - start));
}

function solveHermite(points: DataPoint[]): {
  coefficients: number[];
  expression: string;
} {
  const missing = points.find((point) => !Number.isFinite(point.derivative));
  if (missing) {
    throw new Error("Hermite 插值需要为每个节点输入导数 y'");
  }

  let coefficients = [0];

  points.forEach((point, index) => {
    let basis = [1];
    let denominator = 1;

    points.forEach((other, otherIndex) => {
      if (index === otherIndex) return;
      basis = multiplyPolynomials(basis, [-other.x, 1]);
      denominator *= point.x - other.x;
    });

    const li = scalePolynomial(basis, 1 / denominator);
    const liSquared = multiplyPolynomials(li, li);
    const liPrimeAtXi = evaluatePolynomial(derivativePolynomial(li), point.x);
    const xMinusXi = [-point.x, 1];
    const hBasis = multiplyPolynomials(
      [1 + 2 * liPrimeAtXi * point.x, -2 * liPrimeAtXi],
      liSquared
    );
    const kBasis = multiplyPolynomials(xMinusXi, liSquared);

    coefficients = addPolynomials(
      addPolynomials(coefficients, scalePolynomial(hBasis, point.y)),
      scalePolynomial(kBasis, point.derivative ?? 0)
    );
  });

  return {
    coefficients,
    expression: `H(x) = ${formatPolynomial(coefficients)}`,
  };
}

function solveNaturalCubicSpline(points: DataPoint[]): {
  segments: SplineSegment[];
  expression: string;
} {
  const segmentCount = points.length - 1;
  const h = Array.from(
    { length: segmentCount },
    (_, index) => points[index + 1].x - points[index].x
  );

  if (segmentCount === 1) {
    const slope = (points[1].y - points[0].y) / h[0];
    return {
      segments: [
        {
          interval: [points[0].x, points[1].x],
          a: points[0].y,
          b: slope,
          c: 0,
          d: 0,
        },
      ],
      expression: "S(x) = natural cubic spline (single linear segment)",
    };
  }

  const systemSize = points.length - 2;
  const matrix = Array.from({ length: systemSize }, () =>
    Array.from({ length: systemSize }, () => 0)
  );
  const rhs = Array.from({ length: systemSize }, () => 0);

  for (let row = 0; row < systemSize; row += 1) {
    const i = row + 1;
    if (row > 0) matrix[row][row - 1] = h[i - 1];
    matrix[row][row] = 2 * (h[i - 1] + h[i]);
    if (row < systemSize - 1) matrix[row][row + 1] = h[i];
    rhs[row] =
      6 *
      ((points[i + 1].y - points[i].y) / h[i] -
        (points[i].y - points[i - 1].y) / h[i - 1]);
  }

  const interiorMoments = solveLinearSystem(matrix, rhs);
  if (!interiorMoments) {
    throw new Error("样条方程组奇异，无法生成三次样条");
  }

  const moments = [0, ...interiorMoments, 0];
  const segments = Array.from({ length: segmentCount }, (_, index) => {
    const width = h[index];
    const a = points[index].y;
    const b =
      (points[index + 1].y - points[index].y) / width -
      (width * (2 * moments[index] + moments[index + 1])) / 6;
    const c = moments[index] / 2;
    const d = (moments[index + 1] - moments[index]) / (6 * width);
    return {
      interval: [points[index].x, points[index + 1].x] as [number, number],
      a: normalizeNearZero(a),
      b: normalizeNearZero(b),
      c: normalizeNearZero(c),
      d: normalizeNearZero(d),
    };
  });

  return {
    segments,
    expression: "S_i(x) = a_i + b_i(x-x_i) + c_i(x-x_i)^2 + d_i(x-x_i)^3",
  };
}

function evaluateSpline(segments: SplineSegment[], x: number): number | null {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (x < first.interval[0] - EPS || x > last.interval[1] + EPS) return null;

  const segment =
    segments.find((item) => x >= item.interval[0] - EPS && x <= item.interval[1] + EPS) ??
    last;
  const dx = x - segment.interval[0];
  return normalizeNearZero(
    segment.a + segment.b * dx + segment.c * dx ** 2 + segment.d * dx ** 3
  );
}

type PolynomialApproximationSolve = {
  coefficients: number[];
  expression: string;
  dividedDifferenceTable?: Array<Array<number | null>>;
  normalMatrix?: number[][];
  splineSegments?: SplineSegment[];
};

export function solveApproximation(options: ApproximationOptions): ApproximationResult {
  const points = preparePoints(options.points);
  const queryX = options.queryX?.filter(Number.isFinite) ?? [];

  if (options.method === "piecewiseLinear") {
    const predict = (x: number) => evaluatePiecewiseLinear(points, x);
    const { residuals, metrics } = calculateMetrics(points, (x) => predict(x) ?? Number.NaN);
    return {
      method: options.method,
      expression: "S(x) = piecewise linear interpolation",
      points,
      residuals,
      metrics,
      query: queryX.map((x) => ({ x, y: predict(x) })),
      samples: sampleApproximation(points, predict),
      message: "分段线性插值只在节点区间内给出函数值",
    };
  }

  if (options.method === "cubicSpline") {
    const solved = solveNaturalCubicSpline(points);
    const predict = (x: number) => evaluateSpline(solved.segments, x);
    const { residuals, metrics } = calculateMetrics(points, (x) => predict(x) ?? Number.NaN);
    return {
      method: options.method,
      expression: solved.expression,
      points,
      splineSegments: solved.segments,
      residuals,
      metrics,
      query: queryX.map((x) => ({ x, y: predict(x) })),
      samples: sampleApproximation(points, predict),
      message: "自然三次样条采用端点二阶导数为 0 的边界条件",
    };
  }

  const solved: PolynomialApproximationSolve =
    options.method === "lagrange"
      ? solveLagrange(points)
      : options.method === "newton"
        ? solveNewton(points)
        : options.method === "hermite"
          ? solveHermite(points)
          : solveLeastSquares(points, options.degree ?? Math.min(2, points.length - 1));

  const predict = (x: number) => evaluatePolynomial(solved.coefficients, x);
  const { residuals, metrics } = calculateMetrics(points, predict);

  return {
    method: options.method,
    expression: solved.expression,
    points,
    powerCoefficients: solved.coefficients,
    dividedDifferenceTable: solved.dividedDifferenceTable,
    normalMatrix: solved.normalMatrix,
    residuals,
    metrics,
    query: queryX.map((x) => ({ x, y: predict(x) })),
    samples: sampleApproximation(points, predict),
  };
}

function validateInterval(start: number, end: number): [number, number] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("区间端点必须满足 a < b");
  }
  return [start, end];
}

function metricLine(metric: FunctionExperimentMetric): string {
  const rms = metric.rmsError === undefined ? "" : `, RMS=${formatApproxNumber(metric.rmsError)}`;
  return `${metric.label}: max=${formatApproxNumber(metric.maxError)}${rms}`;
}

function buildFunctionExperimentResult(args: {
  kind: FunctionExperimentKind;
  title: string;
  expression: string;
  interval: [number, number];
  nodes: DataPoint[];
  series: CurveSeries[];
  metrics: FunctionExperimentMetric[];
  summaryPrefix?: string;
  coefficients?: number[];
  exchangePoints?: number[];
}): FunctionExperimentResult {
  const summaryParts = [
    args.summaryPrefix,
    `区间: [${formatApproxNumber(args.interval[0])}, ${formatApproxNumber(args.interval[1])}]`,
    `节点数: ${args.nodes.length}`,
    ...args.metrics.map(metricLine),
  ].filter(Boolean);

  if (args.coefficients) {
    summaryParts.push(`系数: ${args.coefficients.map((value) => formatApproxNumber(value)).join(", ")}`);
  }
  if (args.exchangePoints) {
    summaryParts.push(`交错点: ${args.exchangePoints.map((value) => formatApproxNumber(value)).join(", ")}`);
  }

  return {
    kind: args.kind,
    title: args.title,
    expression: args.expression,
    interval: args.interval,
    nodes: args.nodes,
    series: args.series,
    metrics: args.metrics,
    summary: summaryParts.join("\n"),
    coefficients: args.coefficients,
    exchangePoints: args.exchangePoints,
  };
}

export function solveFunctionExperiment(
  options: FunctionExperimentOptions
): FunctionExperimentResult {
  const interval = validateInterval(options.intervalStart, options.intervalEnd);
  const [start, end] = interval;
  const sampleCount = Math.max(120, Math.floor(options.sampleCount ?? 800));
  const degree = Math.max(1, Math.floor(options.degree ?? 3));
  const expression = options.functionExpression;
  const fn = createApproximationFunction(expression);
  const truth = sampleFunctionSeries("原函数 f(x)", SERIES_COLORS.truth, fn, start, end, sampleCount);

  if (options.kind === "rungeCompare" || options.kind === "chebyshevCompare") {
    const useChebyshev = options.kind === "chebyshevCompare";
    const counts = useChebyshev ? [11, 16, 21] : [10, 15, 20];
    const colors = [SERIES_COLORS.c1, SERIES_COLORS.c2, SERIES_COLORS.c3];
    const metrics: FunctionExperimentMetric[] = [];
    const series = [truth];
    let finalNodes: DataPoint[] = [];

    counts.forEach((count, index) => {
      const xs = useChebyshev
        ? chebyshevZeros(count, start, end)
        : uniformNodes(count, start, end);
      const nodes = xs.map((x) => ({ x, y: fn(x) }));
      const evaluator = lagrangeEvaluator(nodes);
      finalNodes = nodes;
      const label = useChebyshev
        ? `Chebyshev 节点 n=${count}`
        : `等距 ${count} 等分`;
      series.push(
        sampleFunctionSeries(label, colors[index], evaluator, start, end, sampleCount)
      );
      metrics.push({
        label,
        maxError: maxError(fn, evaluator, start, end),
        rmsError: rmsError(fn, evaluator, start, end),
      });
    });

    return buildFunctionExperimentResult({
      kind: options.kind,
      title: useChebyshev ? "Chebyshev 节点改善龙格现象" : "等距节点下的龙格现象",
      expression,
      interval,
      nodes: finalNodes,
      series,
      metrics,
      summaryPrefix: useChebyshev
        ? "Chebyshev 节点在端点附近更密集，通常能显著减轻端点振荡。"
        : "对 Runge 函数，等距高次插值在区间端点附近容易出现明显振荡。",
    });
  }

  if (options.kind === "continuousLeastSquares") {
    const least = continuousLeastSquaresApproximation(fn, start, end, degree);
    const metrics = [
      {
        label: `${degree} 次连续最佳平方逼近`,
        maxError: maxError(fn, least.evaluate, start, end),
        rmsError: rmsError(fn, least.evaluate, start, end),
      },
    ];

    return buildFunctionExperimentResult({
      kind: options.kind,
      title: `${degree} 次连续最佳平方逼近`,
      expression,
      interval,
      nodes: [],
      series: [
        truth,
        sampleFunctionSeries(
          `${degree} 次最佳平方逼近`,
          SERIES_COLORS.least,
          least.evaluate,
          start,
          end,
          sampleCount
        ),
      ],
      metrics,
      coefficients: least.coefficients,
      summaryPrefix: `p_${degree}(x) = ${formatPolynomial(least.coefficients)}`,
    });
  }

  if (options.kind === "remez") {
    const remez = remezApproximation(fn, start, end, degree);
    const metrics = [
      {
        label: `${degree} 次最佳一致逼近`,
        maxError: maxError(fn, remez.evaluate, start, end),
      },
    ];

    return buildFunctionExperimentResult({
      kind: options.kind,
      title: `${degree} 次最佳一致逼近`,
      expression,
      interval,
      nodes: remez.exchangePoints.map((x) => ({ x, y: fn(x) })),
      series: [
        truth,
        sampleFunctionSeries(
          `${degree} 次最佳一致逼近`,
          SERIES_COLORS.remez,
          remez.evaluate,
          start,
          end,
          sampleCount
        ),
      ],
      metrics,
      coefficients: remez.coefficients,
      exchangePoints: remez.exchangePoints,
      summaryPrefix: `p_${degree}(x) = ${formatPolynomial(remez.coefficients)}`,
    });
  }

  const nodes = preparePoints(options.points?.length ? options.points : pointsFromFunction(expression, uniformNodes(options.parts ?? 10, start, end)));
  const lagrange = lagrangeEvaluator(nodes);
  const newtonCoefficients = newtonCoefficientsForPoints(nodes);
  const newton = newtonEvaluatorForPoints(nodes, newtonCoefficients);
  const least = continuousLeastSquaresApproximation(fn, start, end, degree);
  const remez = remezApproximation(fn, start, end, degree);
  const series = [
    truth,
    sampleFunctionSeries("Lagrange 插值", SERIES_COLORS.lagrange, lagrange, start, end, sampleCount),
    sampleFunctionSeries("Newton 插值", SERIES_COLORS.newton, newton, start, end, sampleCount, true),
    sampleFunctionSeries(`${degree} 次最佳平方逼近`, SERIES_COLORS.least, least.evaluate, start, end, sampleCount),
    sampleFunctionSeries(`${degree} 次最佳一致逼近`, SERIES_COLORS.remez, remez.evaluate, start, end, sampleCount),
  ];
  const metrics = [
    {
      label: "Lagrange 插值",
      maxError: maxError(fn, lagrange, start, end),
      rmsError: rmsError(fn, lagrange, start, end),
    },
    {
      label: "Newton 插值",
      maxError: maxError(fn, newton, start, end),
      rmsError: rmsError(fn, newton, start, end),
    },
    {
      label: `${degree} 次最佳平方逼近`,
      maxError: maxError(fn, least.evaluate, start, end),
      rmsError: rmsError(fn, least.evaluate, start, end),
    },
    {
      label: `${degree} 次最佳一致逼近`,
      maxError: maxError(fn, remez.evaluate, start, end),
    },
  ];

  return buildFunctionExperimentResult({
    kind: "currentNodes",
    title: "当前节点的插值与逼近图像",
    expression,
    interval,
    nodes,
    series,
    metrics,
    coefficients: least.coefficients,
    exchangePoints: remez.exchangePoints,
    summaryPrefix: `Newton 差商系数: ${newtonCoefficients.map((value) => formatApproxNumber(value)).join(", ")}`,
  });
}

export function parseDataPointRows(
  rows: Array<{ x: string; y: string; derivative?: string }>
): DataPoint[] {
  return rows
    .map((row) => {
      const derivative = Number(row.derivative);
      return {
        x: Number(row.x),
        y: Number(row.y),
        derivative: Number.isFinite(derivative) ? derivative : undefined,
      };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function parseQueryValues(input: string): number[] {
  return input
    .split(/[\s,;，；]+/u)
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value));
}

export function parsePastedPoints(input: string): Array<{
  x: string;
  y: string;
  derivative?: string;
}> {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,;，；\t]+/u))
    .filter((cells) => cells.length >= 2)
    .map((cells) => ({ x: cells[0], y: cells[1], derivative: cells[2] }));
}
