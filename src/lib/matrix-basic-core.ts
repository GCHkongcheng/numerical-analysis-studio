import Fraction from "fraction.js";

import type { DisplayMode, MatrixOperationResult } from "@/types/matrix";
import {
  addExpr,
  cloneMatrix,
  divExpr,
  formatNumber,
  fractionMatrixToString,
  fractionToString,
  isNumericMatrix,
  isZeroExpr,
  isZeroFraction,
  mulExpr,
  numericValue,
  simplifyExpr,
  subExpr,
  toFractionMatrix,
  tryFraction,
} from "./matrix-internals";

function roundNumericLiterals(expr: string): string {
  return expr.replace(/-?\d+\.\d{6,}/g, (match) => {
    const value = Number(match);
    if (!Number.isFinite(value)) return match;
    return formatNumber(value);
  });
}

function prettySymbolic(expr: string): string {
  return roundNumericLiterals(expr)
    .replace(/\*/g, "·")
    .replace(/sqrt\(/g, "√(");
}

function shouldKeepSymbolicInFractionMode(expr: string): boolean {
  return /sqrt\(|\bpi\b|\be\b|\bi\b/u.test(expr);
}

export function normalizeMatrixInput(inputs: string[][]): string[][] {
  return inputs.map((row) => row.map((value) => simplifyExpr(value || "0")));
}

export function formatValue(expr: string, mode: DisplayMode): string {
  const raw = expr || "0";
  const simplified = simplifyExpr(raw);
  const numeric = numericValue(simplified);
  const preserveSymbolicInFraction =
    shouldKeepSymbolicInFractionMode(raw) ||
    shouldKeepSymbolicInFractionMode(simplified);

  if (mode === "fraction") {
    if (preserveSymbolicInFraction) {
      return prettySymbolic(raw);
    }

    const fraction = tryFraction(simplified);
    if (fraction) return fractionToString(fraction);

    if (numeric !== null) {
      return fractionToString(new Fraction(numeric).simplify(1e-8));
    }

    return prettySymbolic(simplified);
  }

  if (mode === "decimal") {
    if (numeric !== null) return formatNumber(numeric);
    return prettySymbolic(simplified);
  }

  return prettySymbolic(simplified);
}

export function hasChinese(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}

function parseDelimitedRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === "," || char === "\t" || char === ";" || char === "，")) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseMatrixText(text: string): string[][] {
  const normalizedRows = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  const parsed = normalizedRows.map((row) => {
    const hasDelimitedSeparator = /[\t,;，"]/u.test(row);
    const cells = hasDelimitedSeparator
      ? parseDelimitedRow(row)
      : row.split(/\s+/);

    return cells.map((cell) => (cell.length > 0 ? cell : "0"));
  });

  return parsed.filter((row) => row.length > 0);
}

export function applyPaste(
  target: string[][],
  startRow: number,
  startCol: number,
  text: string
): string[][] {
  const rows = parseMatrixText(text);
  if (rows.length === 0) return target;

  const next = target.map((row) => row.slice());
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      const rr = startRow + r;
      const cc = startCol + c;
      if (rr < next.length && cc < next[0].length) {
        next[rr][cc] = value;
      }
    });
  });

  return next;
}

export function buildAugmentedMatrix(a: string[][], b: string[][]): string[][] {
  return a.map((row, r) => [...row, b[r]?.[0] ?? "0"]);
}

export function splitAugmentedMatrix(
  augmented: string[][],
  variableCount: number
): { A: string[][]; b: string[][] } {
  const A = augmented.map((row) => row.slice(0, variableCount));
  const b = augmented.map((row) => [row[variableCount] ?? "0"]);
  return { A, b };
}

export function toNumericMatrix(inputs: string[][]): number[][] | null {
  const numeric = inputs.map((row) =>
    row.map((value) => {
      const numberValue = numericValue(value);
      return numberValue;
    })
  );

  for (const row of numeric) {
    for (const value of row) {
      if (value === null) return null;
    }
  }

  return numeric as number[][];
}

function multiplyFractionMatrices(a: Fraction[][], b: Fraction[][]): Fraction[][] {
  const rows = a.length;
  const cols = b[0].length;
  const mid = b.length;
  const result: Fraction[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => new Fraction(0))
  );

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = new Fraction(0);
      for (let k = 0; k < mid; k += 1) {
        sum = sum.add(a[r][k].mul(b[k][c]));
      }
      result[r][c] = sum;
    }
  }

  return result;
}

export function transposeMatrix(matrix: string[][]): string[][] {
  return matrix[0].map((_, c) => matrix.map((row) => row[c]));
}

export function scalarMultiplyMatrix(matrix: string[][], scalar: string): string[][] {
  const numericScalar = tryFraction(scalar);
  const numericMatrix = toFractionMatrix(matrix);

  if (numericScalar && numericMatrix) {
    return fractionMatrixToString(
      numericMatrix.map((row) => row.map((value) => value.mul(numericScalar)))
    );
  }

  return matrix.map((row) => row.map((value) => mulExpr(scalar, value)));
}

export function addMatrices(a: string[][], b: string[][]): string[][] {
  const numericA = toFractionMatrix(a);
  const numericB = toFractionMatrix(b);

  if (numericA && numericB) {
    return fractionMatrixToString(
      numericA.map((row, r) => row.map((value, c) => value.add(numericB[r][c])))
    );
  }

  return a.map((row, r) => row.map((value, c) => addExpr(value, b[r][c])));
}

export function subtractMatrices(a: string[][], b: string[][]): string[][] {
  const numericA = toFractionMatrix(a);
  const numericB = toFractionMatrix(b);

  if (numericA && numericB) {
    return fractionMatrixToString(
      numericA.map((row, r) => row.map((value, c) => value.sub(numericB[r][c])))
    );
  }

  return a.map((row, r) => row.map((value, c) => subExpr(value, b[r][c])));
}

export function multiplyMatrices(a: string[][], b: string[][]): string[][] {
  const numericA = toFractionMatrix(a);
  const numericB = toFractionMatrix(b);

  if (numericA && numericB) {
    return fractionMatrixToString(multiplyFractionMatrices(numericA, numericB));
  }

  const rows = a.length;
  const cols = b[0].length;
  const mid = b.length;
  const result = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "0")
  );

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = "0";
      for (let k = 0; k < mid; k += 1) {
        sum = addExpr(sum, mulExpr(a[r][k], b[k][c]));
      }
      result[r][c] = sum;
    }
  }

  return result;
}

function rrefFraction(matrix: string[][]): string[][] {
  const work = toFractionMatrix(matrix);
  if (!work) return matrix;

  const rows = work.length;
  const cols = work[0]?.length ?? 0;
  let lead = 0;

  for (let r = 0; r < rows && lead < cols; r += 1) {
    let i = r;
    while (i < rows && isZeroFraction(work[i][lead])) {
      i += 1;
    }

    if (i === rows) {
      lead += 1;
      r -= 1;
      continue;
    }

    let best = i;
    let bestAbs = Math.abs(work[i][lead].valueOf());
    for (let candidate = i + 1; candidate < rows; candidate += 1) {
      if (isZeroFraction(work[candidate][lead])) continue;
      const abs = Math.abs(work[candidate][lead].valueOf());
      if (abs > bestAbs) {
        bestAbs = abs;
        best = candidate;
      }
    }

    if (best !== r) {
      const temp = work[r];
      work[r] = work[best];
      work[best] = temp;
    }

    const pivot = work[r][lead];
    if (!isZeroFraction(pivot)) {
      for (let c = 0; c < cols; c += 1) {
        work[r][c] = work[r][c].div(pivot);
      }
    }

    for (let rr = 0; rr < rows; rr += 1) {
      if (rr === r) continue;
      const factor = work[rr][lead];
      if (isZeroFraction(factor)) continue;
      for (let c = 0; c < cols; c += 1) {
        work[rr][c] = work[rr][c].sub(factor.mul(work[r][c]));
      }
    }

    lead += 1;
  }

  return fractionMatrixToString(work);
}

function rrefSymbolic(matrix: string[][]): string[][] {
  const work = cloneMatrix(matrix).map((row) => row.map((value) => simplifyExpr(value)));
  const rows = work.length;
  const cols = work[0]?.length ?? 0;
  let lead = 0;

  for (let r = 0; r < rows && lead < cols; r += 1) {
    let i = r;
    while (i < rows && isZeroExpr(work[i][lead])) {
      i += 1;
    }

    if (i === rows) {
      lead += 1;
      r -= 1;
      continue;
    }

    let best = i;
    let bestAbs = -1;
    const initialNumeric = numericValue(work[i][lead]);
    if (initialNumeric !== null) bestAbs = Math.abs(initialNumeric);

    for (let candidate = i + 1; candidate < rows; candidate += 1) {
      if (isZeroExpr(work[candidate][lead])) continue;
      const numeric = numericValue(work[candidate][lead]);
      if (numeric === null) continue;
      const abs = Math.abs(numeric);
      if (abs > bestAbs) {
        bestAbs = abs;
        best = candidate;
      }
    }

    if (best !== r) {
      const temp = work[r];
      work[r] = work[best];
      work[best] = temp;
    }

    const pivot = work[r][lead];
    if (!isZeroExpr(pivot)) {
      const inv = divExpr("1", pivot);
      for (let c = 0; c < cols; c += 1) {
        work[r][c] = mulExpr(work[r][c], inv);
      }
    }

    for (let rr = 0; rr < rows; rr += 1) {
      if (rr === r) continue;
      if (isZeroExpr(work[rr][lead])) continue;
      const factor = work[rr][lead];
      for (let c = 0; c < cols; c += 1) {
        work[rr][c] = subExpr(work[rr][c], mulExpr(factor, work[r][c]));
      }
    }

    lead += 1;
  }

  return work;
}

export function rrefMatrix(matrix: string[][]): string[][] {
  if (isNumericMatrix(matrix)) {
    return rrefFraction(matrix);
  }
  return rrefSymbolic(matrix);
}

export function rankMatrix(matrix: string[][]): number {
  const reduced = rrefMatrix(matrix);
  return reduced.reduce((count, row) => {
    const hasNonZero = row.some((value) => !isZeroExpr(value));
    return count + (hasNonZero ? 1 : 0);
  }, 0);
}

export function inverseMatrix(matrix: string[][]): string[][] | null {
  const size = matrix.length;
  if (size === 0 || matrix[0].length !== size) return null;

  const numeric = toFractionMatrix(matrix);
  if (numeric) {
    const left = numeric.map((row) => row.map((value) => new Fraction(value)));
    const right: Fraction[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => new Fraction(r === c ? 1 : 0))
    );

    for (let col = 0; col < size; col += 1) {
      let pivotRow = col;
      let maxAbs = Math.abs(left[col][col].valueOf());
      for (let r = col + 1; r < size; r += 1) {
        const abs = Math.abs(left[r][col].valueOf());
        if (abs > maxAbs) {
          maxAbs = abs;
          pivotRow = r;
        }
      }

      if (isZeroFraction(left[pivotRow][col])) return null;

      if (pivotRow !== col) {
        [left[col], left[pivotRow]] = [left[pivotRow], left[col]];
        [right[col], right[pivotRow]] = [right[pivotRow], right[col]];
      }

      const pivot = left[col][col];
      for (let c = 0; c < size; c += 1) {
        left[col][c] = left[col][c].div(pivot);
        right[col][c] = right[col][c].div(pivot);
      }

      for (let r = 0; r < size; r += 1) {
        if (r === col) continue;
        const factor = left[r][col];
        if (isZeroFraction(factor)) continue;
        for (let c = 0; c < size; c += 1) {
          left[r][c] = left[r][c].sub(factor.mul(left[col][c]));
          right[r][c] = right[r][c].sub(factor.mul(right[col][c]));
        }
      }
    }

    return fractionMatrixToString(right);
  }

  const left = cloneMatrix(matrix).map((row) => row.map((value) => simplifyExpr(value)));
  const right: string[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? "1" : "0"))
  );

  for (let col = 0; col < size; col += 1) {
    let pivotRow = -1;
    let maxAbs = -1;
    let firstNonZero: number | null = null;

    for (let r = col; r < size; r += 1) {
      const value = left[r][col];
      if (isZeroExpr(value)) continue;
      if (firstNonZero === null) firstNonZero = r;
      const numericValueAtCell = numericValue(value);
      if (numericValueAtCell !== null) {
        const abs = Math.abs(numericValueAtCell);
        if (abs > maxAbs) {
          maxAbs = abs;
          pivotRow = r;
        }
      }
    }

    if (pivotRow === -1) {
      if (firstNonZero === null) return null;
      pivotRow = firstNonZero;
    }

    if (pivotRow !== col) {
      [left[col], left[pivotRow]] = [left[pivotRow], left[col]];
      [right[col], right[pivotRow]] = [right[pivotRow], right[col]];
    }

    const pivot = left[col][col];
    if (isZeroExpr(pivot)) return null;

    for (let c = 0; c < size; c += 1) {
      left[col][c] = divExpr(left[col][c], pivot);
      right[col][c] = divExpr(right[col][c], pivot);
    }

    for (let r = 0; r < size; r += 1) {
      if (r === col || isZeroExpr(left[r][col])) continue;
      const factor = left[r][col];
      for (let c = 0; c < size; c += 1) {
        left[r][c] = subExpr(left[r][c], mulExpr(factor, left[col][c]));
        right[r][c] = subExpr(right[r][c], mulExpr(factor, right[col][c]));
      }
    }
  }

  return right;
}

export function determinant(matrix: string[][]): string {
  const size = matrix.length;
  if (size === 0 || matrix[0].length !== size) return "0";

  const numeric = toFractionMatrix(matrix);
  if (numeric) {
    const work = numeric.map((row) => row.map((value) => new Fraction(value)));
    let det = new Fraction(1);
    let sign = 1;

    for (let col = 0; col < size; col += 1) {
      let pivotRow = col;
      let maxAbs = Math.abs(work[col][col].valueOf());
      for (let r = col + 1; r < size; r += 1) {
        const abs = Math.abs(work[r][col].valueOf());
        if (abs > maxAbs) {
          maxAbs = abs;
          pivotRow = r;
        }
      }

      if (isZeroFraction(work[pivotRow][col])) return "0";
      if (pivotRow !== col) {
        [work[col], work[pivotRow]] = [work[pivotRow], work[col]];
        sign *= -1;
      }

      const pivot = work[col][col];
      det = det.mul(pivot);
      for (let r = col + 1; r < size; r += 1) {
        const factor = work[r][col].div(pivot);
        for (let c = col; c < size; c += 1) {
          work[r][c] = work[r][c].sub(factor.mul(work[col][c]));
        }
      }
    }

    if (sign < 0) det = det.neg();
    return fractionToString(det);
  }

  if (size === 1) return simplifyExpr(matrix[0][0]);
  if (size === 2) {
    return simplifyExpr(
      `(${matrix[0][0]}) * (${matrix[1][1]}) - (${matrix[0][1]}) * (${matrix[1][0]})`
    );
  }

  let det = "0";
  for (let c = 0; c < size; c += 1) {
    const minor = matrix.slice(1).map((row) => row.filter((_, idx) => idx !== c));
    const sign = c % 2 === 0 ? "1" : "-1";
    const term = simplifyExpr(`(${sign}) * (${matrix[0][c]}) * (${determinant(minor)})`);
    det = addExpr(det, term);
  }

  return det;
}

export function computeOperationResult(options: {
  op: "transpose" | "simplify" | "scalar" | "square" | "add" | "subtract" | "multiply" | "inverse" | "rank" | "determinant";
  matrixA: string[][];
  matrixB: string[][];
  scalar: string;
}): MatrixOperationResult {
  const { op, matrixA, matrixB, scalar } = options;

  if (op === "transpose") {
    return {
      matrix: transposeMatrix(matrixA),
      text: "\u77e9\u9635\u8f6c\u7f6e\u5df2\u5b8c\u6210",
      tone: "success",
    };
  }

  if (op === "simplify") {
    return {
      matrix: rrefMatrix(matrixA),
      text: "\u884c\u6700\u7b80\u9636\u68af\u5f62\uff08RREF\uff09\u5df2\u751f\u6210",
      tone: "success",
    };
  }

  if (op === "scalar") {
    return {
      matrix: scalarMultiplyMatrix(matrixA, simplifyExpr(scalar || "1")),
      text: "\u6570\u4e58\u8fd0\u7b97\u5df2\u5b8c\u6210",
      tone: "success",
    };
  }

  if (op === "square") {
    if (matrixA.length !== matrixA[0].length) {
      return {
        matrix: null,
        text: "A^2 \u4ec5\u652f\u6301\u65b9\u9635 A",
        tone: "error",
      };
    }

    return {
      matrix: multiplyMatrices(matrixA, matrixA),
      text: "\u77e9\u9635\u5e73\u65b9 A*A \u5df2\u5b8c\u6210",
      tone: "success",
    };
  }

  if (op === "inverse") {
    if (matrixA.length !== matrixA[0].length) {
      return {
        matrix: null,
        text: "\u6c42\u9006\u4ec5\u652f\u6301\u65b9\u9635 A",
        tone: "error",
      };
    }

    const inverse = inverseMatrix(matrixA);
    if (!inverse) {
      return {
        matrix: null,
        text: "\u77e9\u9635\u4e0d\u53ef\u9006\uff08det(A)=0 \u6216\u4e3b\u5143\u9000\u5316\uff09",
        tone: "error",
      };
    }

    return {
      matrix: inverse,
      text: "\u77e9\u9635 A \u7684\u9006\u5df2\u8ba1\u7b97",
      tone: "success",
    };
  }

  if (op === "rank") {
    return {
      matrix: null,
      text: `rank(A) = ${rankMatrix(matrixA)}` ,
      tone: "success",
    };
  }

  if (op === "determinant") {
    if (matrixA.length !== matrixA[0].length) {
      return {
        matrix: null,
        text: "\u884c\u5217\u5f0f\u8ba1\u7b97\u4ec5\u652f\u6301\u65b9\u9635 A",
        tone: "error",
      };
    }

    return {
      matrix: null,
      text: `det(A) = ${determinant(matrixA)}`,
      tone: "success",
    };
  }

  if (op === "multiply") {
    if (matrixA[0].length !== matrixB.length) {
      return {
        matrix: null,
        text: "\u77e9\u9635\u4e58\u6cd5\u8981\u6c42 A \u7684\u5217\u6570\u7b49\u4e8e B \u7684\u884c\u6570",
        tone: "error",
      };
    }

    return {
      matrix: multiplyMatrices(matrixA, matrixB),
      text: "\u77e9\u9635\u4e58\u6cd5 A*B \u5df2\u5b8c\u6210",
      tone: "success",
    };
  }

  if (op === "add" || op === "subtract") {
    if (
      matrixA.length !== matrixB.length ||
      matrixA[0].length !== matrixB[0].length
    ) {
      return {
        matrix: null,
        text: op === "add"
          ? "\u77e9\u9635\u52a0\u6cd5\u8981\u6c42 A \u4e0e B \u540c\u578b"
          : "\u77e9\u9635\u51cf\u6cd5\u8981\u6c42 A \u4e0e B \u540c\u578b",
        tone: "error",
      };
    }

    return {
      matrix: op === "add" ? addMatrices(matrixA, matrixB) : subtractMatrices(matrixA, matrixB),
      text: op === "add"
        ? "\u77e9\u9635\u52a0\u6cd5 A+B \u5df2\u5b8c\u6210"
        : "\u77e9\u9635\u51cf\u6cd5 A-B \u5df2\u5b8c\u6210",
      tone: "success",
    };
  }

  return {
    matrix: null,
    text: "\u4e0d\u652f\u6301\u7684\u8fd0\u7b97",
    tone: "error",
  };
}
