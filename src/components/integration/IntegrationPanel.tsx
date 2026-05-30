"use client";

import { ChartArea, Calculator, Play, Table2 } from "lucide-react";
import { useState } from "react";

import {
  formatIntegrationNumber,
  solveIntegration,
} from "@/lib/integration-core";
import { CoordinatePlot } from "@/components/common/CoordinatePlot";
import type {
  IntegrationMethod,
  IntegrationResult,
} from "@/types/integration";

const METHOD_OPTIONS: Array<{ id: IntegrationMethod; label: string }> = [
  { id: "trapezoid", label: "复化梯形" },
  { id: "simpson", label: "复化 Simpson" },
  { id: "romberg", label: "Romberg" },
  { id: "gaussLegendre", label: "Gauss-Legendre" },
];

function methodLabel(method: IntegrationMethod): string {
  return METHOD_OPTIONS.find((item) => item.id === method)?.label ?? method;
}

function IntegrationPlot({ result }: { result: IntegrationResult | null }) {
  if (!result) {
    return <CoordinatePlot ariaLabel="积分函数图像" emptyMessage="等待积分结果" series={[]} />;
  }

  return (
    <CoordinatePlot
      ariaLabel="积分函数图像"
      emptyMessage="等待积分结果"
      includeZeroY
      series={[
        {
          id: "integrand",
          label: "f(x)",
          color: "#ea580c",
          points: result.samples,
          width: 2.6,
          fillToZero: true,
        },
      ]}
      markers={result.nodes.slice(0, 80).map((node, index) => ({
        id: `integration-node-${index}`,
        x: node.x,
        y: node.fx,
        color: "#0f172a",
        radius: 3.2,
      }))}
    />
  );
}

export function IntegrationPanel() {
  const [method, setMethod] = useState<IntegrationMethod>("simpson");
  const [expression, setExpression] = useState("sin(x)");
  const [intervalStart, setIntervalStart] = useState("0");
  const [intervalEnd, setIntervalEnd] = useState("pi");
  const [subdivisions, setSubdivisions] = useState("20");
  const [rombergLevels, setRombergLevels] = useState("5");
  const [gaussPoints, setGaussPoints] = useState("8");
  const [result, setResult] = useState<IntegrationResult | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const compute = () => {
    try {
      const next = solveIntegration({
        method,
        expression,
        intervalStart: Number(intervalStart),
        intervalEnd: Number(intervalEnd),
        subdivisions: Number(subdivisions),
        rombergLevels: Number(rombergLevels),
        gaussPoints: Number(gaussPoints),
        sampleCount: 220,
      });
      setResult(next);
      setFeedback({ tone: "success", text: "积分计算完成" });
    } catch (error) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "积分计算失败",
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
                <ChartArea size={18} />
                数值积分
              </h2>
              <button type="button" onClick={compute} className="studio-primary-btn inline-flex items-center gap-2">
                <Play size={14} />
                计算
              </button>
            </div>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              f(x)
              <input value={expression} onChange={(event) => setExpression(event.target.value)} className="studio-input font-mono" />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                方法
                <select value={method} onChange={(event) => setMethod(event.target.value as IntegrationMethod)} className="studio-select w-full">
                  {METHOD_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                区间左端 a
                <input value={intervalStart} onChange={(event) => setIntervalStart(event.target.value)} className="studio-input font-mono" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                区间右端 b
                <input value={intervalEnd} onChange={(event) => setIntervalEnd(event.target.value)} className="studio-input font-mono" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                等分数 n
                <input
                  value={subdivisions}
                  onChange={(event) => setSubdivisions(event.target.value)}
                  disabled={method === "romberg" || method === "gaussLegendre"}
                  className="studio-input font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Romberg 层数
                <input
                  value={rombergLevels}
                  onChange={(event) => setRombergLevels(event.target.value)}
                  disabled={method !== "romberg"}
                  className="studio-input font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Gauss 点数
                <input
                  value={gaussPoints}
                  onChange={(event) => setGaussPoints(event.target.value)}
                  disabled={method !== "gaussLegendre"}
                  className="studio-input font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
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
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ChartArea size={18} />
                函数图像与积分区域
              </h2>
              <div className="text-xs text-slate-500">阴影为积分区间内的有向面积</div>
            </div>
            <IntegrationPlot result={result} />
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
                  <div>区间：[{formatIntegrationNumber(result.interval[0])}, {formatIntegrationNumber(result.interval[1])}]</div>
                  <div>积分值：<span className="font-mono">{formatIntegrationNumber(result.value)}</span></div>
                  <div>节点/等分规模：{result.subdivisions}</div>
                  <div>误差估计：<span className="font-mono">{formatIntegrationNumber(result.errorEstimate)}</span></div>
                </div>
                {result.message ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {result.message}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                点击“计算”后显示积分值和过程数据。
              </div>
            )}
          </div>

          {result?.table ? (
            <div className="studio-card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Romberg 表</h2>
              <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.table.map((row) => (
                      <tr key={`romberg-${row.level}`}>
                        <td className="bg-slate-50 px-3 py-2 text-slate-500">{row.level}</td>
                        {row.values.map((value, index) => (
                          <td key={`romberg-${row.level}-${index}`} className="px-3 py-2">
                            {formatIntegrationNumber(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {result?.nodes.length ? (
            <div className="studio-card space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Table2 size={18} />
                节点表
              </h2>
              <div className="max-h-[440px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">x</th>
                      <th className="px-3 py-2">w</th>
                      <th className="px-3 py-2">f(x)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.nodes.map((node, index) => (
                      <tr key={`${node.x}-${index}`}>
                        <td className="px-3 py-2">{formatIntegrationNumber(node.x)}</td>
                        <td className="px-3 py-2">{formatIntegrationNumber(node.weight)}</td>
                        <td className="px-3 py-2">{formatIntegrationNumber(node.fx)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
