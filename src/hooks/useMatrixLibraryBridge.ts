"use client";

import { useCallback, useMemo } from "react";

import { getMatrixDimensionLimitMessage } from "@/config/matrix-limits";
import { resizeInputMatrix } from "@/lib/matrix-format";
import {
  type ActiveContext,
  type MatrixKind,
  type MatrixRecord,
  suggestNameForContext,
  useMatrixLibraryStore,
} from "@/store/matrix-library";
import type { TabId, DecompositionMode, EigenPerturbationResult } from "@/types/workbench";
import type { ToastPayload } from "@/hooks/useToastQueue";

type OperationsBridge = {
  matrixA: string[][];
  matrixB: string[][];
  setMatrixA: (matrix: string[][]) => void;
  setMatrixB: (matrix: string[][]) => void;
};

type SystemBridge = {
  augmented: string[][];
  setAugmentedMatrix: (matrix: string[][]) => void;
};

type DeterminantBridge = {
  matrix: string[][];
  setSize: (size: number) => void;
  setMatrix: (matrix: string[][]) => void;
  setResult: (result: string | null) => void;
};

type DecompositionBridge = {
  mode: DecompositionMode;
  matrix: string[][];
  setRows: (rows: number) => void;
  setCols: (cols: number) => void;
  setMatrix: (matrix: string[][]) => void;
  setResult: (result: null) => void;
};

type EigenBridge = {
  matrix: string[][];
  setSize: (size: number) => void;
  setMatrix: (matrix: string[][]) => void;
  resizeVectorB: (size: number) => void;
  setPerturbationResult: (result: EigenPerturbationResult | null) => void;
};

type UseMatrixLibraryBridgeOptions = {
  activeTab: TabId;
  activeOperationTarget: "A" | "B";
  setActiveOperationTarget: (target: "A" | "B") => void;
  operations: OperationsBridge;
  system: SystemBridge;
  determinant: DeterminantBridge;
  decomposition: DecompositionBridge;
  eigen: EigenBridge;
  pushToast: (payload: ToastPayload) => void;
};

function cloneMatrixValues(matrix: string[][]): string[][] {
  return matrix.map((row) => row.map((value) => value || "0"));
}

function inferMatrixKindByContext(context: ActiveContext): MatrixKind {
  return context === "linear-system" ? "augmented" : "standard";
}

function getActiveLibraryContext(activeTab: TabId): ActiveContext {
  if (activeTab === "operations") return "matrix-operations";
  if (activeTab === "system") return "linear-system";
  if (activeTab === "determinant") return "determinant";
  if (activeTab === "decomposition") return "decomposition";
  return "eigen";
}

export function useMatrixLibraryBridge({
  activeTab,
  activeOperationTarget,
  setActiveOperationTarget,
  operations,
  system,
  determinant,
  decomposition,
  eigen,
  pushToast,
}: UseMatrixLibraryBridgeOptions) {
  const {
    matrixA: operationsMatrixA,
    matrixB: operationsMatrixB,
    setMatrixA,
    setMatrixB,
  } = operations;
  const { augmented, setAugmentedMatrix } = system;
  const {
    matrix: determinantMatrix,
    setSize: setDeterminantSize,
    setMatrix: setDeterminantMatrix,
    setResult: setDeterminantResult,
  } = determinant;
  const {
    mode: decompositionMode,
    matrix: decompositionMatrix,
    setRows: setDecompositionRows,
    setCols: setDecompositionCols,
    setMatrix: setDecompositionMatrix,
    setResult: setDecompositionResult,
  } = decomposition;
  const {
    matrix: eigenMatrix,
    setSize: setEigenSize,
    setMatrix: setEigenMatrix,
    resizeVectorB,
    setPerturbationResult,
  } = eigen;

  const matrixInventory = useMatrixLibraryStore((state) => state.matrixInventory);
  const activeMatrixId = useMatrixLibraryStore((state) => state.activeMatrixId);
  const renameInventoryMatrix = useMatrixLibraryStore((state) => state.renameMatrix);
  const deleteInventoryMatrix = useMatrixLibraryStore((state) => state.deleteMatrix);
  const addInventoryMatrix = useMatrixLibraryStore((state) => state.addMatrix);
  const setInventoryActiveMatrix = useMatrixLibraryStore((state) => state.setActiveMatrix);
  const saveCurrentResultToLibrary = useMatrixLibraryStore(
    (state) => state.saveCurrentResultToLibrary
  );

  const activeLibraryContext = useMemo(
    () => getActiveLibraryContext(activeTab),
    [activeTab]
  );

  const currentInputName = useMemo(
    () => suggestNameForContext(matrixInventory, activeLibraryContext),
    [activeLibraryContext, matrixInventory]
  );

  const loadMatrixToOperationsA = useCallback(
    (matrixData: string[][]) => {
      setMatrixA(cloneMatrixValues(matrixData));
      setActiveOperationTarget("A");
    },
    [setActiveOperationTarget, setMatrixA]
  );

  const loadMatrixToOperationsB = useCallback(
    (matrixData: string[][]) => {
      setMatrixB(cloneMatrixValues(matrixData));
      setActiveOperationTarget("B");
    },
    [setActiveOperationTarget, setMatrixB]
  );

  const loadMatrixToContext = useCallback(
    (matrixData: string[][], context: ActiveContext = activeLibraryContext) => {
      const limitMessage = getMatrixDimensionLimitMessage(matrixData, "加载矩阵");
      if (limitMessage) {
        pushToast({
          tone: "warning",
          title: "矩阵尺寸过大",
          message: limitMessage,
        });
        return;
      }

      const copied = cloneMatrixValues(matrixData);

      if (context === "matrix-operations") {
        if (activeOperationTarget === "B") {
          loadMatrixToOperationsB(copied);
          return;
        }
        loadMatrixToOperationsA(copied);
        return;
      }

      if (context === "linear-system") {
        if ((copied[0]?.length ?? 0) < 2) return;
        setAugmentedMatrix(copied);
        return;
      }

      if (context === "determinant") {
        const size = Math.max(copied.length, copied[0]?.length ?? 1);
        setDeterminantSize(size);
        setDeterminantMatrix(resizeInputMatrix(copied, size, size, "0"));
        setDeterminantResult(null);
        return;
      }

      if (context === "eigen") {
        const size = Math.max(copied.length, copied[0]?.length ?? 1);
        setEigenSize(size);
        setEigenMatrix(resizeInputMatrix(copied, size, size, "0"));
        resizeVectorB(size);
        setPerturbationResult(null);
        return;
      }

      if (
        decompositionMode === "qr" ||
        decompositionMode === "svd" ||
        copied.length !== copied[0]?.length
      ) {
        const rows = Math.max(1, copied.length);
        const cols = Math.max(1, copied[0]?.length ?? 1);
        setDecompositionRows(rows);
        setDecompositionCols(cols);
        setDecompositionMatrix(resizeInputMatrix(copied, rows, cols, "0"));
        setDecompositionResult(null);
        return;
      }

      const size = Math.max(copied.length, copied[0]?.length ?? 1);
      setDecompositionRows(size);
      setDecompositionCols(size);
      setDecompositionMatrix(resizeInputMatrix(copied, size, size, "0"));
      setDecompositionResult(null);
    },
    [
      activeLibraryContext,
      activeOperationTarget,
      decompositionMode,
      loadMatrixToOperationsA,
      loadMatrixToOperationsB,
      pushToast,
      resizeVectorB,
      setAugmentedMatrix,
      setDecompositionCols,
      setDecompositionMatrix,
      setDecompositionResult,
      setDecompositionRows,
      setDeterminantMatrix,
      setDeterminantResult,
      setDeterminantSize,
      setEigenMatrix,
      setEigenSize,
      setPerturbationResult,
    ]
  );

  const saveMatrixWithName = useCallback(
    (
      rawMatrix: string[][] | null,
      preferredName: string,
      context: ActiveContext,
      type?: MatrixKind
    ) => {
      return saveCurrentResultToLibrary(
        rawMatrix,
        context,
        type ?? inferMatrixKindByContext(context),
        preferredName
      );
    },
    [saveCurrentResultToLibrary]
  );

  const handleActivateInventoryMatrix = useCallback(
    (item: Pick<MatrixRecord, "id" | "data" | "type">) => {
      setInventoryActiveMatrix(item.id, activeLibraryContext);
      loadMatrixToContext(item.data, activeLibraryContext);
    },
    [activeLibraryContext, loadMatrixToContext, setInventoryActiveMatrix]
  );

  const handleSmartImportMatrix = useCallback(
    (payload: { name: string; data: string[][]; type: MatrixKind }) => {
      const created = addInventoryMatrix({
        name: payload.name,
        data: payload.data,
        type: payload.type,
      });

      if (!created) {
        pushToast({
          tone: "error",
          title: "智能识别",
          message: "识别矩阵保存失败，请检查矩阵是否为规则二维结构。",
        });
        return;
      }

      setInventoryActiveMatrix(created.id, activeLibraryContext);
      loadMatrixToContext(created.data, activeLibraryContext);
      pushToast({
        tone: "success",
        title: "智能识别",
        message: `已保存矩阵「${created.name}」并加载到当前模块。`,
      });
    },
    [
      activeLibraryContext,
      addInventoryMatrix,
      loadMatrixToContext,
      pushToast,
      setInventoryActiveMatrix,
    ]
  );

  const handleSaveCurrentInputToLibrary = useCallback(
    (name: string) => {
      const activeEditingMatrix =
        activeLibraryContext === "matrix-operations"
          ? activeOperationTarget === "B"
            ? operationsMatrixB
            : operationsMatrixA
          : activeLibraryContext === "linear-system"
            ? augmented
            : activeLibraryContext === "determinant"
              ? determinantMatrix
              : activeLibraryContext === "decomposition"
                ? decompositionMatrix
                : eigenMatrix;

      saveMatrixWithName(
        activeEditingMatrix,
        name,
        activeLibraryContext,
        inferMatrixKindByContext(activeLibraryContext)
      );
    },
    [
      activeLibraryContext,
      activeOperationTarget,
      augmented,
      decompositionMatrix,
      determinantMatrix,
      eigenMatrix,
      operationsMatrixA,
      operationsMatrixB,
      saveMatrixWithName,
    ]
  );

  const saveMatrixDirectly = useCallback(
    (matrixData: string[][], name: string, type: MatrixKind = "standard") =>
      addInventoryMatrix({ name, data: matrixData, type }),
    [addInventoryMatrix]
  );

  return {
    activeLibraryContext,
    currentInputName,
    matrixInventory,
    activeMatrixId,
    renameInventoryMatrix,
    deleteInventoryMatrix,
    addInventoryMatrix,
    loadMatrixToOperationsA,
    loadMatrixToOperationsB,
    loadMatrixToContext,
    saveMatrixWithName,
    saveMatrixDirectly,
    handleActivateInventoryMatrix,
    handleSmartImportMatrix,
    handleSaveCurrentInputToLibrary,
  };
}
