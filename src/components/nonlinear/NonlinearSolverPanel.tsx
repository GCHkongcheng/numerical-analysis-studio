"use client";

import { Activity, AlertCircle, CheckCircle2, Play, Sigma } from "lucide-react";
import { useMemo, useState } from "react";

import {
  formatRootNumber,
  sampleFunction,
  solveRoot,
} from "@/lib/nonlinear-core";
import { CoordinatePlot } from "@/components/common/CoordinatePlot";
import type { RootMethod, RootSolveResult } from "@/types/nonlinear";

const METHOD_OPTIONS: Array<{ id: RootMethod; label: string; needsG?: boolean; needsInterval?: boolean; needsX1?: boolean }> = [
  { id: "fixedPoint", label: "简单迭代", needsG: true },
  { id: "steffensen", label: "Steffensen", needsG: true },
  { id: "newton", label: "牛顿迭代" },
  { id: "dampedNewton", label: "牛顿下山" },
  { id: "bisection", label: "二分法", needsInterval: true },
  { id: "secant", label: "割线法", needsX1: true },
];

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function methodLabel(method: RootMethod): string {
  return METHOD_OPTIONS.find((item) => item.id === method)?.label ?? method;
}

function buildPlotRange(result: RootSolveResult | null, left: number, right: number) {
  const xs = result?.history.map((item) => item.x).filter(Number.isFinite) ?? [];
  if (xs.length > 0) {
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const span = Math.max(max - min, 1);
    return { minX: min - span * 0.45, maxX: max + span * 0.45 };
  }

  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) {
    const min = Math.min(left, right);
    const max = Math.max(left, right);
    const span = Math.max(max - min, 1);
    return { minX: min - span * 0.15, maxX: max + span * 0.15 };
  }

  return { minX: -4, maxX: 4 };
}

function FunctionPlot({
  expression,
  result,
  left,
  right,
}: {
  expression: string;
  result: RootSolveResult | null;
  left: number;
  right: number;
}) {
  const range = buildPlotRange(result, left, right);
  const samples = useMemo(
    () => sampleFunction(expression, range.minX, range.maxX, 420),
    [expression, range.maxX, range.minX]
  );
  const points = result?.history.slice(-18) ?? [];

  return (
    <CoordinatePlot
      ariaLabel="函数图像与迭代点"
      emptyMessage="等待迭代结果"
      height={280}
      includeZeroX
      includeZeroY
      series={[
        {
          id: "root-function",
          label: "f(x)",
          color: "#ea580c",
          points: samples,
          width: 2.5,
        },
      ]}
      markers={points.map((point, index) => ({
        id: `root-iterate-${point.iteration}-${index}`,
        x: point.x,
        y: point.fx,
        color: index === points.length - 1 ? "#0f172a" : "#f97316",
        label: `${point.iteration}`,
        radius: index === points.length - 1 ? 5 : 3.5,
      }))}
    />
  );
}

export function NonlinearSolverPanel() {
  const [method, setMethod] = useState<RootMethod>("newton");
  const [fExpression, setFExpression] = useState("x^3 - x - 1");
  const [gExpression, setGExpression] = useState("(x + 1)^(1/3)");
  const [x0, setX0] = useState("1");
  const [x1, setX1] = useState("2");
  const [intervalStart, setIntervalStart] = useState("1");
  const [intervalEnd, setIntervalEnd] = useState("2");
  const [tolerance, setTolerance] = useState("1e-8");
  const [maxIterations, setMaxIterations] = useState("80");
  const [result, setResult] = useState<RootSolveResult | null>(null);

  const activeMethod = METHOD_OPTIONS.find((item) => item.id === method) ?? METHOD_OPTIONS[0];
  const numericLeft = parseNumber(intervalStart, 1);
  const numericRight = parseNumber(intervalEnd, 2);

  const compute = () => {
    const next = solveRoot({
      method,
      fExpression,
      gExpression,
      x0: parseNumber(x0, 1),
      x1: parseNumber(x1, 2),
      intervalStart: numericLeft,
      intervalEnd: numericRight,
      tolerance: parseNumber(tolerance, 1e-8),
      maxIterations: parseNumber(maxIterations, 80),
    });
    setResult(next);
  };

  const statusTone = result?.converged ? "text-emerald-700" : "text-amber-700";
  const StatusIcon = result?.converged ? CheckCircle2 : AlertCircle;

  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Sigma size={18} />
                非线性方程求根
              </h2>
              <button type="button" onClick={compute} className="studio-primary-btn inline-flex items-center gap-2">
                <Play size={14} />
                计算
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                f(x)
                <input value={fExpression} onChange={(event) => setFExpression(event.target.value)} className="studio-input font-mono" />
              </label>

              <label className="space-y-1 text-sm font-medium text-slate-700">
                方法
                <select value={method} onChange={(event) => setMethod(event.target.value as RootMethod)} className="studio-select w-full">
                  {METHOD_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm font-medium text-slate-700">
                容差
                <input value={tolerance} onChange={(event) => setTolerance(event.target.value)} className="studio-input font-mono" />
              </label>

              {activeMethod.needsG ? (
                <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                  g(x)
                  <input value={gExpression} onChange={(event) => setGExpression(event.target.value)} className="studio-input font-mono" />
                </label>
              ) : null}

              {activeMethod.needsInterval ? (
                <>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    区间左端 a
                    <input value={intervalStart} onChange={(event) => setIntervalStart(event.target.value)} className="studio-input font-mono" />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    区间右端 b
                    <input value={intervalEnd} onChange={(event) => setIntervalEnd(event.target.value)} className="studio-input font-mono" />
                  </label>
                </>
              ) : (
                <>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    初值 x0
                    <input value={x0} onChange={(event) => setX0(event.target.value)} className="studio-input font-mono" />
                  </label>
                  {activeMethod.needsX1 ? (
                    <label className="space-y-1 text-sm font-medium text-slate-700">
                      初值 x1
                      <input value={x1} onChange={(event) => setX1(event.target.value)} className="studio-input font-mono" />
                    </label>
                  ) : (
                    <label className="space-y-1 text-sm font-medium text-slate-700">
                      最大迭代次数
                      <input value={maxIterations} onChange={(event) => setMaxIterations(event.target.value)} className="studio-input font-mono" />
                    </label>
                  )}
                </>
              )}

              {activeMethod.needsInterval || activeMethod.needsX1 ? (
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  最大迭代次数
                  <input value={maxIterations} onChange={(event) => setMaxIterations(event.target.value)} className="studio-input font-mono" />
                </label>
              ) : null}
            </div>
          </div>

          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Activity size={18} />
                函数与迭代轨迹
              </h2>
              <div className="text-xs text-slate-500">最近 18 个迭代点</div>
            </div>
            <FunctionPlot expression={fExpression} result={result} left={numericLeft} right={numericRight} />
          </div>
        </section>

        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">结果</h2>
            {result ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className={`flex items-center gap-2 font-semibold ${statusTone}`}>
                  <StatusIcon size={16} />
                  {result.converged ? "已收敛" : "未收敛"}
                </div>
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>方法：{methodLabel(result.method)}</div>
                  <div>根 x：<span className="font-mono">{formatRootNumber(result.root)}</span></div>
                  <div>残差 |f(x)|：<span className="font-mono">{formatRootNumber(result.residual)}</span></div>
                  <div>迭代次数：{result.iterations}</div>
                </div>
                {result.message ? <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{result.message}</div> : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                点击“计算”后，这里会显示根、残差和收敛状态。
              </div>
            )}
          </div>

          <div className="studio-card space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">迭代表</h2>
            {result?.history.length ? (
              <div className="max-h-[440px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">k</th>
                      <th className="px-3 py-2">x_k</th>
                      <th className="px-3 py-2">f(x_k)</th>
                      <th className="px-3 py-2">误差</th>
                      <th className="px-3 py-2">lambda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.history.map((item) => (
                      <tr key={`${item.iteration}-${item.x}`}>
                        <td className="px-3 py-2">{item.iteration}</td>
                        <td className="px-3 py-2">{formatRootNumber(item.x)}</td>
                        <td className="px-3 py-2">{formatRootNumber(item.fx)}</td>
                        <td className="px-3 py-2">{formatRootNumber(item.error)}</td>
                        <td className="px-3 py-2">{item.lambda === undefined ? "-" : formatRootNumber(item.lambda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                暂无迭代记录。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
