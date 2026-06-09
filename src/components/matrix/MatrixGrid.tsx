"use client";

import { formatValue } from "@/lib/matrix-core";
import type { DisplayMode } from "@/types/matrix";

type MatrixGridProps = {
  matrix: string[][];
  displayMode: DisplayMode;
  augmentedIndex?: number;
  editable?: boolean;
  inputMatrix?: string[][];
  onChange?: (row: number, col: number, value: string) => void;
  onPasteMatrix?: (row: number, col: number, text: string) => void;
  onCellFocus?: (row: number, col: number) => void;
  pivot?: { row: number; col: number };
  highlightRows?: number[];
  className?: string;
};

export function MatrixGrid({
  matrix,
  displayMode,
  augmentedIndex = -1,
  editable = false,
  inputMatrix,
  onChange,
  onPasteMatrix,
  onCellFocus,
  pivot,
  highlightRows = [],
  className = "",
}: MatrixGridProps) {
  if (!matrix.length || !matrix[0]?.length) {
    return (
      <div className="studio-empty-grid rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
        暂无矩阵数据
      </div>
    );
  }

  const colCount = matrix[0].length;
  const useScrollLayout = colCount > 5;

  const minCellWidth =
    colCount <= 3
      ? 70
      : colCount === 4
        ? editable
          ? 52
          : 48
        : colCount === 5
          ? editable
            ? 42
            : 40
          : editable
            ? 56
            : 52;

  const showMathBrackets = !editable;

  return (
    <div className={`matrix-surface ${showMathBrackets ? "matrix-surface-static" : ""} ${className}`}>
      <div className={showMathBrackets ? "matrix-tex-wrap" : undefined}>
        <div className="matrix-scroll">
          <div
            role="group"
            aria-label={editable ? "可编辑矩阵输入网格" : "矩阵显示网格"}
            className={`grid gap-2 ${useScrollLayout ? "matrix-grid-scroll" : "matrix-grid-fit"}`}
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(${minCellWidth}px, 1fr))`,
            }}
          >
            {matrix.map((row, r) =>
              row.map((value, c) => {
                const isPivot = pivot ? pivot.row === r && pivot.col === c : false;
                const isHighlightedRow = highlightRows.includes(r);
                const isAugmentedCol = augmentedIndex >= 0 && c === augmentedIndex;

                const cellClassName = [
                  "matrix-cell",
                  isPivot ? "matrix-cell-pivot" : "",
                  isHighlightedRow ? "matrix-cell-highlight" : "",
                  isAugmentedCol ? "matrix-cell-augmented" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                // 构建 ARIA 标签
                const ariaLabel = `第 ${r + 1} 行, 第 ${c + 1} 列${isPivot ? ", 主元" : ""}${isHighlightedRow ? ", 高亮行" : ""}${isAugmentedCol ? ", 增广列" : ""}`;

                if (editable) {
                  return (
                    <input
                      key={`${r}-${c}`}
                      aria-label={ariaLabel}
                      value={inputMatrix?.[r]?.[c] ?? "0"}
                      onChange={(event) => onChange?.(r, c, event.target.value)}
                      onFocus={() => onCellFocus?.(r, c)}
                      onPaste={(event) => {
                        if (!onPasteMatrix) return;
                        event.preventDefault();
                        const text = event.clipboardData.getData("text");
                        onPasteMatrix(r, c, text);
                      }}
                      className={`${cellClassName} matrix-input`}
                    />
                  );
                }

                return (
                  <div
                    key={`${r}-${c}`}
                    aria-label={ariaLabel}
                    className={cellClassName}
                  >
                    {formatValue(value, displayMode)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
