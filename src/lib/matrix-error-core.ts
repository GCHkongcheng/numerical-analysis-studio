import {
  invertNumericMatrix,
  isValidNumericMatrix,
  matrixInfinityNormInternal,
  matrixOneNormInternal,
  maxAbsVectorNorm,
  normalizeNearZero,
  safeRelativeError,
} from "./matrix-internals";

export function matrixOneNorm(matrix: number[][]): number | null {
  if (!isValidNumericMatrix(matrix)) return null;
  return normalizeNearZero(matrixOneNormInternal(matrix));
}

export function matrixInfinityNorm(matrix: number[][]): number | null {
  if (!isValidNumericMatrix(matrix)) return null;
  return normalizeNearZero(matrixInfinityNormInternal(matrix));
}

export function analyzeConditionNumbers(matrix: number[][]): {
  norm1: number;
  normInf: number;
  inverseNorm1: number | null;
  inverseNormInf: number | null;
  cond1: number | null;
  condInf: number | null;
  invertible: boolean;
} | null {
  if (!isValidNumericMatrix(matrix)) return null;
  if (matrix.length !== matrix[0].length) return null;

  const norm1 = matrixOneNormInternal(matrix);
  const normInf = matrixInfinityNormInternal(matrix);
  const inverse = invertNumericMatrix(matrix);

  if (!inverse) {
    return {
      norm1: normalizeNearZero(norm1),
      normInf: normalizeNearZero(normInf),
      inverseNorm1: null,
      inverseNormInf: null,
      cond1: null,
      condInf: null,
      invertible: false,
    };
  }

  const inverseNorm1 = matrixOneNormInternal(inverse);
  const inverseNormInf = matrixInfinityNormInternal(inverse);
  const cond1Raw = norm1 * inverseNorm1;
  const condInfRaw = normInf * inverseNormInf;

  return {
    norm1: normalizeNearZero(norm1),
    normInf: normalizeNearZero(normInf),
    inverseNorm1: normalizeNearZero(inverseNorm1),
    inverseNormInf: normalizeNearZero(inverseNormInf),
    cond1: Number.isFinite(cond1Raw) ? normalizeNearZero(cond1Raw) : null,
    condInf: Number.isFinite(condInfRaw) ? normalizeNearZero(condInfRaw) : null,
    invertible: true,
  };
}

export function perturbNumericMatrix(
  matrix: number[][],
  epsilon = 1e-6
): number[][] | null {
  if (!isValidNumericMatrix(matrix)) return null;
  return matrix.map((row) =>
    row.map((value) => normalizeNearZero(value + (Math.random() * 2 - 1) * epsilon))
  );
}

export function perturbNumericVector(
  vector: number[],
  epsilon = 1e-6
): number[] | null {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  if (vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  return vector.map((value) => normalizeNearZero(value + (Math.random() * 2 - 1) * epsilon));
}

export function relativeMatrixErrorInfinity(
  baseline: number[][],
  candidate: number[][]
): number | null {
  if (!isValidNumericMatrix(baseline) || !isValidNumericMatrix(candidate)) return null;
  if (
    baseline.length !== candidate.length ||
    baseline[0].length !== candidate[0].length
  ) {
    return null;
  }

  let deltaNorm = 0;
  for (let r = 0; r < baseline.length; r += 1) {
    let rowSum = 0;
    for (let c = 0; c < baseline[0].length; c += 1) {
      rowSum += Math.abs(candidate[r][c] - baseline[r][c]);
    }
    if (rowSum > deltaNorm) {
      deltaNorm = rowSum;
    }
  }

  const baseNorm = matrixInfinityNormInternal(baseline);
  return normalizeNearZero(safeRelativeError(deltaNorm, baseNorm));
}

export function relativeVectorErrorInfinity(
  baseline: number[],
  candidate: number[]
): number | null {
  if (!Array.isArray(baseline) || !Array.isArray(candidate)) return null;
  if (!baseline.length || baseline.length !== candidate.length) return null;
  if (
    baseline.some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    candidate.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    return null;
  }

  const delta = baseline.map((value, idx) => candidate[idx] - value);
  const deltaNorm = maxAbsVectorNorm(delta);
  const baseNorm = maxAbsVectorNorm(baseline);
  return normalizeNearZero(safeRelativeError(deltaNorm, baseNorm));
}
