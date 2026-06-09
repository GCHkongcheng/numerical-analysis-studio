"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MatrixHistorySnapshot } from "@/hooks/useMatrix";
import type { EigenAnalysisResult } from "@/types/matrix";
import type {
  DecompositionMode,
  DecompositionResult,
  EigenPerturbationResult,
  HistoryState,
} from "@/types/workbench";
import { HISTORY_LIMIT } from "@/types/workbench";

export type WorkbenchLocalHistorySnapshot = {
  showCorrectnessPanel: boolean;
  activeOperationTarget: "A" | "B";
  determinant: {
    size: number;
    matrix: string[][];
    result: string | null;
  };
  decomposition: {
    mode: DecompositionMode;
    rows: number;
    cols: number;
    matrix: string[][];
    result: DecompositionResult | null;
  };
  eigen: {
    size: number;
    matrix: string[][];
    result: EigenAnalysisResult | null;
    vectorB: string[];
    perturbationResult: EigenPerturbationResult | null;
  };
};

type WorkbenchHistorySnapshot = {
  matrix: MatrixHistorySnapshot;
  local: WorkbenchLocalHistorySnapshot;
};

type WorkbenchHistoryEntry = {
  key: string;
  snapshot: WorkbenchHistorySnapshot;
};

type UseWorkbenchHistoryOptions = {
  matrixSnapshot: MatrixHistorySnapshot;
  localSnapshot: WorkbenchLocalHistorySnapshot;
  restoreMatrixSnapshot: (snapshot: MatrixHistorySnapshot) => void;
  restoreLocalSnapshot: (snapshot: WorkbenchLocalHistorySnapshot) => void;
  limit?: number;
};

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function useWorkbenchHistory({
  matrixSnapshot,
  localSnapshot,
  restoreMatrixSnapshot,
  restoreLocalSnapshot,
  limit = HISTORY_LIMIT,
}: UseWorkbenchHistoryOptions) {
  const historyStackRef = useRef<WorkbenchHistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const historyApplyingRef = useRef(false);
  const [historyState, setHistoryState] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    index: 0,
    total: 0,
  });

  const syncHistoryState = useCallback(() => {
    const total = historyStackRef.current.length;
    const index = historyIndexRef.current;
    setHistoryState({
      canUndo: index > 0,
      canRedo: index >= 0 && index < total - 1,
      index: total === 0 || index < 0 ? 0 : index + 1,
      total,
    });
  }, []);

  const historySnapshot = useMemo<WorkbenchHistorySnapshot>(
    () => ({
      matrix: matrixSnapshot,
      local: localSnapshot,
    }),
    [localSnapshot, matrixSnapshot]
  );

  const historySnapshotKey = useMemo(
    () => JSON.stringify(historySnapshot),
    [historySnapshot]
  );

  const applyHistorySnapshot = useCallback(
    (snapshot: WorkbenchHistorySnapshot) => {
      historyApplyingRef.current = true;
      restoreMatrixSnapshot(deepClone(snapshot.matrix));
      restoreLocalSnapshot(deepClone(snapshot.local));
    },
    [restoreLocalSnapshot, restoreMatrixSnapshot]
  );

  const undoHistory = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const target = historyStackRef.current[historyIndexRef.current]?.snapshot;
    if (!target) return;
    applyHistorySnapshot(deepClone(target));
    syncHistoryState();
  }, [applyHistorySnapshot, syncHistoryState]);

  const redoHistory = useCallback(() => {
    const nextIndex = historyIndexRef.current + 1;
    if (nextIndex >= historyStackRef.current.length) return;
    historyIndexRef.current = nextIndex;
    const target = historyStackRef.current[nextIndex]?.snapshot;
    if (!target) return;
    applyHistorySnapshot(deepClone(target));
    syncHistoryState();
  }, [applyHistorySnapshot, syncHistoryState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoHistory();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoHistory();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoHistory, undoHistory]);

  useEffect(() => {
    const currentStack = historyStackRef.current;

    if (currentStack.length === 0) {
      historyStackRef.current = [
        { key: historySnapshotKey, snapshot: deepClone(historySnapshot) },
      ];
      historyIndexRef.current = 0;
      syncHistoryState();
      return;
    }

    if (historyApplyingRef.current) {
      historyApplyingRef.current = false;
      syncHistoryState();
      return;
    }

    const current = currentStack[historyIndexRef.current];
    if (current?.key === historySnapshotKey) {
      syncHistoryState();
      return;
    }

    let nextStack = currentStack.slice(0, historyIndexRef.current + 1);
    nextStack.push({
      key: historySnapshotKey,
      snapshot: deepClone(historySnapshot),
    });

    if (nextStack.length > limit) {
      nextStack = nextStack.slice(nextStack.length - limit);
    }

    historyStackRef.current = nextStack;
    historyIndexRef.current = nextStack.length - 1;
    syncHistoryState();
  }, [historySnapshot, historySnapshotKey, limit, syncHistoryState]);

  return {
    historyState,
    undoHistory,
    redoHistory,
  };
}
