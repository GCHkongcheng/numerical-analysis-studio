import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyPaste,
  computeOperationResult,
  formatValue,
  hasChinese,
  normalizeMatrixInput,
  rrefMatrix,
  splitAugmentedMatrix,
  toNumericMatrix,
} from "@/lib/matrix-basic";
import { formatEigenComponent } from "@/lib/matrix-eigen";
import {
  EPS,
  resizeInputMatrix,
  toInputMatrix,
} from "@/lib/matrix-format";
import {
  describeStep,
  solveLinearSystemByGaussJordan,
  solveLinearSystemIterative,
  solveLinearSystemWithSteps,
} from "@/lib/matrix-linear-system";
import type {
  DisplayMode,
  EigenComponent,
  IterativeMethod,
  IterativeSolveResult,
  LinearSystemMethod,
  MatrixOperation,
  ResultTone,
  SolveSummary,
  Step,
} from "@/types/matrix";

type Feedback = {
  text: string;
  tone: ResultTone;
};

export type MatrixHistorySnapshot = {
  displayMode: DisplayMode;
  operations: {
    rows: number;
    cols: number;
    bRows: number;
    bCols: number;
    matrixA: string[][];
    matrixB: string[][];
    operation: MatrixOperation;
    scalar: string;
    resultMatrix: string[][] | null;
  };
  system: {
    rows: number;
    cols: number;
    method: LinearSystemMethod;
    tolerance: string;
    maxIterations: string;
    omega: string;
    augmented: string[][];
    iterativeResult: IterativeSolveResult | null;
    steps: Step[];
    summary: SolveSummary | null;
  };
};

const DEFAULT_MATRIX_A = toInputMatrix([
  [2, 1, -1],
  [-3, -1, 2],
  [-2, 1, 2],
]);

const DEFAULT_SYSTEM_AUGMENTED = toInputMatrix([
  [2, 1, -1, 8],
  [-3, -1, 2, -11],
  [-2, 1, 2, -3],
]);

const DEFAULT_OPERATION_RESULT = rrefMatrix(DEFAULT_MATRIX_A);

export function useMatrix() {
  const sizeOptions = useMemo(() => [2, 3, 4, 5], []);

  const [displayMode, setDisplayMode] = useState<DisplayMode>("decimal");

  const [opsRows, setOpsRows] = useState(3);
  const [opsCols, setOpsCols] = useState(3);
  const [opsMatrixA, setOpsMatrixA] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_MATRIX_A, 3, 3, "0")
  );
  const [opsMatrixB, setOpsMatrixB] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_MATRIX_A, 3, 3, "0")
  );
  const [opsBRows, setOpsBRows] = useState(3);
  const [opsBCols, setOpsBCols] = useState(3);
  const [opsOperation, setOpsOperation] = useState<MatrixOperation>("simplify");
  const [opsScalar, setOpsScalar] = useState("2");
  const [opsResultMatrix, setOpsResultMatrix] = useState<string[][] | null>(
    DEFAULT_OPERATION_RESULT
  );
  const [opsFeedback, setOpsFeedback] = useState<Feedback | null>(null);

  const [systemRows, setSystemRows] = useState(3);
  const [systemCols, setSystemCols] = useState(3);
  const [systemAugmented, setSystemAugmented] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SYSTEM_AUGMENTED, 3, 4, "0")
  );
  const [systemMethod, setSystemMethod] = useState<LinearSystemMethod>(
    "gaussianElimination"
  );
  const [systemTolerance, setSystemTolerance] = useState("1e-10");
  const [systemMaxIterations, setSystemMaxIterations] = useState("120");
  const [systemOmega, setSystemOmega] = useState("1.1");
  const [systemIterativeResult, setSystemIterativeResult] =
    useState<IterativeSolveResult | null>(null);
  const [systemSteps, setSystemSteps] = useState<Step[]>([]);
  const [systemStepIndex, setSystemStepIndex] = useState(0);
  const [systemSummary, setSystemSummary] = useState<SolveSummary | null>(null);
  const [systemPlaying, setSystemPlaying] = useState(false);
  const [systemFeedback, setSystemFeedback] = useState<Feedback | null>(null);
  const systemTimerRef = useRef<NodeJS.Timeout | null>(null);

  const setOpsDimensions = (nextRows: number, nextCols: number) => {
    setOpsRows(nextRows);
    setOpsCols(nextCols);
    setOpsMatrixA((prev) => resizeInputMatrix(prev, nextRows, nextCols, "0"));

    if (opsOperation === "add" || opsOperation === "subtract") {
      setOpsBRows(nextRows);
      setOpsBCols(nextCols);
      setOpsMatrixB((prev) => resizeInputMatrix(prev, nextRows, nextCols, "0"));
      return;
    }

    setOpsMatrixB((prev) => resizeInputMatrix(prev, opsBRows, opsBCols, "0"));
  };

  const setOpsBMatrixDimensions = (nextRows: number, nextCols: number) => {
    setOpsBRows(nextRows);
    setOpsBCols(nextCols);
    setOpsMatrixB((prev) => resizeInputMatrix(prev, nextRows, nextCols, "0"));
  };
  const replaceOpsMatrixA = (nextMatrix: string[][]) => {
    const nextRows = Math.max(1, nextMatrix.length);
    const nextCols = Math.max(1, nextMatrix[0]?.length ?? 1);
    const normalized = resizeInputMatrix(nextMatrix, nextRows, nextCols, "0").map((row) =>
      row.map((value) => value || "0")
    );

    setOpsRows(nextRows);
    setOpsCols(nextCols);
    setOpsMatrixA(normalized);

    if (opsOperation === "add" || opsOperation === "subtract") {
      setOpsBRows(nextRows);
      setOpsBCols(nextCols);
      setOpsMatrixB((prev) => resizeInputMatrix(prev, nextRows, nextCols, "0"));
    }
  };

  const replaceOpsMatrixB = (nextMatrix: string[][]) => {
    const nextRows = Math.max(1, nextMatrix.length);
    const nextCols = Math.max(1, nextMatrix[0]?.length ?? 1);
    const normalized = resizeInputMatrix(nextMatrix, nextRows, nextCols, "0").map((row) =>
      row.map((value) => value || "0")
    );

    setOpsBRows(nextRows);
    setOpsBCols(nextCols);
    setOpsMatrixB(normalized);
  };

  const replaceSystemAugmentedMatrix = (nextMatrix: string[][]) => {
    const nextRows = Math.max(1, nextMatrix.length);
    const nextAugCols = Math.max(2, nextMatrix[0]?.length ?? 2);
    const nextCols = Math.max(1, nextAugCols - 1);

    const normalized = resizeInputMatrix(nextMatrix, nextRows, nextCols + 1, "0").map((row) =>
      row.map((value) => value || "0")
    );

    setSystemRows(nextRows);
    setSystemCols(nextCols);
    setSystemAugmented(normalized);
    resetSystemOutputs();
  };

  const resetSystemOutputs = () => {
    setSystemSteps([]);
    setSystemStepIndex(0);
    setSystemSummary(null);
    setSystemIterativeResult(null);
    setSystemPlaying(false);
    setSystemFeedback(null);
  };

  const setSystemDimensions = (nextRows: number, nextCols: number) => {
    setSystemRows(nextRows);
    setSystemCols(nextCols);
    setSystemAugmented((prev) => resizeInputMatrix(prev, nextRows, nextCols + 1, "0"));
    resetSystemOutputs();
  };

  const rejectChineseInput = (
    value: string,
    setFeedback: (feedback: Feedback | null) => void
  ): boolean => {
    if (hasChinese(value)) {
      setFeedback({
        tone: "error",
        text: "不支持中文字符，请使用数字、分数或变量符号。",
      });
      return true;
    }
    return false;
  };

  const setOpsCellA = (row: number, col: number, value: string) => {
    if (rejectChineseInput(value, setOpsFeedback)) return;
    setOpsMatrixA((prev) => {
      const next = prev.map((line) => line.slice());
      next[row][col] = value;
      return next;
    });
  };

  const setOpsCellB = (row: number, col: number, value: string) => {
    if (rejectChineseInput(value, setOpsFeedback)) return;
    setOpsMatrixB((prev) => {
      const next = prev.map((line) => line.slice());
      next[row][col] = value;
      return next;
    });
  };

  const pasteOpsMatrixA = (row: number, col: number, text: string) => {
    if (rejectChineseInput(text, setOpsFeedback)) return;
    setOpsMatrixA((prev) => applyPaste(prev, row, col, text));
    setOpsFeedback({ tone: "success", text: "矩阵 A 已粘贴" });
  };

  const pasteOpsMatrixB = (row: number, col: number, text: string) => {
    if (rejectChineseInput(text, setOpsFeedback)) return;
    setOpsMatrixB((prev) => applyPaste(prev, row, col, text));
    setOpsFeedback({ tone: "success", text: "矩阵 B 已粘贴" });
  };

  const changeOperation = (nextOperation: MatrixOperation) => {
    setOpsOperation(nextOperation);

    if (nextOperation === "add" || nextOperation === "subtract") {
      setOpsBRows(opsRows);
      setOpsBCols(opsCols);
      setOpsMatrixB((prev) => resizeInputMatrix(prev, opsRows, opsCols, "0"));
    }
  };

  const computeOperations = () => {
    const matrixA = normalizeMatrixInput(opsMatrixA);
    const matrixB = normalizeMatrixInput(opsMatrixB);

    const result = computeOperationResult({
      op: opsOperation,
      matrixA,
      matrixB,
      scalar: opsScalar,
    });

    setOpsResultMatrix(result.matrix);
    setOpsFeedback(
      result.text
        ? {
            text: result.text,
            tone: result.tone,
          }
        : null
    );
  };

  const setSystemCell = (row: number, col: number, value: string) => {
    if (rejectChineseInput(value, setSystemFeedback)) return;
    setSystemAugmented((prev) => {
      const next = prev.map((line) => line.slice());
      next[row][col] = value;
      return next;
    });
  };

  const pasteSystemMatrix = (row: number, col: number, text: string) => {
    if (rejectChineseInput(text, setSystemFeedback)) return;
    setSystemAugmented((prev) => applyPaste(prev, row, col, text));
    setSystemFeedback({ tone: "success", text: "增广矩阵已粘贴" });
  };

  const setLinearSystemMethod = (nextMethod: LinearSystemMethod) => {
    setSystemMethod(nextMethod);
    resetSystemOutputs();
  };

  const parseIterativeTolerance = () => {
    const parsed = Number(systemTolerance);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 1e-10;
  };

  const parseIterativeMaxIterations = () => {
    const parsed = Number(systemMaxIterations);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.floor(parsed);
    }
    return 120;
  };

  const parseIterativeOmega = () => {
    const parsed = Number(systemOmega);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 1.1;
  };

  const iterativeMethodLabel = (method: IterativeMethod) => {
    switch (method) {
      case "jacobi":
        return "Jacobi";
      case "gaussSeidel":
        return "Gauss-Seidel";
      case "sor":
        return "SOR";
      case "conjugateGradient":
        return "Conjugate Gradient";
      default:
        return method;
    }
  };

  const computeSystem = () => {
    const normalized = normalizeMatrixInput(systemAugmented);

    if (systemMethod === "gaussianElimination") {
      const result = solveLinearSystemWithSteps(normalized, systemCols);
      setSystemSteps(result.steps);
      setSystemSummary(result.summary);
      setSystemIterativeResult(null);
      setSystemStepIndex(0);
      setSystemPlaying(false);

      if (result.summary.rankAug > result.summary.rankA) {
        setSystemFeedback({
          tone: "error",
          text: "当前方程组无解（rank([A|b]) > rank(A)）。",
        });
        return;
      }

      if (result.summary.rankA < systemCols) {
        setSystemFeedback({
          tone: "warning",
          text: "检测到自由变量，已生成参数化表达。",
        });
        return;
      }

      setSystemFeedback({ tone: "success", text: "高斯消元完成，得到唯一解。" });
      return;
    }

    if (systemMethod === "gaussJordan") {
      const result = solveLinearSystemByGaussJordan(normalized, systemCols);
      setSystemSteps(result.steps);
      setSystemSummary(result.summary);
      setSystemIterativeResult(null);
      setSystemStepIndex(0);
      setSystemPlaying(false);

      if (result.summary.rankAug > result.summary.rankA) {
        setSystemFeedback({
          tone: "error",
          text: "Gauss-Jordan 判定该方程组无解。",
        });
        return;
      }

      if (result.summary.rankA < systemCols) {
        setSystemFeedback({
          tone: "warning",
          text: "Gauss-Jordan 判定存在自由变量，已给出参数化表达。",
        });
        return;
      }

      setSystemFeedback({ tone: "success", text: "Gauss-Jordan 完成，得到唯一解。" });
      return;
    }

    setSystemPlaying(false);
    setSystemStepIndex(0);
    setSystemSteps([]);

    if (systemRows !== systemCols) {
      setSystemSummary(null);
      setSystemIterativeResult(null);
      setSystemFeedback({
        tone: "error",
        text: "迭代法当前仅支持方阵系统（方程个数等于未知数个数）。",
      });
      return;
    }

    const directSummary = solveLinearSystemByGaussJordan(normalized, systemCols).summary;
    if (directSummary.rankAug > directSummary.rankA || directSummary.rankA < systemCols) {
      setSystemSummary(directSummary);
      setSystemIterativeResult(null);
      setSystemFeedback({
        tone: directSummary.rankAug > directSummary.rankA ? "error" : "warning",
        text:
          directSummary.rankAug > directSummary.rankA
            ? "该系统无解，不适合使用迭代法。"
            : "该系统有无穷多解，迭代法不再给出唯一解近似。",
      });
      return;
    }

    const numericAugmented = toNumericMatrix(normalized);
    if (!numericAugmented) {
      setSystemSummary(null);
      setSystemIterativeResult(null);
      setSystemFeedback({
        tone: "error",
        text: "迭代法需要纯数值输入（支持整数、小数、分数）。",
      });
      return;
    }

    const matrixA = numericAugmented.map((row) => row.slice(0, systemCols));
    const vectorB = numericAugmented.map((row) => row[systemCols]);

    const method = systemMethod as IterativeMethod;
    const iterative = solveLinearSystemIterative({
      method,
      matrixA,
      vectorB,
      tolerance: parseIterativeTolerance(),
      maxIterations: parseIterativeMaxIterations(),
      omega: method === "sor" ? parseIterativeOmega() : undefined,
    });

    if (!iterative) {
      setSystemSummary(null);
      setSystemIterativeResult(null);
      setSystemFeedback({
        tone: "error",
        text: "迭代法初始化失败，请检查输入矩阵维度。",
      });
      return;
    }

    setSystemSummary(directSummary);
    setSystemIterativeResult(iterative);

    const methodLabel = iterativeMethodLabel(method);

    if (iterative.converged) {
      setSystemFeedback({
        tone: "success",
        text: `${methodLabel} 收敛，迭代 ${iterative.iterations} 次。`,
      });
      return;
    }

    setSystemFeedback({
      tone: "warning",
      text: `${methodLabel} 未在设定迭代次数内收敛。`,
    });
  };

  const nextSystemStep = () => {
    setSystemStepIndex((prev) => Math.min(prev + 1, systemSteps.length - 1));
  };

  const prevSystemStep = () => {
    setSystemStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const resetSystemSteps = () => {
    setSystemStepIndex(0);
    setSystemPlaying(false);
  };

  const toggleSystemPlay = () => {
    if (!systemSteps.length) return;
    setSystemPlaying((prev) => !prev);
  };

  useEffect(() => {
    if (!systemPlaying || systemSteps.length === 0) {
      if (systemTimerRef.current) {
        clearInterval(systemTimerRef.current);
        systemTimerRef.current = null;
      }
      return;
    }

    systemTimerRef.current = setInterval(() => {
      setSystemStepIndex((prev) => {
        if (prev + 1 >= systemSteps.length) {
          setSystemPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 850);

    return () => {
      if (systemTimerRef.current) {
        clearInterval(systemTimerRef.current);
        systemTimerRef.current = null;
      }
    };
  }, [systemPlaying, systemSteps.length]);

  const systemCurrentStep = systemSteps[systemStepIndex] ?? null;

  const { A: systemA, b: systemB } = splitAugmentedMatrix(systemAugmented, systemCols);

  const historySnapshot = useMemo<MatrixHistorySnapshot>(
    () => ({
      displayMode,
      operations: {
        rows: opsRows,
        cols: opsCols,
        bRows: opsBRows,
        bCols: opsBCols,
        matrixA: opsMatrixA,
        matrixB: opsMatrixB,
        operation: opsOperation,
        scalar: opsScalar,
        resultMatrix: opsResultMatrix,
      },
      system: {
        rows: systemRows,
        cols: systemCols,
        method: systemMethod,
        tolerance: systemTolerance,
        maxIterations: systemMaxIterations,
        omega: systemOmega,
        augmented: systemAugmented,
        iterativeResult: systemIterativeResult,
        steps: systemSteps,
        summary: systemSummary,
      },
    }),
    [
      displayMode,
      opsRows,
      opsCols,
      opsBRows,
      opsBCols,
      opsMatrixA,
      opsMatrixB,
      opsOperation,
      opsScalar,
      opsResultMatrix,
      systemRows,
      systemCols,
      systemMethod,
      systemTolerance,
      systemMaxIterations,
      systemOmega,
      systemAugmented,
      systemIterativeResult,
      systemSteps,
      systemSummary,
    ]
  );

  const restoreHistorySnapshot = useCallback((snapshot: MatrixHistorySnapshot) => {
    setDisplayMode(snapshot.displayMode);

    setOpsRows(snapshot.operations.rows);
    setOpsCols(snapshot.operations.cols);
    setOpsBRows(snapshot.operations.bRows);
    setOpsBCols(snapshot.operations.bCols);
    setOpsMatrixA(snapshot.operations.matrixA);
    setOpsMatrixB(snapshot.operations.matrixB);
    setOpsOperation(snapshot.operations.operation);
    setOpsScalar(snapshot.operations.scalar);
    setOpsResultMatrix(snapshot.operations.resultMatrix);
    setOpsFeedback(null);

    setSystemRows(snapshot.system.rows);
    setSystemCols(snapshot.system.cols);
    setSystemMethod(snapshot.system.method);
    setSystemTolerance(snapshot.system.tolerance);
    setSystemMaxIterations(snapshot.system.maxIterations);
    setSystemOmega(snapshot.system.omega);
    setSystemAugmented(snapshot.system.augmented);
    setSystemIterativeResult(snapshot.system.iterativeResult);
    setSystemSteps(snapshot.system.steps);
    setSystemSummary(snapshot.system.summary);
    setSystemStepIndex(0);
    setSystemPlaying(false);
    setSystemFeedback(null);
  }, []);

  return {
    EPS,
    sizeOptions,
    displayMode,
    setDisplayMode,
    formatValue: (expr: string) => formatValue(expr, displayMode),
    formatEigenComponent: (value: EigenComponent) =>
      formatEigenComponent(value, displayMode),
    describeStep: (step: Step) => describeStep(step, displayMode),
    history: {
      snapshot: historySnapshot,
      restore: restoreHistorySnapshot,
    },
    operations: {
      rows: opsRows,
      cols: opsCols,
      matrixA: opsMatrixA,
      matrixB: opsMatrixB,
      bRows: opsBRows,
      bCols: opsBCols,
      operation: opsOperation,
      scalar: opsScalar,
      resultMatrix: opsResultMatrix,
      feedback: opsFeedback,
      setDimensions: setOpsDimensions,
      setBMatrixDimensions: setOpsBMatrixDimensions,
      setOperation: changeOperation,
      setScalar: setOpsScalar,
      setCellA: setOpsCellA,
      setCellB: setOpsCellB,
      setMatrixA: replaceOpsMatrixA,
      setMatrixB: replaceOpsMatrixB,
      pasteA: pasteOpsMatrixA,
      pasteB: pasteOpsMatrixB,
      compute: computeOperations,
    },
    system: {
      rows: systemRows,
      cols: systemCols,
      method: systemMethod,
      tolerance: systemTolerance,
      maxIterations: systemMaxIterations,
      omega: systemOmega,
      iterativeResult: systemIterativeResult,
      augmented: systemAugmented,
      matrixA: systemA,
      vectorB: systemB,
      steps: systemSteps,
      stepIndex: systemStepIndex,
      currentStep: systemCurrentStep,
      summary: systemSummary,
      feedback: systemFeedback,
      isPlaying: systemPlaying,
      setDimensions: setSystemDimensions,
      setMethod: setLinearSystemMethod,
      setTolerance: setSystemTolerance,
      setMaxIterations: setSystemMaxIterations,
      setOmega: setSystemOmega,
      setCell: setSystemCell,
      setAugmentedMatrix: replaceSystemAugmentedMatrix,
      paste: pasteSystemMatrix,
      compute: computeSystem,
      nextStep: nextSystemStep,
      prevStep: prevSystemStep,
      resetSteps: resetSystemSteps,
      togglePlay: toggleSystemPlay,
    },
  };
}
