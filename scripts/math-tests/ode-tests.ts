import assert from "node:assert/strict";

import { solveOde } from "../../src/lib/ode-core";

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

export function runOdeTests() {
  testOdeSolvers();
}
