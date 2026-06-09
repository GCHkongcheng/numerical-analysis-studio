"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ExperimentCasePanel,
  MethodComparisonTable,
  MethodGuidancePanel,
  ParameterScanTable,
  ReliabilityPanel,
  SaveExperimentButton,
} from "@/components/common/ExperimentTools";
import { MatrixShelf } from "@/components/matrix/MatrixShelf";
import { SaveToLibraryButton } from "@/components/matrix/SaveToLibraryButton";
import {
  LazyApproximationPanel,
  LazyIntegrationPanel,
  LazyNonlinearSolverPanel,
  LazyOdePanel,
} from "@/components/workbench/LazyModulePanels";
import { DeterminantModule } from "@/components/workbench/DeterminantModule";
import { MatrixOperationsModule } from "@/components/workbench/MatrixOperationsModule";
import { LinearSystemModule } from "@/components/workbench/LinearSystemModule";
import { DecompositionModule } from "@/components/workbench/DecompositionModule";
import { EigenAnalysisModule } from "@/components/workbench/EigenAnalysisModule";
import { ErrorAnalysisModule } from "@/components/workbench/ErrorAnalysisModule";
import {
  CorrectnessPanelToggleCard,
  DisplayModeSwitcher,
  HistoryControlCard,
} from "@/components/workbench/WorkbenchControls";
import { WorkbenchHeader } from "@/components/workbench/WorkbenchHeader";
import { WorkbenchLayout } from "@/components/workbench/WorkbenchLayout";
import { WorkbenchSidebar } from "@/components/workbench/WorkbenchSidebar";
import {
  MATRIX_EXPERIMENT_CASES,
  NAV_SECTIONS,
} from "@/config/workbench";
import { MATRIX_METHOD_GUIDANCE } from "@/config/method-guidance";
import { useMatrix } from "@/hooks/useMatrix";
import {
  useWorkbenchHistory,
  type WorkbenchLocalHistorySnapshot,
} from "@/hooks/useWorkbenchHistory";
import { useMatrixLibraryBridge } from "@/hooks/useMatrixLibraryBridge";
import { useResponsiveNavDrawer } from "@/hooks/useResponsiveNavDrawer";
import { useToastQueue } from "@/hooks/useToastQueue";
import {
  applyPaste,
  determinant,
  normalizeMatrixInput,
  numericValue,
  toNumericMatrix,
} from "@/lib/matrix-basic";
import {
  choleskyDecomposition,
  choleskyResidual,
  luDecomposition,
  luResidual,
  qrDecomposition,
  qrResidual,
  svdDecomposition,
  svdResidual,
} from "@/lib/matrix-decomposition";
import {
  analyzeConditionNumbers,
  perturbNumericMatrix,
  relativeMatrixErrorInfinity,
} from "@/lib/matrix-error-analysis";
import {
  eigsWithMathjs,
  relativeEigenError,
} from "@/lib/matrix-eigen";
import {
  resizeInputMatrix,
  toInputMatrix,
} from "@/lib/matrix-format";
import {
  solveLinearSystemByGaussJordan,
  solveLinearSystemIterative,
  solveLinearSystemWithSteps,
} from "@/lib/matrix-linear-system";
import type {
  EigenAnalysisResult,
  IterativeMethod,
  ResultTone,
} from "@/types/matrix";
import type {
  ComparisonRow,
  ReliabilityItem,
  ScanRow,
} from "@/types/experiment";
import type {
  CorrectnessDescriptor,
  DecompositionMode,
  DecompositionResult,
  EigenPerturbationResult,
  Feedback,
  SidebarToolTab,
  TabId,
} from "@/types/workbench";
import {
  RESIDUAL_THRESHOLD,
} from "@/types/workbench";

const DEFAULT_SQUARE = toInputMatrix([
  [2, 1, -1],
  [-3, -1, 2],
  [-2, 1, 2],
]);

function formatResidual(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return value.toExponential(3);
}

function formatSpectralRadius(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatMetric(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)) {
    return value.toExponential(3);
  }
  return value.toFixed(8).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function computeAxMinusBResidual(
  matrixA: number[][],
  vectorX: number[],
  vectorB: number[]
): number | null {
  if (!matrixA.length || !vectorX.length || matrixA.length !== vectorB.length) {
    return null;
  }

  let maxResidual = 0;

  for (let row = 0; row < matrixA.length; row += 1) {
    if (matrixA[row].length !== vectorX.length) return null;

    let sum = 0;
    for (let col = 0; col < vectorX.length; col += 1) {
      sum += matrixA[row][col] * vectorX[col];
    }
    const residual = Math.abs(sum - vectorB[row]);
    if (residual > maxResidual) maxResidual = residual;
  }

  return maxResidual;
}
export default function Home() {
  const matrix = useMatrix();
  const matrixHistorySnapshot = matrix.history.snapshot;
  const restoreMatrixHistorySnapshot = matrix.history.restore;
  const [activeTab, setActiveTab] = useState<TabId>("operations");
  const [showCorrectnessPanel, setShowCorrectnessPanel] = useState(false);
  const {
    isOpen: isNavDrawerOpen,
    open: openNavDrawer,
    close: closeNavDrawer,
  } = useResponsiveNavDrawer();

  const [detSize, setDetSize] = useState(3);
  const [detMatrix, setDetMatrix] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SQUARE, 3, 3, "0")
  );
  const [detResult, setDetResult] = useState<string | null>(null);

  const [decompMode, setDecompMode] = useState<DecompositionMode>("lu");
  const [decompRows, setDecompRows] = useState(3);
  const [decompCols, setDecompCols] = useState(3);
  const [decompMatrix, setDecompMatrix] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SQUARE, 3, 3, "0")
  );
  const [decompResult, setDecompResult] = useState<DecompositionResult | null>(null);

  const [eigSize, setEigSize] = useState(3);
  const [eigMatrix, setEigMatrix] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SQUARE, 3, 3, "0")
  );
  const [eigResult, setEigResult] = useState<EigenAnalysisResult | null>(null);
  const [eigFeedback, setEigFeedback] = useState<Feedback | null>(null);
  const [eigVectorB, setEigVectorB] = useState<string[]>(["1", "1", "1"]);
  const [eigPerturbationResult, setEigPerturbationResult] =
    useState<EigenPerturbationResult | null>(null);

  const [activeOperationTarget, setActiveOperationTarget] = useState<"A" | "B">("A");

  const { toasts, pushToast, dismissToast } = useToastQueue();
  const [matrixComparisonRows, setMatrixComparisonRows] = useState<ComparisonRow[]>([]);
  const [matrixScanRows, setMatrixScanRows] = useState<ScanRow[]>([]);
  const [sidebarToolTab, setSidebarToolTab] = useState<SidebarToolTab>("nav");

  const navSections = NAV_SECTIONS;

  const handleTabSwitch = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setMatrixComparisonRows([]);
    setMatrixScanRows([]);
    closeNavDrawer();
  }, [closeNavDrawer]);

  const localHistorySnapshot = useMemo<WorkbenchLocalHistorySnapshot>(
    () => ({
      showCorrectnessPanel,
      activeOperationTarget,
      determinant: {
        size: detSize,
        matrix: detMatrix,
        result: detResult,
      },
      decomposition: {
        mode: decompMode,
        rows: decompRows,
        cols: decompCols,
        matrix: decompMatrix,
        result: decompResult,
      },
      eigen: {
        size: eigSize,
        matrix: eigMatrix,
        result: eigResult,
        vectorB: eigVectorB,
        perturbationResult: eigPerturbationResult,
      },
    }),
    [
      activeOperationTarget,
      decompCols,
      decompMatrix,
      decompMode,
      decompResult,
      decompRows,
      detMatrix,
      detResult,
      detSize,
      eigMatrix,
      eigPerturbationResult,
      eigResult,
      eigSize,
      eigVectorB,
      showCorrectnessPanel,
    ]
  );

  const restoreLocalHistorySnapshot = useCallback(
    (snapshot: WorkbenchLocalHistorySnapshot) => {
      setShowCorrectnessPanel(snapshot.showCorrectnessPanel);
      setActiveOperationTarget(snapshot.activeOperationTarget);

      setDetSize(snapshot.determinant.size);
      setDetMatrix(snapshot.determinant.matrix);
      setDetResult(snapshot.determinant.result);

      setDecompMode(snapshot.decomposition.mode);
      setDecompRows(snapshot.decomposition.rows);
      setDecompCols(snapshot.decomposition.cols);
      setDecompMatrix(snapshot.decomposition.matrix);
      setDecompResult(snapshot.decomposition.result);

      setEigSize(snapshot.eigen.size);
      setEigMatrix(snapshot.eigen.matrix);
      setEigResult(snapshot.eigen.result);
      setEigVectorB(snapshot.eigen.vectorB);
      setEigPerturbationResult(snapshot.eigen.perturbationResult);
      setEigFeedback(null);
    },
    []
  );

  const { historyState, undoHistory, redoHistory } = useWorkbenchHistory({
    matrixSnapshot: matrixHistorySnapshot,
    localSnapshot: localHistorySnapshot,
    restoreMatrixSnapshot: restoreMatrixHistorySnapshot,
    restoreLocalSnapshot: restoreLocalHistorySnapshot,
  });



  const eigenCondition = useMemo(() => {
    const normalized = normalizeMatrixInput(eigMatrix);
    const numeric = toNumericMatrix(normalized);
    if (!numeric) return null;
    return analyzeConditionNumbers(numeric);
  }, [eigMatrix]);

  const handleDetSizeChange = (nextSize: number) => {
    setDetSize(nextSize);
    setDetMatrix((prev) => resizeInputMatrix(prev, nextSize, nextSize, "0"));
  };

  const handleDetCellChange = (row: number, col: number, value: string) => {
    setDetMatrix((prev) => {
      const next = prev.map((line) => line.slice());
      next[row][col] = value;
      return next;
    });
  };

  const handleDecompModeChange = (nextMode: DecompositionMode) => {
    setDecompMode(nextMode);
    if (nextMode !== "qr" && nextMode !== "svd") {
      setDecompCols(decompRows);
      setDecompMatrix((prev) => resizeInputMatrix(prev, decompRows, decompRows, "0"));
    }
  };

  const handleDecompRowsChange = (nextRows: number) => {
    setDecompRows(nextRows);
    if (decompMode === "qr" || decompMode === "svd") {
      setDecompMatrix((prev) => resizeInputMatrix(prev, nextRows, decompCols, "0"));
      return;
    }
    setDecompCols(nextRows);
    setDecompMatrix((prev) => resizeInputMatrix(prev, nextRows, nextRows, "0"));
  };

  const handleDecompColsChange = (nextCols: number) => {
    if (decompMode === "qr" || decompMode === "svd") {
      setDecompCols(nextCols);
      setDecompMatrix((prev) => resizeInputMatrix(prev, decompRows, nextCols, "0"));
      return;
    }
    setDecompRows(nextCols);
    setDecompCols(nextCols);
    setDecompMatrix((prev) => resizeInputMatrix(prev, nextCols, nextCols, "0"));
  };

  const handleDecompCellChange = (row: number, col: number, value: string) => {
    setDecompMatrix((prev) => {
      const next = prev.map((line) => line.slice());
      next[row][col] = value;
      return next;
    });
  };

  const isMatrixWorkspace =
    activeTab === "operations" ||
    activeTab === "system" ||
    activeTab === "determinant" ||
    activeTab === "decomposition" ||
    activeTab === "eigen" ||
    activeTab === "errorAnalysis";

  const activeModuleMeta = useMemo(
    () =>
      navSections
        .flatMap((section) =>
          section.items.map((item) => ({
            ...item,
            sectionTitle: section.title,
          }))
        )
        .find((item) => item.id === activeTab),
    [activeTab, navSections]
  );

  const activeNavSection = useMemo(
    () =>
      navSections.find((section) =>
        section.items.some((item) => item.id === activeTab)
      ) ?? navSections[0],
    [activeTab, navSections]
  );

  const handleSectionSwitch = useCallback(
    (sectionTitle: string) => {
      const targetSection = navSections.find((section) => section.title === sectionTitle);
      const firstItem = targetSection?.items[0];
      if (firstItem) {
        handleTabSwitch(firstItem.id);
      }
    },
    [handleTabSwitch, navSections]
  );

  const resizeEigenVectorB = useCallback((nextSize: number) => {
    setEigVectorB((prev) =>
      Array.from({ length: nextSize }, (_, idx) => prev[idx] ?? "1")
    );
  }, []);

  const {
    activeLibraryContext,
    currentInputName,
    matrixInventory,
    activeMatrixId,
    renameInventoryMatrix,
    deleteInventoryMatrix,
    addInventoryMatrix,
    loadMatrixToOperationsA,
    loadMatrixToOperationsB,
    saveMatrixWithName,
    handleActivateInventoryMatrix,
    handleSmartImportMatrix,
    handleSaveCurrentInputToLibrary,
  } = useMatrixLibraryBridge({
    activeTab,
    activeOperationTarget,
    setActiveOperationTarget,
    operations: {
      matrixA: matrix.operations.matrixA,
      matrixB: matrix.operations.matrixB,
      setMatrixA: matrix.operations.setMatrixA,
      setMatrixB: matrix.operations.setMatrixB,
    },
    system: {
      augmented: matrix.system.augmented,
      setAugmentedMatrix: matrix.system.setAugmentedMatrix,
    },
    determinant: {
      matrix: detMatrix,
      setSize: setDetSize,
      setMatrix: setDetMatrix,
      setResult: setDetResult,
    },
    decomposition: {
      mode: decompMode,
      matrix: decompMatrix,
      setRows: setDecompRows,
      setCols: setDecompCols,
      setMatrix: setDecompMatrix,
      setResult: setDecompResult,
    },
    eigen: {
      matrix: eigMatrix,
      setSize: setEigSize,
      setMatrix: setEigMatrix,
      resizeVectorB: resizeEigenVectorB,
      setPerturbationResult: setEigPerturbationResult,
    },
    pushToast,
  });

  const clearMatrixExperimentOutputs = () => {
    setMatrixComparisonRows([]);
    setMatrixScanRows([]);
  };

  const applyMatrixExperimentCase = (caseId: string) => {
    clearMatrixExperimentOutputs();

    if (caseId === "ops-inverse") {
      matrix.operations.setOperation("inverse");
      matrix.operations.setMatrixA(toInputMatrix([[2, 1, 1], [1, 3, 2], [1, 0, 0]]));
      setActiveOperationTarget("A");
      return;
    }

    if (caseId === "ops-rref") {
      matrix.operations.setOperation("simplify");
      matrix.operations.setMatrixA(toInputMatrix([[1, 2, 3], [2, 4, 6], [1, 1, 1]]));
      setActiveOperationTarget("A");
      return;
    }

    if (caseId === "system-unique") {
      matrix.system.setMethod("gaussianElimination");
      matrix.system.setAugmentedMatrix(toInputMatrix([[2, 1, -1, 8], [-3, -1, 2, -11], [-2, 1, 2, -3]]));
      return;
    }

    if (caseId === "system-iterative") {
      matrix.system.setMethod("gaussSeidel");
      matrix.system.setAugmentedMatrix(toInputMatrix([[10, -1, 2, 6], [-1, 11, -1, 25], [2, -1, 10, -11]]));
      return;
    }

    if (caseId === "det-singular") {
      setDetSize(3);
      setDetMatrix(toInputMatrix([[1, 2, 3], [2, 4, 6], [4, 5, 6]]));
      setDetResult(null);
      return;
    }

    if (caseId === "decomp-spd") {
      setDecompMode("cholesky");
      setDecompRows(3);
      setDecompCols(3);
      setDecompMatrix(toInputMatrix([[4, 1, 1], [1, 3, 0], [1, 0, 2]]));
      setDecompResult(null);
      return;
    }

    if (caseId === "decomp-rect") {
      setDecompMode("svd");
      setDecompRows(4);
      setDecompCols(3);
      setDecompMatrix(toInputMatrix([[1, 0, 2], [0, 1, 1], [2, 1, 0], [1, 1, 1]]));
      setDecompResult(null);
      return;
    }

    if (caseId === "eigen-diagonalizable") {
      setEigSize(3);
      setEigMatrix(toInputMatrix([[2, 0, 0], [0, 3, 1], [0, 0, 3]]));
      setEigVectorB(["1", "1", "1"]);
      setEigResult(null);
      setEigPerturbationResult(null);
      return;
    }

    if (caseId === "eigen-defective") {
      setEigSize(2);
      setEigMatrix(toInputMatrix([[2, 1], [0, 2]]));
      setEigVectorB(["1", "1"]);
      setEigResult(null);
      setEigPerturbationResult(null);
      return;
    }

    if (caseId === "error-hilbert") {
      const hilbert = Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => 1 / (row + col + 1))
      );
      setEigSize(4);
      setEigMatrix(toInputMatrix(hilbert));
      setEigVectorB(["1", "1", "1", "1"]);
      setEigResult(null);
      setEigPerturbationResult(null);
    }
  };

  const runMatrixComparison = () => {
    if (activeTab === "system") {
      const normalized = normalizeMatrixInput(matrix.system.augmented);
      const rows: ComparisonRow[] = [];
      const gaussian = solveLinearSystemWithSteps(normalized, matrix.system.cols).summary;
      rows.push({
        method: "高斯消元",
        value: gaussian.type,
        metric: `rank(A)=${gaussian.rankA}, rank([A|b])=${gaussian.rankAug}`,
        cost: "步骤回放",
        tone: gaussian.type === "无解" ? "warning" : "success",
        note: gaussian.solution ? `x=[${gaussian.solution.join(", ")}]` : "完成",
      });

      const jordan = solveLinearSystemByGaussJordan(normalized, matrix.system.cols).summary;
      rows.push({
        method: "Gauss-Jordan",
        value: jordan.type,
        metric: `rank(A)=${jordan.rankA}, rank([A|b])=${jordan.rankAug}`,
        cost: "RREF",
        tone: jordan.type === "无解" ? "warning" : "success",
        note: jordan.solution ? `x=[${jordan.solution.join(", ")}]` : "完成",
      });

      const numericAugmented = toNumericMatrix(normalized);
      if (numericAugmented && matrix.system.rows === matrix.system.cols) {
        const matrixA = numericAugmented.map((row) => row.slice(0, matrix.system.cols));
        const vectorB = numericAugmented.map((row) => row[matrix.system.cols]);
        (["jacobi", "gaussSeidel", "sor", "conjugateGradient"] as IterativeMethod[]).forEach((method) => {
          const solved = solveLinearSystemIterative({
            method,
            matrixA,
            vectorB,
            tolerance: Number(matrix.system.tolerance) || 1e-10,
            maxIterations: Number(matrix.system.maxIterations) || 120,
            omega: method === "sor" ? Number(matrix.system.omega) || 1.1 : undefined,
          });
          rows.push({
            method,
            value: solved?.solution ? `[${solved.solution.join(", ")}]` : "N/A",
            metric: solved ? formatResidual(solved.residual) : "N/A",
            cost: solved ? `${solved.iterations} 次` : "-",
            tone: solved?.converged ? "success" : "warning",
            note: solved?.convergenceMessage ?? solved?.note ?? "无法迭代",
          });
        });
      }
      setMatrixComparisonRows(rows);
      return;
    }

    if (activeTab === "decomposition") {
      const normalized = normalizeMatrixInput(decompMatrix);
      const rows: ComparisonRow[] = [];
      const addRow = (
        method: string,
        residual: number | null,
        cost: string,
        note: string
      ) => {
        rows.push({
          method,
          value: residual === null ? "N/A" : formatMetric(residual),
          metric: residual === null ? "N/A" : residual.toExponential(3),
          cost,
          tone: residual !== null && residual < RESIDUAL_THRESHOLD ? "success" : "warning",
          note,
        });
      };

      const lu = decompRows === decompCols ? luDecomposition(normalized) : null;
      if (lu) addRow("LU（带主元）", luResidual(normalized, lu), "方阵", "PA≈LU");
      const qr = qrDecomposition(normalized);
      if (qr) addRow("QR", qrResidual(normalized, qr), "任意矩阵", "A≈QR");
      const svd = svdDecomposition(normalized);
      if (svd) addRow("SVD", svdResidual(normalized, svd), "任意矩阵", "A≈UΣV^T");
      const chol = decompRows === decompCols ? choleskyDecomposition(normalized) : null;
      if (chol) addRow("Cholesky", choleskyResidual(normalized, chol), "SPD 方阵", "A≈LL^T");
      setMatrixComparisonRows(rows);
      return;
    }

    if (activeTab === "eigen" || activeTab === "errorAnalysis") {
      const normalized = normalizeMatrixInput(eigMatrix);
      const numeric = toNumericMatrix(normalized);
      const condition = numeric ? analyzeConditionNumbers(numeric) : null;
      setMatrixComparisonRows(
        condition
          ? [
              {
                method: "1-范数条件数",
                value: formatMetric(condition.cond1),
                metric: `||A||1=${formatMetric(condition.norm1)}`,
                cost: "灵敏度",
                tone: condition.invertible ? "success" : "warning",
                note: condition.invertible ? "可逆" : "不可逆",
              },
              {
                method: "∞-范数条件数",
                value: formatMetric(condition.condInf),
                metric: `||A||∞=${formatMetric(condition.normInf)}`,
                cost: "灵敏度",
                tone: condition.invertible ? "success" : "warning",
                note: condition.invertible ? "可逆" : "不可逆",
              },
            ]
          : []
      );
      return;
    }

    if (activeTab === "determinant") {
      const normalized = normalizeMatrixInput(detMatrix);
      setMatrixComparisonRows([
        {
          method: "行列式",
          value: normalized.length === normalized[0]?.length ? determinant(normalized) : "N/A",
          metric: `${normalized.length}x${normalized[0]?.length ?? 0}`,
          cost: "方阵判定",
          tone: normalized.length === normalized[0]?.length ? "success" : "error",
          note: "det(A)",
        },
      ]);
      return;
    }

    setMatrixComparisonRows([
      {
        method: "当前矩阵运算",
        value: matrix.operations.feedback?.text ?? "尚未计算",
        metric: `${matrix.operations.rows}x${matrix.operations.cols}`,
        cost: matrix.operations.operation,
        tone: matrix.operations.feedback?.tone ?? "info",
        note: matrix.operations.resultMatrix ? "已有结果" : "点击计算生成结果",
      },
    ]);
  };

  const runMatrixScan = () => {
    if (activeTab === "system") {
      const normalized = normalizeMatrixInput(matrix.system.augmented);
      const numericAugmented = toNumericMatrix(normalized);
      if (!numericAugmented || matrix.system.rows !== matrix.system.cols) {
        setMatrixScanRows([]);
        return;
      }
      const matrixA = numericAugmented.map((row) => row.slice(0, matrix.system.cols));
      const vectorB = numericAugmented.map((row) => row[matrix.system.cols]);
      setMatrixScanRows(
        [1e-2, 1e-4, 1e-6, 1e-8, 1e-10].map((tolerance) => {
          const solved = solveLinearSystemIterative({
            method: "gaussSeidel",
            matrixA,
            vectorB,
            tolerance,
            maxIterations: Number(matrix.system.maxIterations) || 120,
          });
          return {
            parameter: "容差",
            value: tolerance.toExponential(0),
            metric: solved ? formatResidual(solved.residual) : "N/A",
            tone: solved?.converged ? "success" : "warning",
            note: solved ? `${solved.iterations} 次` : "无法迭代",
          };
        })
      );
      return;
    }

    if (activeTab === "eigen" || activeTab === "errorAnalysis") {
      const numericA = toNumericMatrix(normalizeMatrixInput(eigMatrix));
      const baselineEigen = numericA ? eigsWithMathjs(numericA) : null;
      if (!numericA || !baselineEigen) {
        setMatrixScanRows([]);
        return;
      }
      setMatrixScanRows(
        [1e-8, 1e-7, 1e-6, 1e-5].map((epsilon) => {
          const perturbed = perturbNumericMatrix(numericA, epsilon);
          if (!perturbed) {
            return {
              parameter: "扰动 ε",
              value: epsilon.toExponential(0),
              metric: "N/A",
              tone: "error",
              note: "扰动生成失败",
            } satisfies ScanRow;
          }
          const perturbedEigen = eigsWithMathjs(perturbed);
          const eigenError = perturbedEigen
            ? relativeEigenError(baselineEigen.values, perturbedEigen.values)
            : null;
          return {
            parameter: "扰动 ε",
            value: epsilon.toExponential(0),
            metric: `relEig=${formatMetric(eigenError)}`,
            tone: eigenError !== null && eigenError < 1e-3 ? "success" : "warning",
            note: `relA=${formatMetric(relativeMatrixErrorInfinity(numericA, perturbed))}`,
          };
        })
      );
      return;
    }

    if (activeTab === "decomposition") {
      const normalized = normalizeMatrixInput(decompMatrix);
      setMatrixScanRows(
        (["lu", "qr", "svd"] as const).map((mode) => {
          const residual =
            mode === "lu"
              ? decompRows === decompCols
                ? (() => {
                    const lu = luDecomposition(normalized);
                    return lu ? luResidual(normalized, lu) : null;
                  })()
                : null
              : mode === "qr"
                ? (() => {
                    const qr = qrDecomposition(normalized);
                    return qr ? qrResidual(normalized, qr) : null;
                  })()
                : (() => {
                    const svd = svdDecomposition(normalized);
                    return svd ? svdResidual(normalized, svd) : null;
                  })();
          return {
            parameter: "方法",
            value: mode.toUpperCase(),
            metric: residual === null ? "N/A" : residual.toExponential(3),
            tone: residual !== null && residual < RESIDUAL_THRESHOLD ? "success" : "warning",
            note: "残差",
          };
        })
      );
      return;
    }

    setMatrixScanRows([]);
  };


  const pasteDeterminantMatrix = (row: number, col: number, text: string) => {
    setDetMatrix((prev) => applyPaste(prev, row, col, text));
    setDetResult(null);
  };

  const pasteDecompositionMatrix = (row: number, col: number, text: string) => {
    setDecompMatrix((prev) => applyPaste(prev, row, col, text));
    setDecompResult(null);
  };

  const pasteEigenMatrix = (row: number, col: number, text: string) => {
    setEigMatrix((prev) => applyPaste(prev, row, col, text));
    setEigPerturbationResult(null);
  };

  const systemEvidence = matrix.system.iterativeResult
    ? `残差=${formatResidual(matrix.system.iterativeResult.residual)}，迭代次数=${matrix.system.iterativeResult.iterations}，ρ(B)=${formatSpectralRadius(matrix.system.iterativeResult.spectralRadius)}，判定=${matrix.system.iterativeResult.convergenceGuaranteed === true ? "ρ(B)<1，保证收敛" : matrix.system.iterativeResult.convergenceGuaranteed === false ? "ρ(B)≥1，不保证收敛" : "不适用/无法判定"}`
    : undefined;
  const systemResultMatrix =
    matrix.system.currentStep?.matrix ?? matrix.system.augmented;
  const decompEvidence = useMemo(() => {
    if (!decompResult) return undefined;
    if (decompResult.mode === "lu" || decompResult.mode === "luPlain") {
      if (decompResult.mode === "luPlain") {
        return `A=L*U, maxAbs(A-LU)=${decompResult.residual?.toExponential(3) ?? "N/A"}`;
      }
      return `P*A = L*U, maxAbs(PA-LU)=${decompResult.residual?.toExponential(3) ?? "N/A"}`;
    }
    if (decompResult.mode === "qr") {
      return `A=QR, maxAbs(A-QR)=${decompResult.residual?.toExponential(3) ?? "N/A"}, maxAbs(Q^TQ-I)=${decompResult.orthResidual?.toExponential(3) ?? "N/A"}`;
    }
    if (decompResult.mode === "svd") {
      return `A=UΣV^T, maxAbs(A-UΣV^T)=${decompResult.residual?.toExponential(3) ?? "N/A"}, maxAbs(U^TU-I)=${decompResult.orthResidualU?.toExponential(3) ?? "N/A"}, maxAbs(V^TV-I)=${decompResult.orthResidualV?.toExponential(3) ?? "N/A"}`;
    }
    return `A=L*L^T, maxAbs(A-LL^T)=${decompResult.residual?.toExponential(3) ?? "N/A"}`;
  }, [decompResult]);
  const decompPrimaryMatrix = useMemo(() => {
    if (!decompResult) return null;
    if (decompResult.mode === "lu" || decompResult.mode === "luPlain") {
      return decompResult.decomposition.L;
    }
    if (decompResult.mode === "qr") return decompResult.decomposition.Q;
    if (decompResult.mode === "svd") return decompResult.decomposition.U;
    return decompResult.decomposition.L;
  }, [decompResult]);
  const operationCorrectness = useMemo<CorrectnessDescriptor | null>(() => {
    if (!matrix.operations.feedback) return null;

    const operation = matrix.operations.operation;
    if (operation === "rank" || operation === "determinant") {
      return {
        title: "运算正确性证据",
        equation: matrix.operations.feedback.text,
        passed: matrix.operations.feedback.tone === "success",
        note: "该结果由分数/符号链路直接计算得到。",
      };
    }

    if (operation === "inverse" && matrix.operations.resultMatrix) {
      const matrixA = toNumericMatrix(normalizeMatrixInput(matrix.operations.matrixA));
      const inverseA = toNumericMatrix(normalizeMatrixInput(matrix.operations.resultMatrix));

      if (!matrixA || !inverseA) {
        return {
          title: "运算正确性证据",
          equation: "A · A^-1 = I",
          passed: null,
          note: "当前输入包含非纯数值表达，无法计算数值残差。",
        };
      }

      const size = matrixA.length;
      if (
        !size ||
        matrixA.some((row) => row.length !== size) ||
        inverseA.some((row) => row.length !== size)
      ) {
        return null;
      }

      let maxResidual = 0;
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          let sum = 0;
          for (let k = 0; k < size; k += 1) {
            sum += matrixA[r][k] * inverseA[k][c];
          }
          const expected = r === c ? 1 : 0;
          const residual = Math.abs(sum - expected);
          if (residual > maxResidual) maxResidual = residual;
        }
      }

      return {
        title: "运算正确性证据",
        equation: "A · A^-1 = I",
        residual: maxResidual,
        threshold: RESIDUAL_THRESHOLD,
        passed: maxResidual < RESIDUAL_THRESHOLD,
      };
    }

    return null;
  }, [
    matrix.operations.feedback,
    matrix.operations.matrixA,
    matrix.operations.operation,
    matrix.operations.resultMatrix,
  ]);

  const systemCorrectness = useMemo<CorrectnessDescriptor | null>(() => {
    const summary = matrix.system.summary;
    if (!summary) return null;

    const baseMetrics = [
      { label: "rank(A)", value: `${summary.rankA}` },
      { label: "rank([A|b])", value: `${summary.rankAug}` },
    ];

    if (matrix.system.iterativeResult) {
      const tolerance = Number(matrix.system.tolerance);
      const threshold =
        Number.isFinite(tolerance) && tolerance > 0 ? tolerance : RESIDUAL_THRESHOLD;
      const iterative = matrix.system.iterativeResult;
      return {
        title: "求解正确性证据",
        equation: "maxAbs(Ax-b)",
        residual: iterative.residual,
        threshold,
        passed: iterative.converged || iterative.residual < threshold,
        metrics: [
          ...baseMetrics,
          { label: "迭代次数", value: `${iterative.iterations}` },
          { label: "ρ(B)", value: formatSpectralRadius(iterative.spectralRadius) },
        ],
        note: iterative.convergenceMessage,
      };
    }

    const variableCount = matrix.system.cols;

    if (summary.rankAug > summary.rankA) {
      return {
        title: "求解正确性证据",
        equation: "rank([A|b]) > rank(A)",
        passed: true,
        metrics: baseMetrics,
        note: "秩判定满足无解条件。",
      };
    }

    if (summary.rankA < variableCount) {
      return {
        title: "求解正确性证据",
        equation: "rank([A|b]) = rank(A) < n",
        passed: true,
        metrics: [
          ...baseMetrics,
          { label: "变量数 n", value: `${variableCount}` },
        ],
        note: "秩判定满足无穷多解条件。",
      };
    }

    if (!summary.solution || summary.solution.length !== variableCount) {
      return {
        title: "求解正确性证据",
        equation: "maxAbs(Ax-b)",
        passed: null,
        metrics: baseMetrics,
        note: "当前无法构造完整的数值解向量。",
      };
    }

    const matrixA = toNumericMatrix(normalizeMatrixInput(matrix.system.matrixA));
    const vectorBMatrix = toNumericMatrix(normalizeMatrixInput(matrix.system.vectorB));
    const vectorX = summary.solution.map((value) => numericValue(value));

    if (!matrixA || !vectorBMatrix || vectorX.some((value) => value === null)) {
      return {
        title: "求解正确性证据",
        equation: "maxAbs(Ax-b)",
        passed: null,
        metrics: baseMetrics,
        note: "当前输入包含非纯数值表达，无法计算数值残差。",
      };
    }

    const residual = computeAxMinusBResidual(
      matrixA,
      vectorX as number[],
      vectorBMatrix.map((row) => row[0])
    );

    return {
      title: "求解正确性证据",
      equation: "maxAbs(Ax-b)",
      residual,
      threshold: RESIDUAL_THRESHOLD,
      passed: residual !== null ? residual < RESIDUAL_THRESHOLD : null,
      metrics: baseMetrics,
    };
  }, [
    matrix.system.cols,
    matrix.system.iterativeResult,
    matrix.system.matrixA,
    matrix.system.summary,
    matrix.system.tolerance,
    matrix.system.vectorB,
  ]);

  const decompCorrectness = useMemo<CorrectnessDescriptor | null>(() => {
    if (!decompResult) return null;

    if (decompResult.mode === "svd") {
      return {
        title: "分解正确性证据",
        equation: "A = U·Σ·V^T",
        residual: decompResult.residual,
        threshold: decompResult.threshold,
        passed: decompResult.passed,
        metrics: [
          {
            label: "maxAbs(U^TU-I)",
            value: formatResidual(decompResult.orthResidualU ?? Number.NaN),
          },
          {
            label: "maxAbs(V^TV-I)",
            value: formatResidual(decompResult.orthResidualV ?? Number.NaN),
          },
        ],
      };
    }

    if (decompResult.mode === "qr") {
      return {
        title: "分解正确性证据",
        equation: "A = Q·R",
        residual: decompResult.residual,
        threshold: decompResult.threshold,
        passed: decompResult.passed,
        metrics: [
          {
            label: "maxAbs(Q^TQ-I)",
            value: formatResidual(decompResult.orthResidual ?? Number.NaN),
          },
        ],
      };
    }

    if (decompResult.mode === "cholesky") {
      return {
        title: "分解正确性证据",
        equation: "A = L·L^T",
        residual: decompResult.residual,
        threshold: decompResult.threshold,
        passed: decompResult.passed,
      };
    }

    return {
      title: "分解正确性证据",
      equation: decompResult.mode === "lu" ? "P·A = L·U" : "A = L·U",
      residual: decompResult.residual,
      threshold: decompResult.threshold,
      passed: decompResult.passed,
      note:
        decompResult.mode === "luPlain"
          ? "普通 LU 不包含主元策略，病态矩阵下稳定性较弱。"
          : undefined,
    };
  }, [decompResult]);

  const detCorrectness = useMemo<CorrectnessDescriptor | null>(() => {
    if (!detResult) return null;
    return {
      title: "行列式验证",
      equation: "det(A)",
      passed: true,
      metrics: [{ label: "det(A)", value: matrix.formatValue(detResult) }],
      note: "行列式由精确表达式链路计算，可用于可逆性初判。",
    };
  }, [detResult, matrix]);

  const eigenCorrectness = useMemo<CorrectnessDescriptor | null>(() => {
    if (!eigResult) return null;

    const algebraicTotal = eigResult.multiplicities.reduce(
      (sum, item) => sum + item.algebraic,
      0
    );
    const geometricTotal = eigResult.multiplicities.reduce(
      (sum, item) => sum + item.geometric,
      0
    );

    return {
      title: "特征分析正确性证据",
      equation: "对任意 λ: geometric(λ) ≤ algebraic(λ)",
      passed: eigResult.diagonalizable ? true : null,
      metrics: [
        { label: "代数重数总和", value: `${algebraicTotal}` },
        { label: "几何重数总和", value: `${geometricTotal}` },
      ],
      note: eigResult.diagonalizable
        ? "几何重数满足对角化条件。"
        : "几何重数不足，矩阵不可对角化（该结论本身是有效结果）。",
    };
  }, [eigResult]);

  const activeCorrectnessDescriptor =
    activeTab === "operations"
      ? operationCorrectness
      : activeTab === "system"
        ? systemCorrectness
        : activeTab === "determinant"
          ? detCorrectness
        : activeTab === "decomposition"
            ? decompCorrectness
            : activeTab === "eigen" || activeTab === "errorAnalysis"
              ? eigenCorrectness
              : null;

  const matrixReliabilityItems = useMemo<ReliabilityItem[]>(() => {
    const items: ReliabilityItem[] = [];
    const descriptor = activeCorrectnessDescriptor;

    if (descriptor) {
      items.push({
        label: descriptor.title,
        tone:
          descriptor.passed === true
            ? "success"
            : descriptor.passed === false
              ? "warning"
              : "info",
        detail:
          descriptor.residual !== undefined && descriptor.residual !== null
            ? `${descriptor.equation ?? "残差"} = ${formatMetric(descriptor.residual)}`
            : descriptor.note ?? descriptor.equation ?? "已生成验证信息。",
      });
    } else {
      items.push({
        label: "等待计算",
        tone: "info",
        detail: "点击当前模块的计算按钮后，这里会显示残差、秩、条件数或收敛性检查。",
      });
    }

    if (activeTab === "system" && matrix.system.iterativeResult) {
      items.push({
        label: "迭代收敛性",
        tone: matrix.system.iterativeResult.converged ? "success" : "warning",
        detail: matrix.system.iterativeResult.convergenceMessage ?? "已完成迭代法判定。",
      });
    }

    if ((activeTab === "eigen" || activeTab === "errorAnalysis") && eigenCondition) {
      items.push({
        label: "条件数",
        tone:
          !eigenCondition.invertible
            ? "error"
            : (eigenCondition.condInf ?? 0) > 1e6
              ? "warning"
              : "success",
        detail: `cond∞(A)=${formatMetric(eigenCondition.condInf)}，cond1(A)=${formatMetric(eigenCondition.cond1)}。`,
      });
    }


    return items;
  }, [
    activeCorrectnessDescriptor,
    activeTab,
    eigenCondition,
    matrix.system.iterativeResult,
  ]);

  const matrixExperimentSummary = useMemo(() => {
    if (activeTab === "system" && matrix.system.summary) {
      return `线性方程组：${matrix.system.summary.type}`;
    }
    if ((activeTab === "eigen" || activeTab === "errorAnalysis") && eigenCondition) {
      return `误差/特征实验：cond∞=${formatMetric(eigenCondition.condInf)}`;
    }
    if (activeTab === "operations" && matrix.operations.feedback) {
      return `矩阵运算：${matrix.operations.feedback.text}`;
    }
    return `${activeModuleMeta?.label ?? "矩阵实验"}配置`;
  }, [
    activeModuleMeta?.label,
    activeTab,
    eigenCondition,
    matrix.operations.feedback,
    matrix.system.summary,
  ]);

  useEffect(() => {
    if (!matrix.operations.feedback) return;
    pushToast({
      tone: matrix.operations.feedback.tone,
      title: "运算状态",
      message: matrix.operations.feedback.text,
    });
  }, [matrix.operations.feedback, pushToast]);

  useEffect(() => {
    if (!matrix.system.feedback) return;
    pushToast({
      tone: matrix.system.feedback.tone,
      title: "\u6c42\u89e3\u72b6\u6001",
      message: matrix.system.feedback.text,
      evidence: systemEvidence,
    });
  }, [matrix.system.feedback, systemEvidence, pushToast]);


  useEffect(() => {
    if (!eigFeedback) return;
    pushToast({
      tone: eigFeedback.tone,
      title: "特征分析状态",
      message: eigFeedback.text,
    });
  }, [eigFeedback, pushToast]);

  return (
    <WorkbenchLayout
      header={
        <WorkbenchHeader
          navSections={navSections}
          activeSectionTitle={activeNavSection?.title}
          onOpenNavDrawer={openNavDrawer}
          onSectionSwitch={handleSectionSwitch}
        />
      }
      sidebar={
        <WorkbenchSidebar
          activeTab={activeTab}
          activeToolTab={sidebarToolTab}
          activeNavSection={activeNavSection}
          isOpen={isNavDrawerOpen}
          onClose={closeNavDrawer}
          onTabSwitch={handleTabSwitch}
          onToolTabChange={setSidebarToolTab}
        >

            {!isMatrixWorkspace ? (
              <>
                <div
                  id="module-sidebar-cases"
                  className={sidebarToolTab === "cases" ? "space-y-3" : "hidden"}
                />
                <div
                  id="module-sidebar-params"
                  className={sidebarToolTab === "params" ? "space-y-3" : "hidden"}
                />
                <div
                  id="module-sidebar-verify"
                  className={sidebarToolTab === "verify" ? "space-y-3" : "hidden"}
                />
                <div
                  id="module-sidebar-data"
                  className={sidebarToolTab === "data" ? "space-y-3" : "hidden"}
                />
              </>
            ) : (
              <>
                {sidebarToolTab === "cases" ? (
                  <>
                    <ExperimentCasePanel
                      cases={MATRIX_EXPERIMENT_CASES[activeTab] ?? []}
                      onApply={applyMatrixExperimentCase}
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        实验工具
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={runMatrixComparison}
                          className="step-control justify-center"
                        >
                          方法对比
                        </button>
                        <button
                          type="button"
                          onClick={runMatrixScan}
                          className="step-control justify-center"
                        >
                          参数扫描
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}

                {sidebarToolTab === "params" ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      矩阵输入
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      矩阵表格需要更宽的编辑空间，因此保留在主工作区；这里集中放置案例、验证与数据管理。
                    </div>
                  </div>
                ) : null}

                {sidebarToolTab === "verify" ? (
                  <>
                    <ReliabilityPanel items={matrixReliabilityItems} />
                    <MethodGuidancePanel
                      items={MATRIX_METHOD_GUIDANCE[activeTab] ?? []}
                    />
                    <DisplayModeSwitcher
                      displayMode={matrix.displayMode}
                      onChange={matrix.setDisplayMode}
                    />
                    <CorrectnessPanelToggleCard
                      enabled={showCorrectnessPanel}
                      onToggle={setShowCorrectnessPanel}
                    />
                  </>
                ) : null}

                {sidebarToolTab === "data" ? (
                  <>
                    <SaveExperimentButton
                      module={
                        activeTab === "errorAnalysis"
                          ? "error-analysis"
                          : activeTab === "operations" ||
                              activeTab === "system" ||
                              activeTab === "determinant" ||
                              activeTab === "decomposition" ||
                              activeTab === "eigen"
                            ? "linear-algebra"
                            : "linear-algebra"
                      }
                      defaultName={activeModuleMeta?.label ?? "数值线性代数实验"}
                      summary={matrixExperimentSummary}
                      payload={{
                        activeTab,
                        matrixSnapshot: matrixHistorySnapshot,
                        eigen: { eigSize, eigMatrix, eigResult, eigVectorB, eigPerturbationResult },
                        comparisonRows: matrixComparisonRows,
                        scanRows: matrixScanRows,
                      }}
                      disabled={
                        !activeCorrectnessDescriptor &&
                        matrixComparisonRows.length === 0 &&
                        matrixScanRows.length === 0 &&
                        !(activeTab === "operations" && matrix.operations.resultMatrix)
                      }
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          矩阵实验数据
                        </div>
                        <SaveToLibraryButton
                          defaultName={currentInputName}
                          onSave={handleSaveCurrentInputToLibrary}
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {activeLibraryContext === "matrix-operations"
                          ? `当前活动输入位：${activeOperationTarget}`
                          : "可将当前编辑矩阵保存到矩阵库，继续用于后续数值线性代数或误差实验。"}
                      </div>
                    </div>
                    <MatrixShelf
                      items={matrixInventory}
                      activeMatrixId={activeMatrixId}
                      onActivate={handleActivateInventoryMatrix}
                      onDelete={deleteInventoryMatrix}
                      onRename={renameInventoryMatrix}
                      onSmartImport={handleSmartImportMatrix}
                    />
                    <HistoryControlCard
                      canUndo={historyState.canUndo}
                      canRedo={historyState.canRedo}
                      index={historyState.index}
                      total={historyState.total}
                      onUndo={undoHistory}
                      onRedo={redoHistory}
                    />
                  </>
                ) : null}
              </>
            )}
        </WorkbenchSidebar>
      }
      toasts={toasts}
      onDismissToast={dismissToast}
    >

        <div>
          {isMatrixWorkspace && (matrixComparisonRows.length > 0 || matrixScanRows.length > 0) ? (
            <div className="mb-6 space-y-6">
              <MethodComparisonTable rows={matrixComparisonRows} />
              <ParameterScanTable title="矩阵实验参数扫描" rows={matrixScanRows} />
            </div>
          ) : null}

          {activeTab === "operations" && (
            <MatrixOperationsModule
              operations={matrix.operations}
              sizeOptions={matrix.sizeOptions}
              displayMode={matrix.displayMode}
              showCorrectnessPanel={showCorrectnessPanel}
              correctness={operationCorrectness}
              matrixInventory={matrixInventory}
              onSaveToLibrary={(name) =>
                saveMatrixWithName(
                  matrix.operations.resultMatrix,
                  name,
                  "matrix-operations",
                  "standard"
                )
              }
              onLoadResultToA={() =>
                loadMatrixToOperationsA(matrix.operations.resultMatrix!)
              }
              onLoadResultToB={() =>
                loadMatrixToOperationsB(matrix.operations.resultMatrix!)
              }
              onFocusA={() => setActiveOperationTarget("A")}
              onFocusB={() => setActiveOperationTarget("B")}
            />
          )}

          {activeTab === "system" && (
            <LinearSystemModule
              system={matrix.system}
              sizeOptions={matrix.sizeOptions}
              displayMode={matrix.displayMode}
              showCorrectnessPanel={showCorrectnessPanel}
              correctness={systemCorrectness}
              matrixInventory={matrixInventory}
              onSaveToLibrary={(name) =>
                saveMatrixWithName(
                  systemResultMatrix,
                  name,
                  "linear-system",
                  "augmented"
                )
              }
              describeStep={matrix.describeStep}
              formatValue={matrix.formatValue}
            />
          )}

          {activeTab === "determinant" && (
            <DeterminantModule
              displayMode={matrix.displayMode}
              sizeOptions={matrix.sizeOptions}
              size={detSize}
              matrix={detMatrix}
              result={detResult}
              matrixInventory={matrixInventory}
              onSizeChange={handleDetSizeChange}
              onMatrixChange={handleDetCellChange}
              onMatrixPaste={pasteDeterminantMatrix}
              onResultChange={setDetResult}
              onSaveToLibrary={(matrixData, name) => {
                const record = addInventoryMatrix({
                  name,
                  data: matrixData,
                  type: "standard",
                });
                if (record) {
                  pushToast({
                    tone: "success",
                    title: "保存成功",
                    message: `矩阵 "${name}" 已保存到矩阵库`,
                  });
                }
              }}
              onFeedback={(feedback) => {
                pushToast({
                  tone: feedback.tone,
                  title: feedback.tone === "success" ? "计算完成" : "计算失败",
                  message: feedback.text,
                });
              }}
              formatValue={matrix.formatValue}
            />
          )}
          {activeTab === "decomposition" && (
            <DecompositionModule
              sizeOptions={matrix.sizeOptions}
              displayMode={matrix.displayMode}
              mode={decompMode}
              rows={decompRows}
              cols={decompCols}
              matrix={decompMatrix}
              result={decompResult}
              showCorrectnessPanel={showCorrectnessPanel}
              correctness={decompCorrectness}
              matrixInventory={matrixInventory}
              onModeChange={handleDecompModeChange}
              onRowsChange={handleDecompRowsChange}
              onColsChange={handleDecompColsChange}
              onMatrixChange={handleDecompCellChange}
              onMatrixPaste={pasteDecompositionMatrix}
              onResultChange={setDecompResult}
              onSaveToLibrary={(matrixData, name) =>
                saveMatrixWithName(decompPrimaryMatrix ?? matrixData, name, "decomposition", "standard")
              }
              onFeedback={(feedback) =>
                pushToast({ tone: feedback.tone, title: "分解状态", message: feedback.text, evidence: decompEvidence })
              }
            />
          )}

          {activeTab === "eigen" && (
            <EigenAnalysisModule
              size={eigSize}
              matrix={eigMatrix}
              result={eigResult}
              vectorB={eigVectorB}
              perturbationResult={eigPerturbationResult}
              onSizeChange={(next) => {
                setEigSize(next);
                setEigMatrix((prev) => resizeInputMatrix(prev, next, next, "0"));
                resizeEigenVectorB(next);
              }}
              onMatrixChange={(r, c, value) =>
                setEigMatrix((prev) => {
                  const next = prev.map((line) => line.slice());
                  next[r][c] = value;
                  return next;
                })
              }
              onMatrixPaste={pasteEigenMatrix}
              onResultChange={setEigResult}
              onPerturbationResultChange={setEigPerturbationResult}
              sizeOptions={matrix.sizeOptions}
              displayMode={matrix.displayMode}
              showCorrectnessPanel={showCorrectnessPanel}
              correctness={eigenCorrectness}
              matrixInventory={matrixInventory}
              onSaveToLibrary={(matrixData, name) =>
                saveMatrixWithName(matrixData, name, "eigen", "standard")
              }
              onFeedback={(feedback) =>
                pushToast({ tone: feedback.tone, title: "特征分析", message: feedback.text })
              }
              formatEigenComponent={matrix.formatEigenComponent}
            />
          )}

          {activeTab === "nonlinear" && <LazyNonlinearSolverPanel />}

          {activeTab === "approximation" && <LazyApproximationPanel />}

          {activeTab === "integration" && <LazyIntegrationPanel />}

          {activeTab === "ode" && <LazyOdePanel />}

          {activeTab === "errorAnalysis" && (
            <ErrorAnalysisModule
              size={eigSize}
              matrix={eigMatrix}
              vectorB={eigVectorB}
              perturbationResult={eigPerturbationResult}
              onSizeChange={(next) => {
                setEigSize(next);
                setEigMatrix((prev) => resizeInputMatrix(prev, next, next, "0"));
                resizeEigenVectorB(next);
              }}
              onMatrixChange={(r, c, value) =>
                setEigMatrix((prev) => {
                  const next = prev.map((line) => line.slice());
                  next[r][c] = value;
                  return next;
                })
              }
              onMatrixPaste={pasteEigenMatrix}
              onVectorBChange={(idx, value) =>
                setEigVectorB((prev) => prev.map((item, i) => (i === idx ? value : item)))
              }
              onPerturbationResultChange={setEigPerturbationResult}
              sizeOptions={matrix.sizeOptions}
              displayMode={matrix.displayMode}
              onToast={(tone, title, message) => pushToast({ tone: tone as ResultTone, title, message })}
            />
          )}
        </div>
    </WorkbenchLayout>
  );
}
