# Numerical Analysis Studio

中文名：数值分析工作台

预览网址：[math.gchkc.top](https://math.gchkc.top)

[![GitHub Repo stars](https://img.shields.io/github/stars/GCHkongcheng/numerical-analysis-studio?style=social)](https://github.com/GCHkongcheng/numerical-analysis-studio/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一个面向学习与工程实践的数值分析可视化工作台。项目聚焦三件事：

- 结果正确：核心算法提供残差、一致性校验与误差指标，避免“看起来对”但实际不可靠。
- 过程可解释：支持步骤回放、迭代历史、收敛提示、主元交换原因说明与解类型判定。
- 数据可复用：通过全局矩阵库实现跨模块流转，支持从线性代数计算继续进入误差分析与链式实验。

## 功能总览

### 1. 数值线性代数

- 支持 `A+B`、`A-B`、`A*B`、`A^-1`、`A^2`、`转置`、`RREF`、`数乘`
- 支持 `秩` 与 `行列式`，并在结果区展示具体数值
- 支持线性方程组求解：`高斯消元`、`高斯-约旦`、`Jacobi`、`Gauss-Seidel`、`SOR`、`共轭梯度法`
- 自动判定解类型：`无解 / 唯一解 / 无穷多解`
- 输出 `rank(A)` 与 `rank([A|b])`
- 迭代法自动计算谱半径 `ρ(B)`，给出“是否保证收敛”的判定提示

### 2. 矩阵分解与特征分析

- 分解支持：`LU（带主元）`、`LU（普通）`、`QR（Householder）`、`Cholesky`、`SVD`
- 显示并校验分解残差：
- LU：`maxAbs(PA - LU)`
- QR：`maxAbs(A - QR)` 与 `maxAbs(Q^TQ - I)`
- Cholesky：`maxAbs(A - LL^T)`
- SVD：`maxAbs(A - UΣV^T)` 与正交性残差
- 特征分析支持复数特征值与特征向量配对展示（`λi ↔ vi`）
- 缺陷矩阵可识别并提示不可对角化

### 3. 非线性方程求根

- 支持常见一元非线性方程求根流程
- 展示迭代历史、误差变化与收敛状态
- 支持函数曲线与迭代点可视化，帮助理解初值、区间和步长对结果的影响

### 4. 插值与逼近

- 支持数据点输入与函数逼近实验
- 展示插值曲线、原始数据点和误差趋势
- 适合观察不同节点、阶数与采样密度对数值结果的影响

### 5. 数值积分

- 支持典型数值积分实验
- 展示积分结果、误差估计与计算过程
- 适合比较不同求积策略在平滑函数、振荡函数或局部变化较大函数上的表现

### 6. 常微分方程数值解

- 支持 ODE 初值问题的数值求解
- 展示数值解曲线、步进数据与误差指标
- 可用于比较步长、方法与精确解之间的差异

### 7. 误差与稳定性分析

- 支持条件数、矩阵扰动、向量扰动与相对误差对比
- 可观察病态矩阵、近奇异矩阵和扰动放大现象
- 将“算出答案”升级为“解释答案是否可信”

### 8. 全局矩阵库（Matrix Library）

- 使用 Zustand 全局状态管理
- 支持保存、重命名、删除、设为当前活动矩阵
- 支持普通矩阵与增广矩阵类型区分
- localStorage 持久化，刷新后不丢失
- 结果区可“一键存入库”，用于下一步链式计算

### 9. 智能识别（Smart Import）

- 侧边栏提供“智能识别”入口
- 支持文本格式快速导入，例如：`1,1;2,2;3,3`
- 支持增广分隔输入，例如：`1,2|3;4,5|6`
- 支持拍照/扫码导入（浏览器支持 `BarcodeDetector` 时）
- 导入后先进入可编辑预览，再保存到矩阵库

### 10. 交互与体验

- Container-based 响应式布局
- 移动端矩阵输入支持内部平滑横向滚动，避免整页溢出
- 侧边栏矩阵预览支持大矩阵滚动查看
- 运算、求解、分解状态统一 Toast 反馈

## 技术栈

- 框架：Next.js 16 + React 19 + TypeScript
- 样式：Tailwind CSS 4 + Typography 插件
- 图标：lucide-react
- 数学计算：mathjs + fraction.js
- 状态管理：zustand（含 persist）

## 目录结构

```text
src/
  app/
    page.tsx                 # 主工作台
    error.tsx                # 路由级错误边界
    about/page.tsx           # 关于页
    robots.ts                # robots
    sitemap.ts               # sitemap
    manifest.ts              # Web App Manifest
  components/
    approximation/           # 插值与逼近面板
    common/                  # 实验工具、图表与共享面板
    integration/             # 数值积分面板
    nonlinear/               # 非线性方程求根面板
    ode/                     # 常微分方程面板
    matrix/                  # 矩阵输入、矩阵库、步骤与 Toast
    workbench/               # 线性代数工作台拆分模块
  config/workbench.ts        # 工作台导航、案例与侧边栏配置
  hooks/useMatrix.ts         # 矩阵与线性方程组业务编排
  hooks/useMatrixLibraryBridge.ts # 矩阵库与工作台模块桥接
  hooks/useResponsiveNavDrawer.ts # 响应式导航抽屉
  hooks/useToastQueue.ts     # Toast 队列、去重与自动关闭
  hooks/useWorkbenchHistory.ts # 工作台撤销 / 重做快照
  lib/
    matrix-basic.ts          # 基础矩阵工具与输入规范化
    matrix-core.ts           # 数值线性代数格式化与通用逻辑
    matrix-decomposition.ts  # LU / QR / Cholesky / SVD
    matrix-eigen.ts          # 特征值与特征向量
    matrix-error-analysis.ts # 条件数与扰动分析
    matrix-linear-system.ts  # 线性方程组求解
    nonlinear-core.ts        # 非线性方程核心逻辑
    approximation-core.ts    # 插值与逼近核心逻辑
    integration-core.ts      # 数值积分核心逻辑
    ode-core.ts              # ODE 核心逻辑
  store/matrix-library.ts    # 全局矩阵库状态
```

## 本地运行

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 提交时自动更新 CHANGELOG

```bash
# 初始化 Git Hook（只需一次）
npm run setup:hooks
```

- 默认行为：每次 `git commit` 会优先调用 `codex exec` 基于已暂存改动更新 `CHANGELOG.md` 的公开发布说明。
- 回退行为：若本机不可用 Codex 或执行失败，会回退到本地规则，在 `Added / Changed / Fixed / Removed` 中生成一条简洁变更说明。
- 手动优先：如果本次提交已经修改了 `CHANGELOG.md`，Hook 会跳过自动更新，避免重复写入。
- 强制使用 Codex：设置环境变量 `CHANGELOG_REQUIRE_CODEX=1`，Codex 失败时会直接阻止提交。
- 自定义 Codex 命令：可配置 `hooks.codexChangelogCommand`，支持占位符
- `{REPO_ROOT}` `{CHANGELOG}` `{COMMIT_MSG}` `{STAGED_DIFF}` `{STAGED_FILES}` `{SUBJECT}`

## 开源维护与 Codex

本项目是公开开源的教育与工程实践工具，维护重点包括数值算法正确性、交互可用性、回归测试与文档同步。

Codex 当前用于辅助维护流程：

- 审查已暂存改动，发现潜在回归与遗漏的测试场景
- 自动整理 `CHANGELOG.md`，降低发布记录维护成本
- 辅助定位数值算法边界案例、生成测试思路与重构建议
- 规划后续 PR triage、发布检查与安全审查工作流

## 质量检查

```bash
# 类型检查
npx tsc --noEmit

# 代码规范
npm run lint

# 数学回归测试
npm run test:math

# 生产构建
npm run build
```

## 部署到 Vercel

1. 将仓库推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量：

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

4. 点击 Deploy

项目已内置：

- SEO metadata（title/description/open graph/twitter）
- `robots.txt` / `sitemap.xml`
- `manifest.webmanifest`
- 安全响应头与静态资源缓存策略

## 输入格式示例

- 文本矩阵：`1,2,3;4,5,6`
- 逐行输入：
- `1 2 3`
- `4 5 6`
- 增广矩阵：`1,2|3;4,5|6`
- 支持 Excel/CSV 粘贴到矩阵输入网格

## 项目目标

- 让数值分析计算“可视、可证、可复用”
- 在保证数学正确性的前提下，持续优化交互效率
- 帮助用户理解算法条件、误差传播、收敛性与结果可信度

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 联系方式

- GitHub: <https://github.com/GCHkongcheng/numerical-analysis-studio>
- Email: 2839474636@qq.com

## Star History

<a href="https://www.star-history.com/?repos=GCHkongcheng%2Fnumerical-analysis-studio&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=GCHkongcheng/numerical-analysis-studio&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=GCHkongcheng/numerical-analysis-studio&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=GCHkongcheng/numerical-analysis-studio&type=date&legend=top-left" />
 </picture>
</a>
