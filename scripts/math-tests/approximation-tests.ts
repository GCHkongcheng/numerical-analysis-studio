import assert from "node:assert/strict";

import {
  chebyshevZeros,
  evaluatePolynomial,
  solveApproximation,
  solveFunctionExperiment,
  uniformNodes,
} from "../../src/lib/approximation-core";

function testInterpolationAndApproximation() {
  const quadraticPoints = [
    { x: 0, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 5 },
    { x: 3, y: 10 },
  ];

  const lagrange = solveApproximation({
    method: "lagrange",
    points: quadraticPoints,
    queryX: [1.5],
  });
  assert.ok(lagrange.powerCoefficients, "Lagrange should return power coefficients");
  assert.ok(Math.abs((lagrange.query[0].y ?? 0) - 3.25) < 1e-10, "Lagrange query should match x^2+1");
  assert.ok(lagrange.metrics.rmse < 1e-10, "Lagrange interpolation should pass through nodes");

  const newton = solveApproximation({
    method: "newton",
    points: quadraticPoints,
    queryX: [2.5],
  });
  assert.ok(newton.dividedDifferenceTable, "Newton should return a divided-difference table");
  assert.ok(Math.abs((newton.query[0].y ?? 0) - 7.25) < 1e-10, "Newton query should match x^2+1");

  const piecewise = solveApproximation({
    method: "piecewiseLinear",
    points: quadraticPoints,
    queryX: [1.5, 4],
  });
  assert.ok(Math.abs((piecewise.query[0].y ?? 0) - 3.5) < 1e-10, "Piecewise linear interpolation should interpolate inside interval");
  assert.equal(piecewise.query[1].y, null, "Piecewise linear interpolation should not extrapolate");

  const leastSquares = solveApproximation({
    method: "leastSquaresPolynomial",
    points: [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ],
    degree: 1,
    queryX: [4],
  });
  assert.ok(leastSquares.powerCoefficients, "Least squares should return coefficients");
  assert.ok(Math.abs(evaluatePolynomial(leastSquares.powerCoefficients ?? [], 4) - 9) < 1e-10, "Least-squares line should extrapolate y=2x+1");
  assert.ok((leastSquares.metrics.r2 ?? 0) > 0.999999, "Least-squares fit should report strong R2");

  const hermite = solveApproximation({
    method: "hermite",
    points: [
      { x: 0, y: 0, derivative: 0 },
      { x: 1, y: 1, derivative: 2 },
      { x: 2, y: 4, derivative: 4 },
    ],
    queryX: [1.5],
  });
  assert.ok(hermite.powerCoefficients, "Hermite should return power coefficients");
  assert.ok(Math.abs((hermite.query[0].y ?? 0) - 2.25) < 1e-10, "Hermite interpolation should honor derivative data for x^2");

  const spline = solveApproximation({
    method: "cubicSpline",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ],
    queryX: [1],
  });
  assert.equal(spline.splineSegments?.length, 2, "Natural cubic spline should return one segment per interval");
  assert.ok(Math.abs((spline.query[0].y ?? 0) - 1) < 1e-10, "Spline should pass through interpolation nodes");
}

function testFunctionApproximationExperiments() {
  const uniform = uniformNodes(4, -1, 1);
  assert.deepEqual(uniform, [-1, -0.5, 0, 0.5, 1], "Uniform node generation should include both endpoints");

  const chebyshev = chebyshevZeros(5, -1, 1);
  assert.equal(chebyshev.length, 5, "Chebyshev node generation should return requested count");
  assert.ok(chebyshev[0] < chebyshev[4], "Chebyshev nodes should be sorted");

  const least = solveFunctionExperiment({
    kind: "continuousLeastSquares",
    functionExpression: "x^2 + 1",
    intervalStart: -1,
    intervalEnd: 1,
    degree: 2,
    sampleCount: 180,
  });
  assert.ok(least.coefficients, "Continuous least-squares should return coefficients");
  assert.ok((least.metrics[0]?.maxError ?? 1) < 1e-8, "Quadratic continuous least-squares should recover x^2+1");

  const remez = solveFunctionExperiment({
    kind: "remez",
    functionExpression: "x^2 + 1",
    intervalStart: -1,
    intervalEnd: 1,
    degree: 2,
    sampleCount: 180,
  });
  assert.ok(remez.exchangePoints?.length === 4, "Degree-2 Remez should track four exchange points");
  assert.ok((remez.metrics[0]?.maxError ?? 1) < 1e-7, "Remez should recover a quadratic exactly");

  const compare = solveFunctionExperiment({
    kind: "chebyshevCompare",
    functionExpression: "1 / (1 + 25 * x^2)",
    intervalStart: -1,
    intervalEnd: 1,
    sampleCount: 180,
  });
  assert.equal(compare.metrics.length, 3, "Chebyshev comparison should produce three metric rows");
  assert.equal(compare.series.length, 4, "Chebyshev comparison should include original function and three approximations");
}

export function runApproximationTests() {
  testInterpolationAndApproximation();
  testFunctionApproximationExperiments();
}
