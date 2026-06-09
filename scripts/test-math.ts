import { runApproximationTests } from "./math-tests/approximation-tests";
import { runIntegrationTests } from "./math-tests/integration-tests";
import { runMatrixTests } from "./math-tests/matrix-tests";
import { runNonlinearTests } from "./math-tests/nonlinear-tests";
import { runOdeTests } from "./math-tests/ode-tests";

function run() {
  runMatrixTests();
  runNonlinearTests();
  runApproximationTests();
  runIntegrationTests();
  runOdeTests();

  console.log("[test:math] 所有回归测试通过");
}

run();
