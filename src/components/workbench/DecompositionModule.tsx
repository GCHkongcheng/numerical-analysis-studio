"use client";

import { MatrixGrid } from "@/components/matrix/MatrixGrid";
import { CorrectnessPanel } from "@/components/matrix/CorrectnessPanel";
import { SaveToLibraryButton } from "@/components/matrix/SaveToLibraryButton";
import {
  choleskyDecomposition,
  choleskyResidual,
  luDecomposition,
  luDecompositionPlain,
  luResidual,
  luResidualPlain,
  qrDecomposition,
  qrOrthogonalityResidual,
  qrResidual,
  svdDecomposition,
  svdOrthogonalityResiduals,
  svdResidual,
} from "@/lib/matrix-decomposition";
import { normalizeMatrixInput } from "@/lib/matrix-basic";
import { suggestNameForContext } from "@/store/matrix-library";
import type { MatrixRecord } from "@/store/matrix-library";
import type { DisplayMode } from "@/types/matrix";
import type {
  CorrectnessDescriptor,
  DecompositionMode,
  DecompositionResult,
  Feedback,
} from "@/types/workbench";

const RESIDUAL_THRESHOLD = 1e-10;

const DECOMPOSITION_OPTIONS: Array<{ id: DecompositionMode; label: string }> = [
  { id: "lu", label: "LU（带主元）" },
  { id: "luPlain", label: "LU（普通）" },
  { id: "qr", label: "QR（Householder）" },
  { id: "cholesky", label: "Cholesky分解" },
  { id: "svd", label: "SVD分解" },
];

type DecompositionModuleProps = {
  sizeOptions: number[];
  displayMode: DisplayMode;
  mode: DecompositionMode;
  rows: number;
  cols: number;
  matrix: string[][];
  result: DecompositionResult | null;
  showCorrectnessPanel: boolean;
  correctness: CorrectnessDescriptor | null;
  matrixInventory: MatrixRecord[];
  onModeChange: (mode: DecompositionMode) => void;
  onRowsChange: (rows: number) => void;
  onColsChange: (cols: number) => void;
  onMatrixChange: (row: number, col: number, value: string) => void;
  onMatrixPaste: (row: number, col: number, text: string) => void;
  onResultChange: (result: DecompositionResult | null) => void;
  onSaveToLibrary: (matrix: string[][], name: string) => void;
  onFeedback: (feedback: Feedback) => void;
};

export function DecompositionModule({
  sizeOptions,
  displayMode,
  mode,
  rows,
  cols,
  matrix,
  result,
  showCorrectnessPanel,
  correctness,
  matrixInventory,
  onModeChange,
  onRowsChange,
  onColsChange,
  onMatrixChange,
  onMatrixPaste,
  onResultChange,
  onSaveToLibrary,
  onFeedback,
}: DecompositionModuleProps) {
  const primaryMatrix =
    result == null
      ? null
      : result.mode === "lu" || result.mode === "luPlain"
        ? result.decomposition.L
        : result.mode === "qr"
          ? result.decomposition.Q
          : result.mode === "svd"
            ? result.decomposition.U
            : result.decomposition.L;

  const handleCompute = () => {
    const normalized = normalizeMatrixInput(matrix);
    if (mode !== "qr" && mode !== "svd" && rows !== cols) {
      onResultChange(null);
      onFeedback({ tone: "error", text: "LU/Cholesky 需要方阵" });
      return;
    }

    if (mode === "lu" || mode === "luPlain") {
      const isPlain = mode === "luPlain";
      const decomp = isPlain ? luDecompositionPlain(normalized) : luDecomposition(normalized);
      if (!decomp) {
        onResultChange(null);
        onFeedback({
          tone: "error",
          text: isPlain
            ? "普通 LU 分解失败（主对角线出现零主元，建议改用带主元 LU）"
            : "LU 分解失败",
        });
        return;
      }
      const residual = isPlain ? luResidualPlain(normalized, decomp) : luResidual(normalized, decomp);
      const passed = residual === null ? null : residual < RESIDUAL_THRESHOLD;
      onResultChange({ mode: isPlain ? "luPlain" : "lu", decomposition: decomp, residual, threshold: RESIDUAL_THRESHOLD, passed });
      onFeedback({ tone: passed === false ? "warning" : "success", text: isPlain ? "普通 LU 分解完成" : "LU 分解完成" });
      return;
    }

    if (mode === "qr") {
      const decomp = qrDecomposition(normalized);
      if (!decomp) {
        onResultChange(null);
        onFeedback({ tone: "error", text: "QR 需要纯数值输入" });
        return;
      }
      const residual = qrResidual(normalized, decomp);
      const orthResidual = qrOrthogonalityResidual(decomp);
      const passed = residual !== null && orthResidual !== null && residual < RESIDUAL_THRESHOLD && orthResidual < RESIDUAL_THRESHOLD;
      onResultChange({ mode: "qr", decomposition: decomp, residual, orthResidual, threshold: RESIDUAL_THRESHOLD, passed });
      onFeedback({ tone: passed ? "success" : "warning", text: "QR 分解完成" });
      return;
    }

    if (mode === "svd") {
      const decomp = svdDecomposition(normalized);
      if (!decomp) {
        onResultChange(null);
        onFeedback({ tone: "error", text: "SVD 需要纯数值输入" });
        return;
      }
      const residual = svdResidual(normalized, decomp);
      const { u, v, max } = svdOrthogonalityResiduals(decomp);
      const passed = residual !== null && max !== null && residual < RESIDUAL_THRESHOLD && max < RESIDUAL_THRESHOLD;
      onResultChange({ mode: "svd", decomposition: decomp, residual, orthResidualU: u, orthResidualV: v, threshold: RESIDUAL_THRESHOLD, passed });
      onFeedback({ tone: passed ? "success" : "warning", text: "SVD 分解完成" });
      return;
    }

    // Cholesky
    const decomp = choleskyDecomposition(normalized);
    if (!decomp) {
      onResultChange(null);
      onFeedback({ tone: "error", text: "Cholesky 需要对称正定矩阵" });
      return;
    }
    const residual = choleskyResidual(normalized, decomp);
    const passed = residual !== null && residual < RESIDUAL_THRESHOLD;
    onResultChange({ mode: "cholesky", decomposition: decomp, residual, threshold: RESIDUAL_THRESHOLD, passed });
    onFeedback({ tone: passed ? "success" : "warning", text: "Cholesky 分解完成" });
  };

  const handleModeChange = (nextMode: DecompositionMode) => {
    onModeChange(nextMode);
    onResultChange(null);
  };

  const handleRowsChange = (nextRows: number) => {
    onRowsChange(nextRows);
    onResultChange(null);
  };

  const handleColsChange = (nextCols: number) => {
    onColsChange(nextCols);
    onResultChange(null);
  };

  const handleCellChange = (r: number, c: number, value: string) => {
    onMatrixChange(r, c, value);
    onResultChange(null);
  };

  const handlePaste = (r: number, c: number, text: string) => {
    onMatrixPaste(r, c, text);
    onResultChange(null);
  };

  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          <div className="studio-card decomposition-result-card space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">矩阵分解</h2>
                <button
                  onClick={handleCompute}
                  className="studio-primary-btn"
                  aria-label="计算矩阵分解"
                >
                  计算
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-2">模式
                  <select value={mode} onChange={(e) => handleModeChange(e.target.value as DecompositionMode)} className="studio-select">
                    {DECOMPOSITION_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">行数
                  <select value={rows} onChange={(e) => handleRowsChange(Number(e.target.value))} className="studio-select">
                    {sizeOptions.map((s) => <option key={`dr-${s}`} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2">列数
                  <select value={cols} onChange={(e) => handleColsChange(Number(e.target.value))} className="studio-select">
                    {sizeOptions.map((s) => <option key={`dc-${s}`} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <MatrixGrid
              matrix={matrix.map((row) => row.map((v) => v || "0"))}
              inputMatrix={matrix}
              editable
              displayMode={displayMode}
              onChange={handleCellChange}
              onPasteMatrix={handlePaste}
            />
          </div>
        </section>

        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">结果</h2>
              <SaveToLibraryButton
                disabled={!result || !primaryMatrix}
                defaultName={suggestNameForContext(matrixInventory, "decomposition")}
                onSave={(name) => primaryMatrix && onSaveToLibrary(primaryMatrix, name)}
              />
            </div>

            {result?.mode === "lu" || result?.mode === "luPlain" ? (
              <>
                <div className="rounded-xl border border-border-soft bg-surface-muted px-3 py-2 text-xs text-slate-700">
                  {result.mode === "lu" ? "LU 分解关系：P·A = L·U" : "普通 LU 分解关系：A = L·U"}
                </div>
                <div className="decomposition-result-grid">
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">L（下三角矩阵）</div>
                    <MatrixGrid matrix={result.decomposition.L} displayMode={displayMode} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">U（上三角矩阵）</div>
                    <MatrixGrid matrix={result.decomposition.U} displayMode={displayMode} />
                  </div>
                  {result.mode === "lu" ? (
                    <div className="decomposition-result-wide min-w-0 space-y-2">
                      <div className="text-xs font-semibold tracking-wide text-text-muted">P（置换矩阵）</div>
                      <MatrixGrid matrix={result.decomposition.P} displayMode={displayMode} />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {result?.mode === "qr" ? (
              <>
                <div className="rounded-xl border border-border-soft bg-surface-muted px-3 py-2 text-xs text-slate-700">
                  QR 分解关系：A = Q·R
                </div>
                <div className="decomposition-result-grid">
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">Q（正交矩阵）</div>
                    <MatrixGrid matrix={result.decomposition.Q} displayMode={displayMode} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">R（上三角矩阵）</div>
                    <MatrixGrid matrix={result.decomposition.R} displayMode={displayMode} />
                  </div>
                </div>
              </>
            ) : null}

            {result?.mode === "cholesky" ? (
              <>
                <div className="rounded-xl border border-border-soft bg-surface-muted px-3 py-2 text-xs text-slate-700">
                  Cholesky 分解关系：A = L·L^T
                </div>
                <div className="decomposition-result-grid">
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">L（下三角矩阵）</div>
                    <MatrixGrid matrix={result.decomposition.L} displayMode={displayMode} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">L^T（L 的转置）</div>
                    <MatrixGrid matrix={result.decomposition.Lt} displayMode={displayMode} />
                  </div>
                </div>
              </>
            ) : null}

            {result?.mode === "svd" ? (
              <>
                <div className="rounded-xl border border-border-soft bg-surface-muted px-3 py-2 text-xs text-slate-700">
                  SVD 分解关系：A = U·Σ·V^T
                </div>
                <div className="decomposition-result-grid">
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">U（左奇异向量）</div>
                    <MatrixGrid matrix={result.decomposition.U} displayMode={displayMode} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">Σ（奇异值对角矩阵）</div>
                    <MatrixGrid matrix={result.decomposition.Sigma} displayMode={displayMode} />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="text-xs font-semibold tracking-wide text-text-muted">V^T（右奇异向量转置）</div>
                    <MatrixGrid matrix={result.decomposition.Vt} displayMode={displayMode} />
                  </div>
                  <div className="flex min-w-0 flex-col justify-between space-y-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold tracking-wide text-text-muted">奇异值</div>
                      <div className="rounded-xl border border-border-soft bg-surface-muted px-3 py-2 text-xs font-mono text-slate-700">
                        [{result.decomposition.singularValues.join(", ")}]
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {showCorrectnessPanel && correctness ? (
              <CorrectnessPanel {...correctness} />
            ) : null}

            {!result ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                点击“计算”后，这里将显示分解结果矩阵。
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
