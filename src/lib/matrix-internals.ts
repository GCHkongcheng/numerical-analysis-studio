import Fraction from "fraction.js";
import { evaluate, simplify } from "mathjs";

import type { EigenComponent } from "@/types/matrix";
import {
  EPS,
} from "./matrix-format";

export {
  EPS,
  cloneMatrix,
  formatNumber,
  formatNumberPrecise,
  toPreciseInputMatrix,
} from "./matrix-format";

export function simplifyExpr(expr: string): string {
  try {
    return simplify(expr).toString();
  } catch {
    return expr;
  }
}

export function numericValue(expr: string): number | null {
  const trimmed = expr.trim();
  if (!trimmed) return 0;

  try {
    return new Fraction(trimmed).valueOf();
  } catch {
    // fall through to mathjs
  }

  try {
    const value = evaluate(trimmed);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return null;
  } catch {
    return null;
  }
}

export function isZeroExpr(expr: string): boolean {
  const simplified = simplifyExpr(expr);
  if (simplified === "0") return true;
  const numeric = numericValue(simplified);
  return numeric !== null ? Math.abs(numeric) < EPS : false;
}

export function tryFraction(expr: string): Fraction | null {
  try {
    return new Fraction(expr.trim() || "0");
  } catch {
    return null;
  }
}

export function isZeroFraction(value: Fraction): boolean {
  return Number(value.n) === 0;
}

export function fractionToString(value: Fraction): string {
  if (isZeroFraction(value)) return "0";
  return value.toFraction();
}

export function toFractionMatrix(matrix: string[][]): Fraction[][] | null {
  const converted: Fraction[][] = [];
  for (const row of matrix) {
    const nextRow: Fraction[] = [];
    for (const value of row) {
      const parsed = tryFraction(value);
      if (!parsed) return null;
      nextRow.push(parsed);
    }
    converted.push(nextRow);
  }
  return converted;
}

export function fractionMatrixToString(matrix: Fraction[][]): string[][] {
  return matrix.map((row) => row.map((value) => fractionToString(value)));
}

export function isNumericMatrix(matrix: string[][]): boolean {
  return matrix.every((row) => row.every((value) => tryFraction(value) !== null));
}

export function addExpr(a: string, b: string): string {
  return simplifyExpr(`(${a}) + (${b})`);
}

export function subExpr(a: string, b: string): string {
  return simplifyExpr(`(${a}) - (${b})`);
}

export function mulExpr(a: string, b: string): string {
  return simplifyExpr(`(${a}) * (${b})`);
}

export function divExpr(a: string, b: string): string {
  return simplifyExpr(`(${a}) / (${b})`);
}

export function toPlainArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "valueOf" in value) {
    const raw = (value as { valueOf: () => unknown }).valueOf();
    if (Array.isArray(raw)) return raw;
  }
  return [];
}

export function normalizeNearZero(value: number): number {
  return Math.abs(value) < EPS ? 0 : value;
}

export function toComplexParts(value: EigenComponent): { re: number; im: number } {
  if (typeof value === "number") {
    return { re: value, im: 0 };
  }
  return value;
}

export function componentMagnitude(value: EigenComponent): number {
  const parts = toComplexParts(value);
  return Math.hypot(parts.re, parts.im);
}

export function eigenApproxEqual(a: EigenComponent, b: EigenComponent, tol = 1e-8): boolean {
  const pa = toComplexParts(a);
  const pb = toComplexParts(b);
  const scale = Math.max(1, componentMagnitude(a), componentMagnitude(b));
  return Math.hypot(pa.re - pb.re, pa.im - pb.im) <= tol * scale;
}

export function multiplyNumericMatrices(a: number[][], b: number[][]): number[][] | null {
  const rows = a.length;
  const inner = a[0]?.length ?? 0;
  const cols = b[0]?.length ?? 0;

  if (!rows || !inner || !b.length || inner !== b.length) return null;

  const output: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      let sum = 0;
      for (let k = 0; k < inner; k += 1) {
        sum += a[r][k] * b[k][c];
      }
      output[r][c] = sum;
    }
  }

  return output;
}

export function maxAbsMatrixDiff(a: number[][], b: number[][]): number | null {
  if (a.length !== b.length || a[0]?.length !== b[0]?.length) return null;

  let maxAbs = 0;
  for (let r = 0; r < a.length; r += 1) {
    for (let c = 0; c < a[0].length; c += 1) {
      maxAbs = Math.max(maxAbs, Math.abs(a[r][c] - b[r][c]));
    }
  }
  return maxAbs;
}

export function transposeNumericMatrix(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => matrix[r][c])
  );
}

export function identityNumericMatrix(size: number): number[][] {
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? 1 : 0))
  );
}

export function normalizedNumericMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => row.map((value) => normalizeNearZero(value)));
}

export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function matVecMultiply(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => {
    let sum = 0;
    for (let i = 0; i < row.length; i += 1) {
      sum += row[i] * vector[i];
    }
    return sum;
  });
}

export function maxAbsDelta(a: number[], b: number[]): number {
  let maxAbs = 0;
  for (let i = 0; i < a.length; i += 1) {
    maxAbs = Math.max(maxAbs, Math.abs(a[i] - b[i]));
  }
  return maxAbs;
}

export function zeroNumericMatrix(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

export function addNumericMatrices(a: number[][], b: number[][]): number[][] | null {
  if (a.length !== b.length || a[0]?.length !== b[0]?.length) return null;
  return a.map((row, r) =>
    row.map((value, c) => normalizeNearZero(value + b[r][c]))
  );
}

export function scaleNumericMatrix(matrix: number[][], scalar: number): number[][] {
  return matrix.map((row) =>
    row.map((value) => normalizeNearZero(value * scalar))
  );
}

export function invertNumericMatrix(matrix: number[][]): number[][] | null {
  const size = matrix.length;
  if (!size || matrix.some((row) => row.length !== size)) return null;

  const augmented = matrix.map((row, r) => [
    ...row.map((value) => value),
    ...Array.from({ length: size }, (_, c) => (c === r ? 1 : 0)),
  ]);

  for (let col = 0; col < size; col += 1) {
    let pivotRow = col;
    let maxAbs = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < size; row += 1) {
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

    const pivot = augmented[col][col];
    for (let c = 0; c < augmented[col].length; c += 1) {
      augmented[col][c] /= pivot;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      if (Math.abs(factor) < EPS) continue;
      for (let c = 0; c < augmented[row].length; c += 1) {
        augmented[row][c] -= factor * augmented[col][c];
      }
    }
  }

  return augmented.map((row) =>
    row.slice(size).map((value) => normalizeNearZero(value))
  );
}

export function isValidNumericMatrix(matrix: number[][]): boolean {
  if (!Array.isArray(matrix) || matrix.length === 0) return false;
  const cols = matrix[0]?.length ?? 0;
  if (cols === 0) return false;
  return matrix.every(
    (row) =>
      Array.isArray(row) &&
      row.length === cols &&
      row.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

export function matrixOneNormInternal(matrix: number[][]): number {
  const rows = matrix.length;
  const cols = matrix[0].length;
  let maxColumnSum = 0;

  for (let c = 0; c < cols; c += 1) {
    let sum = 0;
    for (let r = 0; r < rows; r += 1) {
      sum += Math.abs(matrix[r][c]);
    }
    if (sum > maxColumnSum) {
      maxColumnSum = sum;
    }
  }

  return maxColumnSum;
}

export function matrixInfinityNormInternal(matrix: number[][]): number {
  let maxRowSum = 0;

  for (const row of matrix) {
    const rowSum = row.reduce((sum, value) => sum + Math.abs(value), 0);
    if (rowSum > maxRowSum) {
      maxRowSum = rowSum;
    }
  }

  return maxRowSum;
}

export function maxAbsVectorNorm(vector: number[]): number {
  return vector.reduce((maxAbs, value) => Math.max(maxAbs, Math.abs(value)), 0);
}

export function safeRelativeError(deltaNorm: number, baseNorm: number): number {
  const denominator = Math.max(baseNorm, EPS);
  return deltaNorm / denominator;
}
