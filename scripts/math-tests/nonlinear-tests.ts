import assert from "node:assert/strict";

import { formatValue } from "../../src/lib/matrix-core";
import { solveRoot } from "../../src/lib/nonlinear-core";

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

export function runNonlinearTests() {
  testRootFormattingBehavior();
  testNonlinearRootSolvers();
}
