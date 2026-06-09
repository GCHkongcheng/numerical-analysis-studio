import Fraction from "fraction.js";
import { eigs } from "mathjs";

import type {
  DisplayMode,
  EigenAnalysisResult,
  EigenComponent,
  EigenMultiplicity,
} from "@/types/matrix";
import {
  EPS,
  componentMagnitude,
  eigenApproxEqual,
  formatNumber,
  fractionToString,
  normalizeNearZero,
  toComplexParts,
  toPlainArray,
} from "./matrix-internals";

type EigenCluster = {
  value: EigenComponent;
  algebraic: number;
};

function formatRealByMode(value: number, mode: DisplayMode): string {
  if (mode === "fraction") {
    return fractionToString(new Fraction(value).simplify(1e-8));
  }
  return formatNumber(value);
}

export function formatEigenComponent(
  value: EigenComponent,
  mode: DisplayMode
): string {
  const { re, im } = toComplexParts(value);

  if (Math.abs(im) < EPS) {
    return formatRealByMode(re, mode);
  }

  const reText = formatNumber(re);
  const imagAbs = Math.abs(im);
  const imagUnit = Math.abs(imagAbs - 1) < EPS ? "i" : `${formatNumber(imagAbs)}i`;

  if (Math.abs(re) < EPS) {
    return im < 0 ? `-${imagUnit}` : imagUnit;
  }

  return im < 0 ? `${reText} - ${imagUnit}` : `${reText} + ${imagUnit}`;
}

function toEigenComponent(value: unknown): EigenComponent | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeNearZero(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return normalizeNearZero(parsed);
    }
  }

  if (value && typeof value === "object") {
    const asComplex = value as { re?: unknown; im?: unknown };
    if (
      typeof asComplex.re === "number" &&
      Number.isFinite(asComplex.re) &&
      typeof asComplex.im === "number" &&
      Number.isFinite(asComplex.im)
    ) {
      const re = normalizeNearZero(asComplex.re);
      const im = normalizeNearZero(asComplex.im);
      if (im === 0) return re;
      return { re, im };
    }

    if ("toNumber" in value && typeof (value as { toNumber?: unknown }).toNumber === "function") {
      const numberLike = (value as { toNumber: () => unknown }).toNumber();
      if (typeof numberLike === "number" && Number.isFinite(numberLike)) {
        return normalizeNearZero(numberLike);
      }
    }

    if ("valueOf" in value && typeof (value as { valueOf?: unknown }).valueOf === "function") {
      const primitive = (value as { valueOf: () => unknown }).valueOf();
      if (primitive !== value) {
        const parsed = toEigenComponent(primitive);
        if (parsed !== null) return parsed;
      }
    }
  }

  return null;
}

function clusterEigenValues(values: EigenComponent[]): EigenCluster[] {
  const clusters: EigenCluster[] = [];

  for (const value of values) {
    const cluster = clusters.find((item) => eigenApproxEqual(item.value, value));
    if (cluster) {
      cluster.algebraic += 1;
      continue;
    }

    clusters.push({ value, algebraic: 1 });
  }

  return clusters;
}

export function eigsWithMathjs(matrix: number[][]): EigenAnalysisResult | null {
  try {
    const result = eigs(matrix as never) as {
      values: unknown;
      eigenvectors?: Array<{ value: unknown; vector: unknown }>;
    };

    const values = toPlainArray(result.values)
      .map((entry) => toEigenComponent(entry))
      .filter((entry): entry is EigenComponent => entry !== null);

    if (!values.length) return null;

    const eigenPairs = (result.eigenvectors ?? [])
      .map((pair) => {
        const value = toEigenComponent(pair.value);
        const vector = toPlainArray(pair.vector)
          .map((entry) => toEigenComponent(entry))
          .filter((entry): entry is EigenComponent => entry !== null);

        if (value === null || vector.length === 0) {
          return null;
        }

        return { value, vector };
      })
      .filter((pair): pair is { value: EigenComponent; vector: EigenComponent[] } => pair !== null);

    const multiplicities: EigenMultiplicity[] = clusterEigenValues(values).map((cluster) => ({
      value: cluster.value,
      algebraic: cluster.algebraic,
      geometric: eigenPairs.filter((pair) => eigenApproxEqual(pair.value, cluster.value)).length,
    }));

    const diagonalizable = multiplicities.every(
      (item) => item.geometric === item.algebraic
    );

    return {
      values,
      vectors: eigenPairs.map((pair) => pair.vector),
      eigenPairs,
      multiplicities,
      diagonalizable,
    };
  } catch {
    return null;
  }
}

function sortEigenComponents(components: EigenComponent[]): EigenComponent[] {
  return [...components].sort((left, right) => {
    const a = toComplexParts(left);
    const b = toComplexParts(right);
    if (Math.abs(a.re - b.re) > 1e-8) return a.re - b.re;
    return a.im - b.im;
  });
}

export function relativeEigenError(
  baseline: EigenComponent[],
  candidate: EigenComponent[]
): number | null {
  if (!baseline.length || baseline.length !== candidate.length) return null;

  const left = sortEigenComponents(baseline);
  const right = sortEigenComponents(candidate);

  let maxDiff = 0;
  let baseMagnitude = 0;

  for (let i = 0; i < left.length; i += 1) {
    const a = toComplexParts(left[i]);
    const b = toComplexParts(right[i]);
    const diff = Math.hypot(a.re - b.re, a.im - b.im);
    maxDiff = Math.max(maxDiff, diff);
    baseMagnitude = Math.max(baseMagnitude, componentMagnitude(left[i]));
  }

  return normalizeNearZero(maxDiff / Math.max(baseMagnitude, EPS));
}
