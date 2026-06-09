import type {
  DisplayMode,
  IterativeMethod,
  IterativeSolveResult,
  SolveSummary,
  Step,
} from "@/types/matrix";
import {
  EPS,
  addNumericMatrices,
  cloneMatrix,
  divExpr,
  dotProduct,
  formatNumberPrecise,
  fractionMatrixToString,
  fractionToString,
  invertNumericMatrix,
  isNumericMatrix,
  isValidNumericMatrix,
  isZeroExpr,
  isZeroFraction,
  matVecMultiply,
  maxAbsDelta,
  componentMagnitude,
  mulExpr,
  multiplyNumericMatrices,
  normalizeNearZero,
  numericValue,
  scaleNumericMatrix,
  simplifyExpr,
  subExpr,
  toFractionMatrix,
  zeroNumericMatrix,
} from "./matrix-internals";
import { formatValue, rrefMatrix } from "./matrix-basic-core";
import { eigsWithMathjs } from "./matrix-eigen-core";

type IterativeConvergenceInfo = {
  spectralRadius: number | null;
  convergenceGuaranteed: boolean | null;
  convergenceMessage?: string;
};

export function maxAbsAxMinusB(
  a: number[][],
  x: number[],
  b: number[]
): number | null {
  if (!a.length || a.length !== b.length || a[0].length !== x.length) {
    return null;
  }

  let maxAbs = 0;
  for (let r = 0; r < a.length; r += 1) {
    let ax = 0;
    for (let c = 0; c < a[0].length; c += 1) {
      ax += a[r][c] * x[c];
    }
    maxAbs = Math.max(maxAbs, Math.abs(ax - b[r]));
  }

  return maxAbs;
}

function summaryFromRref(rref: string[][], variableCount: number): SolveSummary {
  const lastColumn = variableCount;

  let rankA = 0;
  let rankAug = 0;
  let inconsistent = false;

  for (const row of rref) {
    const hasA = row.slice(0, variableCount).some((value) => !isZeroExpr(value));
    const hasAug = row.some((value) => !isZeroExpr(value));
    if (hasA) rankA += 1;
    if (hasAug) rankAug += 1;
    if (!hasA && !isZeroExpr(row[lastColumn] ?? "0")) {
      inconsistent = true;
    }
  }

  if (inconsistent || rankAug > rankA) {
    return { type: "无解", rankA, rankAug };
  }

  const rowForPivotCol = new Map<number, number>();
  for (let r = 0; r < rref.length; r += 1) {
    for (let c = 0; c < variableCount; c += 1) {
      if (!isZeroExpr(rref[r][c])) {
        rowForPivotCol.set(c, r);
        break;
      }
    }
  }

  if (rankA === variableCount) {
    const solution = Array.from({ length: variableCount }, () => "0");
    rowForPivotCol.forEach((rowIndex, col) => {
      solution[col] = simplifyExpr(rref[rowIndex][lastColumn] ?? "0");
    });
    return {
      type: "唯一解",
      rankA,
      rankAug,
      solution,
    };
  }

  const freeCols = Array.from({ length: variableCount }, (_, idx) => idx).filter(
    (idx) => !rowForPivotCol.has(idx)
  );
  const freeVariables = freeCols.map((col) => `x${col + 1}`);
  const freeNameMap = new Map<number, string>();
  freeCols.forEach((col, idx) => {
    freeNameMap.set(col, `t${idx + 1}`);
  });

  const parametric = Array.from({ length: variableCount }, (_, col) => {
    if (freeNameMap.has(col)) {
      return `x${col + 1} = ${freeNameMap.get(col)}`;
    }

    const row = rowForPivotCol.get(col);
    if (row === undefined) {
      return `x${col + 1} = 0`;
    }

    let expr = rref[row][lastColumn] ?? "0";
    for (const freeCol of freeCols) {
      const coeff = rref[row][freeCol];
      if (isZeroExpr(coeff)) continue;
      expr = subExpr(expr, mulExpr(coeff, freeNameMap.get(freeCol) ?? "0"));
    }

    return `x${col + 1} = ${simplifyExpr(expr)}`;
  });

  return {
    type: "无穷多解",
    rankA,
    rankAug,
    parametric,
    freeVariables,
  };
}

function gaussianEliminationFraction(
  input: string[][],
  variableCount: number
): { steps: Step[]; summary: SolveSummary } {
  const matrix = toFractionMatrix(input);
  if (!matrix) {
    return gaussianEliminationSymbolic(input, variableCount);
  }

  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const steps: Step[] = [];

  const snapshot = () => fractionMatrixToString(matrix);

  steps.push({
    matrix: snapshot(),
    kind: "start",
    operationLabel: "初始增广矩阵",
  });

  let pivotRow = 0;
  for (let col = 0; col < variableCount && pivotRow < rows; col += 1) {
    let maxRow = -1;
    let maxAbs = -1;

    for (let r = pivotRow; r < rows; r += 1) {
      if (isZeroFraction(matrix[r][col])) continue;
      const abs = Math.abs(matrix[r][col].valueOf());
      if (abs > maxAbs) {
        maxAbs = abs;
        maxRow = r;
      }
    }

    if (maxRow === -1) {
      steps.push({
        matrix: snapshot(),
        kind: "skip",
        col,
        operationLabel: `第 ${col + 1} 列无可用主元，跳过`,
      });
      continue;
    }

    if (maxRow !== pivotRow) {
      [matrix[pivotRow], matrix[maxRow]] = [matrix[maxRow], matrix[pivotRow]];
      steps.push({
        matrix: snapshot(),
        kind: "swap",
        pivot: { row: pivotRow, col },
        pivotRow,
        swapWith: maxRow,
        highlightRows: [pivotRow, maxRow],
        swapReason: "选择绝对值最大的主元，避免除以过小数值导致误差放大。",
        operationLabel: `R${pivotRow + 1} <-> R${maxRow + 1}`,
      });
    }

    for (let r = pivotRow + 1; r < rows; r += 1) {
      if (isZeroFraction(matrix[r][col])) continue;
      const factor = matrix[r][col].div(matrix[pivotRow][col]);
      for (let c = col; c < cols; c += 1) {
        matrix[r][c] = matrix[r][c].sub(factor.mul(matrix[pivotRow][c]));
      }

      steps.push({
        matrix: snapshot(),
        kind: "eliminate",
        pivot: { row: pivotRow, col },
        activeRow: r,
        pivotRow,
        targetRow: r,
        factor: fractionToString(factor),
        highlightRows: [r],
        operationLabel: `R${r + 1} <- R${r + 1} - (${fractionToString(factor)})R${pivotRow + 1}`,
      });
    }

    pivotRow += 1;
  }

  steps.push({
    matrix: snapshot(),
    kind: "done",
    operationLabel: "消元完成，得到阶梯形矩阵",
  });

  const summary = summaryFromRref(rrefMatrix(snapshot()), variableCount);
  return { steps, summary };
}

function gaussianEliminationSymbolic(
  input: string[][],
  variableCount: number
): { steps: Step[]; summary: SolveSummary } {
  const matrix = cloneMatrix(input).map((row) => row.map((value) => simplifyExpr(value)));
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const steps: Step[] = [];

  steps.push({
    matrix: cloneMatrix(matrix),
    kind: "start",
    operationLabel: "初始增广矩阵",
  });

  let pivotRow = 0;
  for (let col = 0; col < variableCount && pivotRow < rows; col += 1) {
    let maxRow = -1;
    let maxAbs = -1;
    let firstNonZero: number | null = null;

    for (let r = pivotRow; r < rows; r += 1) {
      const value = matrix[r][col];
      if (isZeroExpr(value)) continue;
      if (firstNonZero === null) firstNonZero = r;
      const numeric = numericValue(value);
      if (numeric !== null) {
        const abs = Math.abs(numeric);
        if (abs > maxAbs) {
          maxAbs = abs;
          maxRow = r;
        }
      }
    }

    if (maxRow === -1) {
      if (firstNonZero === null) {
        steps.push({
          matrix: cloneMatrix(matrix),
          kind: "skip",
          col,
          operationLabel: `第 ${col + 1} 列无可用主元，跳过`,
        });
        continue;
      }
      maxRow = firstNonZero;
    }

    if (maxRow !== pivotRow) {
      [matrix[pivotRow], matrix[maxRow]] = [matrix[maxRow], matrix[pivotRow]];
      steps.push({
        matrix: cloneMatrix(matrix),
        kind: "swap",
        pivot: { row: pivotRow, col },
        pivotRow,
        swapWith: maxRow,
        highlightRows: [pivotRow, maxRow],
        swapReason: "优先选择更稳定的主元，降低消元过程中的误差传播。",
        operationLabel: `R${pivotRow + 1} <-> R${maxRow + 1}`,
      });
    }

    for (let r = pivotRow + 1; r < rows; r += 1) {
      if (isZeroExpr(matrix[r][col])) continue;
      const factor = divExpr(matrix[r][col], matrix[pivotRow][col]);
      for (let c = col; c < cols; c += 1) {
        matrix[r][c] = subExpr(matrix[r][c], mulExpr(factor, matrix[pivotRow][c]));
      }

      steps.push({
        matrix: cloneMatrix(matrix),
        kind: "eliminate",
        pivot: { row: pivotRow, col },
        activeRow: r,
        pivotRow,
        targetRow: r,
        factor,
        highlightRows: [r],
        operationLabel: `R${r + 1} <- R${r + 1} - (${factor})R${pivotRow + 1}`,
      });
    }

    pivotRow += 1;
  }

  steps.push({
    matrix: cloneMatrix(matrix),
    kind: "done",
    operationLabel: "消元完成，得到阶梯形矩阵",
  });

  const summary = summaryFromRref(rrefMatrix(matrix), variableCount);
  return { steps, summary };
}

export function solveLinearSystemWithSteps(
  augmented: string[][],
  variableCount: number
): { steps: Step[]; summary: SolveSummary } {
  if (isNumericMatrix(augmented)) {
    return gaussianEliminationFraction(augmented, variableCount);
  }
  return gaussianEliminationSymbolic(augmented, variableCount);
}

export function solveLinearSystemByGaussJordan(
  augmented: string[][],
  variableCount: number
): { steps: Step[]; summary: SolveSummary } {
  const normalized = cloneMatrix(augmented).map((row) =>
    row.map((value) => simplifyExpr(value))
  );
  const reduced = rrefMatrix(normalized);

  const steps: Step[] = [
    {
      matrix: cloneMatrix(normalized),
      kind: "start",
      operationLabel: "初始增广矩阵",
    },
    {
      matrix: cloneMatrix(reduced),
      kind: "done",
      operationLabel: "Gauss-Jordan 完成，得到最简阶梯形矩阵 (RREF)",
    },
  ];

  return {
    steps,
    summary: summaryFromRref(reduced, variableCount),
  };
}

function isStrictlyDiagonallyDominant(matrix: number[][]): boolean {
  return matrix.every((row, i) => {
    const diagonal = Math.abs(row[i]);
    const others = row.reduce((sum, value, j) => (j === i ? sum : sum + Math.abs(value)), 0);
    return diagonal > others;
  });
}

function isSymmetricMatrix(matrix: number[][], tolerance = 1e-8): boolean {
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = r + 1; c < matrix.length; c += 1) {
      if (Math.abs(matrix[r][c] - matrix[c][r]) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

function isPositiveDefiniteByCholesky(matrix: number[][]): boolean {
  const size = matrix.length;
  const l: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k += 1) {
        sum -= l[i][k] * l[j][k];
      }

      if (i === j) {
        if (sum <= EPS) return false;
        l[i][j] = Math.sqrt(sum);
      } else {
        if (Math.abs(l[j][j]) < EPS) return false;
        l[i][j] = sum / l[j][j];
      }
    }
  }

  return true;
}

export function solveNumericLinearSystem(
  matrixA: number[][],
  vectorB: number[]
): number[] | null {
  if (!isValidNumericMatrix(matrixA)) return null;
  const n = matrixA.length;
  if (matrixA[0].length !== n) return null;
  if (!Array.isArray(vectorB) || vectorB.length !== n) return null;
  if (vectorB.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;

  const augmented = matrixA.map((row, idx) => [...row, vectorB[idx]]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxAbs = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < n; row += 1) {
      const abs = Math.abs(augmented[row][col]);
      if (abs > maxAbs) {
        maxAbs = abs;
        pivotRow = row;
      }
    }

    if (maxAbs < EPS) return null;

    if (pivotRow !== col) {
      [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];
    }

    for (let row = col + 1; row < n; row += 1) {
      const factor = augmented[row][col] / augmented[col][col];
      if (Math.abs(factor) < EPS) continue;
      for (let c = col; c <= n; c += 1) {
        augmented[row][c] -= factor * augmented[col][c];
      }
    }
  }

  const x = Array.from({ length: n }, () => 0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = augmented[row][n];
    for (let c = row + 1; c < n; c += 1) {
      sum -= augmented[row][c] * x[c];
    }

    const pivot = augmented[row][row];
    if (Math.abs(pivot) < EPS) return null;
    x[row] = normalizeNearZero(sum / pivot);
  }

  return x;
}

function buildIterationMatrix(
  method: IterativeMethod,
  matrixA: number[][],
  omega: number
): { matrix: number[][] | null; message?: string } {
  if (method === "conjugateGradient") {
    return {
      matrix: null,
      message:
        "共轭梯度法没有固定迭代矩阵 B，rho(B) 判据不适用。",
    };
  }

  const size = matrixA.length;
  const d = zeroNumericMatrix(size, size);
  const l = zeroNumericMatrix(size, size);
  const u = zeroNumericMatrix(size, size);

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (r === c) {
        d[r][c] = matrixA[r][c];
      } else if (r > c) {
        l[r][c] = matrixA[r][c];
      } else {
        u[r][c] = matrixA[r][c];
      }
    }
  }

  if (method === "jacobi") {
    const dInv = zeroNumericMatrix(size, size);
    for (let i = 0; i < size; i += 1) {
      if (Math.abs(d[i][i]) < EPS) {
        return {
          matrix: null,
          message: `对角元 a(${i + 1},${i + 1}) 为 0，无法构造 Jacobi 迭代矩阵 B。`,
        };
      }
      dInv[i][i] = 1 / d[i][i];
    }

    const lPlusU = addNumericMatrices(l, u);
    if (!lPlusU) return { matrix: null, message: "无法构造 Jacobi 迭代矩阵 B。" };

    const product = multiplyNumericMatrices(dInv, lPlusU);
    if (!product) return { matrix: null, message: "无法构造 Jacobi 迭代矩阵 B。" };

    return { matrix: scaleNumericMatrix(product, -1) };
  }

  if (method === "gaussSeidel") {
    const dPlusL = addNumericMatrices(d, l);
    if (!dPlusL) return { matrix: null, message: "无法构造 Gauss-Seidel 迭代矩阵 B。" };

    const leftInverse = invertNumericMatrix(dPlusL);
    if (!leftInverse) {
      return {
        matrix: null,
        message: "矩阵 (D + L) 奇异，无法构造 Gauss-Seidel 迭代矩阵 B。",
      };
    }

    const product = multiplyNumericMatrices(leftInverse, u);
    if (!product) return { matrix: null, message: "无法构造 Gauss-Seidel 迭代矩阵 B。" };

    return { matrix: scaleNumericMatrix(product, -1) };
  }

  const dPlusOmegaL = addNumericMatrices(d, scaleNumericMatrix(l, omega));
  if (!dPlusOmegaL) return { matrix: null, message: "无法构造 SOR 迭代矩阵 B。" };

  const leftInverse = invertNumericMatrix(dPlusOmegaL);
  if (!leftInverse) {
    return {
      matrix: null,
      message: "矩阵 (D + omega*L) 奇异，无法构造 SOR 迭代矩阵 B。",
    };
  }

  const right = addNumericMatrices(
    scaleNumericMatrix(u, omega),
    scaleNumericMatrix(d, omega - 1)
  );
  if (!right) return { matrix: null, message: "无法构造 SOR 迭代矩阵 B。" };

  const product = multiplyNumericMatrices(leftInverse, right);
  if (!product) return { matrix: null, message: "无法构造 SOR 迭代矩阵 B。" };

  return { matrix: scaleNumericMatrix(product, -1) };
}

function spectralRadiusFromMatrix(matrix: number[][]): number | null {
  const eigen = eigsWithMathjs(matrix);
  if (!eigen || !eigen.values.length) return null;

  let maxMagnitude = 0;
  for (const value of eigen.values) {
    maxMagnitude = Math.max(maxMagnitude, componentMagnitude(value));
  }

  if (!Number.isFinite(maxMagnitude)) return null;
  return normalizeNearZero(maxMagnitude);
}

function evaluateIterativeConvergence(
  method: IterativeMethod,
  matrixA: number[][],
  omega: number
): IterativeConvergenceInfo {
  const built = buildIterationMatrix(method, matrixA, omega);
  if (!built.matrix) {
    return {
      spectralRadius: null,
      convergenceGuaranteed: null,
      convergenceMessage: built.message ?? "由于无法构造 B，暂无法判定是否保证收敛。",
    };
  }

  const spectralRadius = spectralRadiusFromMatrix(built.matrix);
  if (spectralRadius === null) {
    return {
      spectralRadius: null,
      convergenceGuaranteed: null,
      convergenceMessage: "无法计算 rho(B)，暂无法给出保证收敛判定。",
    };
  }

  const convergenceGuaranteed = spectralRadius < 1;
  return {
    spectralRadius,
    convergenceGuaranteed,
    convergenceMessage: convergenceGuaranteed
      ? `rho(B)=${formatNumberPrecise(spectralRadius)} < 1，保证收敛。`
      : `rho(B)=${formatNumberPrecise(spectralRadius)} >= 1，不保证收敛。`,
  };
}

function iterativeHistoryEntry(iteration: number, vector: number[], residual: number): {
  iteration: number;
  vector: string[];
  residual: number;
} {
  return {
    iteration,
    vector: vector.map((value) => formatNumberPrecise(value)),
    residual,
  };
}

export function solveLinearSystemIterative(options: {
  method: IterativeMethod;
  matrixA: number[][];
  vectorB: number[];
  tolerance?: number;
  maxIterations?: number;
  initialGuess?: number[];
  omega?: number;
}): IterativeSolveResult | null {
  const { method, matrixA, vectorB } = options;

  const rows = matrixA.length;
  const cols = matrixA[0]?.length ?? 0;
  if (!rows || rows !== cols || vectorB.length !== rows) {
    return null;
  }

  if (matrixA.some((row) => row.length !== cols)) {
    return null;
  }

  const toleranceCandidate = options.tolerance ?? 1e-10;
  const tolerance =
    Number.isFinite(toleranceCandidate) && toleranceCandidate > 0
      ? toleranceCandidate
      : 1e-10;

  const maxIterationsCandidate = options.maxIterations ?? 120;
  const maxIterations =
    Number.isFinite(maxIterationsCandidate) && maxIterationsCandidate >= 1
      ? Math.floor(maxIterationsCandidate)
      : 120;

  const omegaCandidate = options.omega ?? 1.1;
  const omega =
    Number.isFinite(omegaCandidate) && omegaCandidate > 0 ? omegaCandidate : 1.1;

  const convergenceInfo = evaluateIterativeConvergence(method, matrixA, omega);

  const defaultGuess = Array.from({ length: rows }, () => 0);
  const initialGuess =
    options.initialGuess && options.initialGuess.length === rows
      ? options.initialGuess.map((value) => normalizeNearZero(value))
      : defaultGuess;

  const history: Array<{ iteration: number; vector: string[]; residual: number }> = [];
  const notes: string[] = [];

  if (method === "conjugateGradient") {
    if (!isSymmetricMatrix(matrixA)) {
      return {
        method,
        converged: false,
        iterations: 0,
        residual: Number.POSITIVE_INFINITY,
        spectralRadius: convergenceInfo.spectralRadius,
        convergenceGuaranteed: convergenceInfo.convergenceGuaranteed,
        solution: initialGuess.map((value) => formatNumberPrecise(value)),
        history: [iterativeHistoryEntry(0, initialGuess, Number.POSITIVE_INFINITY)],
        convergenceMessage: convergenceInfo.convergenceMessage,
        note: "Conjugate Gradient 要求矩阵为对称正定（SPD），当前矩阵不是对称矩阵。",
      };
    }

    if (!isPositiveDefiniteByCholesky(matrixA)) {
      return {
        method,
        converged: false,
        iterations: 0,
        residual: Number.POSITIVE_INFINITY,
        spectralRadius: convergenceInfo.spectralRadius,
        convergenceGuaranteed: convergenceInfo.convergenceGuaranteed,
        solution: initialGuess.map((value) => formatNumberPrecise(value)),
        history: [iterativeHistoryEntry(0, initialGuess, Number.POSITIVE_INFINITY)],
        convergenceMessage: convergenceInfo.convergenceMessage,
        note: "Conjugate Gradient 要求矩阵为对称正定（SPD），当前矩阵未通过正定性检查。",
      };
    }

    let current = initialGuess.slice();
    const ax = matVecMultiply(matrixA, current);
    let r = vectorB.map((value, i) => value - ax[i]);
    let p = r.slice();
    let rr = dotProduct(r, r);

    let residual = maxAbsAxMinusB(matrixA, current, vectorB) ?? Number.POSITIVE_INFINITY;
    history.push(iterativeHistoryEntry(0, current, residual));

    let converged = residual <= tolerance || Math.sqrt(Math.max(rr, 0)) <= tolerance;
    let iterations = 0;

    for (let iter = 1; iter <= maxIterations && !converged; iter += 1) {
      const ap = matVecMultiply(matrixA, p);
      const denom = dotProduct(p, ap);
      if (Math.abs(denom) < EPS) {
        notes.push("迭代方向分母过小，CG 提前终止。请检查矩阵条件数。");
        break;
      }

      const alpha = rr / denom;
      current = current.map((value, i) => normalizeNearZero(value + alpha * p[i]));
      r = r.map((value, i) => normalizeNearZero(value - alpha * ap[i]));

      const rrNew = dotProduct(r, r);
      residual = maxAbsAxMinusB(matrixA, current, vectorB) ?? Number.POSITIVE_INFINITY;
      iterations = iter;

      if (iter <= 10 || iter % 5 === 0 || residual <= tolerance || iter === maxIterations) {
        history.push(iterativeHistoryEntry(iter, current, residual));
      }

      if (residual <= tolerance || Math.sqrt(Math.max(rrNew, 0)) <= tolerance) {
        converged = true;
        rr = rrNew;
        break;
      }

      const beta = rrNew / rr;
      p = r.map((value, i) => normalizeNearZero(value + beta * p[i]));
      rr = rrNew;
    }

    const tail = history[history.length - 1];
    const tailKey = tail?.vector.join(",") ?? "";
    const currentKey = current.map((value) => formatNumberPrecise(value)).join(",");
    if (tailKey !== currentKey) {
      history.push(iterativeHistoryEntry(iterations, current, residual));
    }

    if (!converged) {
      notes.push(
        `达到最大迭代次数 ${maxIterations} 后仍未满足容差 ${formatNumberPrecise(tolerance)}。`
      );
    }

    return {
      method,
      converged,
      iterations,
      residual,
      spectralRadius: convergenceInfo.spectralRadius,
      convergenceGuaranteed: convergenceInfo.convergenceGuaranteed,
      solution: current.map((value) => formatNumberPrecise(value)),
      history,
      note: notes.length ? notes.join(" ") : undefined,
      convergenceMessage: convergenceInfo.convergenceMessage,
    };
  }

  for (let i = 0; i < rows; i += 1) {
    if (Math.abs(matrixA[i][i]) < EPS) {
      return {
        method,
        converged: false,
        iterations: 0,
        residual: Number.POSITIVE_INFINITY,
        spectralRadius: convergenceInfo.spectralRadius,
        convergenceGuaranteed: convergenceInfo.convergenceGuaranteed,
        solution: initialGuess.map((value) => formatNumberPrecise(value)),
        history: [iterativeHistoryEntry(0, initialGuess, Number.POSITIVE_INFINITY)],
        convergenceMessage: convergenceInfo.convergenceMessage,
        note: `主对角线存在 0（第 ${i + 1} 行），当前迭代法不可用。`,
      };
    }
  }

  let current = initialGuess.slice();
  let residual = maxAbsAxMinusB(matrixA, current, vectorB) ?? Number.POSITIVE_INFINITY;
  history.push(iterativeHistoryEntry(0, current, residual));

  let converged = residual <= tolerance;
  let iterations = 0;

  for (let iter = 1; iter <= maxIterations && !converged; iter += 1) {
    const next = current.slice();

    for (let i = 0; i < rows; i += 1) {
      let sigma = 0;
      for (let j = 0; j < cols; j += 1) {
        if (j === i) continue;

        if (method === "jacobi") {
          sigma += matrixA[i][j] * current[j];
          continue;
        }

        const xj = j < i ? next[j] : current[j];
        sigma += matrixA[i][j] * xj;
      }

      const gaussSeidelUpdate = (vectorB[i] - sigma) / matrixA[i][i];
      if (method === "sor") {
        next[i] = normalizeNearZero((1 - omega) * current[i] + omega * gaussSeidelUpdate);
      } else {
        next[i] = normalizeNearZero(gaussSeidelUpdate);
      }
    }

    const delta = maxAbsDelta(next, current);
    residual = maxAbsAxMinusB(matrixA, next, vectorB) ?? Number.POSITIVE_INFINITY;
    iterations = iter;
    current = next;

    if (iter <= 10 || iter % 5 === 0 || residual <= tolerance || iter === maxIterations) {
      history.push(iterativeHistoryEntry(iter, current, residual));
    }

    if (delta <= tolerance || residual <= tolerance) {
      converged = true;
    }
  }

  const tail = history[history.length - 1];
  const tailKey = tail?.vector.join(",") ?? "";
  const currentKey = current.map((value) => formatNumberPrecise(value)).join(",");
  if (tailKey !== currentKey) {
    history.push(iterativeHistoryEntry(iterations, current, residual));
  }

  if (!isStrictlyDiagonallyDominant(matrixA)) {
    notes.push("矩阵不满足严格对角占优，迭代可能不收敛或收敛较慢。");
  }
  if (method === "sor" && (omega <= 0 || omega >= 2)) {
    notes.push("SOR 通常建议 0 < omega < 2，当前参数可能导致发散。");
  }
  if (!converged) {
    notes.push(
      `达到最大迭代次数 ${maxIterations} 后仍未满足容差 ${formatNumberPrecise(tolerance)}。`
    );
  }

  return {
    method,
    converged,
    iterations,
    residual,
    spectralRadius: convergenceInfo.spectralRadius,
    convergenceGuaranteed: convergenceInfo.convergenceGuaranteed,
    solution: current.map((value) => formatNumberPrecise(value)),
    history,
    note: notes.length ? notes.join(" ") : undefined,
    convergenceMessage: convergenceInfo.convergenceMessage,
  };
}

export function describeStep(step: Step, mode: DisplayMode): string {
  if (step.operationLabel) {
    return step.operationLabel.replace(/\(([^)]+)\)/g, (_, expr: string) => {
      return `(${formatValue(expr, mode)})`;
    });
  }

  switch (step.kind) {
    case "start":
      return "初始增广矩阵";
    case "skip":
      return `第 ${step.col !== undefined ? step.col + 1 : "?"} 列没有可用主元，跳过`;
    case "swap":
      return `交换 R${(step.pivotRow ?? 0) + 1} 与 R${(step.swapWith ?? 0) + 1}`;
    case "eliminate":
      return `R${(step.targetRow ?? 0) + 1} <- R${(step.targetRow ?? 0) + 1} - (${formatValue(
        step.factor ?? "0",
        mode
      )})R${(step.pivotRow ?? 0) + 1}`;
    case "done":
      return "消元完成";
    default:
      return "";
  }
}
