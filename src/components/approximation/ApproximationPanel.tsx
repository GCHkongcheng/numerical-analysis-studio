"use client";

import {
  BarChart3,
  Calculator,
  LineChart,
  ListPlus,
  Play,
  Table2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  formatApproxNumber,
  chebyshevZeros,
  pointsFromFunction,
  parseDataPointRows,
  parsePastedPoints,
  parseQueryValues,
  solveApproximation,
  solveFunctionExperiment,
  uniformNodes,
} from "@/lib/approximation-core";
import { CoordinatePlot } from "@/components/common/CoordinatePlot";
import type {
  ApproximationMethod,
  ApproximationResult,
  FunctionExperimentKind,
  FunctionExperimentResult,
} from "@/types/approximation";

type EditablePoint = {
  id: string;
  x: string;
  y: string;
  derivative: string;
};

const METHOD_OPTIONS: Array<{
  id: ApproximationMethod;
  label: string;
  needsDegree?: boolean;
}> = [
  { id: "lagrange", label: "Lagrange 插值" },
  { id: "newton", label: "Newton 插值" },
  { id: "piecewiseLinear", label: "分段线性" },
  { id: "leastSquaresPolynomial", label: "最小二乘多项式", needsDegree: true },
  { id: "cubicSpline", label: "三次自然样条" },
  { id: "hermite", label: "Hermite 插值" },
];

const INITIAL_POINTS: EditablePoint[] = [
  { id: "p-0", x: "0", y: "1", derivative: "0" },
  { id: "p-1", x: "1", y: "2", derivative: "2" },
  { id: "p-2", x: "2", y: "5", derivative: "4" },
  { id: "p-3", x: "3", y: "10", derivative: "6" },
];

function makePointId(): string {
  return `p-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function methodLabel(method: ApproximationMethod): string {
  return METHOD_OPTIONS.find((item) => item.id === method)?.label ?? method;
}

function ApproximationPlot({
  result,
  previewPoints = [],
}: {
  result: ApproximationResult | null;
  previewPoints?: Array<{ x: number; y: number }>;
}) {
  if (!result) {
    return (
      <CoordinatePlot
        ariaLabel="插值与逼近曲线"
        emptyMessage="等待计算结果"
        includeZeroX
        includeZeroY
        series={[]}
        markers={previewPoints.map((point, index) => ({
          id: `preview-node-${index}`,
          x: point.x,
          y: point.y,
          color: "#0f172a",
          label: `${index}`,
          radius: 5,
        }))}
      />
    );
  }
  return (
    <CoordinatePlot
      ariaLabel="插值与逼近曲线"
      emptyMessage="等待计算结果"
      includeZeroX
      includeZeroY
      series={[
        {
          id: "approximation",
          label: methodLabel(result.method),
          color: "#ea580c",
          points: result.samples,
          width: 2.6,
        },
      ]}
      markers={[
        ...result.points.map((point, index) => ({
          id: `node-${index}`,
          x: point.x,
          y: point.y,
          color: "#0f172a",
          label: `${index}`,
          radius: 5,
        })),
        ...result.query.map((point, index) => ({
          id: `query-${index}`,
          x: point.x,
          y: point.y,
          color: "#16a34a",
          shape: "diamond" as const,
          radius: 4,
        })),
      ]}
    />
  );
}

function FunctionExperimentPlot({
  result,
  previewPoints = [],
}: {
  result: FunctionExperimentResult | null;
  previewPoints?: Array<{ x: number; y: number }>;
}) {
  if (!result) {
    return (
      <CoordinatePlot
        ariaLabel="函数实验曲线"
        emptyMessage="等待函数实验结果"
        height={320}
        includeZeroX
        includeZeroY
        series={[]}
        markers={previewPoints.map((point, index) => ({
          id: `preview-node-${index}`,
          x: point.x,
          y: point.y,
          color: "#0f172a",
          label: `${index}`,
          radius: 4.5,
        }))}
      />
    );
  }

  return (
    <CoordinatePlot
      ariaLabel="函数实验曲线"
      emptyMessage="等待函数实验结果"
      height={320}
      includeZeroX
      includeZeroY
      series={result.series.map((item) => ({
        id: item.label,
        label: item.label,
        color: item.color,
        points: item.samples,
        dashed: item.dashed,
        width: item.dashed ? 2.15 : 2.6,
      }))}
      markers={result.nodes.map((point, index) => ({
        id: `function-node-${index}`,
        x: point.x,
        y: point.y,
        color: "#0f172a",
        radius: 4.5,
      }))}
    />
  );
}

export function ApproximationPanel() {
  const [inputMode, setInputMode] = useState<"points" | "function">("points");
  const [method, setMethod] = useState<ApproximationMethod>("newton");
  const [degree, setDegree] = useState("2");
  const [queryText, setQueryText] = useState("1.5 2.5");
  const [pasteText, setPasteText] = useState("");
  const [points, setPoints] = useState<EditablePoint[]>(INITIAL_POINTS);
  const [result, setResult] = useState<ApproximationResult | null>(null);
  const [functionResult, setFunctionResult] = useState<FunctionExperimentResult | null>(null);
  const [functionExpression, setFunctionExpression] = useState("1 / (1 + 25 * x^2)");
  const [intervalStart, setIntervalStart] = useState("-1");
  const [intervalEnd, setIntervalEnd] = useState("1");
  const [parts, setParts] = useState("10");
  const [sampleCount, setSampleCount] = useState("800");
  const [functionDegree, setFunctionDegree] = useState("3");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const activeMethod = METHOD_OPTIONS.find((item) => item.id === method) ?? METHOD_OPTIONS[0];
  const parsedPartsValue = Number(parts);
  const normalizedParts = Number.isFinite(parsedPartsValue)
    ? Math.max(1, Math.floor(parsedPartsValue))
    : 10;
  const automaticChebyshevCount = normalizedParts + 1;
  const showDerivativeColumn = inputMode === "points" && method === "hermite";
  const dataPointCardSpacing = "space-y-3";
  const dataPointTableClass = `w-full text-left text-xs ${
    showDerivativeColumn ? "min-w-[440px]" : "min-w-[360px]"
  }`;
  const dataPointCellClass = "px-2 py-1.5";
  const dataPointInputClass = "studio-input h-8 min-w-0 px-2 font-mono text-xs";
  const pasteAreaClass =
    "min-h-16 rounded-xl border border-slate-200 bg-white px-2 py-2 font-mono text-xs text-slate-700 outline-none focus:border-orange-400";
  const experimentButtonClass =
    "inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700";

  const parsedDataPoints = useMemo(() => parseDataPointRows(points), [points]);
  const validPointCount = parsedDataPoints.length;

  const updatePoint = (id: string, key: "x" | "y" | "derivative", value: string) => {
    setPoints((prev) =>
      prev.map((point) => (point.id === id ? { ...point, [key]: value } : point))
    );
  };

  const addPoint = () => {
    setPoints((prev) => [
      ...prev,
      { id: makePointId(), x: `${prev.length}`, y: "0", derivative: "0" },
    ]);
  };

  const removePoint = (id: string) => {
    setPoints((prev) => (prev.length <= 2 ? prev : prev.filter((point) => point.id !== id)));
  };

  const applyPastedPoints = () => {
    const pasted = parsePastedPoints(pasteText);
    if (pasted.length < 2) {
      setFeedback({ tone: "error", text: "批量数据至少需要两行有效点" });
      return;
    }

    setPoints(
      pasted.map((point) => ({
        id: makePointId(),
        x: point.x,
        y: point.y,
        derivative: point.derivative ?? "0",
      }))
    );
    setFeedback({ tone: "success", text: `已载入 ${pasted.length} 个数据点` });
  };

  const compute = () => {
    try {
      const next = solveApproximation({
        method,
        points: parseDataPointRows(points),
        degree: Number(degree),
        queryX: parseQueryValues(queryText),
      });
      setResult(next);
      setFunctionResult(null);
      setFeedback({ tone: "success", text: "计算完成" });
    } catch (error) {
      setResult(null);
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "计算失败",
      });
    }
  };

  const loadFunctionNodes = (kind: "uniform" | "chebyshev") => {
    try {
      const a = Number(intervalStart);
      const b = Number(intervalEnd);
      const xs =
        kind === "uniform"
          ? uniformNodes(normalizedParts, a, b)
          : chebyshevZeros(automaticChebyshevCount, a, b);
      const generated = pointsFromFunction(functionExpression, xs);
      setPoints(
        generated.map((point) => ({
          id: makePointId(),
          x: formatApproxNumber(point.x),
          y: formatApproxNumber(point.y),
          derivative: "0",
        }))
      );
      setFeedback({
        tone: "success",
        text: kind === "uniform" ? "已生成等距节点" : "已生成 Chebyshev 节点",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "节点生成失败",
      });
    }
  };

  const runFunctionExperiment = (kind: FunctionExperimentKind) => {
    try {
      const next = solveFunctionExperiment({
        kind,
        functionExpression,
        intervalStart: Number(intervalStart),
        intervalEnd: Number(intervalEnd),
        points: parseDataPointRows(points),
        degree: Number(functionDegree),
        parts: normalizedParts,
        chebyshevCount: automaticChebyshevCount,
        sampleCount: Number(sampleCount),
      });
      setFunctionResult(next);
      setResult(null);
      setFeedback({ tone: "success", text: "函数实验完成" });
    } catch (error) {
      setFunctionResult(null);
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "函数实验失败",
      });
    }
  };

  return (
    <div className="workspace-container">
      <div className="workspace-grid">
        <section className="space-y-6">
          <div className="studio-card space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              输入模式
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInputMode("points")}
                className={`mode-chip ${inputMode === "points" ? "mode-chip-active" : ""}`}
              >
                数据点插值
              </button>
              <button
                type="button"
                onClick={() => setInputMode("function")}
                className={`mode-chip ${inputMode === "function" ? "mode-chip-active" : ""}`}
              >
                函数实验
              </button>
            </div>
          </div>

          {inputMode === "points" ? (
          <div className="studio-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <LineChart size={18} />
                插值与函数逼近
              </h2>
              <button type="button" onClick={compute} className="studio-primary-btn inline-flex items-center gap-2">
                <Play size={14} />
                计算
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                方法
                <select value={method} onChange={(event) => setMethod(event.target.value as ApproximationMethod)} className="studio-select w-full">
                  {METHOD_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                多项式次数
                <input
                  value={degree}
                  onChange={(event) => setDegree(event.target.value)}
                  disabled={!activeMethod.needsDegree}
                  className="studio-input font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                查询 x
                <input value={queryText} onChange={(event) => setQueryText(event.target.value)} className="studio-input font-mono" />
              </label>
            </div>
          </div>
          ) : (
            <div className="studio-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <LineChart size={18} />
                  函数实验
                </h2>
                <button
                  type="button"
                  onClick={() => runFunctionExperiment("currentNodes")}
                  className="studio-primary-btn inline-flex items-center gap-2"
                >
                  <Play size={14} />
                  计算当前节点
                </button>
              </div>

              <label className="space-y-1 text-sm font-medium text-slate-700">
                f(x)
                <input
                  value={functionExpression}
                  onChange={(event) => setFunctionExpression(event.target.value)}
                  className="studio-input font-mono"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  区间左端 a
                  <input value={intervalStart} onChange={(event) => setIntervalStart(event.target.value)} className="studio-input font-mono" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  区间右端 b
                  <input value={intervalEnd} onChange={(event) => setIntervalEnd(event.target.value)} className="studio-input font-mono" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  逼近次数
                  <input value={functionDegree} onChange={(event) => setFunctionDegree(event.target.value)} className="studio-input font-mono" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  等分数 m
                  <input value={parts} onChange={(event) => setParts(event.target.value)} className="studio-input font-mono" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Chebyshev 节点数 n
                  <input value={automaticChebyshevCount} readOnly className="studio-input bg-slate-100 font-mono text-slate-500" />
                  <span className="block text-xs font-normal text-slate-500">自动取 m + 1</span>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  绘图采样数
                  <input value={sampleCount} onChange={(event) => setSampleCount(event.target.value)} className="studio-input font-mono" />
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <button type="button" onClick={() => loadFunctionNodes("uniform")} className={experimentButtonClass}>
                  生成等距节点
                </button>
                <button type="button" onClick={() => loadFunctionNodes("chebyshev")} className={experimentButtonClass}>
                  生成 Chebyshev 节点
                </button>
                <button type="button" onClick={() => runFunctionExperiment("rungeCompare")} className={experimentButtonClass}>
                  等距 10/15/20 对比
                </button>
                <button type="button" onClick={() => runFunctionExperiment("chebyshevCompare")} className={experimentButtonClass}>
                  Chebyshev 11/16/21 对比
                </button>
                <button type="button" onClick={() => runFunctionExperiment("continuousLeastSquares")} className={experimentButtonClass}>
                  连续最佳平方
                </button>
                <button type="button" onClick={() => runFunctionExperiment("remez")} className={experimentButtonClass}>
                  最佳一致逼近
                </button>
              </div>
            </div>
          )}
          <div
            className="grid items-start gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(420px,1.18fr)]"
          >
          <div className={`studio-card ${dataPointCardSpacing}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Table2 size={18} />
                数据点
              </h2>
              <div className="flex gap-2">
                <button type="button" onClick={addPoint} className="step-control">
                  <ListPlus size={14} />
                  添加
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-200">
              <table className={dataPointTableClass}>
                <thead className="bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className={dataPointCellClass}>i</th>
                    <th className={dataPointCellClass}>x_i</th>
                    <th className={dataPointCellClass}>y_i</th>
                    {showDerivativeColumn ? <th className={dataPointCellClass}>y&apos;_i</th> : null}
                    <th className="w-10 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {points.map((point, index) => (
                    <tr key={point.id}>
                      <td className={`${dataPointCellClass} text-xs text-slate-500`}>{index}</td>
                      <td className={dataPointCellClass}>
                        <input value={point.x} onChange={(event) => updatePoint(point.id, "x", event.target.value)} className={dataPointInputClass} />
                      </td>
                      <td className={dataPointCellClass}>
                        <input value={point.y} onChange={(event) => updatePoint(point.id, "y", event.target.value)} className={dataPointInputClass} />
                      </td>
                      {showDerivativeColumn ? (
                        <td className={dataPointCellClass}>
                          <input
                            value={point.derivative}
                            onChange={(event) => updatePoint(point.id, "derivative", event.target.value)}
                            className={dataPointInputClass}
                          />
                        </td>
                      ) : null}
                      <td className={dataPointCellClass}>
                        <button
                          type="button"
                          onClick={() => removePoint(point.id)}
                          disabled={points.length <= 2}
                          className="step-control px-2"
                          aria-label={`删除第 ${index + 1} 个点`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2">
              <textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                className={pasteAreaClass}
                placeholder={showDerivativeColumn ? "0 1 0\n1 2 2\n2 5 4" : "0 1\n1 2\n2 5"}
              />
              <button type="button" onClick={applyPastedPoints} className="studio-primary-btn h-9 self-end text-xs">
                批量载入
              </button>
            </div>

            {feedback ? (
              <div className={`rounded-xl border px-3 py-2 text-xs ${feedback.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {feedback.text}
              </div>
            ) : (
              <div className="text-xs text-slate-500">有效点数：{validPointCount}</div>
            )}
          </div>

          <div className="studio-card space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <BarChart3 size={18} />
                曲线
              </h2>
              <div className="text-xs text-slate-500">黑点为节点，绿点为查询值</div>
            </div>
            {inputMode === "function" ? (
              <FunctionExperimentPlot result={functionResult} previewPoints={parsedDataPoints} />
            ) : (
              <ApproximationPlot result={result} previewPoints={parsedDataPoints} />
            )}
          </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="studio-card space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Calculator size={18} />
              结果
            </h2>
            {inputMode === "function" && functionResult ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>实验：{functionResult.title}</div>
                  <div>区间：[{formatApproxNumber(functionResult.interval[0])}, {formatApproxNumber(functionResult.interval[1])}]</div>
                  <div>节点数：{functionResult.nodes.length}</div>
                </div>
                <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs leading-6 text-slate-700">
                  {functionResult.summary}
                </pre>
              </div>
            ) : result ? (
              <div className="space-y-3 text-sm text-slate-700">
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>方法：{methodLabel(result.method)}</div>
                  <div>节点数：{result.points.length}</div>
                  <div>SSE：<span className="font-mono">{formatApproxNumber(result.metrics.sse)}</span></div>
                  <div>RMSE：<span className="font-mono">{formatApproxNumber(result.metrics.rmse)}</span></div>
                  <div>R²：<span className="font-mono">{formatApproxNumber(result.metrics.r2)}</span></div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 font-mono text-xs leading-6 text-slate-700">
                  {result.expression}
                </div>
                {result.message ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {result.message}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                点击“计算”后显示公式、误差指标和查询值。
              </div>
            )}
          </div>

          <div className="studio-card space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">查询值</h2>
            {result?.query.length ? (
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">x</th>
                      <th className="px-3 py-2">y</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.query.map((item, index) => (
                      <tr key={`${item.x}-${index}`}>
                        <td className="px-3 py-2">{formatApproxNumber(item.x)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(item.y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                暂无查询值。
              </div>
            )}
          </div>

          {result?.dividedDifferenceTable ? (
            <div className="studio-card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">差商表</h2>
              <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.dividedDifferenceTable.map((row, rowIndex) => (
                      <tr key={`dd-${rowIndex}`}>
                        <td className="bg-slate-50 px-3 py-2 text-slate-500">{rowIndex}</td>
                        {row.map((value, colIndex) => (
                          <td key={`dd-${rowIndex}-${colIndex}`} className="px-3 py-2">
                            {value === null ? "" : formatApproxNumber(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {result?.normalMatrix ? (
            <div className="studio-card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">正规方程</h2>
              <div className="max-h-[300px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.normalMatrix.map((row, rowIndex) => (
                      <tr key={`normal-${rowIndex}`}>
                        {row.map((value, colIndex) => (
                          <td key={`normal-${rowIndex}-${colIndex}`} className="px-3 py-2">
                            {formatApproxNumber(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {result?.splineSegments ? (
            <div className="studio-card space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">样条系数</h2>
              <div className="max-h-[320px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">区间</th>
                      <th className="px-3 py-2">a</th>
                      <th className="px-3 py-2">b</th>
                      <th className="px-3 py-2">c</th>
                      <th className="px-3 py-2">d</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.splineSegments.map((segment, index) => (
                      <tr key={`spline-${index}`}>
                        <td className="px-3 py-2">
                          [{formatApproxNumber(segment.interval[0])}, {formatApproxNumber(segment.interval[1])}]
                        </td>
                        <td className="px-3 py-2">{formatApproxNumber(segment.a)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(segment.b)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(segment.c)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(segment.d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="studio-card space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">残差表</h2>
            {result?.residuals.length ? (
              <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">x</th>
                      <th className="px-3 py-2">y</th>
                      <th className="px-3 py-2">ŷ</th>
                      <th className="px-3 py-2">r</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {result.residuals.map((item, index) => (
                      <tr key={`${item.x}-${index}`}>
                        <td className="px-3 py-2">{formatApproxNumber(item.x)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(item.y)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(item.predicted)}</td>
                        <td className="px-3 py-2">{formatApproxNumber(item.residual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                暂无残差。
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
