import type { EigenComponent } from "../../src/types/matrix";

export type Complex = {
  re: number;
  im: number;
};

export const EIG_TOL = 1e-7;
export const LU_TOL = 1e-10;
export const SYSTEM_TOL = 1e-10;

export function toComplex(value: EigenComponent): Complex {
  if (typeof value === "number") {
    return { re: value, im: 0 };
  }
  return value;
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function abs(value: Complex): number {
  return Math.hypot(value.re, value.im);
}

export function distance(a: EigenComponent, b: Complex): number {
  const ca = toComplex(a);
  return Math.hypot(ca.re - b.re, ca.im - b.im);
}

export function hasEigenvalue(values: EigenComponent[], target: Complex, tol = EIG_TOL): boolean {
  return values.some((value) => distance(value, target) < tol);
}

export function eigenResidual(
  matrix: number[][],
  lambda: EigenComponent,
  vector: EigenComponent[]
): number {
  const lam = toComplex(lambda);
  let maxErr = 0;

  for (let r = 0; r < matrix.length; r += 1) {
    let lhs: Complex = { re: 0, im: 0 };
    for (let c = 0; c < matrix[0].length; c += 1) {
      const a = matrix[r][c];
      const v = toComplex(vector[c]);
      lhs = add(lhs, { re: a * v.re, im: a * v.im });
    }

    const rhs = mul(lam, toComplex(vector[r]));
    maxErr = Math.max(maxErr, abs(sub(lhs, rhs)));
  }

  return maxErr;
}
