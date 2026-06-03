"use client";

import { CorrectnessPanel } from "@/components/matrix/CorrectnessPanel";
import { MatrixGrid } from "@/components/matrix/MatrixGrid";
import { SaveToLibraryButton } from "@/components/matrix/SaveToLibraryButton";
import { eigsWithMathjs } from "@/lib/matrix-eigen";
import { normalizeMatrixInput, toNumericMatrix } from "@/lib/matrix-basic";
import { suggestNameForContext } from "@/store/matrix-library";
import type { MatrixRecord } from "@/store/matrix-library";
import type {
  DisplayMode,
  EigenAnalysisResult,
  EigenComponent,
} from "@/types/matrix";
import type {
  CorrectnessDescriptor,
  EigenPerturbationResult,
  Feedback,
} from "@/types/workbench";

type EigenAnalysisModuleProps = {
  // 共享状态（与 ErrorAnalysisModule 共用）
  size: number;
  matrix: string[][];
  result: EigenAnalysisResult | null;
  vectorB: string[];
  perturbationResult: EigenPerturbationResult | null;
  onSizeChange: (size: number) => void;
  onMatrixChange: (r: number, c: number, value: string) => void;
  onMatrixPaste: (r: number, c: number, text: string) => void;
  onResultChange: (result: EigenAnalysisResult | null) => void;
  onPerturbationResultChange: (result: EigenPerturbationResult | null) => void;
  // UI 配置
  sizeOptions: number[];
  displayMode: DisplayMode;
  showCorrectnessPanel: boolean;
  correctness: CorrectnessDescriptor | null;
  matrixInventory: MatrixRecord[];
  onSaveToLibrary: (matrix: string[][], name: string) => void;
  onFeedback: (feedback: Feedback) => void;
  formatEigenComponent: (v: EigenComponent) => string;
};

export function EigenAnalysisModule({
  size,
  matrix,
  result,
  onSizeChange,
  onMatrixChange,
  onMatrixPaste,
  onResultChange,
  onPerturbationResultChange,
  sizeOptions,
  displayMode,
  showCorrectnessPanel,
  correctness,
  matrixInventory,
  onSaveToLibrary,
  onFeedback,
  formatEigenComponent,
}: EigenAnalysisModuleProps) {
  const handleSizeChange = (next: number) => {
    onSizeChange(next);
    onPerturbationResultChange(null);
  };

  const handleCellChange = (r: number, c: number, value: string) => {
    onMatrixChange(r, c, value);
    onPerturbationResultChange(null);
  };

  const handlePaste = (r: number, c: number, text: string) => {
    onMatrixPaste(r, c, text);
    onPerturbationResultChange(null);
  };

  const handleCompute = () => {
    const normalized = normalizeMatrixInput(matrix);
    const numeric = toNumericMatrix(normalized);
    if (!numeric) {
      onResultChange(null);
      onFeedback({ tone: "error", text: "特征分析需要纯数值输入" });
      return;
    }
    const res = eigsWithMathjs(numeric);
    if (!res) {
      onResultChange(null);
      onFeedback({ tone: "error", text: "特征分析计算失败" });
      return;
    }
    onResultChange(res);
    onFeedback({
      tone: res.diagonalizable ? "success" : "warning",
      text: res.diagonalizable ? "特征分析完成" : "该矩阵不可对角化",
    });
  };

  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">特征分析</h2>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  维度
                  <select
                    value={size}
                    onChange={(e) => handleSizeChange(Number(e.target.value))}
                    className="studio-select"
                  >
                    {sizeOptions.map((s) => (
                      <option key={`eig-${s}`} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <button onClick={handleCompute} className="studio-primary-btn">计算</button>
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

          {result ? (
            <div className="studio-card space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                特征值代数与几何重数
              </h3>
              <div className="overflow-auto rounded-2xl border border-border-soft">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-soft bg-surface-muted text-text-muted font-semibold">
                      <th className="px-3 py-2">特征值 (λ)</th>
                      <th className="px-3 py-2 text-center">代数重数</th>
                      <th className="px-3 py-2 text-center">几何重数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.multiplicities.map((item, idx) => (
                      <tr key={`m-row-${idx}`} className="border-b border-border-soft hover:bg-surface-muted/50">
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                          {formatEigenComponent(item.value)}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-700">{item.algebraic}</td>
                        <td className="px-3 py-2 text-center text-slate-700">{item.geometric}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">结果</h2>
              <SaveToLibraryButton
                disabled={!result}
                defaultName={suggestNameForContext(matrixInventory, "eigen")}
                onSave={(name) => onSaveToLibrary(matrix, name)}
              />
            </div>

            {result ? (
              <div className="space-y-4 text-sm text-slate-700">
                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wide text-text-muted">特征向量对</div>
                  {result.eigenPairs.map((pair, idx) => (
                    <div
                      key={`p-${idx}`}
                      className="rounded-2xl border border-border-soft bg-surface-muted px-4 py-3"
                    >
                      <div className="font-semibold text-slate-900">
                        第 {idx + 1} 对：λ = {formatEigenComponent(pair.value)}
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {pair.vector.map((component, cIdx) => (
                          <div key={`v-${idx}-${cIdx}`} className="font-mono text-xs text-slate-700">
                            v[{cIdx + 1}] = {formatEigenComponent(component)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {showCorrectnessPanel && correctness ? (
                  <CorrectnessPanel {...correctness} />
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border-soft px-3 py-4 text-sm text-text-muted">
                点击“计算”后，这里将显示特征值与特征向量对应关系。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
