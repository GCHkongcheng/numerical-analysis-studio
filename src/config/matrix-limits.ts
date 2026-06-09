export const MATRIX_DIMENSION_LIMITS = {
  maxEditableRows: 8,
  maxEditableCols: 8,
  maxEditableCells: 64,
} as const;

export function getMatrixDimensionLimitMessage(
  matrix: string[][],
  label = "矩阵"
): string | null {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const cells = rows * cols;

  if (
    rows > MATRIX_DIMENSION_LIMITS.maxEditableRows ||
    cols > MATRIX_DIMENSION_LIMITS.maxEditableCols ||
    cells > MATRIX_DIMENSION_LIMITS.maxEditableCells
  ) {
    return `${label}尺寸为 ${rows}x${cols}，当前可编辑工作台建议不超过 ${MATRIX_DIMENSION_LIMITS.maxEditableRows} 行、${MATRIX_DIMENSION_LIMITS.maxEditableCols} 列或 ${MATRIX_DIMENSION_LIMITS.maxEditableCells} 个单元格。请拆分后再导入。`;
  }

  return null;
}
