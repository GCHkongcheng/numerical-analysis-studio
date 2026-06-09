"use client";

import { Database, Download, FlaskConical, Save, ShieldCheck, Table2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { MethodGuidanceItem } from "@/config/method-guidance";
import { useExperimentLibraryStore } from "@/store/experiment-library";
import type {
  ComparisonRow,
  ExperimentCase,
  ExperimentModule,
  ReliabilityItem,
  ReliabilityTone,
  ScanRow,
} from "@/types/experiment";

const toneClass: Record<ReliabilityTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const toneDotClass: Record<ReliabilityTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  info: "bg-slate-400",
};

export function ExperimentCasePanel({
  cases,
  onApply,
}: {
  cases: ExperimentCase[];
  onApply: (id: string) => void;
}) {
  if (!cases.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <FlaskConical size={14} />
        实验案例
      </div>
      <div className="grid gap-2">
        {cases.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onApply(item.id)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-orange-300 hover:bg-orange-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{item.title}</span>
              {item.tag ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                  {item.tag}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReliabilityPanel({ items }: { items: ReliabilityItem[] }) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <ShieldCheck size={14} />
        可信度检查
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.label}-${item.detail}`} className={`rounded-xl border px-3 py-2 ${toneClass[item.tone]}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className={`h-2 w-2 rounded-full ${toneDotClass[item.tone]}`} />
              {item.label}
            </div>
            <div className="mt-1 text-xs leading-5">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MethodGuidancePanel({ items }: { items: MethodGuidanceItem[] }) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <ShieldCheck size={14} />
        方法边界
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.method} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-sm font-semibold text-slate-800">{item.method}</div>
            <div className="mt-1 text-xs leading-5 text-slate-600">{item.applies}</div>
            <div className="mt-2 grid gap-1 text-[11px] leading-4 text-slate-500">
              <div>成本：{item.cost}</div>
              <div>留意：{item.watch}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MethodComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  if (!rows.length) return null;

  return (
    <div className="studio-card space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Table2 size={18} />
        方法对比
      </h2>
      <div className="overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">方法</th>
              <th className="px-3 py-2">结果</th>
              <th className="px-3 py-2">误差/残差</th>
              <th className="px-3 py-2">成本</th>
              <th className="px-3 py-2">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={`${row.method}-${row.value}`} className="align-top">
                <td className="px-3 py-2 font-semibold text-slate-700">{row.method}</td>
                <td className="px-3 py-2 font-mono">{row.value}</td>
                <td className="px-3 py-2 font-mono">{row.metric}</td>
                <td className="px-3 py-2">{row.cost}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-1 ${toneClass[row.tone]}`}>
                    {row.note}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ParameterScanTable({
  title = "参数扫描",
  rows,
}: {
  title?: string;
  rows: ScanRow[];
}) {
  if (!rows.length) return null;

  return (
    <div className="studio-card space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <Table2 size={18} />
        {title}
      </h2>
      <div className="overflow-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">参数</th>
              <th className="px-3 py-2">取值</th>
              <th className="px-3 py-2">指标</th>
              <th className="px-3 py-2">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={`${row.parameter}-${row.value}`}>
                <td className="px-3 py-2 font-semibold text-slate-700">{row.parameter}</td>
                <td className="px-3 py-2 font-mono">{row.value}</td>
                <td className="px-3 py-2 font-mono">{row.metric}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-1 ${toneClass[row.tone]}`}>
                    {row.note ?? row.tone}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SaveExperimentButton({
  module,
  defaultName,
  summary,
  payload,
  disabled,
}: {
  module: ExperimentModule;
  defaultName: string;
  summary: string;
  payload: unknown;
  disabled?: boolean;
}) {
  const addExperiment = useExperimentLibraryStore((state) => state.addExperiment);
  const deleteExperiment = useExperimentLibraryStore((state) => state.deleteExperiment);
  const experiments = useExperimentLibraryStore((state) => state.experiments);
  const [savedName, setSavedName] = useState<string | null>(null);

  const moduleExperiments = useMemo(
    () => experiments.filter((item) => item.module === module),
    [experiments, module]
  );

  const exportBaseName = sanitizeFileName(defaultName);
  const exportPayload = {
    name: defaultName,
    module,
    summary,
    exportedAt: new Date().toISOString(),
    payload,
  };
  const exportJson = () => {
    downloadText(
      `${exportBaseName}.json`,
      JSON.stringify(exportPayload, null, 2),
      "application/json"
    );
  };
  const exportMarkdown = () => {
    downloadText(
      `${exportBaseName}.md`,
      [
        `# ${defaultName}`,
        "",
        `- 模块：${module}`,
        `- 摘要：${summary}`,
        `- 导出时间：${exportPayload.exportedAt}`,
        "",
        "```json",
        JSON.stringify(payload, null, 2),
        "```",
        "",
      ].join("\n"),
      "text/markdown"
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <Database size={14} />
        实验保存
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const record = addExperiment({
            name: defaultName,
            module,
            summary,
            payload,
          });
          setSavedName(record.name);
        }}
        className="step-control w-full justify-center disabled:opacity-50"
      >
        <Save size={14} />
        保存当前实验
      </button>
      <div className="mt-2 text-xs leading-5 text-slate-500">
        已保存 {moduleExperiments.length} 个本模块实验
        {savedName ? `，最近保存：${savedName}` : ""}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={exportJson}
          className="step-control justify-center disabled:opacity-50"
        >
          <Download size={14} />
          JSON
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={exportMarkdown}
          className="step-control justify-center disabled:opacity-50"
        >
          <Download size={14} />
          Markdown
        </button>
      </div>
      {moduleExperiments.length ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {moduleExperiments.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-2 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-700">{item.name}</div>
                <div className="text-[11px] leading-4 text-slate-500">
                  {item.summary}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteExperiment(item.id)}
                className="step-control shrink-0 px-2"
                aria-label={`删除实验 ${item.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "-");
  return normalized || "numerical-experiment";
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
