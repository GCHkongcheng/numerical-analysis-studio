"use client";

import {
  AlertTriangle,
  Braces,
  Calculator,
  ChartArea,
  CircleHelp,
  FunctionSquare,
  LineChart,
  Menu,
  Redo2,
  Sigma,
  SplitSquareVertical,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CorrectnessPanel } from "@/components/matrix/CorrectnessPanel";
import { MatrixGrid } from "@/components/matrix/MatrixGrid";
import { MatrixShelf } from "@/components/matrix/MatrixShelf";
import { OperationButtonGroup } from "@/components/matrix/OperationButtonGroup";
import { ToastHost, type ToastItem } from "@/components/matrix/ToastHost";
import { SaveToLibraryButton } from "@/components/matrix/SaveToLibraryButton";
import { StepCard } from "@/components/matrix/StepCard";
import { ApproximationPanel } from "@/components/approximation/ApproximationPanel";
import { IntegrationPanel } from "@/components/integration/IntegrationPanel";
import { NonlinearSolverPanel } from "@/components/nonlinear/NonlinearSolverPanel";
import { OdePanel } from "@/components/ode/OdePanel";
import { useMatrix, type MatrixHistorySnapshot } from "@/hooks/useMatrix";
import {
  analyzeConditionNumbers,
  applyPaste,
  choleskyDecomposition,
  choleskyResidual,
  determinant,
  eigsWithMathjs,
  perturbNumericMatrix,
  perturbNumericVector,
  relativeEigenError,
  relativeMatrixErrorInfinity,
  relativeVectorErrorInfinity,
  luDecomposition,
  luDecompositionPlain,
  luResidual,
  luResidualPlain,
  normalizeMatrixInput,
  numericValue,
  qrDecomposition,
  qrOrthogonalityResidual,
  qrResidual,
  resizeInputMatrix,
  solveNumericLinearSystem,
  svdDecomposition,
  svdOrthogonalityResiduals,
  svdResidual,
  toInputMatrix,
  toNumericMatrix,
} from "@/lib/matrix-core";
import type {
  CholeskyResult,
  DisplayMode,
  EigenAnalysisResult,
  LinearSystemMethod,
  LUResult,
  QRResult,
  ResultTone,
  SVDResult,
} from "@/types/matrix";
import {
  type ActiveContext,
  type MatrixKind,
  suggestNameForContext,
  useMatrixLibraryStore,
} from "@/store/matrix-library";

type TabId =
  | "operations"
  | "system"
  | "determinant"
  | "decomposition"
  | "eigen"
  | "nonlinear"
  | "approximation"
  | "integration"
  | "ode"
  | "errorAnalysis";
type DecompositionMode = "lu" | "luPlain" | "qr" | "cholesky" | "svd";

type Feedback = {
  tone: ResultTone;
  text: string;
};

type PerturbationTarget = "A" | "b";

type EigenPerturbationResult = {
  target: PerturbationTarget;
  epsilon: number;
  matrixRelativeError: number | null;
  vectorRelativeError: number | null;
  eigenRelativeError: number | null;
  solutionRelativeError: number | null;
  baselineSolution: string[] | null;
  perturbedSolution: string[] | null;
};

type DecompositionResult =
  | {
      mode: "lu" | "luPlain";
      decomposition: LUResult;
      residual: number | null;
      threshold: number;
      passed: boolean | null;
    }
  | {
      mode: "qr";
      decomposition: QRResult;
      residual: number | null;
      orthResidual: number | null;
      threshold: number;
      passed: boolean;
    }
  | {
      mode: "cholesky";
      decomposition: CholeskyResult;
      residual: number | null;
      threshold: number;
      passed: boolean;
    }
  | {
      mode: "svd";
      decomposition: SVDResult;
      residual: number | null;
      orthResidualU: number | null;
      orthResidualV: number | null;
      threshold: number;
      passed: boolean | null;
    };

const RESIDUAL_THRESHOLD = 1e-10;
const HISTORY_LIMIT = 120;

const OPERATION_OPTIONS = [
  { id: "add", label: "A + B" },
  { id: "subtract", label: "A - B" },
  { id: "multiply", label: "A * B" },
  { id: "inverse", label: "A^-1" },
  { id: "rank", label: "\u79e9" },
  { id: "determinant", label: "\u884c\u5217\u5f0f" },
  { id: "transpose", label: "转置" },
  { id: "simplify", label: "RREF" },
  { id: "scalar", label: "数乘" },
  { id: "square", label: "A^2" },
] as const;

const DEFAULT_SQUARE = toInputMatrix([
  [2, 1, -1],
  [-3, -1, 2],
  [-2, 1, 2],
]);

const DECOMPOSITION_OPTIONS: Array<{ id: DecompositionMode; label: string }> = [
  { id: "lu", label: "LU（带主元）" },
  { id: "luPlain", label: "LU（普通）" },
  { id: "qr", label: "QR（Householder）" },
  { id: "cholesky", label: "Cholesky分解" },
  { id: "svd", label: "SVD分解" },
];

const SYSTEM_METHOD_OPTIONS: Array<{ id: LinearSystemMethod; label: string }> = [
  { id: "gaussianElimination", label: "高斯消元" },
  { id: "gaussJordan", label: "高斯-约旦" },
  { id: "jacobi", label: "Jacobi迭代" },
  { id: "gaussSeidel", label: "Gauss-Seidel迭代" },
  { id: "sor", label: "SOR迭代" },
  { id: "conjugateGradient", label: "共轭梯度法" },
];

function isIterativeSystemMethod(method: LinearSystemMethod): boolean {
  return (
    method === "jacobi" ||
    method === "gaussSeidel" ||
    method === "sor" ||
    method === "conjugateGradient"
  );
}

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


type CorrectnessDescriptor = {
  title: string;
  equation?: string;
  residual?: number | null;
  threshold?: number | null;
  passed?: boolean | null;
  note?: string;
  metrics?: Array<{ label: string; value: string }>;
};

type LocalHistorySnapshot = {
  activeTab: TabId;
  showCorrectnessPanel: boolean;
  activeOperationTarget: "A" | "B";
  determinant: {
    size: number;
    matrix: string[][];
    result: string | null;
  };
  decomposition: {
    mode: DecompositionMode;
    rows: number;
    cols: number;
    matrix: string[][];
    result: DecompositionResult | null;
  };
  eigen: {
    size: number;
    matrix: string[][];
    result: EigenAnalysisResult | null;
    vectorB: string[];
    perturbationResult: EigenPerturbationResult | null;
  };
};

type AppHistorySnapshot = {
  matrix: MatrixHistorySnapshot;
  local: LocalHistorySnapshot;
};

type HistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  index: number;
  total: number;
};

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
function cloneMatrixValues(matrix: string[][]): string[][] {
  return matrix.map((row) => row.map((value) => value || "0"));
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function DisplayModeSwitcher({
  displayMode,
  onChange,
}: {
  displayMode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        显示模式
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { value: "decimal", label: "小数" },
          { value: "fraction", label: "分数" },
          { value: "symbolic", label: "符号" },
        ].map((mode) => (
          <button
            key={mode.value}
            onClick={() => onChange(mode.value as DisplayMode)}
            className={`mode-chip ${displayMode === mode.value ? "mode-chip-active" : ""}`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CorrectnessPanelToggleCard({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-700">正确性证据</div>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        aria-pressed={enabled}
        aria-label={enabled ? "关闭正确性证据面板" : "开启正确性证据面板"}
        className={`relative h-6 w-11 rounded-full transition ${
          enabled ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            enabled ? "left-5" : "left-0.5"
          }`}
        />
      </button>
      </div>
    </div>
  );
}

function HistoryControlCard({
  canUndo,
  canRedo,
  index,
  total,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  index: number;
  total: number;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-700">操作历史</div>
        <div className="text-xs text-slate-500">{total ? `${index}/${total}` : "0/0"}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="step-control justify-center"
          aria-label="撤销"
        >
          <Undo2 size={14} />
          撤销
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="step-control justify-center"
          aria-label="重做"
        >
          <Redo2 size={14} />
          重做
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const matrix = useMatrix();
  const matrixHistorySnapshot = matrix.history.snapshot;
  const restoreMatrixHistorySnapshot = matrix.history.restore;
  const [activeTab, setActiveTab] = useState<TabId>("operations");
  const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
  const [showCorrectnessPanel, setShowCorrectnessPanel] = useState(false);

  const [detSize, setDetSize] = useState(3);
  const [detMatrix, setDetMatrix] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SQUARE, 3, 3, "0")
  );
  const [detResult, setDetResult] = useState<string | null>(null);
  const [detFeedback, setDetFeedback] = useState<Feedback | null>(null);

  const [decompMode, setDecompMode] = useState<DecompositionMode>("lu");
  const [decompRows, setDecompRows] = useState(3);
  const [decompCols, setDecompCols] = useState(3);
  const [decompMatrix, setDecompMatrix] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SQUARE, 3, 3, "0")
  );
  const [decompResult, setDecompResult] = useState<DecompositionResult | null>(null);
  const [decompFeedback, setDecompFeedback] = useState<Feedback | null>(null);

  const [eigSize, setEigSize] = useState(3);
  const [eigMatrix, setEigMatrix] = useState<string[][]>(
    resizeInputMatrix(DEFAULT_SQUARE, 3, 3, "0")
  );
  const [eigResult, setEigResult] = useState<EigenAnalysisResult | null>(null);
  const [eigFeedback, setEigFeedback] = useState<Feedback | null>(null);
  const [eigVectorB, setEigVectorB] = useState<string[]>(["1", "1", "1"]);
  const [eigPerturbationResult, setEigPerturbationResult] =
    useState<EigenPerturbationResult | null>(null);

  const matrixInventory = useMatrixLibraryStore((state) => state.matrixInventory);
  const activeMatrixId = useMatrixLibraryStore((state) => state.activeMatrixId);
  const renameInventoryMatrix = useMatrixLibraryStore((state) => state.renameMatrix);
  const deleteInventoryMatrix = useMatrixLibraryStore((state) => state.deleteMatrix);
  const addInventoryMatrix = useMatrixLibraryStore((state) => state.addMatrix);
  const setInventoryActiveMatrix = useMatrixLibraryStore((state) => state.setActiveMatrix);
  const saveCurrentResultToLibrary = useMatrixLibraryStore(
    (state) => state.saveCurrentResultToLibrary
  );
  const [activeOperationTarget, setActiveOperationTarget] = useState<"A" | "B">("A");

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeqRef = useRef(0);
  const toastTimersRef = useRef<Map<number, number>>(new Map());
  const toastGroupRef = useRef<Map<string, number>>(new Map());
  const historyStackRef = useRef<AppHistorySnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const historyApplyingRef = useRef(false);
  const [historyState, setHistoryState] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    index: 0,
    total: 0,
  });

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }

    setToasts((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        const groupedId = toastGroupRef.current.get(target.title);
        if (groupedId === id) {
          toastGroupRef.current.delete(target.title);
        }
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const pushToast = useCallback(
    (payload: Omit<ToastItem, "id">) => {
      const existingId = toastGroupRef.current.get(payload.title);

      if (existingId !== undefined) {
        const timer = toastTimersRef.current.get(existingId);
        if (timer !== undefined) {
          window.clearTimeout(timer);
        }

        setToasts((prev) =>
          prev.map((item) =>
            item.id === existingId ? { id: existingId, ...payload } : item
          )
        );

        const nextTimer = window.setTimeout(() => {
          dismissToast(existingId);
        }, 3600);
        toastTimersRef.current.set(existingId, nextTimer);
        return;
      }

      const id = Date.now() + toastSeqRef.current;
      toastSeqRef.current += 1;

      toastGroupRef.current.set(payload.title, id);
      setToasts((prev) => [...prev, { id, ...payload }]);

      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, 3600);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timerMap = toastTimersRef.current;
    const groupMap = toastGroupRef.current;

    return () => {
      timerMap.forEach((timer) => window.clearTimeout(timer));
      timerMap.clear();
      groupMap.clear();
    };
  }, []);

  useEffect(() => {
    if (!isNavDrawerOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNavDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isNavDrawerOpen]);

  const tabs = useMemo(
    () => [
      { id: "operations", label: "矩阵运算", icon: Calculator },
      { id: "system", label: "线性方程组", icon: Braces },
      { id: "decomposition", label: "矩阵分解", icon: SplitSquareVertical },
      { id: "eigen", label: "特征分析", icon: FunctionSquare },
      { id: "nonlinear", label: "非线性求根", icon: Sigma },
      { id: "approximation", label: "插值与逼近", icon: LineChart },
      { id: "integration", label: "数值积分", icon: ChartArea },
      { id: "ode", label: "微分方程", icon: FunctionSquare },
      { id: "errorAnalysis", label: "误差分析", icon: AlertTriangle },
    ],
    []
  );

  const handleTabSwitch = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setIsNavDrawerOpen(false);
  }, []);

  const syncHistoryState = useCallback(() => {
    const total = historyStackRef.current.length;
    const index = historyIndexRef.current;
    setHistoryState({
      canUndo: index > 0,
      canRedo: index >= 0 && index < total - 1,
      index: total === 0 || index < 0 ? 0 : index + 1,
      total,
    });
  }, []);

  const localHistorySnapshot = useMemo<LocalHistorySnapshot>(
    () => ({
      activeTab,
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
      activeTab,
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

  const appHistorySnapshot = useMemo<AppHistorySnapshot>(
    () => ({
      matrix: matrixHistorySnapshot,
      local: localHistorySnapshot,
    }),
    [localHistorySnapshot, matrixHistorySnapshot]
  );

  const applyHistorySnapshot = useCallback(
    (snapshot: AppHistorySnapshot) => {
      historyApplyingRef.current = true;

      restoreMatrixHistorySnapshot(deepClone(snapshot.matrix));

      setActiveTab(snapshot.local.activeTab);
      setShowCorrectnessPanel(snapshot.local.showCorrectnessPanel);
      setActiveOperationTarget(snapshot.local.activeOperationTarget);

      setDetSize(snapshot.local.determinant.size);
      setDetMatrix(snapshot.local.determinant.matrix);
      setDetResult(snapshot.local.determinant.result);
      setDetFeedback(null);

      setDecompMode(snapshot.local.decomposition.mode);
      setDecompRows(snapshot.local.decomposition.rows);
      setDecompCols(snapshot.local.decomposition.cols);
      setDecompMatrix(snapshot.local.decomposition.matrix);
      setDecompResult(snapshot.local.decomposition.result);
      setDecompFeedback(null);

      setEigSize(snapshot.local.eigen.size);
      setEigMatrix(snapshot.local.eigen.matrix);
      setEigResult(snapshot.local.eigen.result);
      setEigVectorB(snapshot.local.eigen.vectorB);
      setEigPerturbationResult(snapshot.local.eigen.perturbationResult);
      setEigFeedback(null);
    },
    [restoreMatrixHistorySnapshot]
  );

  const undoHistory = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const target = historyStackRef.current[historyIndexRef.current];
    if (!target) return;
    applyHistorySnapshot(deepClone(target));
    syncHistoryState();
  }, [applyHistorySnapshot, syncHistoryState]);

  const redoHistory = useCallback(() => {
    const nextIndex = historyIndexRef.current + 1;
    if (nextIndex >= historyStackRef.current.length) return;
    historyIndexRef.current = nextIndex;
    const target = historyStackRef.current[nextIndex];
    if (!target) return;
    applyHistorySnapshot(deepClone(target));
    syncHistoryState();
  }, [applyHistorySnapshot, syncHistoryState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoHistory();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoHistory();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoHistory, undoHistory]);

  useEffect(() => {
    const nextSnapshot = deepClone(appHistorySnapshot);
    const currentStack = historyStackRef.current;

    if (currentStack.length === 0) {
      historyStackRef.current = [nextSnapshot];
      historyIndexRef.current = 0;
      syncHistoryState();
      return;
    }

    if (historyApplyingRef.current) {
      historyApplyingRef.current = false;
      syncHistoryState();
      return;
    }

    const current = currentStack[historyIndexRef.current];
    if (current && JSON.stringify(current) === JSON.stringify(nextSnapshot)) {
      syncHistoryState();
      return;
    }

    let nextStack = currentStack.slice(0, historyIndexRef.current + 1);
    nextStack.push(nextSnapshot);

    if (nextStack.length > HISTORY_LIMIT) {
      nextStack = nextStack.slice(nextStack.length - HISTORY_LIMIT);
    }

    historyStackRef.current = nextStack;
    historyIndexRef.current = nextStack.length - 1;
    syncHistoryState();
  }, [appHistorySnapshot, syncHistoryState]);

  const computeDeterminant = () => {
    const normalized = normalizeMatrixInput(detMatrix);
    if (normalized.length !== normalized[0].length) {
      setDetResult(null);
      setDetFeedback({ tone: "error", text: "行列式计算要求方阵" });
      return;
    }
    setDetResult(determinant(normalized));
    setDetFeedback({ tone: "success", text: "det(A) 计算完成" });
  };

  const computeDecomposition = () => {
    const normalized = normalizeMatrixInput(decompMatrix);
    if (decompMode !== "qr" && decompMode !== "svd" && decompRows !== decompCols) {
      setDecompResult(null);
      setDecompFeedback({ tone: "error", text: "LU/Cholesky 需要方阵" });
      return;
    }

    if (decompMode === "lu" || decompMode === "luPlain") {
      const isPlainLu = decompMode === "luPlain";
      const decomposition = isPlainLu
        ? luDecompositionPlain(normalized)
        : luDecomposition(normalized);
      if (!decomposition) {
        setDecompResult(null);
        setDecompFeedback({
          tone: "error",
          text: isPlainLu
            ? "普通 LU 分解失败（主对角线出现零主元，建议改用带主元 LU）"
            : "LU 分解失败",
        });
        return;
      }
      const residual = isPlainLu
        ? luResidualPlain(normalized, decomposition)
        : luResidual(normalized, decomposition);
      const passed = residual === null ? null : residual < RESIDUAL_THRESHOLD;
      setDecompResult({
        mode: isPlainLu ? "luPlain" : "lu",
        decomposition,
        residual,
        threshold: RESIDUAL_THRESHOLD,
        passed,
      });
      setDecompFeedback({
        tone: passed === false ? "warning" : "success",
        text: isPlainLu ? "普通 LU 分解完成" : "LU 分解完成",
      });
      return;
    }

    if (decompMode === "qr") {
      const decomposition = qrDecomposition(normalized);
      if (!decomposition) {
        setDecompResult(null);
        setDecompFeedback({ tone: "error", text: "QR 需要纯数值输入" });
        return;
      }
      const residual = qrResidual(normalized, decomposition);
      const orthResidual = qrOrthogonalityResidual(decomposition);
      const passed =
        residual !== null &&
        orthResidual !== null &&
        residual < RESIDUAL_THRESHOLD &&
        orthResidual < RESIDUAL_THRESHOLD;
      setDecompResult({
        mode: "qr",
        decomposition,
        residual,
        orthResidual,
        threshold: RESIDUAL_THRESHOLD,
        passed,
      });
      setDecompFeedback({ tone: passed ? "success" : "warning", text: "QR 分解完成" });
      return;
    }

    if (decompMode === "svd") {
      const decomposition = svdDecomposition(normalized);
      if (!decomposition) {
        setDecompResult(null);
        setDecompFeedback({ tone: "error", text: "SVD 需要纯数值输入" });
        return;
      }

      const residual = svdResidual(normalized, decomposition);
      const orthResiduals = svdOrthogonalityResiduals(decomposition);
      const passed =
        residual !== null &&
        orthResiduals.max !== null &&
        residual < RESIDUAL_THRESHOLD &&
        orthResiduals.max < RESIDUAL_THRESHOLD;

      setDecompResult({
        mode: "svd",
        decomposition,
        residual,
        orthResidualU: orthResiduals.u,
        orthResidualV: orthResiduals.v,
        threshold: RESIDUAL_THRESHOLD,
        passed,
      });
      setDecompFeedback({ tone: passed ? "success" : "warning", text: "SVD 分解完成" });
      return;
    }

    const decomposition = choleskyDecomposition(normalized);
    if (!decomposition) {
      setDecompResult(null);
      setDecompFeedback({ tone: "error", text: "Cholesky 需要对称正定矩阵" });
      return;
    }
    const residual = choleskyResidual(normalized, decomposition);
    const passed = residual !== null && residual < RESIDUAL_THRESHOLD;
    setDecompResult({ mode: "cholesky", decomposition, residual, threshold: RESIDUAL_THRESHOLD, passed });
    setDecompFeedback({ tone: passed ? "success" : "warning", text: "Cholesky 分解完成" });
  };

  const computeEigen = () => {
    const normalized = normalizeMatrixInput(eigMatrix);
    const numeric = toNumericMatrix(normalized);
    if (!numeric) {
      setEigResult(null);
      setEigFeedback({ tone: "error", text: "特征分析需要纯数值输入" });
      return;
    }
    const result = eigsWithMathjs(numeric);
    if (!result) {
      setEigResult(null);
      setEigFeedback({ tone: "error", text: "特征分析计算失败" });
      return;
    }
    setEigResult(result);
    if (!result.diagonalizable) {
      setEigFeedback({ tone: "warning", text: "该矩阵不可对角化" });
      return;
    }
    setEigFeedback({ tone: "success", text: "特征分析完成" });
  };

  const eigenCondition = useMemo(() => {
    const normalized = normalizeMatrixInput(eigMatrix);
    const numeric = toNumericMatrix(normalized);
    if (!numeric) return null;
    return analyzeConditionNumbers(numeric);
  }, [eigMatrix]);

  const runEigenPerturbationTest = (target: PerturbationTarget) => {
    const epsilon = 1e-6;
    const normalizedA = normalizeMatrixInput(eigMatrix);
    const numericA = toNumericMatrix(normalizedA);
    if (!numericA) {
      setEigPerturbationResult(null);
      pushToast({
        tone: "error",
        title: "扰动实验",
        message: "矩阵 A 需要纯数值输入。",
      });
      return;
    }

    const numericBColumn = toNumericMatrix(eigVectorB.map((value) => [value]));
    if (!numericBColumn) {
      setEigPerturbationResult(null);
      pushToast({
        tone: "error",
        title: "扰动实验",
        message: "向量 b 需要纯数值输入。",
      });
      return;
    }
    const numericB = numericBColumn.map((row) => row[0]);

    const baselineEigen = eigsWithMathjs(numericA);
    if (!baselineEigen) {
      setEigPerturbationResult(null);
      pushToast({
        tone: "error",
        title: "扰动实验",
        message: "基线特征值计算失败，无法进行扰动对比。",
      });
      return;
    }

    const perturbedA =
      target === "A" ? perturbNumericMatrix(numericA, epsilon) : numericA.map((row) => row.slice());
    if (!perturbedA) {
      setEigPerturbationResult(null);
      pushToast({
        tone: "error",
        title: "扰动实验",
        message: "矩阵扰动生成失败。",
      });
      return;
    }

    const perturbedB =
      target === "b" ? perturbNumericVector(numericB, epsilon) : numericB.slice();
    if (!perturbedB) {
      setEigPerturbationResult(null);
      pushToast({
        tone: "error",
        title: "扰动实验",
        message: "向量扰动生成失败。",
      });
      return;
    }

    const perturbedEigen = eigsWithMathjs(perturbedA);

    const baselineSolution = solveNumericLinearSystem(numericA, numericB);
    const perturbedSolution = solveNumericLinearSystem(perturbedA, perturbedB);

    setEigPerturbationResult({
      target,
      epsilon,
      matrixRelativeError: relativeMatrixErrorInfinity(numericA, perturbedA),
      vectorRelativeError: relativeVectorErrorInfinity(numericB, perturbedB),
      eigenRelativeError: perturbedEigen
        ? relativeEigenError(baselineEigen.values, perturbedEigen.values)
        : null,
      solutionRelativeError:
        baselineSolution && perturbedSolution
          ? relativeVectorErrorInfinity(baselineSolution, perturbedSolution)
          : null,
      baselineSolution: baselineSolution ? toInputMatrix([baselineSolution])[0] : null,
      perturbedSolution: perturbedSolution ? toInputMatrix([perturbedSolution])[0] : null,
    });

    pushToast({
      tone: "success",
      title: "扰动实验",
      message: target === "A" ? "已完成 A 的随机扰动实验。" : "已完成 b 的随机扰动实验。",
    });
  };
  const activeLibraryContext = useMemo<ActiveContext>(() => {
    if (activeTab === "operations") return "matrix-operations";
    if (activeTab === "system") return "linear-system";
    if (activeTab === "determinant") return "determinant";
    if (activeTab === "decomposition") return "decomposition";
    if (activeTab === "errorAnalysis") return "eigen";
    return "eigen";
  }, [activeTab]);

  const inferMatrixKindByContext = (context: ActiveContext): MatrixKind =>
    context === "linear-system" ? "augmented" : "standard";

  const resizeEigenVectorB = useCallback((nextSize: number) => {
    setEigVectorB((prev) =>
      Array.from({ length: nextSize }, (_, idx) => prev[idx] ?? "1")
    );
  }, []);

  const loadMatrixToOperationsA = (matrixData: string[][]) => {
    matrix.operations.setMatrixA(cloneMatrixValues(matrixData));
    setActiveOperationTarget("A");
  };

  const loadMatrixToOperationsB = (matrixData: string[][]) => {
    matrix.operations.setMatrixB(cloneMatrixValues(matrixData));
    setActiveOperationTarget("B");
  };

  const loadMatrixToContext = (
    matrixData: string[][],
    context: ActiveContext = activeLibraryContext
  ) => {
    const copied = cloneMatrixValues(matrixData);

    if (context === "matrix-operations") {
      if (activeOperationTarget === "B") {
        loadMatrixToOperationsB(copied);
        return;
      }
      loadMatrixToOperationsA(copied);
      return;
    }

    if (context === "linear-system") {
      if ((copied[0]?.length ?? 0) < 2) return;
      matrix.system.setAugmentedMatrix(copied);
      return;
    }

    if (context === "determinant") {
      const size = Math.max(copied.length, copied[0]?.length ?? 1);
      setDetSize(size);
      setDetMatrix(resizeInputMatrix(copied, size, size, "0"));
      return;
    }

    if (context === "eigen") {
      const size = Math.max(copied.length, copied[0]?.length ?? 1);
      setEigSize(size);
      setEigMatrix(resizeInputMatrix(copied, size, size, "0"));
      resizeEigenVectorB(size);
      setEigPerturbationResult(null);
      return;
    }

    if (context === "decomposition") {
      if (
        decompMode === "qr" ||
        decompMode === "svd" ||
        copied.length !== copied[0]?.length
      ) {
        const rows = Math.max(1, copied.length);
        const cols = Math.max(1, copied[0]?.length ?? 1);
        setDecompRows(rows);
        setDecompCols(cols);
        setDecompMatrix(resizeInputMatrix(copied, rows, cols, "0"));
        return;
      }

      const size = Math.max(copied.length, copied[0]?.length ?? 1);
      setDecompRows(size);
      setDecompCols(size);
      setDecompMatrix(resizeInputMatrix(copied, size, size, "0"));
    }
  };

  const saveMatrixWithName = (
    rawMatrix: string[][] | null,
    preferredName: string,
    context: ActiveContext,
    type?: MatrixKind
  ) => {
    saveCurrentResultToLibrary(
      rawMatrix,
      context,
      type ?? inferMatrixKindByContext(context),
      preferredName
    );
  };

  const handleActivateInventoryMatrix = (item: {
    id: string;
    data: string[][];
    type: MatrixKind;
  }) => {
    setInventoryActiveMatrix(item.id, activeLibraryContext);
    loadMatrixToContext(item.data, activeLibraryContext);
  };

  const handleSmartImportMatrix = (payload: {
    name: string;
    data: string[][];
    type: MatrixKind;
  }) => {
    const created = addInventoryMatrix({
      name: payload.name,
      data: payload.data,
      type: payload.type,
    });

    if (!created) {
      pushToast({
        tone: "error",
        title: "智能识别",
        message: "识别矩阵保存失败，请检查矩阵是否为规则二维结构。",
      });
      return;
    }

    setInventoryActiveMatrix(created.id, activeLibraryContext);
    loadMatrixToContext(created.data, activeLibraryContext);
    pushToast({
      tone: "success",
      title: "智能识别",
      message: `已保存矩阵「${created.name}」并加载到当前模块。`,
    });
  };

  const handleSaveCurrentInputToLibrary = (name: string) => {
    const activeEditingMatrix =
      activeLibraryContext === "matrix-operations"
        ? activeOperationTarget === "B"
          ? matrix.operations.matrixB
          : matrix.operations.matrixA
        : activeLibraryContext === "linear-system"
          ? matrix.system.augmented
          : activeLibraryContext === "determinant"
            ? detMatrix
            : activeLibraryContext === "decomposition"
              ? decompMatrix
              : eigMatrix;

    saveMatrixWithName(
      activeEditingMatrix,
      name,
      activeLibraryContext,
      inferMatrixKindByContext(activeLibraryContext)
    );
  };

  const pasteDeterminantMatrix = (row: number, col: number, text: string) => {
    setDetMatrix((prev) => applyPaste(prev, row, col, text));
  };

  const pasteDecompositionMatrix = (row: number, col: number, text: string) => {
    setDecompMatrix((prev) => applyPaste(prev, row, col, text));
  };

  const pasteEigenMatrix = (row: number, col: number, text: string) => {
    setEigMatrix((prev) => applyPaste(prev, row, col, text));
    setEigPerturbationResult(null);
  };

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

  const systemUsesIteration = isIterativeSystemMethod(matrix.system.method);
  const systemEvidence = matrix.system.iterativeResult
    ? `残差=${formatResidual(matrix.system.iterativeResult.residual)}，迭代次数=${matrix.system.iterativeResult.iterations}，ρ(B)=${formatSpectralRadius(matrix.system.iterativeResult.spectralRadius)}，判定=${matrix.system.iterativeResult.convergenceGuaranteed === true ? "ρ(B)<1，保证收敛" : matrix.system.iterativeResult.convergenceGuaranteed === false ? "ρ(B)≥1，不保证收敛" : "不适用/无法判定"}`
    : undefined;
  const systemResultMatrix =
    matrix.system.currentStep?.matrix ?? matrix.system.augmented;
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
    if (!detFeedback) return;
    pushToast({
      tone: detFeedback.tone,
      title: "行列式状态",
      message: detFeedback.text,
    });
  }, [detFeedback, pushToast]);

  useEffect(() => {
    if (!decompFeedback) return;
    pushToast({
      tone: decompFeedback.tone,
      title: "\u5206\u89e3\u72b6\u6001",
      message: decompFeedback.text,
      evidence: decompEvidence,
    });
  }, [decompFeedback, decompEvidence, pushToast]);

  useEffect(() => {
    if (!eigFeedback) return;
    pushToast({
      tone: eigFeedback.tone,
      title: "特征分析状态",
      message: eigFeedback.text,
    });
  }, [eigFeedback, pushToast]);

  return (
    <div className="min-h-screen px-6 py-10 text-[15px] text-slate-900">
      <header className="mx-auto w-full max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNavDrawerOpen(true)}
              className="step-control lg:hidden"
              aria-label="打开导航菜单"
            >
              <Menu size={14} />
              菜单
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              线性代数工作室
            </div>
          </div>
          <Link href="/about" className="step-control" aria-label="打开关于页面">
            <CircleHelp size={14} />
            关于页面
          </Link>
        </div>
        <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
          数值分析工作台
        </h1>
        <p className="max-w-3xl text-base text-slate-700">
          支持线性代数计算、非线性方程求根、插值逼近、数值积分、微分方程、迭代过程追踪与正确性校验。
        </p>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-6xl gap-6 lg:grid-cols-[240px_1fr]">
        <button
          type="button"
          className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
            isNavDrawerOpen
              ? "pointer-events-auto bg-slate-900/35 opacity-100 backdrop-blur-[1.5px]"
              : "pointer-events-none opacity-0"
          }`}
          aria-label="关闭导航菜单"
          onClick={() => setIsNavDrawerOpen(false)}
        />

        <aside
          className={`studio-card space-y-4 lg:h-fit lg:translate-x-0 lg:overflow-visible ${
            isNavDrawerOpen ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] overflow-y-auto rounded-none border-r border-slate-200 pb-6 pt-4 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu will-change-transform lg:static lg:w-auto lg:rounded-3xl lg:border lg:border-slate-200 lg:p-5 lg:shadow-none`}
        >
          <div className="mb-1 flex items-center justify-between lg:hidden">
            <div className="text-sm font-semibold text-slate-700">导航菜单</div>
            <button
              type="button"
              onClick={() => setIsNavDrawerOpen(false)}
              className="step-control"
              aria-label="关闭导航菜单"
            >
              <X size={14} />
              关闭
            </button>
          </div>

          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">导航</div>
          <div className="grid gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSwitch(tab.id as TabId)}
                  className={`nav-tab ${activeTab === tab.id ? "nav-tab-active" : ""}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <DisplayModeSwitcher displayMode={matrix.displayMode} onChange={matrix.setDisplayMode} />
          <CorrectnessPanelToggleCard
            enabled={showCorrectnessPanel}
            onToggle={setShowCorrectnessPanel}
          />
          {activeTab !== "nonlinear" &&
          activeTab !== "approximation" &&
          activeTab !== "integration" &&
          activeTab !== "ode" ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    当前输入
                  </div>
                  <SaveToLibraryButton
                    defaultName={suggestNameForContext(matrixInventory, activeLibraryContext)}
                    onSave={handleSaveCurrentInputToLibrary}
                  />
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {activeLibraryContext === "matrix-operations"
                    ? `当前活动输入位：${activeOperationTarget}`
                    : "可将当前编辑矩阵保存到矩阵库。"}
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
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              当前模块使用函数表达式或数据点，矩阵库会在切回线性代数模块后继续可用。
            </div>
          )}
          <HistoryControlCard
            canUndo={historyState.canUndo}
            canRedo={historyState.canRedo}
            index={historyState.index}
            total={historyState.total}
            onUndo={undoHistory}
            onRedo={redoHistory}
          />
        </aside>

        <div>
          {activeTab === "operations" && (
            <div className="workspace-container">
              <div className="workspace-grid">
                <section className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">矩阵输入</h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <label className="flex items-center gap-2">
                          行数
                          <select
                            value={matrix.operations.rows}
                            onChange={(event) => matrix.operations.setDimensions(Number(event.target.value), matrix.operations.cols)}
                            className="studio-select"
                          >
                            {matrix.sizeOptions.map((size) => (
                              <option key={`ops-row-${size}`} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2">
                          列数
                          <select
                            value={matrix.operations.cols}
                            onChange={(event) => matrix.operations.setDimensions(matrix.operations.rows, Number(event.target.value))}
                            className="studio-select"
                          >
                            {matrix.sizeOptions.map((size) => (
                              <option key={`ops-col-${size}`} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <MatrixGrid
                      matrix={matrix.operations.matrixA.map((row) => row.map((value) => value || "0"))}
                      inputMatrix={matrix.operations.matrixA}
                      editable
                      displayMode={matrix.displayMode}
                      onChange={matrix.operations.setCellA}
                      onPasteMatrix={matrix.operations.pasteA}
                      onCellFocus={() => setActiveOperationTarget("A")}
                    />

                    {(matrix.operations.operation === "add" || matrix.operations.operation === "subtract" || matrix.operations.operation === "multiply") && (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <div className="font-semibold text-slate-700">矩阵 B</div>
                          {matrix.operations.operation === "multiply" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="flex items-center gap-1">行数
                                <select
                                  value={matrix.operations.bRows}
                                  onChange={(event) => matrix.operations.setBMatrixDimensions(Number(event.target.value), matrix.operations.bCols)}
                                  className="studio-select"
                                >
                                  {matrix.sizeOptions.map((size) => (
                                    <option key={`ops-b-row-${size}`} value={size}>{size}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex items-center gap-1">列数
                                <select
                                  value={matrix.operations.bCols}
                                  onChange={(event) => matrix.operations.setBMatrixDimensions(matrix.operations.bRows, Number(event.target.value))}
                                  className="studio-select"
                                >
                                  {matrix.sizeOptions.map((size) => (
                                    <option key={`ops-b-col-${size}`} value={size}>{size}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : null}
                        </div>

                        <MatrixGrid
                          matrix={matrix.operations.matrixB.map((row) => row.map((value) => value || "0"))}
                          inputMatrix={matrix.operations.matrixB}
                          editable
                          displayMode={matrix.displayMode}
                          onChange={matrix.operations.setCellB}
                          onPasteMatrix={matrix.operations.pasteB}
                          onCellFocus={() => setActiveOperationTarget("B")}
                        />
                      </div>
                    )}
                  </div>

                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">运算</h2>
                      <button onClick={matrix.operations.compute} className="studio-primary-btn">计算</button>
                    </div>

                    <OperationButtonGroup
                      options={[...OPERATION_OPTIONS]}
                      active={matrix.operations.operation}
                      onChange={matrix.operations.setOperation}
                    />

                    {matrix.operations.operation === "scalar" && (
                      <input
                        value={matrix.operations.scalar}
                        onChange={(event) => matrix.operations.setScalar(event.target.value)}
                        className="studio-input"
                        placeholder="数乘系数，例如 1/3"
                      />
                    )}
                  </div>
                </section>

                <aside className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">结果</h2>
                      <SaveToLibraryButton
                        disabled={!matrix.operations.resultMatrix}
                        defaultName={suggestNameForContext(
                          matrixInventory,
                          "matrix-operations"
                        )}
                        onSave={(name) =>
                          saveMatrixWithName(
                            matrix.operations.resultMatrix,
                            name,
                            "matrix-operations",
                            "standard"
                          )
                        }
                      />
                    </div>
                    {matrix.operations.resultMatrix ? (
                      <>
                        <MatrixGrid matrix={matrix.operations.resultMatrix} displayMode={matrix.displayMode} />
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => loadMatrixToOperationsA(matrix.operations.resultMatrix!)}
                            className="step-control"
                          >
                            结果填入 A
                          </button>
                          <button
                            onClick={() => loadMatrixToOperationsB(matrix.operations.resultMatrix!)}
                            className="step-control"
                          >
                            结果填入 B
                          </button>
                        </div>
                      </>
                    ) : null}
                    {!matrix.operations.resultMatrix &&
                    (matrix.operations.operation === "rank" ||
                      matrix.operations.operation === "determinant") &&
                    matrix.operations.feedback ? (
                      <div
                        className={
                          matrix.operations.feedback.tone === "error"
                            ? "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                            : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700"
                        }
                      >
                        {matrix.operations.feedback.text}
                      </div>
                    ) : null}
                    {showCorrectnessPanel && operationCorrectness ? (
                      <CorrectnessPanel {...operationCorrectness} />
                    ) : null}
                  </div>
                </aside>
              </div>
            </div>
          )}

                    {activeTab === "system" && (
            <div className="workspace-container">
              <div className="workspace-grid">
                <section className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">线性方程组</h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <label className="flex items-center gap-2">方程数
                          <select
                            value={matrix.system.rows}
                            onChange={(event) => matrix.system.setDimensions(Number(event.target.value), matrix.system.cols)}
                            className="studio-select"
                          >
                            {matrix.sizeOptions.map((size) => (
                              <option key={`sys-row-${size}`} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2">变量数
                          <select
                            value={matrix.system.cols}
                            onChange={(event) => matrix.system.setDimensions(matrix.system.rows, Number(event.target.value))}
                            className="studio-select"
                          >
                            {matrix.sizeOptions.map((size) => (
                              <option key={`sys-col-${size}`} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2">求解方法
                          <select
                            value={matrix.system.method}
                            onChange={(event) => matrix.system.setMethod(event.target.value as LinearSystemMethod)}
                            className="studio-select"
                          >
                            {SYSTEM_METHOD_OPTIONS.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                        {systemUsesIteration ? (
                          <>
                            <label className="flex items-center gap-2">容差
                              <input
                                value={matrix.system.tolerance}
                                onChange={(event) => matrix.system.setTolerance(event.target.value)}
                                className="studio-input w-32"
                                placeholder="1e-10"
                              />
                            </label>
                            <label className="flex items-center gap-2">迭代
                              <input
                                value={matrix.system.maxIterations}
                                onChange={(event) => matrix.system.setMaxIterations(event.target.value)}
                                className="studio-input w-24"
                                placeholder="120"
                              />
                            </label>
                            {matrix.system.method === "sor" ? (
                              <label className="flex items-center gap-2">松弛因子
                                <input
                                  value={matrix.system.omega}
                                  onChange={(event) => matrix.system.setOmega(event.target.value)}
                                  className="studio-input w-24"
                                  placeholder="1.1"
                                />
                              </label>
                            ) : null}
                          </>
                        ) : null}
                        <button onClick={matrix.system.compute} className="studio-primary-btn">求解</button>
                      </div>
                    </div>

                    <MatrixGrid
                      matrix={matrix.system.augmented.map((row) => row.map((value) => value || "0"))}
                      inputMatrix={matrix.system.augmented}
                      editable
                      displayMode={matrix.displayMode}
                      augmentedIndex={matrix.system.cols}
                      onChange={matrix.system.setCell}
                      onPasteMatrix={matrix.system.paste}
                    />
                  </div>

                  {systemUsesIteration ? (
                    <div className="studio-card space-y-4">
                      <h3 className="text-base font-semibold text-slate-900">迭代过程</h3>
                      {matrix.system.iterativeResult ? (
                        <>
                          <MatrixGrid
                            matrix={matrix.system.iterativeResult.solution.map((value) => [value])}
                            displayMode={matrix.displayMode}
                          />
                          <div className="space-y-2">
                            {matrix.system.iterativeResult.history.slice(-8).map((item, idx) => (
                              <div
                                key={`iter-${idx}-${item.iteration}`}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700"
                              >
                                k={item.iteration}，残差={formatResidual(item.residual)}，x=[{item.vector.join(", ")}]
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-500">执行求解后查看迭代历史。</div>
                      )}
                    </div>
                  ) : (
                    <StepCard
                      step={matrix.system.currentStep}
                      stepIndex={matrix.system.stepIndex}
                      totalSteps={Math.max(matrix.system.steps.length, 1)}
                      stepDescription={matrix.system.currentStep ? matrix.describeStep(matrix.system.currentStep) : "等待求解"}
                      isPlaying={matrix.system.isPlaying}
                      onPrev={matrix.system.prevStep}
                      onNext={matrix.system.nextStep}
                      onReset={matrix.system.resetSteps}
                      onTogglePlay={matrix.system.togglePlay}
                    >
                      {matrix.system.currentStep ? (
                        <MatrixGrid
                          matrix={matrix.system.currentStep.matrix}
                          displayMode={matrix.displayMode}
                          augmentedIndex={matrix.system.cols}
                          pivot={matrix.system.currentStep.pivot}
                          highlightRows={matrix.system.currentStep.highlightRows}
                        />
                      ) : null}
                    </StepCard>
                  )}
                </section>

                <aside className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">结果摘要</h2>
                      <SaveToLibraryButton
                        disabled={!matrix.system.summary}
                        defaultName={suggestNameForContext(matrixInventory, "linear-system")}
                        onSave={(name) =>
                          saveMatrixWithName(
                            systemResultMatrix,
                            name,
                            "linear-system",
                            "augmented"
                          )
                        }
                      />
                    </div>
                    {matrix.system.summary ? (
                      <div className="space-y-2 text-sm">
                        <div>类型：{matrix.system.summary.type}</div>
                        <div>rank(A) = {matrix.system.summary.rankA}</div>
                        <div>rank([A|b]) = {matrix.system.summary.rankAug}</div>
                        {matrix.system.iterativeResult ? (
                          <div className="font-mono text-xs">{matrix.system.iterativeResult.solution.map((v, i) => `x${i + 1}=${matrix.formatValue(v)}`).join(", ")}</div>
                        ) : matrix.system.summary.solution ? (
                          <div className="font-mono text-xs">{matrix.system.summary.solution.map((v, i) => `x${i + 1}=${matrix.formatValue(v)}`).join(", ")}</div>
                        ) : null}
                    {showCorrectnessPanel && systemCorrectness ? (
                      <CorrectnessPanel {...systemCorrectness} />
                    ) : null}
                        {matrix.system.summary.parametric ? (
                          <div className="font-mono text-xs">{matrix.system.summary.parametric.join("; ")}</div>
                        ) : null}
                        {matrix.system.iterativeResult?.note ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            {matrix.system.iterativeResult.note}
                          </div>
                        ) : null}
                        {matrix.system.iterativeResult?.convergenceMessage ? (
                          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                            收敛性判定：{matrix.system.iterativeResult.convergenceMessage}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </aside>
              </div>
            </div>
          )}

          {activeTab === "determinant" && (
            <div className="workspace-container">
              <div className="workspace-grid">
                <section className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">行列式</h2>
                      <div className="flex items-center gap-2 text-sm">
                        维度
                        <select
                          value={detSize}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setDetSize(next);
                            setDetMatrix((prev) => resizeInputMatrix(prev, next, next, "0"));
                          }}
                          className="studio-select"
                        >
                          {matrix.sizeOptions.map((size) => (
                            <option key={`det-${size}`} value={size}>{size}</option>
                          ))}
                        </select>
                        <button onClick={computeDeterminant} className="studio-primary-btn">计算</button>
                      </div>
                    </div>

                    <MatrixGrid
                      matrix={detMatrix.map((row) => row.map((value) => value || "0"))}
                      inputMatrix={detMatrix}
                      editable
                      displayMode={matrix.displayMode}
                      onChange={(r, c, value) => {
                        setDetMatrix((prev) => {
                          const next = prev.map((line) => line.slice());
                          next[r][c] = value;
                          return next;
                        });
                      }}
                      onPasteMatrix={pasteDeterminantMatrix}
                    />
                  </div>
                </section>

                <aside className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">结果</h2>
                      <SaveToLibraryButton
                        disabled={!detResult}
                        defaultName={suggestNameForContext(matrixInventory, "determinant")}
                        onSave={(name) =>
                          saveMatrixWithName(detMatrix, name, "determinant", "standard")
                        }
                      />
                    </div>
                    {detResult ? <div className="text-sm">det(A) = {matrix.formatValue(detResult)}</div> : null}
                  </div>
                </aside>
              </div>
            </div>
          )}
          {activeTab === "decomposition" && (
            <div className="workspace-container">
              <div className="workspace-grid">
                <section className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">矩阵分解</h2>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <label className="flex items-center gap-1">模式
                          <select
                            value={decompMode}
                            onChange={(event) => {
                              const nextMode = event.target.value as DecompositionMode;
                              setDecompMode(nextMode);
                              if (nextMode !== "qr" && nextMode !== "svd") {
                                setDecompCols(decompRows);
                                setDecompMatrix((prev) => resizeInputMatrix(prev, decompRows, decompRows, "0"));
                              }
                            }}
                            className="studio-select"
                          >
                            {DECOMPOSITION_OPTIONS.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-1">行数
                          <select
                            value={decompRows}
                            onChange={(event) => {
                              const nextRows = Number(event.target.value);
                              setDecompRows(nextRows);
                              if (decompMode === "qr" || decompMode === "svd") {
                                setDecompMatrix((prev) => resizeInputMatrix(prev, nextRows, decompCols, "0"));
                                return;
                              }
                              setDecompCols(nextRows);
                              setDecompMatrix((prev) => resizeInputMatrix(prev, nextRows, nextRows, "0"));
                            }}
                            className="studio-select"
                          >
                            {matrix.sizeOptions.map((size) => (
                              <option key={`decomp-row-${size}`} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-1">列数
                          <select
                            value={decompCols}
                            onChange={(event) => {
                              const nextCols = Number(event.target.value);
                              if (decompMode === "qr" || decompMode === "svd") {
                                setDecompCols(nextCols);
                                setDecompMatrix((prev) =>
                                  resizeInputMatrix(prev, decompRows, nextCols, "0")
                                );
                                return;
                              }
                              // 方阵分解模式下，列数与行数保持同步，保证始终是方阵输入。
                              setDecompRows(nextCols);
                              setDecompCols(nextCols);
                              setDecompMatrix((prev) =>
                                resizeInputMatrix(prev, nextCols, nextCols, "0")
                              );
                            }}
                            className="studio-select"
                          >
                            {matrix.sizeOptions.map((size) => (
                              <option key={`decomp-col-${size}`} value={size}>{size}</option>
                            ))}
                          </select>
                        </label>
                        <button onClick={computeDecomposition} className="studio-primary-btn">计算</button>
                      </div>
                    </div>

                    <MatrixGrid
                      matrix={decompMatrix.map((row) => row.map((value) => value || "0"))}
                      inputMatrix={decompMatrix}
                      editable
                      displayMode={matrix.displayMode}
                      onChange={(r, c, value) => {
                        setDecompMatrix((prev) => {
                          const next = prev.map((line) => line.slice());
                          next[r][c] = value;
                          return next;
                        });
                      }}
                      onPasteMatrix={pasteDecompositionMatrix}
                    />
                  </div>
                </section>

                <aside className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">结果</h2>
                      <SaveToLibraryButton
                        disabled={!decompResult || !decompPrimaryMatrix}
                        defaultName={suggestNameForContext(matrixInventory, "decomposition")}
                        onSave={(name) =>
                          saveMatrixWithName(
                            decompPrimaryMatrix,
                            name,
                            "decomposition",
                            "standard"
                          )
                        }
                      />
                    </div>

                    {decompResult?.mode === "lu" || decompResult?.mode === "luPlain" ? (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          {decompResult.mode === "lu"
                            ? "LU 分解关系：P·A = L·U"
                            : "普通 LU 分解关系：A = L·U"}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">L（下三角矩阵）</div>
                          <MatrixGrid matrix={decompResult.decomposition.L} displayMode={matrix.displayMode} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">U（上三角矩阵）</div>
                          <MatrixGrid matrix={decompResult.decomposition.U} displayMode={matrix.displayMode} />
                        </div>
                        {decompResult.mode === "lu" ? (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold tracking-wide text-slate-600">P（置换矩阵）</div>
                            <MatrixGrid matrix={decompResult.decomposition.P} displayMode={matrix.displayMode} />
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {decompResult?.mode === "qr" ? (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          QR 分解关系：A = Q·R
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">Q（正交矩阵）</div>
                          <MatrixGrid matrix={decompResult.decomposition.Q} displayMode={matrix.displayMode} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">R（上三角矩阵）</div>
                          <MatrixGrid matrix={decompResult.decomposition.R} displayMode={matrix.displayMode} />
                        </div>
                      </>
                    ) : null}

                    {decompResult?.mode === "cholesky" ? (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          Cholesky 分解关系：A = L·L^T
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">L（下三角矩阵）</div>
                          <MatrixGrid matrix={decompResult.decomposition.L} displayMode={matrix.displayMode} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">L^T（L 的转置）</div>
                          <MatrixGrid matrix={decompResult.decomposition.Lt} displayMode={matrix.displayMode} />
                        </div>
                      </>
                    ) : null}

                    {decompResult?.mode === "svd" ? (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          SVD 分解关系：A = U·Σ·V^T
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">
                            U（左奇异向量）
                          </div>
                          <MatrixGrid matrix={decompResult.decomposition.U} displayMode={matrix.displayMode} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">
                            Σ（奇异值对角矩阵）
                          </div>
                          <MatrixGrid matrix={decompResult.decomposition.Sigma} displayMode={matrix.displayMode} />
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold tracking-wide text-slate-600">
                            V^T（右奇异向量转置）
                          </div>
                          <MatrixGrid matrix={decompResult.decomposition.Vt} displayMode={matrix.displayMode} />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700">
                          奇异值：[{decompResult.decomposition.singularValues.join(", ")}]
                        </div>
                      </>
                    ) : null}
                    {showCorrectnessPanel && decompCorrectness ? (
                      <CorrectnessPanel {...decompCorrectness} />
                    ) : null}

                    {!decompResult ? (
                      <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                        点击“计算”后，这里将显示分解结果矩阵。
                      </div>
                    ) : null}
                  </div>
                </aside>
              </div>
            </div>
          )}

          {activeTab === "eigen" && (
            <div className="workspace-container">
              <div className="workspace-grid">
                <section className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">特征分析</h2>
                      <div className="flex items-center gap-2 text-sm">
                        维度
                        <select
                          value={eigSize}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setEigSize(next);
                            setEigMatrix((prev) => resizeInputMatrix(prev, next, next, "0"));
                            resizeEigenVectorB(next);
                            setEigPerturbationResult(null);
                          }}
                          className="studio-select"
                        >
                          {matrix.sizeOptions.map((size) => (
                            <option key={`eig-${size}`} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                        <button onClick={computeEigen} className="studio-primary-btn">
                          计算
                        </button>
                      </div>
                    </div>

                    <MatrixGrid
                      matrix={eigMatrix.map((row) => row.map((value) => value || "0"))}
                      inputMatrix={eigMatrix}
                      editable
                      displayMode={matrix.displayMode}
                      onChange={(r, c, value) => {
                        setEigMatrix((prev) => {
                          const next = prev.map((line) => line.slice());
                          next[r][c] = value;
                          return next;
                        });
                        setEigPerturbationResult(null);
                      }}
                      onPasteMatrix={pasteEigenMatrix}
                    />
                  </div>
                </section>

                <aside className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">结果</h2>
                      <SaveToLibraryButton
                        disabled={!eigResult}
                        defaultName={suggestNameForContext(matrixInventory, "eigen")}
                        onSave={(name) =>
                          saveMatrixWithName(eigMatrix, name, "eigen", "standard")
                        }
                      />
                    </div>

                    {eigResult ? (
                      <div className="space-y-4 text-sm text-slate-700">
                        <div>
                          {eigResult.multiplicities.map((item, idx) => (
                            <div key={`m-${idx}`}>
                              特征值 λ = {matrix.formatEigenComponent(item.value)}，代数重数 ={" "}
                              {item.algebraic}，几何重数 = {item.geometric}
                            </div>
                          ))}
                        </div>
                        {eigResult.eigenPairs.map((pair, idx) => (
                          <div
                            key={`p-${idx}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <div className="font-semibold">
                              第 {idx + 1} 对：λ = {matrix.formatEigenComponent(pair.value)}
                            </div>
                            {pair.vector.map((component, cIdx) => (
                              <div key={`v-${idx}-${cIdx}`} className="font-mono text-xs">
                                特征向量分量 v[{cIdx + 1}] ={" "}
                                {matrix.formatEigenComponent(component)}
                              </div>
                            ))}
                          </div>
                        ))}
                        {showCorrectnessPanel && eigenCorrectness ? (
                          <CorrectnessPanel {...eigenCorrectness} />
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                        点击“计算”后，这里将显示特征值与特征向量对应关系。
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          )}

          {activeTab === "nonlinear" && <NonlinearSolverPanel />}

          {activeTab === "approximation" && <ApproximationPanel />}

          {activeTab === "integration" && <IntegrationPanel />}

          {activeTab === "ode" && <OdePanel />}

          {activeTab === "errorAnalysis" && (
            <div className="workspace-container">
              <div className="workspace-grid">
                <section className="space-y-6">
                  <div className="studio-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">误差分析</h2>
                      <div className="flex items-center gap-2 text-sm">
                        维度
                        <select
                          value={eigSize}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setEigSize(next);
                            setEigMatrix((prev) => resizeInputMatrix(prev, next, next, "0"));
                            resizeEigenVectorB(next);
                            setEigPerturbationResult(null);
                          }}
                          className="studio-select"
                        >
                          {matrix.sizeOptions.map((size) => (
                            <option key={`error-${size}`} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <MatrixGrid
                      matrix={eigMatrix.map((row) => row.map((value) => value || "0"))}
                      inputMatrix={eigMatrix}
                      editable
                      displayMode={matrix.displayMode}
                      onChange={(r, c, value) => {
                        setEigMatrix((prev) => {
                          const next = prev.map((line) => line.slice());
                          next[r][c] = value;
                          return next;
                        });
                        setEigPerturbationResult(null);
                      }}
                      onPasteMatrix={pasteEigenMatrix}
                    />
                  </div>
                </section>

                <aside className="space-y-6">
                  <div className="studio-card space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">条件数分析</h2>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {eigenCondition ? (
                        <div className="space-y-1 text-xs text-slate-600">
                          <div>||A||₁ = {formatMetric(eigenCondition.norm1)}</div>
                          <div>||A||∞ = {formatMetric(eigenCondition.normInf)}</div>
                          <div>cond₁(A) = {formatMetric(eigenCondition.cond1)}</div>
                          <div>cond∞(A) = {formatMetric(eigenCondition.condInf)}</div>
                          {!eigenCondition.invertible ? (
                            <div className="text-amber-700">
                              当前矩阵不可逆，条件数视为无穷大（不稳定）。
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          当前输入不是合法数值方阵，暂时无法计算条件数。
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="studio-card space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">扰动实验（ε = 10^-6）</h2>
                    <p className="text-xs text-slate-600">
                      可在 A 或 b 上施加随机微扰，比较特征值与解向量变化的相对误差。
                    </p>

                    <div>
                      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-600">
                        线性系统向量 b（用于 Ax=b 的灵敏度对比）
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {eigVectorB.map((value, idx) => (
                          <label
                            key={`eig-b-${idx}`}
                            className="flex items-center gap-2 text-xs text-slate-600"
                          >
                            b{idx + 1}
                            <input
                              value={value}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setEigVectorB((prev) =>
                                  prev.map((item, itemIdx) =>
                                    itemIdx === idx ? nextValue : item
                                  )
                                );
                                setEigPerturbationResult(null);
                              }}
                              className="studio-input"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runEigenPerturbationTest("A")}
                        className="studio-primary-btn"
                      >
                        随机扰动 A
                      </button>
                      <button
                        onClick={() => runEigenPerturbationTest("b")}
                        className="studio-primary-btn"
                      >
                        随机扰动 b
                      </button>
                    </div>

                    {eigPerturbationResult ? (
                      <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                        <div>
                          本次扰动对象：{eigPerturbationResult.target}，ε ={" "}
                          {eigPerturbationResult.epsilon.toExponential(0)}
                        </div>
                        <div>
                          相对扰动 ||ΔA||∞ / ||A||∞ ={" "}
                          {formatMetric(eigPerturbationResult.matrixRelativeError)}
                        </div>
                        <div>
                          相对扰动 ||Δb||∞ / ||b||∞ ={" "}
                          {formatMetric(eigPerturbationResult.vectorRelativeError)}
                        </div>
                        <div>
                          特征值相对误差 max|Δλ|/max|λ| ={" "}
                          {formatMetric(eigPerturbationResult.eigenRelativeError)}
                        </div>
                        <div>
                          解向量相对误差 ||Δx||∞ / ||x||∞ ={" "}
                          {formatMetric(eigPerturbationResult.solutionRelativeError)}
                        </div>
                        {eigPerturbationResult.baselineSolution &&
                        eigPerturbationResult.perturbedSolution ? (
                          <>
                            <div className="pt-1 text-slate-600">
                              原始解 x = [{eigPerturbationResult.baselineSolution.join(", ")}]
                            </div>
                            <div className="text-slate-600">
                              扰动后解 x̃ = [{eigPerturbationResult.perturbedSolution.join(", ")}]
                            </div>
                          </>
                        ) : (
                          <div className="pt-1 text-amber-700">
                            由于 A 不可逆或接近奇异，无法稳定求解 Ax=b 的误差对比。
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />

      <footer className="mx-auto mt-10 w-full max-w-6xl rounded-3xl border border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        以矩阵为中心的工作流 · 默认启用列选主元
      </footer>
    </div>
  );
}
