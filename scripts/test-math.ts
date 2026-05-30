import assert from "node:assert/strict";

import {
  analyzeConditionNumbers,
  eigsWithMathjs,
  choleskyDecomposition,
  choleskyResidual,
  luDecomposition,
  luResidual,
  maxAbsAxMinusB,
  formatValue,
  numericValue,
  perturbNumericMatrix,
  perturbNumericVector,
  qrDecomposition,
  qrOrthogonalityResidual,
  qrResidual,
  svdDecomposition,
  svdOrthogonalityResiduals,
  svdResidual,
  relativeEigenError,
  relativeMatrixErrorInfinity,
  relativeVectorErrorInfinity,
  solveLinearSystemIterative,
  solveLinearSystemWithSteps,
  solveNumericLinearSystem,
} from "../src/lib/matrix-core";
import {
  chebyshevZeros,
  evaluatePolynomial,
  solveApproximation,
  solveFunctionExperiment,
  uniformNodes,
} from "../src/lib/approximation-core";
import { solveIntegration } from "../src/lib/integration-core";
import { solveRoot } from "../src/lib/nonlinear-core";
import { solveOde } from "../src/lib/ode-core";
import type { EigenComponent } from "../src/types/matrix";

type Complex = {
  re: number;
  im: number;
};

const EIG_TOL = 1e-7;
const LU_TOL = 1e-10;
const SYSTEM_TOL = 1e-10;

function toComplex(value: EigenComponent): Complex {
  if (typeof value === "number") {
    return { re: value, im: 0 };
  }
  return value;
}

function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function mul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function abs(value: Complex): number {
  return Math.hypot(value.re, value.im);
}

function distance(a: EigenComponent, b: Complex): number {
  const ca = toComplex(a);
  return Math.hypot(ca.re - b.re, ca.im - b.im);
}

function hasEigenvalue(values: EigenComponent[], target: Complex, tol = EIG_TOL): boolean {
  return values.some((value) => distance(value, target) < tol);
}

function eigenResidual(
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

function testEigenRealPairing() {
  const matrix = [
    [2, 1],
    [1, 2],
  ];
  const result = eigsWithMathjs(matrix);

  assert.ok(result, "实特征值场景应返回结果");
  assert.ok(hasEigenvalue(result.values, { re: 1, im: 0 }), "应包含特征值 1");
  assert.ok(hasEigenvalue(result.values, { re: 3, im: 0 }), "应包含特征值 3");

  for (const pair of result.eigenPairs) {
    const residual = eigenResidual(matrix, pair.value, pair.vector);
    assert.ok(
      residual < EIG_TOL,
      `实特征值配对残差过大: ${residual.toExponential(3)}`
    );
  }
}

function testEigenComplexSupport() {
  const matrix = [
    [0, -1],
    [1, 0],
  ];
  const result = eigsWithMathjs(matrix);

  assert.ok(result, "复特征值场景应返回结果");
  assert.ok(hasEigenvalue(result.values, { re: 0, im: 1 }), "应包含 +i");
  assert.ok(hasEigenvalue(result.values, { re: 0, im: -1 }), "应包含 -i");

  for (const pair of result.eigenPairs) {
    const residual = eigenResidual(matrix, pair.value, pair.vector);
    assert.ok(
      residual < EIG_TOL,
      `复特征值配对残差过大: ${residual.toExponential(3)}`
    );
  }
}

function testDefectiveMatrixDetection() {
  const matrix = [
    [1, 2],
    [0, 1],
  ];
  const result = eigsWithMathjs(matrix);

  assert.ok(result, "缺陷矩阵场景应返回结果");
  const multiplicity = result.multiplicities.find(
    (item) => distance(item.value, { re: 1, im: 0 }) < EIG_TOL
  );

  assert.ok(multiplicity, "应识别 lambda=1 的重数信息");
  assert.equal(multiplicity.algebraic, 2, "代数重数应为 2");
  assert.equal(multiplicity.geometric, 1, "几何重数应为 1");
  assert.equal(result.diagonalizable, false, "应标记为不可对角化");
}

function testLuWithPivoting() {
  const matrix = [
    ["4", "3"],
    ["6", "3"],
  ];

  const lu = luDecomposition(matrix);
  assert.ok(lu, "LU 分解应成功");
  assert.notDeepEqual(
    lu.P,
    [
      ["1", "0"],
      ["0", "1"],
    ],
    "该用例应触发行交换"
  );

  const residual = luResidual(matrix, lu);
  assert.ok(residual !== null, "数值矩阵应返回 LU residual");
  assert.ok(
    residual < LU_TOL,
    `LU residual 超阈值: ${residual.toExponential(3)}`
  );
}

function makeSeededRandom(seed = 123456789) {
  let current = seed >>> 0;
  return () => {
    current = (1664525 * current + 1013904223) >>> 0;
    return current / 0xffffffff;
  };
}

function testLuRandomResiduals() {
  const random = makeSeededRandom(20260320);

  for (let caseIndex = 0; caseIndex < 8; caseIndex += 1) {
    const size = 4;
    const matrix: string[][] = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => {
        const noise = random() * 2 - 1;
        const value = (r === c ? 5 : 0) + noise;
        return value.toString();
      })
    );

    const lu = luDecomposition(matrix);
    assert.ok(lu, `随机用例 ${caseIndex + 1} LU 分解失败`);

    const residual = luResidual(matrix, lu);
    assert.ok(residual !== null, `随机用例 ${caseIndex + 1} residual 为空`);
    assert.ok(
      residual < 1e-8,
      `随机用例 ${caseIndex + 1} residual 过大: ${residual.toExponential(3)}`
    );
  }
}


function testQrDecomposition() {
  const matrix = [
    ["12", "-51", "4"],
    ["6", "167", "-68"],
    ["-4", "24", "-41"],
  ];

  const qr = qrDecomposition(matrix);
  assert.ok(qr, "QR ?????");

  const residual = qrResidual(matrix, qr);
  const orthResidual = qrOrthogonalityResidual(qr);

  assert.ok(residual !== null, "QR residual ????");
  assert.ok(orthResidual !== null, "Q ??? residual ????");
  assert.ok(residual < 1e-8, "QR residual ??: " + residual.toExponential(3));
  assert.ok(
    orthResidual < 1e-8,
    "Q ??? residual ??: " + orthResidual.toExponential(3)
  );
}

function testSvdDecomposition() {
  const matrix = [
    ["1", "0"],
    ["0", "2"],
    ["0", "0"],
  ];

  const svd = svdDecomposition(matrix);
  assert.ok(svd, "SVD decomposition should return a result");

  const residual = svdResidual(matrix, svd);
  assert.ok(residual !== null, "SVD residual should be computable");
  assert.ok(residual < 1e-8, "SVD residual is too large: " + residual.toExponential(3));

  const orth = svdOrthogonalityResiduals(svd);
  assert.ok(orth.u !== null, "U orthogonality residual should be computable");
  assert.ok(orth.v !== null, "V orthogonality residual should be computable");
  assert.ok(
    (orth.u ?? Number.POSITIVE_INFINITY) < 1e-8,
    "U orthogonality residual is too large: " + (orth.u ?? Number.NaN).toExponential(3)
  );
  assert.ok(
    (orth.v ?? Number.POSITIVE_INFINITY) < 1e-8,
    "V orthogonality residual is too large: " + (orth.v ?? Number.NaN).toExponential(3)
  );

  const singularValues = svd.singularValues.map((value) => Number(value));
  assert.ok(singularValues.length >= 2, "SVD should return at least two singular values for this matrix");
  assert.ok(Math.abs(singularValues[0] - 2) < 1e-6, "Leading singular value should be close to 2");
  assert.ok(Math.abs(singularValues[1] - 1) < 1e-6, "Second singular value should be close to 1");
}
function testCholeskyDecomposition() {
  const matrix = [
    ["4", "12", "-16"],
    ["12", "37", "-43"],
    ["-16", "-43", "98"],
  ];

  const chol = choleskyDecomposition(matrix);
  assert.ok(chol, "Cholesky ?????");

  const residual = choleskyResidual(matrix, chol);
  assert.ok(residual !== null, "Cholesky residual ????");
  assert.ok(
    residual < 1e-8,
    "Cholesky residual ??: " + residual.toExponential(3)
  );
}

function testLinearSystemResidual() {
  const augmented = [
    ["2", "1", "-1", "8"],
    ["-3", "-1", "2", "-11"],
    ["-2", "1", "2", "-3"],
  ];

  const result = solveLinearSystemWithSteps(augmented, 3);
  assert.equal(result.summary.type, "唯一解", "该方程组应有唯一解");
  assert.ok(result.summary.solution, "唯一解场景应返回 solution");

  const solution = result.summary.solution.map((entry, index) => {
    const value = numericValue(entry);
    assert.notEqual(value, null, `x${index + 1} 无法转为数值`);
    return value as number;
  });

  const residual = maxAbsAxMinusB(
    [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ],
    solution,
    [8, -11, -3]
  );

  assert.ok(residual !== null, "系统残差应可计算");
  assert.ok(
    residual < SYSTEM_TOL,
    `系统 Ax-b 残差超阈值: ${residual.toExponential(3)}`
  );
}

function testJacobiIterationConvergence() {
  const matrixA = [
    [10, 1, 1],
    [2, 10, 1],
    [2, 2, 10],
  ];
  const vectorB = [12, 13, 14];

  const result = solveLinearSystemIterative({
    method: "jacobi",
    matrixA,
    vectorB,
    tolerance: 1e-12,
    maxIterations: 200,
  });

  assert.ok(result, "Jacobi ?????");
  assert.ok(result.converged, "Jacobi ???");
  assert.ok(result.residual < 1e-9, "Jacobi residual ????");
  assert.ok(result.history.length >= 2, "Jacobi ???????");

  const numericSolution = result.solution.map((item) => Number(item));
  for (const value of numericSolution) {
    assert.ok(Math.abs(value - 1) < 1e-6, "Jacobi ???? [1,1,1]");
  }
}

function testGaussSeidelIterationConvergence() {
  const matrixA = [
    [8, -1, 0],
    [-1, 8, -1],
    [0, -1, 8],
  ];
  const vectorB = [7, 6, 7];

  const result = solveLinearSystemIterative({
    method: "gaussSeidel",
    matrixA,
    vectorB,
    tolerance: 1e-12,
    maxIterations: 120,
  });

  assert.ok(result, "Gauss-Seidel ?????");
  assert.ok(result.converged, "Gauss-Seidel ???");
  assert.ok(result.residual < 1e-9, "Gauss-Seidel residual ????");
  assert.ok(result.iterations > 0, "Gauss-Seidel ??????? 0");

  const numericSolution = result.solution.map((item) => Number(item));
  const residual = maxAbsAxMinusB(matrixA, numericSolution, vectorB);
  assert.ok(residual !== null, "Gauss-Seidel ???????");
  assert.ok(residual < 1e-7, "Gauss-Seidel ????????");
}

function testSorIterationConvergence() {
  const matrixA = [
    [10, 1, 1],
    [2, 10, 1],
    [2, 2, 10],
  ];
  const vectorB = [12, 13, 14];

  const result = solveLinearSystemIterative({
    method: "sor",
    matrixA,
    vectorB,
    tolerance: 1e-12,
    maxIterations: 120,
    omega: 1.15,
  });

  assert.ok(result, "SOR ?????");
  assert.ok(result.converged, "SOR ???");
  assert.ok(result.residual < 1e-9, "SOR residual ????");

  const numericSolution = result.solution.map((item) => Number(item));
  for (const value of numericSolution) {
    assert.ok(Math.abs(value - 1) < 1e-6, "SOR ???? [1,1,1]");
  }
}

function testConjugateGradientConvergence() {
  const matrixA = [
    [4, 1],
    [1, 3],
  ];
  const vectorB = [1, 2];

  const result = solveLinearSystemIterative({
    method: "conjugateGradient",
    matrixA,
    vectorB,
    tolerance: 1e-12,
    maxIterations: 80,
  });

  assert.ok(result, "CG ?????");
  assert.ok(result.converged, "CG ???");
  assert.ok(result.residual < 1e-9, "CG residual ????");

  const numericSolution = result.solution.map((item) => Number(item));
  assert.ok(Math.abs(numericSolution[0] - 1 / 11) < 1e-6, "x1 ??? 1/11");
  assert.ok(Math.abs(numericSolution[1] - 7 / 11) < 1e-6, "x2 ??? 7/11");
}

function testConjugateGradientRejectsNonSpd() {
  const matrixA = [
    [1, 2],
    [3, 4],
  ];
  const vectorB = [1, 1];

  const result = solveLinearSystemIterative({
    method: "conjugateGradient",
    matrixA,
    vectorB,
    tolerance: 1e-12,
    maxIterations: 20,
  });

  assert.ok(result, "CG ? SPD ??????????");
  assert.equal(result.converged, false, "? SPD ??????");
  assert.ok(result.note, "? SPD ???????");
}

function testConditionNumberAnalysis() {
  const matrix = [
    [4, 1],
    [2, 3],
  ];

  const analysis = analyzeConditionNumbers(matrix);
  assert.ok(analysis, "条件数分析应返回结果");
  assert.equal(analysis.invertible, true, "该矩阵应可逆");
  assert.ok(analysis.cond1 !== null, "cond1 应可计算");
  assert.ok(analysis.condInf !== null, "condInf 应可计算");
  assert.ok(Math.abs((analysis.cond1 ?? 0) - 3) < 1e-8, "cond1 应接近 3");
  assert.ok(Math.abs((analysis.condInf ?? 0) - 3) < 1e-8, "condInf 应接近 3");

  const singular = analyzeConditionNumbers([
    [1, 2],
    [2, 4],
  ]);
  assert.ok(singular, "奇异矩阵也应返回基础范数信息");
  assert.equal(singular.invertible, false, "奇异矩阵应标记为不可逆");
  assert.equal(singular.cond1, null, "奇异矩阵 cond1 应为空");
  assert.equal(singular.condInf, null, "奇异矩阵 condInf 应为空");
}

function testPerturbationAndRelativeErrors() {
  const matrix = [
    [3, 1],
    [1, 2],
  ];
  const vector = [5, 5];

  const perturbedMatrix = perturbNumericMatrix(matrix, 1e-6);
  assert.ok(perturbedMatrix, "矩阵扰动应成功");
  const matrixError = relativeMatrixErrorInfinity(matrix, perturbedMatrix);
  assert.ok(matrixError !== null, "矩阵相对误差应可计算");
  assert.ok(matrixError >= 0, "矩阵相对误差应非负");

  const perturbedVector = perturbNumericVector(vector, 1e-6);
  assert.ok(perturbedVector, "向量扰动应成功");
  const vectorError = relativeVectorErrorInfinity(vector, perturbedVector);
  assert.ok(vectorError !== null, "向量相对误差应可计算");
  assert.ok(vectorError >= 0, "向量相对误差应非负");
}

function testRootFormattingBehavior() {
  const symbolicRoot = formatValue("sqrt(2)", "fraction");
  assert.equal(symbolicRoot, "√(2)", "fraction 模式下根号应保留符号表达");

  const decimalRoot = formatValue("sqrt(2)", "decimal");
  assert.ok(decimalRoot !== "√(2)", "decimal 模式下应给出近似数值");
}

function testNonlinearRootSolvers() {
  const fExpression = "x^3 - x - 1";

  const newton = solveRoot({
    method: "newton",
    fExpression,
    x0: 1,
    tolerance: 1e-10,
    maxIterations: 30,
  });
  assert.ok(newton.converged, "Newton should converge for the sample equation");
  assert.ok(newton.root !== null, "Newton should return a root");
  assert.ok(Math.abs(newton.root - 1.3247179572) < 1e-8, "Newton root should match the plastic constant");

  const damped = solveRoot({
    method: "dampedNewton",
    fExpression,
    x0: 0,
    tolerance: 1e-10,
    maxIterations: 50,
  });
  assert.ok(damped.history.some((item) => item.lambda !== undefined), "Damped Newton should record step lengths");

  const fixedPoint = solveRoot({
    method: "fixedPoint",
    fExpression,
    gExpression: "(x + 1)^(1/3)",
    x0: 1,
    tolerance: 1e-10,
    maxIterations: 80,
  });
  assert.ok(fixedPoint.converged, "Fixed-point iteration should converge for the provided g(x)");

  const steffensen = solveRoot({
    method: "steffensen",
    fExpression,
    gExpression: "(x + 1)^(1/3)",
    x0: 1,
    tolerance: 1e-10,
    maxIterations: 20,
  });
  assert.ok(steffensen.converged, "Steffensen iteration should converge for the provided g(x)");

  const bisection = solveRoot({
    method: "bisection",
    fExpression,
    intervalStart: 1,
    intervalEnd: 2,
    tolerance: 1e-10,
    maxIterations: 80,
  });
  assert.ok(bisection.converged, "Bisection should converge on a sign-changing interval");

  const secant = solveRoot({
    method: "secant",
    fExpression,
    x0: 1,
    x1: 2,
    tolerance: 1e-10,
    maxIterations: 40,
  });
  assert.ok(secant.converged, "Secant should converge for the sample equation");
}

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

function testNumericalIntegration() {
  const trapezoid = solveIntegration({
    method: "trapezoid",
    expression: "x",
    intervalStart: 0,
    intervalEnd: 1,
    subdivisions: 20,
  });
  assert.ok(Math.abs(trapezoid.value - 0.5) < 1e-12, "Composite trapezoid should integrate linear functions exactly");

  const simpson = solveIntegration({
    method: "simpson",
    expression: "x^3",
    intervalStart: 0,
    intervalEnd: 1,
    subdivisions: 10,
  });
  assert.ok(Math.abs(simpson.value - 0.25) < 1e-12, "Composite Simpson should integrate cubic functions exactly");

  const romberg = solveIntegration({
    method: "romberg",
    expression: "sin(x)",
    intervalStart: 0,
    intervalEnd: Math.PI,
    rombergLevels: 6,
  });
  assert.ok(Math.abs(romberg.value - 2) < 1e-10, "Romberg should accurately integrate sin on [0, pi]");
  assert.ok(romberg.table?.length === 6, "Romberg should expose convergence table");

  const gauss = solveIntegration({
    method: "gaussLegendre",
    expression: "x^5 + x^2",
    intervalStart: -1,
    intervalEnd: 1,
    gaussPoints: 4,
  });
  assert.ok(Math.abs(gauss.value - 2 / 3) < 1e-12, "Gauss-Legendre should integrate low-degree polynomials exactly");
}

function testOdeSolvers() {
  const rk4 = solveOde({
    method: "rk4",
    expression: "y - x^2 + 1",
    exactExpression: "(x + 1)^2 - 0.5 * exp(x)",
    x0: 0,
    y0: 0.5,
    xEnd: 2,
    stepSize: 0.2,
  });
  assert.ok((rk4.maxError ?? 1) < 2e-4, "RK4 should be accurate on the sample initial value problem");

  const euler = solveOde({
    method: "euler",
    expression: "y",
    exactExpression: "exp(x)",
    x0: 0,
    y0: 1,
    xEnd: 1,
    stepSize: 0.1,
  });
  assert.ok((euler.maxError ?? 0) > 0.01, "Euler should expose visible first-order error on exp(x)");

  const shortened = solveOde({
    method: "midpoint",
    expression: "x + y",
    x0: 0,
    y0: 1,
    xEnd: 1,
    stepSize: 0.3,
  });
  assert.ok(shortened.message, "Solver should report shortened final step");
  assert.ok(Math.abs(shortened.steps[shortened.steps.length - 1].x - 1) < 1e-12, "Solver should land exactly on endpoint");

  const backward = solveOde({
    method: "rk4",
    expression: "y",
    exactExpression: "exp(x)",
    x0: 1,
    y0: Math.E,
    xEnd: 0,
    stepSize: 0.1,
  });
  assert.ok(Math.abs(backward.steps[backward.steps.length - 1].y - 1) < 1e-6, "Solver should support backward integration");
}

function testSolveNumericLinearSystemAndEigenRelativeError() {
  const matrix = [
    [4, 1],
    [1, 3],
  ];
  const vector = [1, 2];

  const solution = solveNumericLinearSystem(matrix, vector);
  assert.ok(solution, "数值线性系统应可求解");
  assert.ok(Math.abs(solution[0] - 1 / 11) < 1e-8, "x1 应接近 1/11");
  assert.ok(Math.abs(solution[1] - 7 / 11) < 1e-8, "x2 应接近 7/11");

  const eigenError = relativeEigenError(
    [
      { re: 1, im: 2 },
      { re: 3, im: 0 },
    ],
    [
      { re: 1.000001, im: 1.999999 },
      { re: 2.999999, im: 0.000001 },
    ]
  );
  assert.ok(eigenError !== null, "特征值相对误差应可计算");
  assert.ok(eigenError > 0, "特征值相对误差应大于 0");
  assert.ok(eigenError < 1e-4, "特征值相对误差应保持在小扰动量级");
}

function run() {
  testEigenRealPairing();
  testEigenComplexSupport();
  testDefectiveMatrixDetection();
  testLuWithPivoting();
  testLuRandomResiduals();
  testQrDecomposition();
  testSvdDecomposition();
  testCholeskyDecomposition();
  testLinearSystemResidual();
  testJacobiIterationConvergence();
  testGaussSeidelIterationConvergence();
  testSorIterationConvergence();
  testConjugateGradientConvergence();
  testConjugateGradientRejectsNonSpd();
  testConditionNumberAnalysis();
  testPerturbationAndRelativeErrors();
  testSolveNumericLinearSystemAndEigenRelativeError();
  testRootFormattingBehavior();
  testNonlinearRootSolvers();
  testInterpolationAndApproximation();
  testFunctionApproximationExperiments();
  testNumericalIntegration();
  testOdeSolvers();

  console.log("[test:math] 所有回归测试通过");
}

run();
