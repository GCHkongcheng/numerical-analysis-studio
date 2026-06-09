import assert from "node:assert/strict";

import { solveIntegration } from "../../src/lib/integration-core";

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
  assert.ok(romberg.convergence?.errorLimit === null, "Romberg should treat an omitted error limit as layer-controlled");
  assert.ok(romberg.sequence?.length === 6, "Romberg should expose extrapolation sequence");
  assert.ok(romberg.sequence?.[3]?.Tn !== null, "Romberg sequence should expose T_n");
  assert.ok(romberg.sequence?.[3]?.Sn !== null, "Romberg sequence should expose S_n");
  assert.ok(romberg.sequence?.[3]?.Cn !== null, "Romberg sequence should expose C_n");
  assert.ok(romberg.sequence?.[3]?.Rn !== null, "Romberg sequence should expose R_n");

  const toleranceStoppedRomberg = solveIntegration({
    method: "romberg",
    expression: "sin(x)",
    intervalStart: 0,
    intervalEnd: Math.PI,
    rombergLevels: 8,
    errorLimit: 1e-2,
  });
  assert.ok(
    (toleranceStoppedRomberg.table?.length ?? 0) < 8,
    "Romberg should stop early when the error limit is reached"
  );
  assert.ok(
    toleranceStoppedRomberg.convergence?.stoppedEarly,
    "Romberg convergence metadata should record early stopping"
  );

  const gauss = solveIntegration({
    method: "gaussLegendre",
    expression: "x^5 + x^2",
    intervalStart: -1,
    intervalEnd: 1,
    gaussPoints: 4,
  });
  assert.ok(Math.abs(gauss.value - 2 / 3) < 1e-12, "Gauss-Legendre should integrate low-degree polynomials exactly");
}

export function runIntegrationTests() {
  testNumericalIntegration();
}
