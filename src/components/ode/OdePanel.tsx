"use client";

import { Activity, Calculator, Play, Table2 } from "lucide-react";
import { useState } from "react";

import { formatOdeNumber, solveOde } from "@/lib/ode-core";
import { CoordinatePlot } from "@/components/common/CoordinatePlot";
import type { OdeMethod, OdeResult } from "@/types/ode";

const METHOD_OPTIONS: Array<{ id: OdeMethod; label: string }> = [
  { id: "euler", label: "Euler" },
  { id: "improvedEuler", label: "改进 Euler" },
  { id: "midpoint", label: "中点法" },
  { id: "rk4", label: "RK4" },
];

function methodLabel(method: OdeMethod): string {
  return METHOD_OPTIONS.find((item) => item.id === method)?.label ?? method;
}

function OdePlot({ result }: { result: OdeResult | null }) {
  if (!result) {
    return <CoordinatePlot ariaLabel="常微分方程数值解曲线" emptyMessage="等待初值问题求解结果" series={[]} />;
  }

  const exactPoints = result.steps.map((step) => ({ x: step.x, y: step.exact }));

  return (
    <CoordinatePlot
      ariaLabel="常微分方程数值解曲线"
      emptyMessage="等待初值问题求解结果"
      includeZeroX
      includeZeroY
      series={[
        {
          id: "ode-approx",
          label: "数值解",
          color: "#ea580c",
          points: result.steps.map((step) => ({ x: step.x, y: step.y })),
          width: 2.6,
        },
        ...(result.exactExpression
          ? [
              {
                id: "ode-exact",
                label: "精确解",
                color: "#16a34a",
                points: exactPoints,
                width: 2.2,
                dashed: true,
              },
            ]
          : []),
      ]}
      markers={result.steps.map((step) => ({
        id: `ode-dot-${step.index}`,
        x: step.x,
        y: step.y,
        color: "#0f172a",
        radius: 3.5,
      }))}
    />
  );
}

export function OdePanel() {
  const [method, setMethod] = useState<OdeMethod>("rk4");
  const [expression, setExpression] = useState("y - x^2 + 1");
  const [exactExpression, setExactExpression] = useState("(x + 1)^2 - 0.5 * exp(x)");
  const [x0, setX0] = useState("0");
  const [y0, setY0] = useState("0.5");
  const [xEnd, setXEnd] = useState("2");
  const [stepSize, setStepSize] = useState("0.2");
  const [result, setResult] = useState<OdeResult | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const compute = () => {
    try {
      const next = solveOde({
        method,
        expression,
        exactExpression,
        x0: Number(x0),
        y0: Number(y0),
        xEnd: Number(xEnd),
        stepSize: Number(stepSize),
      });
      setResult(next);
      setFeedback({ tone: "success", text: "初值问题求解完成" });
    } catch (error) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "求解失败",
      });
    }
  };

  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          <div className="studio-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Activity size={18} />
                常微分方程初值问题
              </h2>
              <button type="button" onClick={compute} className="studio-primary-btn inline-flex items-center gap-2">
                <Play size={14} />
                计算
              </button>
            </div>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              y&apos; = f(x,y)
              <input value={expression} onChange={(event) => setExpression(event.target.value)} className="studio-input font-mono" />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              精确解 y(x)
              <input value={exactExpression} onChange={(event) => setExactExpression(event.target.value)} className="studio-input font-mono" />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                方法
                <select value={method} onChange={(event) => setMethod(event.target.value as OdeMethod)} className="studio-select w-full">
                  {METHOD_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                x0
                <input value={x0} onChange={(event) => setX0(event.target.value)} className="studio-input font-mono" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                y0
                <input value={y0} onChange={(event) => setY0(event.target.value)} className="studio-input font-mono" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                终点 x
                <input value={xEnd} onChange={(event) => setXEnd(event.target.value)} className="studio-input font-mono" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                步长 h
                <input value={stepSize} onChange={(event) => setStepSize(event.target.value)} className="studio-input font-mono" />
              </label>
            </div>

            {feedback ? (
              <div className={`rounded-xl border px-3 py-2 text-xs ${feedback.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {feedback.text}
              </div>
            ) : null}
          </div>

          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">解曲线</h2>
              <div className="text-xs text-slate-500">橙色为数值解，绿色虚线为精确解</div>
            </div>
            <OdePlot result={result} />
          </div>
        </section>

        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Calculator size={18} />
              结果
            </h2>
            {result ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>方法：{methodLabel(result.method)}</div>
                  <div>步数：{result.steps.length - 1}</div>
                  <div>终点数值解：<span className="font-mono">{formatOdeNumber(result.steps[result.steps.length - 1]?.y)}</span></div>
                  <div>最大误差：<span className="font-mono">{formatOdeNumber(result.maxError)}</span></div>
                </div>
                {result.message ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {result.message}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                点击“计算”后显示终点解、误差和过程表。
              </div>
            )}
          </div>

          <div className="studio-card space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Table2 size={18} />
              步进表
            </h2>
            {result?.steps.length ? (
              <div className="max-h-[560px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">k</th>
                      <th className="px-3 py-2">x_k</th>
                      <th className="px-3 py-2">y_k</th>
                      <th className="px-3 py-2">f(x_k,y_k)</th>
                      <th className="px-3 py-2">精确解</th>
                      <th className="px-3 py-2">误差</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.steps.map((step) => (
                      <tr key={`ode-step-${step.index}`}>
                        <td className="px-3 py-2">{step.index}</td>
                        <td className="px-3 py-2">{formatOdeNumber(step.x)}</td>
                        <td className="px-3 py-2">{formatOdeNumber(step.y)}</td>
                        <td className="px-3 py-2">{formatOdeNumber(step.slope)}</td>
                        <td className="px-3 py-2">{formatOdeNumber(step.exact)}</td>
                        <td className="px-3 py-2">{formatOdeNumber(step.error)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                暂无步进数据。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
