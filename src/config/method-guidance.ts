import type { TabId } from "@/types/workbench";

export type MethodGuidanceItem = {
  method: string;
  applies: string;
  cost: string;
  watch: string;
};

export const MATRIX_METHOD_GUIDANCE: Partial<Record<TabId, MethodGuidanceItem[]>> = {
  operations: [
    {
      method: "RREF / 秩",
      applies: "适合判断线性相关、主元列和解空间结构。",
      cost: "约 O(n^3)",
      watch: "主元过小会放大舍入误差，符号输入会优先保留表达式。",
    },
    {
      method: "逆矩阵 / 行列式",
      applies: "适合方阵可逆性验证和小规模精确计算。",
      cost: "约 O(n^3)",
      watch: "病态矩阵即使可逆，也可能对输入扰动非常敏感。",
    },
  ],
  system: [
    {
      method: "高斯消元",
      applies: "适合一般线性方程组，能区分无解、唯一解和无穷多解。",
      cost: "约 O(n^3)",
      watch: "行交换用于降低主元退化带来的数值误差。",
    },
    {
      method: "Jacobi / Gauss-Seidel / SOR / CG",
      applies: "适合较大稀疏系统或需要观察收敛过程的场景。",
      cost: "每轮约 O(n^2)",
      watch: "对角占优、谱半径和 SPD 条件决定是否更可靠地收敛。",
    },
  ],
  determinant: [
    {
      method: "消元行列式",
      applies: "适合小到中等方阵的体积因子和可逆性判断。",
      cost: "约 O(n^3)",
      watch: "行交换会改变符号；奇异矩阵会出现零主元。",
    },
  ],
  decomposition: [
    {
      method: "LU / QR / Cholesky",
      applies: "LU 适合方阵求解，QR 适合最小二乘，Cholesky 适合 SPD 矩阵。",
      cost: "约 O(n^3)",
      watch: "Cholesky 失败通常意味着矩阵不是对称正定。",
    },
    {
      method: "SVD",
      applies: "适合秩、低秩近似和病态问题观察。",
      cost: "通常高于 LU/QR",
      watch: "奇异值接近 0 时，结果对扰动更敏感。",
    },
  ],
  eigen: [
    {
      method: "特征值 / 特征向量",
      applies: "适合分析线性变换的不变量、稳定性和对角化。",
      cost: "约 O(n^3)",
      watch: "重特征值或缺陷矩阵会让特征向量配对更敏感。",
    },
  ],
  errorAnalysis: [
    {
      method: "条件数",
      applies: "适合估计输入扰动对解或矩阵运算结果的放大程度。",
      cost: "约 O(n^3)",
      watch: "条件数很大时，残差小也不代表解一定稳定。",
    },
  ],
};
