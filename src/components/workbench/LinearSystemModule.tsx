"use client";

import { CorrectnessPanel } from "@/components/matrix/CorrectnessPanel";
import { MatrixGrid } from "@/components/matrix/MatrixGrid";
import { SaveToLibraryButton } from "@/components/matrix/SaveToLibraryButton";
import { StepCard } from "@/components/matrix/StepCard";
import { suggestNameForContext } from "@/store/matrix-library";
import type { MatrixRecord } from "@/store/matrix-library";
import type {
  DisplayMode,
  LinearSystemMethod,
  ResultTone,
  Step,
  IterativeSolveResult,
  SolveSummary,
} from "@/types/matrix";
import type { CorrectnessDescriptor } from "@/types/workbench";

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

type LinearSystemModuleProps = {
  system: {
    rows: number;
    cols: number;
    method: LinearSystemMethod;
    tolerance: string;
    maxIterations: string;
    omega: string;
    iterativeResult: IterativeSolveResult | null;
    augmented: string[][];
    steps: Step[];
    stepIndex: number;
    currentStep: Step | null;
    summary: SolveSummary | null;
    feedback: { tone: ResultTone; text: string } | null;
    isPlaying: boolean;
    setDimensions: (rows: number, cols: number) => void;
    setMethod: (method: LinearSystemMethod) => void;
    setTolerance: (v: string) => void;
    setMaxIterations: (v: string) => void;
    setOmega: (v: string) => void;
    setCell: (r: number, c: number, v: string) => void;
    paste: (r: number, c: number, text: string) => void;
    compute: () => void;
    nextStep: () => void;
    prevStep: () => void;
    resetSteps: () => void;
    togglePlay: () => void;
  };
  sizeOptions: number[];
  displayMode: DisplayMode;
  showCorrectnessPanel: boolean;
  correctness: CorrectnessDescriptor | null;
  matrixInventory: MatrixRecord[];
  onSaveToLibrary: (name: string) => void;
  describeStep: (step: Step) => string;
  formatValue: (v: string) => string;
};

/**
 * 线性方程组求解模块
 *
 * 功能：
 * - 输入增广矩阵（Ax=b）
 * - 支持直接法（高斯消元、高斯-约旦）和迭代法（Jacobi、Gauss-Seidel、SOR、共轭梯度）
 * - 直接法显示分步消元过程
 * - 迭代法显示收敛历史
 * - 显示求解结果和方程组分类
 * - 保存增广矩阵到矩阵库
 */
export function LinearSystemModule({
  system,
  sizeOptions,
  displayMode,
  showCorrectnessPanel,
  correctness,
  matrixInventory,
  onSaveToLibrary,
  describeStep,
  formatValue,
}: LinearSystemModuleProps) {
  const systemUsesIteration = isIterativeSystemMethod(system.method);

  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          {/* 增广矩阵输入和求解控制 */}
          <div className="studio-card space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  线性方程组
                </h2>
                <button onClick={system.compute} className="studio-primary-btn">
                  求解
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  方程数
                  <select
                    value={system.rows}
                    onChange={(event) =>
                      system.setDimensions(Number(event.target.value), system.cols)
                    }
                    className="studio-select"
                  >
                    {sizeOptions.map((size) => (
                      <option key={`sys-row-${size}`} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  变量数
                  <select
                    value={system.cols}
                    onChange={(event) =>
                      system.setDimensions(system.rows, Number(event.target.value))
                    }
                    className="studio-select"
                  >
                    {sizeOptions.map((size) => (
                      <option key={`sys-col-${size}`} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  求解方法
                  <select
                    value={system.method}
                    onChange={(event) =>
                      system.setMethod(event.target.value as LinearSystemMethod)
                    }
                    className="studio-select"
                  >
                    {SYSTEM_METHOD_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* 迭代法特有的参数 */}
                {systemUsesIteration ? (
                  <>
                    <label className="flex items-center gap-2">
                      容差
                      <input
                        value={system.tolerance}
                        onChange={(event) =>
                          system.setTolerance(event.target.value)
                        }
                        className="studio-input w-32"
                        placeholder="1e-10"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      迭代
                      <input
                        value={system.maxIterations}
                        onChange={(event) =>
                          system.setMaxIterations(event.target.value)
                        }
                        className="studio-input w-24"
                        placeholder="120"
                      />
                    </label>
                    {system.method === "sor" ? (
                      <label className="flex items-center gap-2">
                        松弛因子
                        <input
                          value={system.omega}
                          onChange={(event) =>
                            system.setOmega(event.target.value)
                          }
                          className="studio-input w-24"
                          placeholder="1.1"
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <MatrixGrid
              matrix={system.augmented.map((row) =>
                row.map((value) => value || "0")
              )}
              inputMatrix={system.augmented}
              editable
              displayMode={displayMode}
              augmentedIndex={system.cols}
              onChange={system.setCell}
              onPasteMatrix={system.paste}
            />
          </div>

          {/* 迭代法结果或直接法步骤 */}
          {systemUsesIteration ? (
            <div className="studio-card space-y-4">
              <h3 className="text-base font-semibold text-slate-900">
                迭代过程
              </h3>
              {system.iterativeResult ? (
                <>
                  <MatrixGrid
                    matrix={system.iterativeResult.solution.map((value) => [
                      value,
                    ])}
                    displayMode={displayMode}
                  />
                  <div className="space-y-2">
                    {system.iterativeResult.history
                      .slice(-8)
                      .map((item, idx) => (
                        <div
                          key={`iter-${idx}-${item.iteration}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700"
                        >
                          k={item.iteration}，残差={formatResidual(
                            item.residual
                          )}，x=[{item.vector.join(", ")}]
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">
                  执行求解后查看迭代历史。
                </div>
              )}
            </div>
          ) : (
            <StepCard
              step={system.currentStep}
              stepIndex={system.stepIndex}
              totalSteps={Math.max(system.steps.length, 1)}
              stepDescription={
                system.currentStep
                  ? describeStep(system.currentStep)
                  : "等待求解"
              }
              isPlaying={system.isPlaying}
              onPrev={system.prevStep}
              onNext={system.nextStep}
              onReset={system.resetSteps}
              onTogglePlay={system.togglePlay}
            >
              {system.currentStep ? (
                <MatrixGrid
                  matrix={system.currentStep.matrix}
                  displayMode={displayMode}
                  augmentedIndex={system.cols}
                  pivot={system.currentStep.pivot}
                  highlightRows={system.currentStep.highlightRows}
                />
              ) : null}
            </StepCard>
          )}
        </section>

        {/* 结果摘要区域 */}
        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">结果摘要</h2>
              <SaveToLibraryButton
                disabled={!system.summary}
                defaultName={suggestNameForContext(
                  matrixInventory,
                  "linear-system"
                )}
                onSave={onSaveToLibrary}
              />
            </div>

            {system.summary ? (
              <div className="space-y-2 text-sm">
                {/* 方程组分类 */}
                <div>类型：{system.summary.type}</div>

                {/* 秩信息 */}
                <div>rank(A) = {system.summary.rankA}</div>
                <div>rank([A|b]) = {system.summary.rankAug}</div>

                {/* 解 */}
                {system.iterativeResult ? (
                  <div className="font-mono text-xs">
                    {system.iterativeResult.solution
                      .map((v, i) => `x${i + 1}=${formatValue(v)}`)
                      .join(", ")}
                  </div>
                ) : system.summary.solution ? (
                  <div className="font-mono text-xs">
                    {system.summary.solution
                      .map((v, i) => `x${i + 1}=${formatValue(v)}`)
                      .join(", ")}
                  </div>
                ) : null}

                {/* 参数化通解 */}
                {system.summary.parametric ? (
                  <div className="font-mono text-xs">
                    {system.summary.parametric.join("; ")}
                  </div>
                ) : null}

                {/* 迭代结果信息 */}
                {system.iterativeResult?.note ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {system.iterativeResult.note}
                  </div>
                ) : null}

                {system.iterativeResult?.convergenceMessage ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                    收敛性判定：{system.iterativeResult.convergenceMessage}
                  </div>
                ) : null}

                {/* 正确性面板 */}
                {showCorrectnessPanel && correctness ? (
                  <CorrectnessPanel {...correctness} />
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border-soft px-3 py-4 text-sm text-text-muted">
                点击“求解”后，这里将显示方程组解的类型、秩信息与数值解。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
