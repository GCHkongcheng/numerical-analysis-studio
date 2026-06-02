# 更新日志

本项目更新日志遵循 Keep a Changelog 约定，并使用语义化版本（SemVer）。

## [Unreleased]

### Added

- 关于页新增“说明文档”与“更新日志”入口，支持弹窗查看 Markdown 文档。
- 关于页新增博客指引链接：<https://blog.gchkc.top>

### Changed

- 文档弹窗从纯文本展示升级为 Markdown 渲染，支持标题、列表、表格等常见语法。

### Commit Audit
- 2026-06-02 16:06:42 | 提交：1
  - 文件审查：新增 1，修改 5
  - 变更范围：`LICENSE`、`README.md`、`package-lock.json`、`package.json`、`src/app/about/page.tsx`、`src/lib/site.ts`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；依赖清单变更，建议执行 npm install 并验证 build；涉及前端交互，建议人工回归关键页面
- 2026-06-02 13:56:48 | 提交：Hide FAB in mobile keyboard mode when open
  - 文件审查：修改 2
  - 变更范围：`src/components/common/SymbolKeyboard.tsx`、`tests/ui/symbol-keyboard.spec.ts`
  - 风险提示：涉及前端交互，建议人工回归关键页面
- 2026-06-02 10:18:17 | 提交：1
  - 文件审查：修改 3
  - 变更范围：`src/app/globals.css`、`src/components/common/SymbolKeyboard.tsx`、`tests/ui/symbol-keyboard.spec.ts`
  - 风险提示：涉及前端交互，建议人工回归关键页面
- 2026-06-02 09:53:47 | 提交：1
  - 文件审查：修改 3
  - 变更范围：`src/app/globals.css`、`src/components/common/SymbolKeyboard.tsx`、`tests/ui/symbol-keyboard.spec.ts`
  - 风险提示：涉及前端交互，建议人工回归关键页面
- 2026-06-02 09:47:09 | 提交：1
  - 文件审查：修改 5
  - 变更范围：`scripts/test-math.ts`、`src/components/integration/IntegrationPanel.tsx`、`src/lib/integration-core.ts`、`src/types/integration.ts`、`tests/ui/integration.spec.ts`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；涉及前端交互，建议人工回归关键页面
- 2026-06-02 00:18:47 | 提交：1
  - 文件审查：新增 26，修改 9
  - 变更范围：`.vscode/settings.json`、`README.md`、`eslint.config.mjs`、`scripts/test-math.ts`、`src/app/error.tsx`、`src/app/globals.css`、`src/app/page.tsx`、`src/components/common/SymbolKeyboard.tsx`、`src/components/integration/IntegrationPanel.tsx`、`src/components/matrix/MatrixGrid.tsx`、`src/components/workbench/DecompositionModule.tsx`、`src/components/workbench/DeterminantModule.tsx`、`src/components/workbench/EigenAnalysisModule.tsx`、`src/components/workbench/ErrorAnalysisModule.tsx`、`src/components/workbench/LinearSystemModule.tsx`、`src/components/workbench/MatrixOperationsModule.tsx`、`src/components/workbench/WorkbenchControls.tsx`、`src/components/workbench/WorkbenchHeader.tsx`、`src/components/workbench/WorkbenchLayout.tsx`、`src/components/workbench/WorkbenchSidebar.tsx`、`src/config/workbench.ts`、`src/hooks/useMatrixLibraryBridge.ts`、`src/hooks/useResponsiveNavDrawer.ts`、`src/hooks/useToastQueue.ts`、`src/hooks/useWorkbenchHistory.ts`、`src/lib/integration-core.ts`、`src/types/integration.ts`、`src/types/workbench.ts`、`tests/ui/integration.spec.ts`、`tests/ui/symbol-keyboard.spec.ts`、`tests/ui/workbench-regression.spec.ts`、`"\344\273\243\347\240\201\346\250\241\345\235\227\345\214\226\351\207\215\346\236\204\346\226\271\346\241\210.md"`、`"\345\211\215\347\253\257\344\274\230\345\214\226\345\256\236\346\226\275\346\212\245\345\221\212.md"`、`"\350\241\214\345\210\227\345\274\217\346\250\241\345\235\227\351\233\206\346\210\220\346\212\245\345\221\212.md"`、`"\351\207\215\346\236\204\350\277\233\345\272\246\346\212\245\345\221\212.md"`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；涉及前端交互，建议人工回归关键页面
- 2026-05-31 20:54:37 | 提交：1
  - 文件审查：新增 2，修改 2
  - 变更范围：`package-lock.json`、`package.json`、`"\345\211\215\347\253\257\345\270\203\345\261\200\346\240\267\345\274\217\344\274\230\345\214\226\345\273\272\350\256\256.md"`、`"\351\241\271\347\233\256\344\274\230\345\214\226\345\273\272\350\256\256.md"`
  - 风险提示：依赖清单变更，建议执行 npm install 并验证 build
- 2026-05-31 19:55:07 | 提交：1
  - 文件审查：新增 9，修改 10
  - 变更范围：`.gitignore`、`package-lock.json`、`package.json`、`playwright.config.ts`、`src/app/page.tsx`、`src/components/approximation/ApproximationPanel.tsx`、`src/components/common/CoordinatePlot.tsx`、`src/components/workbench/LazyModulePanels.tsx`、`src/hooks/useMatrix.ts`、`src/lib/matrix-basic.ts`、`src/lib/matrix-core.ts`、`src/lib/matrix-decomposition.ts`、`src/lib/matrix-eigen.ts`、`src/lib/matrix-error-analysis.ts`、`src/lib/matrix-format.ts`、`src/lib/matrix-linear-system.ts`、`src/store/experiment-library.ts`、`src/store/matrix-library.ts`、`tests/ui/approximation.spec.ts`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；依赖清单变更，建议执行 npm install 并验证 build；涉及前端交互，建议人工回归关键页面
- 2026-05-31 14:29:48 | 提交：1
  - 文件审查：新增 4，修改 12
  - 变更范围：`README.md`、`package-lock.json`、`package.json`、`src/app/about/page.tsx`、`src/app/opengraph-image.tsx`、`src/app/page.tsx`、`src/app/twitter-image.tsx`、`src/components/approximation/ApproximationPanel.tsx`、`src/components/common/ExperimentTools.tsx`、`src/components/common/ModuleSidebarPortal.tsx`、`src/components/integration/IntegrationPanel.tsx`、`src/components/nonlinear/NonlinearSolverPanel.tsx`、`src/components/ode/OdePanel.tsx`、`src/lib/site.ts`、`src/store/experiment-library.ts`、`src/types/experiment.ts`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；依赖清单变更，建议执行 npm install 并验证 build；涉及前端交互，建议人工回归关键页面
- 2026-05-31 00:15:11 | 提交：1
  - 文件审查：新增 13，修改 3
  - 变更范围：`scripts/test-math.ts`、`src/app/page.tsx`、`src/components/approximation/ApproximationPanel.tsx`、`src/components/common/CoordinatePlot.tsx`、`src/components/integration/IntegrationPanel.tsx`、`src/components/nonlinear/NonlinearSolverPanel.tsx`、`src/components/ode/OdePanel.tsx`、`src/lib/approximation-core.ts`、`src/lib/integration-core.ts`、`src/lib/nonlinear-core.ts`、`src/lib/ode-core.ts`、`src/types/approximation.ts`、`src/types/integration.ts`、`src/types/nonlinear.ts`、`src/types/ode.ts`、`tsconfig.math-tests.json`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；涉及前端交互，建议人工回归关键页面
- 2026-03-31 17:44:17 | 提交：优化移动端适配
  - 文件审查：修改 2
  - 变更范围：`scripts/test-math.ts`、`src/lib/matrix-core.ts`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math
- 2026-03-31 16:30:26 | 提交：Implement mobile drawer navigation with smooth transitions
  - 文件审查：修改 1
  - 变更范围：`src/app/page.tsx`
  - 风险提示：涉及前端交互，建议人工回归关键页面
- 2026-03-30 21:02:46 | 提交：Add SVD decomposition with validation and undo redo history
  - 文件审查：修改 5
  - 变更范围：`scripts/test-math.ts`、`src/app/page.tsx`、`src/hooks/useMatrix.ts`、`src/lib/matrix-core.ts`、`src/types/matrix.ts`
  - 风险提示：涉及核心计算逻辑，建议运行 npm run test:math；涉及前端交互，建议人工回归关键页面

- 2026-03-30 18:22:25 | 提交：增加显示正确性证据功能
  - 文件审查：新增 1，修改 2
  - 变更范围：`README.md`、`src/app/page.tsx`、`src/components/matrix/CorrectnessPanel.tsx`
  - 风险提示：涉及前端交互，建议人工回归关键页面
- 2026-03-24 21:13:49 | 提交：Enable Codex-powered changelog updates on commit
  - 文件审查：修改 2
  - 变更范围：`README.md`、`scripts/update-changelog-on-commit.mjs`

## [0.1.0] - 2026-03-23

### Added

- 首次发布线性代数可视化工作台。
- 支持矩阵运算、线性方程组求解、矩阵分解与特征分析。
- 提供全局矩阵库、智能导入、步骤回放与结果校验能力。

### Started
