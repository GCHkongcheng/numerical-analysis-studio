import assert from "node:assert/strict";

import {
  analyzeConditionNumbers,
  choleskyDecomposition,
  choleskyResidual,
  eigsWithMathjs,
  luDecomposition,
  luResidual,
  maxAbsAxMinusB,
  numericValue,
  perturbNumericMatrix,
  perturbNumericVector,
  qrDecomposition,
  qrOrthogonalityResidual,
  qrResidual,
  relativeEigenError,
  relativeMatrixErrorInfinity,
  relativeVectorErrorInfinity,
  solveLinearSystemIterative,
  solveLinearSystemWithSteps,
  solveNumericLinearSystem,
  svdDecomposition,
  svdOrthogonalityResiduals,
  svdResidual,
} from "../../src/lib/matrix-core";
import {
  EIG_TOL,
  LU_TOL,
  SYSTEM_TOL,
  distance,
  eigenResidual,
  hasEigenvalue,
} from "./helpers";

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

export function runMatrixTests() {
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
}
