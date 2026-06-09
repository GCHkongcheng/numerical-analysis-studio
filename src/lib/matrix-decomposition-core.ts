import type { CholeskyResult, LUResult, QRResult, SVDResult } from "@/types/matrix";
import {
  EPS,
  addExpr,
  cloneMatrix,
  divExpr,
  dotProduct,
  formatNumberPrecise,
  identityNumericMatrix,
  isZeroExpr,
  matVecMultiply,
  maxAbsMatrixDiff,
  mulExpr,
  multiplyNumericMatrices,
  normalizeNearZero,
  normalizedNumericMatrix,
  numericValue,
  simplifyExpr,
  subExpr,
  toComplexParts,
  toPreciseInputMatrix,
  transposeNumericMatrix,
} from "./matrix-internals";
import { toNumericMatrix } from "./matrix-basic-core";
import { eigsWithMathjs } from "./matrix-eigen-core";

export function luDecomposition(matrix: string[][]): LUResult | null {
  const size = matrix.length;
  if (size === 0 || matrix[0].length !== size) return null;

  const A: string[][] = cloneMatrix(matrix).map((row) => row.map((value) => simplifyExpr(value)));
  const L: string[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? "1" : "0"))
  );
  const U: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "0")
  );
  const P: string[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? "1" : "0"))
  );

  for (let k = 0; k < size; k += 1) {
    let pivotRow = -1;
    let maxAbs = -1;
    let firstNonZero: number | null = null;

    for (let r = k; r < size; r += 1) {
      const value = A[r][k];
      if (isZeroExpr(value)) continue;
      if (firstNonZero === null) firstNonZero = r;
      const numericCell = numericValue(value);
      if (numericCell !== null) {
        const abs = Math.abs(numericCell);
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

    if (pivotRow !== k) {
      [A[k], A[pivotRow]] = [A[pivotRow], A[k]];
      [P[k], P[pivotRow]] = [P[pivotRow], P[k]];
      for (let c = 0; c < k; c += 1) {
        const temp = L[k][c];
        L[k][c] = L[pivotRow][c];
        L[pivotRow][c] = temp;
      }
    }

    for (let j = k; j < size; j += 1) {
      let sum = "0";
      for (let s = 0; s < k; s += 1) {
        sum = addExpr(sum, mulExpr(L[k][s], U[s][j]));
      }
      U[k][j] = subExpr(A[k][j], sum);
    }

    if (isZeroExpr(U[k][k])) return null;

    for (let i = k + 1; i < size; i += 1) {
      let sum = "0";
      for (let s = 0; s < k; s += 1) {
        sum = addExpr(sum, mulExpr(L[i][s], U[s][k]));
      }
      L[i][k] = divExpr(subExpr(A[i][k], sum), U[k][k]);
    }
  }

  return { L, U, P };
}

export function luDecompositionPlain(matrix: string[][]): LUResult | null {
  const size = matrix.length;
  if (size === 0 || matrix[0].length !== size) return null;

  const A: string[][] = cloneMatrix(matrix).map((row) =>
    row.map((value) => simplifyExpr(value))
  );

  const L: string[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? "1" : "0"))
  );
  const U: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "0")
  );
  const P: string[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? "1" : "0"))
  );

  for (let k = 0; k < size; k += 1) {
    for (let j = k; j < size; j += 1) {
      let sum = "0";
      for (let s = 0; s < k; s += 1) {
        sum = addExpr(sum, mulExpr(L[k][s], U[s][j]));
      }
      U[k][j] = subExpr(A[k][j], sum);
    }

    if (isZeroExpr(U[k][k])) return null;

    for (let i = k + 1; i < size; i += 1) {
      let sum = "0";
      for (let s = 0; s < k; s += 1) {
        sum = addExpr(sum, mulExpr(L[i][s], U[s][k]));
      }
      L[i][k] = divExpr(subExpr(A[i][k], sum), U[k][k]);
    }
  }

  return { L, U, P };
}

export function qrDecomposition(matrix: string[][]): QRResult | null {
  const numeric = toNumericMatrix(matrix);
  if (!numeric) return null;

  const rowCount = numeric.length;
  const colCount = numeric[0]?.length ?? 0;
  if (!rowCount || !colCount || rowCount < colCount) return null;

  const qColumns: number[][] = [];
  const rMatrix: number[][] = Array.from({ length: colCount }, () =>
    Array.from({ length: colCount }, () => 0)
  );

  for (let col = 0; col < colCount; col += 1) {
    const vector = Array.from({ length: rowCount }, (_, r) => numeric[r][col]);

    for (let prev = 0; prev < qColumns.length; prev += 1) {
      const qPrev = qColumns[prev];
      let projection = 0;
      for (let i = 0; i < rowCount; i += 1) {
        projection += qPrev[i] * vector[i];
      }

      rMatrix[prev][col] = projection;
      for (let i = 0; i < rowCount; i += 1) {
        vector[i] -= projection * qPrev[i];
      }
    }

    const norm = Math.hypot(...vector);
    if (norm < EPS) return null;

    rMatrix[col][col] = norm;
    qColumns.push(vector.map((value) => value / norm));
  }

  const qMatrix = Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: colCount }, (_, c) => qColumns[c][r])
  );

  return {
    Q: toPreciseInputMatrix(normalizedNumericMatrix(qMatrix)),
    R: toPreciseInputMatrix(normalizedNumericMatrix(rMatrix)),
  };
}

export function qrResidual(input: string[][], qr: QRResult): number | null {
  const a = toNumericMatrix(input);
  const q = toNumericMatrix(qr.Q);
  const r = toNumericMatrix(qr.R);
  if (!a || !q || !r) return null;

  const qrProduct = multiplyNumericMatrices(q, r);
  if (!qrProduct) return null;
  return maxAbsMatrixDiff(a, qrProduct);
}

export function qrOrthogonalityResidual(qr: QRResult): number | null {
  const q = toNumericMatrix(qr.Q);
  if (!q) return null;

  const qt = transposeNumericMatrix(q);
  const qtq = multiplyNumericMatrices(qt, q);
  if (!qtq) return null;

  return maxAbsMatrixDiff(qtq, identityNumericMatrix(qtq.length));
}

function buildSigmaMatrix(singularValues: number[], rows: number, cols: number): number[][] {
  const sigma = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const count = Math.min(rows, cols, singularValues.length);

  for (let i = 0; i < count; i += 1) {
    sigma[i][i] = normalizeNearZero(singularValues[i]);
  }

  return sigma;
}

export function svdDecomposition(matrix: string[][]): SVDResult | null {
  const numeric = toNumericMatrix(matrix);
  if (!numeric) return null;

  const rowCount = numeric.length;
  const colCount = numeric[0]?.length ?? 0;
  if (!rowCount || !colCount) return null;

  const transpose = transposeNumericMatrix(numeric);
  const ata = multiplyNumericMatrices(transpose, numeric);
  if (!ata) return null;

  const eigen = eigsWithMathjs(ata);
  if (!eigen) return null;

  const candidates = eigen.eigenPairs
    .map((pair) => {
      const eigenValue = toComplexParts(pair.value);
      if (Math.abs(eigenValue.im) > 1e-6) return null;

      const vector = pair.vector.map((entry) => {
        const component = toComplexParts(entry);
        if (Math.abs(component.im) > 1e-6) return Number.NaN;
        return component.re;
      });

      if (vector.length !== colCount || vector.some((value) => !Number.isFinite(value))) {
        return null;
      }

      return {
        lambda: Math.max(0, normalizeNearZero(eigenValue.re)),
        vector,
      };
    })
    .filter((item): item is { lambda: number; vector: number[] } => item !== null)
    .sort((a, b) => b.lambda - a.lambda);

  if (!candidates.length) return null;

  const singularValues: number[] = [];
  const vColumns: number[][] = [];
  const uColumns: number[][] = [];

  for (const candidate of candidates) {
    let v = candidate.vector.slice();

    for (const prev of vColumns) {
      const projection = dotProduct(prev, v);
      v = v.map((value, idx) => value - projection * prev[idx]);
    }

    const vNorm = Math.hypot(...v);
    if (vNorm < EPS) continue;
    v = v.map((value) => value / vNorm);

    const sigma = Math.sqrt(Math.max(0, candidate.lambda));
    if (sigma < EPS) continue;

    let u = matVecMultiply(numeric, v).map((value) => value / sigma);
    for (const prev of uColumns) {
      const projection = dotProduct(prev, u);
      u = u.map((value, idx) => value - projection * prev[idx]);
    }

    const uNorm = Math.hypot(...u);
    if (uNorm < EPS) continue;
    u = u.map((value) => value / uNorm);

    singularValues.push(normalizeNearZero(sigma));
    vColumns.push(v);
    uColumns.push(u);

    if (singularValues.length >= Math.min(rowCount, colCount)) {
      break;
    }
  }

  if (!singularValues.length) {
    singularValues.push(0);
    vColumns.push(Array.from({ length: colCount }, (_, idx) => (idx === 0 ? 1 : 0)));
    uColumns.push(Array.from({ length: rowCount }, (_, idx) => (idx === 0 ? 1 : 0)));
  }

  const rank = singularValues.length;
  const uMatrix = Array.from({ length: rowCount }, (_, row) =>
    Array.from({ length: rank }, (_, col) => normalizeNearZero(uColumns[col][row]))
  );
  const vtMatrix = Array.from({ length: rank }, (_, row) =>
    Array.from({ length: colCount }, (_, col) => normalizeNearZero(vColumns[row][col]))
  );
  const sigma = buildSigmaMatrix(singularValues, rank, rank);

  return {
    U: toPreciseInputMatrix(normalizedNumericMatrix(uMatrix)),
    Sigma: toPreciseInputMatrix(normalizedNumericMatrix(sigma)),
    Vt: toPreciseInputMatrix(normalizedNumericMatrix(vtMatrix)),
    singularValues: singularValues.map((value) => formatNumberPrecise(value)),
  };
}

export function svdResidual(input: string[][], decomposition: SVDResult): number | null {
  const a = toNumericMatrix(input);
  const u = toNumericMatrix(decomposition.U);
  const sigma = toNumericMatrix(decomposition.Sigma);
  const vt = toNumericMatrix(decomposition.Vt);
  if (!a || !u || !sigma || !vt) return null;

  const us = multiplyNumericMatrices(u, sigma);
  if (!us) return null;

  const reconstructed = multiplyNumericMatrices(us, vt);
  if (!reconstructed) return null;

  return maxAbsMatrixDiff(a, reconstructed);
}

export function svdOrthogonalityResiduals(
  decomposition: SVDResult
): { u: number | null; v: number | null; max: number | null } {
  const u = toNumericMatrix(decomposition.U);
  const vt = toNumericMatrix(decomposition.Vt);
  if (!u || !vt) {
    return { u: null, v: null, max: null };
  }

  const ut = transposeNumericMatrix(u);
  const utu = multiplyNumericMatrices(ut, u);
  const uResidual = utu ? maxAbsMatrixDiff(utu, identityNumericMatrix(utu.length)) : null;

  const v = transposeNumericMatrix(vt);
  const vtv = multiplyNumericMatrices(vt, v);
  const vResidual = vtv ? maxAbsMatrixDiff(vtv, identityNumericMatrix(vtv.length)) : null;

  let maxResidual: number | null = null;
  if (uResidual !== null && vResidual !== null) {
    maxResidual = Math.max(uResidual, vResidual);
  } else {
    maxResidual = uResidual ?? vResidual;
  }

  return {
    u: uResidual,
    v: vResidual,
    max: maxResidual,
  };
}

export function choleskyDecomposition(matrix: string[][]): CholeskyResult | null {
  const numeric = toNumericMatrix(matrix);
  if (!numeric) return null;

  const size = numeric.length;
  if (!size || numeric[0].length !== size) return null;

  for (let r = 0; r < size; r += 1) {
    for (let c = r + 1; c < size; c += 1) {
      if (Math.abs(numeric[r][c] - numeric[c][r]) > 1e-8) {
        return null;
      }
    }
  }

  const lMatrix: number[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0)
  );

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = numeric[i][j];
      for (let k = 0; k < j; k += 1) {
        sum -= lMatrix[i][k] * lMatrix[j][k];
      }

      if (i === j) {
        if (sum <= EPS) return null;
        lMatrix[i][j] = Math.sqrt(sum);
      } else {
        if (Math.abs(lMatrix[j][j]) < EPS) return null;
        lMatrix[i][j] = sum / lMatrix[j][j];
      }
    }
  }

  const normalizedL = normalizedNumericMatrix(lMatrix);
  const ltMatrix = normalizedNumericMatrix(transposeNumericMatrix(lMatrix));

  return {
    L: toPreciseInputMatrix(normalizedL),
    Lt: toPreciseInputMatrix(ltMatrix),
  };
}

export function choleskyResidual(
  input: string[][],
  decomposition: CholeskyResult
): number | null {
  const a = toNumericMatrix(input);
  const l = toNumericMatrix(decomposition.L);
  const lt = toNumericMatrix(decomposition.Lt);
  if (!a || !l || !lt) return null;

  const product = multiplyNumericMatrices(l, lt);
  if (!product) return null;

  return maxAbsMatrixDiff(a, product);
}

export function luResidual(input: string[][], lu: LUResult): number | null {
  const a = toNumericMatrix(input);
  const l = toNumericMatrix(lu.L);
  const u = toNumericMatrix(lu.U);
  const p = toNumericMatrix(lu.P);

  if (!a || !l || !u || !p) return null;

  const pa = multiplyNumericMatrices(p, a);
  const luProduct = multiplyNumericMatrices(l, u);
  if (!pa || !luProduct) return null;

  return maxAbsMatrixDiff(pa, luProduct);
}

export function luResidualPlain(input: string[][], lu: LUResult): number | null {
  const a = toNumericMatrix(input);
  const l = toNumericMatrix(lu.L);
  const u = toNumericMatrix(lu.U);

  if (!a || !l || !u) return null;

  const luProduct = multiplyNumericMatrices(l, u);
  if (!luProduct) return null;

  return maxAbsMatrixDiff(a, luProduct);
}
