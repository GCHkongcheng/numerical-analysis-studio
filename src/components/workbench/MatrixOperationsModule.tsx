"use client";

import { CorrectnessPanel } from "@/components/matrix/CorrectnessPanel";
import { MatrixGrid } from "@/components/matrix/MatrixGrid";
import { OperationButtonGroup } from "@/components/matrix/OperationButtonGroup";
import { SaveToLibraryButton } from "@/components/matrix/SaveToLibraryButton";
import { suggestNameForContext } from "@/store/matrix-library";
import type { MatrixRecord } from "@/store/matrix-library";
import type {
  DisplayMode,
  MatrixOperation,
  ResultTone,
} from "@/types/matrix";
import type { CorrectnessDescriptor } from "@/types/workbench";

const OPERATION_OPTIONS = [
  { id: "add", label: "A + B" },
  { id: "subtract", label: "A - B" },
  { id: "multiply", label: "A * B" },
  { id: "inverse", label: "A^-1" },
  { id: "rank", label: "秩" },
  { id: "determinant", label: "行列式" },
  { id: "transpose", label: "转置" },
  { id: "simplify", label: "RREF" },
  { id: "scalar", label: "数乘" },
  { id: "square", label: "A^2" },
] as const;

type MatrixOperationsModuleProps = {
  operations: {
    rows: number;
    cols: number;
    matrixA: string[][];
    matrixB: string[][];
    bRows: number;
    bCols: number;
    operation: MatrixOperation;
    scalar: string;
    resultMatrix: string[][] | null;
    feedback: { tone: ResultTone; text: string } | null;
    setDimensions: (rows: number, cols: number) => void;
    setBMatrixDimensions: (rows: number, cols: number) => void;
    setOperation: (op: MatrixOperation) => void;
    setScalar: (v: string) => void;
    setCellA: (r: number, c: number, v: string) => void;
    setCellB: (r: number, c: number, v: string) => void;
    pasteA: (r: number, c: number, text: string) => void;
    pasteB: (r: number, c: number, text: string) => void;
    compute: () => void;
  };
  sizeOptions: number[];
  displayMode: DisplayMode;
  showCorrectnessPanel: boolean;
  correctness: CorrectnessDescriptor | null;
  matrixInventory: MatrixRecord[];
  onSaveToLibrary: (name: string) => void;
  onLoadResultToA: () => void;
  onLoadResultToB: () => void;
  onFocusA: () => void;
  onFocusB: () => void;
};

/**
 * 矩阵运算模块
 *
 * 功能：
 * - 输入矩阵 A 和矩阵 B（支持多种维度组合）
 * - 选择运算类型（加减乘、求秩、求行列式、转置、RREF、数乘等）
 * - 显示运算结果
 * - 结果可加载回矩阵 A 或 B，支持链式运算
 * - 保存结果到矩阵库
 */
export function MatrixOperationsModule({
  operations,
  sizeOptions,
  displayMode,
  showCorrectnessPanel,
  correctness,
  matrixInventory,
  onSaveToLibrary,
  onLoadResultToA,
  onLoadResultToB,
  onFocusA,
  onFocusB,
}: MatrixOperationsModuleProps) {
  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          {/* 矩阵 A 输入 */}
          <div className="studio-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">矩阵输入</h2>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  行数
                  <select
                    value={operations.rows}
                    onChange={(event) =>
                      operations.setDimensions(
                        Number(event.target.value),
                        operations.cols
                      )
                    }
                    className="studio-select"
                  >
                    {sizeOptions.map((size) => (
                      <option key={`ops-row-${size}`} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  列数
                  <select
                    value={operations.cols}
                    onChange={(event) =>
                      operations.setDimensions(
                        operations.rows,
                        Number(event.target.value)
                      )
                    }
                    className="studio-select"
                  >
                    {sizeOptions.map((size) => (
                      <option key={`ops-col-${size}`} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <MatrixGrid
              matrix={operations.matrixA.map((row) =>
                row.map((value) => value || "0")
              )}
              inputMatrix={operations.matrixA}
              editable
              displayMode={displayMode}
              onChange={operations.setCellA}
              onPasteMatrix={operations.pasteA}
              onCellFocus={onFocusA}
            />

            {/* 矩阵 B 输入（仅在需要时显示） */}
            {(operations.operation === "add" ||
              operations.operation === "subtract" ||
              operations.operation === "multiply") && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="font-semibold text-slate-700">矩阵 B</div>
                  {operations.operation === "multiply" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1">
                        行数
                        <select
                          value={operations.bRows}
                          onChange={(event) =>
                            operations.setBMatrixDimensions(
                              Number(event.target.value),
                              operations.bCols
                            )
                          }
                          className="studio-select"
                        >
                          {sizeOptions.map((size) => (
                            <option key={`ops-b-row-${size}`} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        列数
                        <select
                          value={operations.bCols}
                          onChange={(event) =>
                            operations.setBMatrixDimensions(
                              operations.bRows,
                              Number(event.target.value)
                            )
                          }
                          className="studio-select"
                        >
                          {sizeOptions.map((size) => (
                            <option key={`ops-b-col-${size}`} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>

                <MatrixGrid
                  matrix={operations.matrixB.map((row) =>
                    row.map((value) => value || "0")
                  )}
                  inputMatrix={operations.matrixB}
                  editable
                  displayMode={displayMode}
                  onChange={operations.setCellB}
                  onPasteMatrix={operations.pasteB}
                  onCellFocus={onFocusB}
                />
              </div>
            )}
          </div>

          {/* 运算选择和控制 */}
          <div className="studio-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">运算</h2>
              <button onClick={operations.compute} className="studio-primary-btn">
                计算
              </button>
            </div>

            <OperationButtonGroup
              options={[...OPERATION_OPTIONS]}
              active={operations.operation}
              onChange={operations.setOperation}
            />

            {/* 数乘系数输入 */}
            {operations.operation === "scalar" && (
              <input
                value={operations.scalar}
                onChange={(event) => operations.setScalar(event.target.value)}
                className="studio-input"
                placeholder="数乘系数，例如 1/3"
              />
            )}
          </div>
        </section>

        {/* 结果区域 */}
        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">结果</h2>
              <SaveToLibraryButton
                disabled={!operations.resultMatrix}
                defaultName={suggestNameForContext(
                  matrixInventory,
                  "matrix-operations"
                )}
                onSave={onSaveToLibrary}
              />
            </div>

            {operations.resultMatrix ? (
              <>
                <MatrixGrid
                  matrix={operations.resultMatrix}
                  displayMode={displayMode}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onLoadResultToA}
                    className="step-control"
                  >
                    结果填入 A
                  </button>
                  <button
                    onClick={onLoadResultToB}
                    className="step-control"
                  >
                    结果填入 B
                  </button>
                </div>
              </>
            ) : null}

            {/* 反馈信息（仅在没有结果矩阵的标量运算中显示） */}
            {!operations.resultMatrix &&
            (operations.operation === "rank" ||
              operations.operation === "determinant") &&
            operations.feedback ? (
              <div
                className={
                  operations.feedback.tone === "error"
                    ? "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    : "rounded-xl border border-border-soft bg-surface-muted px-3 py-2 text-sm font-mono text-slate-700"
                }
              >
                {operations.feedback.text}
              </div>
            ) : null}

            {!operations.resultMatrix && (!operations.feedback || (operations.operation !== "rank" && operations.operation !== "determinant")) ? (
              <div className="rounded-xl border border-dashed border-border-soft px-3 py-4 text-sm text-text-muted">
                点击“计算”后，这里将显示运算结果矩阵或数值。
              </div>
            ) : null}

            {/* 正确性面板 */}
            {showCorrectnessPanel && correctness ? (
              <CorrectnessPanel {...correctness} />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
