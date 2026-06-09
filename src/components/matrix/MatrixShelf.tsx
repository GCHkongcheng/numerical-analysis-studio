"use client";

import {
  Camera,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";

import { getMatrixDimensionLimitMessage } from "@/config/matrix-limits";
import type { MatrixKind, MatrixRecord } from "@/store/matrix-library";

type MatrixShelfProps = {
  items: MatrixRecord[];
  activeMatrixId: string | null;
  onActivate: (item: MatrixRecord) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSmartImport: (payload: {
    name: string;
    data: string[][];
    type: MatrixKind;
  }) => void;
};

type ParseResult =
  | { ok: true; data: string[][]; type: MatrixKind }
  | { ok: false; error: string };

const text = {
  shelf: "\u77e9\u9635\u5e93",
  countSuffix: "\u4e2a\u77e9\u9635",
  emptyMatrix: "\u7a7a\u77e9\u9635",
  noSaved: "\u8fd8\u6ca1\u6709\u4fdd\u5b58\u7684\u77e9\u9635\u3002",
  collapse: "\u6536\u8d77\u77e9\u9635\u5e93",
  expand: "\u5c55\u5f00\u77e9\u9635\u5e93",
  rename: "\u91cd\u547d\u540d",
  saveName: "\u4fdd\u5b58\u540d\u79f0",
  remove: "\u5220\u9664",
  active: "\u8bbe\u4e3a\u5f53\u524d\u6d3b\u52a8\u77e9\u9635",
  standard: "\u666e\u901a\u77e9\u9635",
  augmented: "\u589e\u5e7f\u77e9\u9635",
  smart: "\u667a\u80fd\u8bc6\u522b",
  close: "\u5173\u95ed",
  scan: "拍照识别矩阵",
  scanning: "图片识别中...",
  confirmPreview: "\u786e\u8ba4\u5e76\u751f\u6210\u53ef\u7f16\u8f91\u77e9\u9635",
  backInput: "\u8fd4\u56de\u8bc6\u522b",
  saveLibrary: "\u4fdd\u5b58\u5230\u77e9\u9635\u5e93",
  matrixName: "\u77e9\u9635\u540d\u79f0",
  matrixType: "\u7c7b\u578b",
  matrixSize: "\u7ef4\u5ea6",
  inputPlaceholder: "1,1;2,2;3,3  \u6216  1,2|3;4,5|6",
  helper:
    "输入 1,1;2,2;3,3，或拍摄清晰的数字矩阵图片；识别后可继续编辑矩阵。",
  errEmptyInput: "\u8bf7\u8f93\u5165\u77e9\u9635\u5185\u5bb9\u540e\u518d\u8bc6\u522b\u3002",
  errNoRows: "\u672a\u8bc6\u522b\u5230\u6709\u6548\u884c\uff0c\u8bf7\u68c0\u67e5\u8f93\u5165\u683c\u5f0f\u3002",
  errEmptyCell:
    "\u5b58\u5728\u7a7a\u884c\u6216\u7a7a\u5217\uff0c\u8bf7\u68c0\u67e5\u5206\u9694\u7b26\uff08\u9017\u53f7/\u5206\u53f7\uff09\u3002",
  errNoCols: "\u672a\u8bc6\u522b\u5230\u5217\u6570\u636e\uff0c\u8bf7\u68c0\u67e5\u8f93\u5165\u3002",
  errUneven: "\u5404\u884c\u5217\u6570\u4e0d\u4e00\u81f4\uff0c\u65e0\u6cd5\u751f\u6210\u77e9\u9635\u3002",
  errAugCols: "\u589e\u5e7f\u77e9\u9635\u81f3\u5c11\u9700\u8981\u4e24\u5217\u3002",
  errNoOcr: "图片中未识别到可解析的矩阵文本，请调整拍摄角度或改用文本输入。",
  errScanFail: "图片识别失败，请确认图片清晰、背景干净，或改用文本输入。",
  errNoData: "\u77e9\u9635\u5185\u5bb9\u4e3a\u7a7a\uff0c\u65e0\u6cd5\u4fdd\u5b58\u3002",
} as const;

function splitRowCells(raw: string): string[] {
  const normalized = raw
    .trim()
    .replace(/[()[\]{}]/g, " ")
    .replaceAll("\uFF0C", ",")
    .replaceAll("\uFF1B", ";")
    .replaceAll("\uFF5C", "|")
    .replace(/[−–—]/g, "-");

  if (!normalized) return [];

  if (normalized.includes("\t")) {
    return normalized
      .split(/\t+/)
      .map((cell) => cell.trim())
      .filter(Boolean);
  }

  if (normalized.includes(",")) {
    return normalized
      .split(",")
      .map((cell) => cell.trim())
      .filter(Boolean);
  }

  return normalized
    .split(/\s+/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function normalizeRecognizedMatrixText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replaceAll("\uFF0C", ",")
    .replaceAll("\uFF1B", ";")
    .replaceAll("\uFF5C", "|")
    .replace(/[−–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[·•]/g, ".")
    .split("\n")
    .map((line) =>
      line
        .replace(/[()[\]{}]/g, " ")
        .replace(/(?<=\d)[oO](?=\d)/g, "0")
        .replace(/(?<=\d)[lI](?=\d)/g, "1")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

function parseSmartMatrixText(textInput: string): ParseResult {
  const cleaned = normalizeRecognizedMatrixText(textInput).trim();
  if (!cleaned) {
    return { ok: false, error: text.errEmptyInput };
  }

  const normalized = cleaned
    .replace(/\r\n/g, "\n")
    .replaceAll("\uFF0C", ",")
    .replaceAll("\uFF1B", ";")
    .replaceAll("\uFF5C", "|");

  const rowsRaw =
    normalized.includes("\n")
      ? normalized.split("\n")
      : normalized.includes(";")
        ? normalized.split(";")
        : [normalized];

  const rows = rowsRaw.map((row) => row.trim()).filter(Boolean);
  if (!rows.length) {
    return { ok: false, error: text.errNoRows };
  }

  let sawAugmented = false;
  const parsedRows: string[][] = rows.map((row) => {
    if (!row.includes("|")) {
      return splitRowCells(row);
    }

    sawAugmented = true;
    const [leftRaw, ...restRaw] = row.split("|");
    const rightRaw = restRaw.join("|");
    const leftCells = splitRowCells(leftRaw);
    const rightCells = splitRowCells(rightRaw);
    return [...leftCells, ...rightCells];
  });

  if (parsedRows.some((row) => row.length === 0)) {
    return { ok: false, error: text.errEmptyCell };
  }

  const colCount = parsedRows[0].length;
  if (colCount === 0) {
    return { ok: false, error: text.errNoCols };
  }

  if (parsedRows.some((row) => row.length !== colCount)) {
    return { ok: false, error: text.errUneven };
  }

  if (sawAugmented && colCount < 2) {
    return { ok: false, error: text.errAugCols };
  }

  const limitMessage = getMatrixDimensionLimitMessage(parsedRows, "识别矩阵");
  if (limitMessage) {
    return { ok: false, error: limitMessage };
  }

  return {
    ok: true,
    data: parsedRows,
    type: sawAugmented ? "augmented" : "standard",
  };
}

async function imageFileToOcrDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  try {
    const maxDimension = 1800;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return await fileToDataUrl(file);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;

    for (let index = 0; index < data.length; index += 4) {
      const gray =
        data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      const boosted = gray > 175 ? 255 : gray < 95 ? 0 : gray;
      data[index] = boosted;
      data[index + 1] = boosted;
      data[index + 2] = boosted;
    }

    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unsupported image result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Image read failed"));
    reader.readAsDataURL(file);
  });
}

async function recognizeMatrixTextFromImage(file: File): Promise<string> {
  const [{ createWorker, PSM }, imageUrl] = await Promise.all([
    import("tesseract.js"),
    imageFileToOcrDataUrl(file),
  ]);
  const worker = await createWorker("eng", 1, {
    logger: () => undefined,
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.,;|/+-eE()[]{} \n\t",
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });

    const result = await worker.recognize(imageUrl);
    return normalizeRecognizedMatrixText(result.data.text);
  } finally {
    await worker.terminate();
  }
}

function PreviewGrid({ item }: { item: MatrixRecord }) {
  const previewRows = item.data;
  const previewCols = item.data[0]?.length ?? 0;

  if (previewRows.length === 0 || previewCols === 0) {
    return <div className="text-[11px] text-slate-500">{text.emptyMatrix}</div>;
  }

  return (
    <div className="max-h-36 overflow-auto rounded-lg border border-slate-100 bg-white/70 p-1">
      <div
        className="grid w-max gap-1"
        style={{ gridTemplateColumns: `repeat(${previewCols}, minmax(30px, auto))` }}
      >
        {previewRows.map((row, r) =>
          row.map((value, c) => {
            const markAugmentedDivider = item.type === "augmented" && c === previewCols - 1;
            return (
              <div
                key={`${item.id}-${r}-${c}`}
                className={`rounded-md border border-slate-200 bg-white px-1 py-0.5 text-center font-mono text-[10px] text-slate-700 ${
                  markAugmentedDivider ? "border-l-2 border-l-dashed border-l-slate-400" : ""
                }`}
                title={value}
              >
                {value}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function MatrixShelf({
  items,
  activeMatrixId,
  onActivate,
  onDelete,
  onRename,
  onSmartImport,
}: MatrixShelfProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const [smartOpen, setSmartOpen] = useState(false);
  const [smartStep, setSmartStep] = useState<"input" | "preview">("input");
  const [smartRawText, setSmartRawText] = useState("");
  const [smartDraftName, setSmartDraftName] = useState("\u8bc6\u522b\u77e9\u9635");
  const [smartType, setSmartType] = useState<MatrixKind>("standard");
  const [smartPreview, setSmartPreview] = useState<string[][]>([]);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const itemCountLabel = useMemo(
    () => `${items.length} ${text.countSuffix}`,
    [items.length]
  );

  const startRename = (item: MatrixRecord) => {
    setEditingId(item.id);
    setDraftName(item.name);
  };

  const confirmRename = () => {
    if (!editingId) return;
    onRename(editingId, draftName);
    setEditingId(null);
    setDraftName("");
  };

  const openSmartDialog = () => {
    setSmartOpen(true);
    setSmartStep("input");
    setSmartRawText("");
    setSmartDraftName("\u8bc6\u522b\u77e9\u9635");
    setSmartType("standard");
    setSmartPreview([]);
    setSmartError(null);
  };

  const closeSmartDialog = () => {
    setSmartOpen(false);
    setSmartError(null);
    setScanning(false);
  };

  const buildEditablePreview = (raw: string) => {
    const parsed = parseSmartMatrixText(raw);
    if (!parsed.ok) {
      setSmartError(parsed.error);
      return;
    }

    setSmartPreview(parsed.data.map((row) => row.slice()));
    setSmartType(parsed.type);
    setSmartError(null);
    setSmartStep("preview");
  };

  const triggerImageScan = () => {
    imageInputRef.current?.click();
  };

  const handleScanFromImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setScanning(true);
    setSmartError(null);

    try {
      const recognizedText = await recognizeMatrixTextFromImage(file);

      if (!recognizedText) {
        setSmartError(text.errNoOcr);
        return;
      }

      setSmartRawText(recognizedText);
      buildEditablePreview(recognizedText);
    } catch {
      setSmartError(text.errScanFail);
    } finally {
      setScanning(false);
    }
  };

  const updatePreviewCell = (row: number, col: number, value: string) => {
    setSmartPreview((prev) => {
      const next = prev.map((line) => line.slice());
      next[row][col] = value;
      return next;
    });
  };

  const confirmSmartSave = () => {
    if (!smartPreview.length || !smartPreview[0]?.length) {
      setSmartError(text.errNoData);
      return;
    }

    onSmartImport({
      name: smartDraftName.trim() || "\u8bc6\u522b\u77e9\u9635",
      data: smartPreview,
      type: smartType,
    });
    closeSmartDialog();
  };

  if (collapsed) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
        <button
          onClick={openSmartDialog}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700"
          title={text.smart}
          type="button"
        >
          <Sparkles size={14} />
        </button>
        <button
          onClick={() => setCollapsed(false)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700"
          title={text.expand}
          type="button"
        >
          <ChevronsRight size={16} />
          <span>{items.length}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {text.shelf}
          </div>
          <div className="text-[11px] text-slate-500">{itemCountLabel}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={openSmartDialog}
            className="step-control"
            title={text.smart}
            type="button"
          >
            <Sparkles size={14} />
            {text.smart}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-lg border border-slate-200 p-1 text-slate-600"
            title={text.collapse}
            type="button"
          >
            <ChevronsLeft size={16} />
          </button>
        </div>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">
            {text.noSaved}
          </div>
        ) : null}

        {items.map((item) => {
          const isActive = item.id === activeMatrixId;
          const isEditing = editingId === item.id;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-2 ${
                isActive
                  ? "border-orange-300 bg-orange-50/70"
                  : "border-slate-200 bg-slate-50/70"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                {isEditing ? (
                  <input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmRename();
                      }
                      if (event.key === "Escape") {
                        setEditingId(null);
                        setDraftName("");
                      }
                    }}
                    className="studio-input h-8 text-xs"
                    autoFocus
                  />
                ) : (
                  <div className="truncate font-mono text-xs font-semibold text-slate-800">
                    {item.name}
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <button
                      onClick={confirmRename}
                      className="rounded-md border border-slate-200 p-1 text-slate-700"
                      title={text.saveName}
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => startRename(item)}
                      className="rounded-md border border-slate-200 p-1 text-slate-700"
                      title={text.rename}
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-md border border-rose-200 p-1 text-rose-600"
                    title={text.remove}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <PreviewGrid item={item} />

              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {item.data.length}x{item.data[0]?.length ?? 0}
                </span>
                <span>{item.type === "augmented" ? text.augmented : text.standard}</span>
              </div>

              <button
                onClick={() => onActivate(item)}
                className="mt-2 step-control w-full justify-center"
              >
                {text.active}
              </button>
            </div>
          );
        })}
      </div>

      {smartOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{text.smart}</div>
                <div className="mt-1 text-xs text-slate-500">{text.helper}</div>
              </div>
              <button onClick={closeSmartDialog} className="step-control" type="button">
                {text.close}
              </button>
            </div>

            {smartStep === "input" ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={smartRawText}
                  onChange={(event) => setSmartRawText(event.target.value)}
                  className="studio-input min-h-36 resize-y"
                  placeholder={text.inputPlaceholder}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={triggerImageScan}
                    className="step-control"
                    type="button"
                    disabled={scanning}
                  >
                    <Camera size={14} />
                    {scanning ? text.scanning : text.scan}
                  </button>
                  <button
                    onClick={() => buildEditablePreview(smartRawText)}
                    className="step-control step-control-primary"
                    type="button"
                  >
                    {text.confirmPreview}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_210px]">
                  <div className="matrix-surface">
                    <div className="matrix-scroll">
                      <div
                        className="matrix-grid grid gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${smartPreview[0]?.length ?? 1}, minmax(58px, 1fr))`,
                        }}
                      >
                        {smartPreview.map((row, r) =>
                          row.map((value, c) => {
                            const isAugmentedDivider =
                              smartType === "augmented" &&
                              c === (smartPreview[0]?.length ?? 1) - 1;

                            return (
                              <input
                                key={`smart-${r}-${c}`}
                                value={value}
                                onChange={(event) =>
                                  updatePreviewCell(r, c, event.target.value)
                                }
                                className={`matrix-cell matrix-input ${
                                  isAugmentedDivider ? "matrix-cell-augmented" : ""
                                }`}
                              />
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">{text.matrixName}</label>
                      <input
                        value={smartDraftName}
                        onChange={(event) => setSmartDraftName(event.target.value)}
                        className="studio-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">{text.matrixType}</label>
                      <select
                        value={smartType}
                        onChange={(event) => setSmartType(event.target.value as MatrixKind)}
                        className="studio-select w-full"
                      >
                        <option value="standard">{text.standard}</option>
                        <option value="augmented">{text.augmented}</option>
                      </select>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {text.matrixSize}：{smartPreview.length}x{smartPreview[0]?.length ?? 0}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => setSmartStep("input")}
                        className="step-control"
                        type="button"
                      >
                        {text.backInput}
                      </button>
                      <button
                        onClick={confirmSmartSave}
                        className="step-control step-control-primary"
                        type="button"
                      >
                        {text.saveLibrary}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {smartError ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {smartError}
              </div>
            ) : null}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleScanFromImage}
              className="hidden"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
