"use client";

import {
  createContext,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Delete, Keyboard, MoveLeft, MoveRight, X } from "lucide-react";

type MathInputElement = HTMLInputElement | HTMLTextAreaElement;
type SymbolGroup = "numbers" | "functions" | "letters" | "symbols";
type SymbolAction = "insert" | "backspace" | "moveLeft" | "moveRight";

export type MathInputKind = "expression" | "matrix" | "number" | "text";

type MathInputTarget = {
  id: string;
  kind: MathInputKind;
  element: MathInputElement;
};

type SymbolKey = {
  label: string;
  hint: string;
  action?: SymbolAction;
  insert?: string;
  cursorOffset?: number;
  appendToSelection?: boolean;
  wrapSelection?: boolean;
  wide?: boolean;
};

type MathInputContextValue = {
  hasTarget: boolean;
  isMobileKeyboardMode: boolean;
  keyboardOpenRequest: number;
  targetLabel: string;
  focusTarget: () => void;
  pressKey: (key: SymbolKey) => void;
  registerTarget: (target: MathInputTarget) => void;
};

const MathInputContext = createContext<MathInputContextValue | null>(null);
const MOBILE_KEYBOARD_QUERY = "(hover: none) and (pointer: coarse), (max-width: 768px)";

const GROUPS: Array<{ id: SymbolGroup; label: string }> = [
  { id: "numbers", label: "123" },
  { id: "functions", label: "f(x)" },
  { id: "letters", label: "ABC" },
  { id: "symbols", label: "#&¬" },
];

const CONTROL_KEYS = {
  left: { label: "←", hint: "光标左移", action: "moveLeft" as const },
  right: { label: "→", hint: "光标右移", action: "moveRight" as const },
  backspace: { label: "⌫", hint: "退格", action: "backspace" as const },
};

const KEYBOARD_LAYOUTS: Record<SymbolGroup, SymbolKey[][]> = {
  numbers: [
    [
      { label: "x", insert: "x", hint: "变量 x" },
      { label: "y", insert: "y", hint: "变量 y" },
      { label: "z", insert: "z", hint: "变量 z" },
      { label: "π", insert: "pi", hint: "pi" },
      { label: "7", insert: "7", hint: "7" },
      { label: "8", insert: "8", hint: "8" },
      { label: "9", insert: "9", hint: "9" },
      { label: "×", insert: "*", hint: "乘" },
      { label: "÷", insert: "/", hint: "除" },
    ],
    [
      { label: "x²", insert: "^2", hint: "平方", appendToSelection: true },
      { label: "xⁿ", insert: "^()", hint: "指数", cursorOffset: -1, appendToSelection: true },
      { label: "√", insert: "sqrt()", hint: "sqrt()", cursorOffset: -1, wrapSelection: true },
      { label: "e", insert: "e", hint: "e" },
      { label: "4", insert: "4", hint: "4" },
      { label: "5", insert: "5", hint: "5" },
      { label: "6", insert: "6", hint: "6" },
      { label: "+", insert: "+", hint: "加" },
      { label: "-", insert: "-", hint: "减" },
    ],
    [
      { label: "(", insert: "(", hint: "左括号" },
      { label: ")", insert: ")", hint: "右括号" },
      { label: "|x|", insert: "abs()", hint: "abs()", cursorOffset: -1, wrapSelection: true },
      { label: ",", insert: ",", hint: "逗号" },
      { label: "1", insert: "1", hint: "1" },
      { label: "2", insert: "2", hint: "2" },
      { label: "3", insert: "3", hint: "3" },
      { label: "^", insert: "^", hint: "幂" },
      CONTROL_KEYS.backspace,
    ],
    [
      { label: "sin", insert: "sin()", hint: "sin()", cursorOffset: -1, wrapSelection: true },
      { label: "cos", insert: "cos()", hint: "cos()", cursorOffset: -1, wrapSelection: true },
      { label: "ln", insert: "log()", hint: "log()", cursorOffset: -1, wrapSelection: true },
      { label: ".", insert: ".", hint: "小数点" },
      { label: "0", insert: "0", hint: "0", wide: true },
      CONTROL_KEYS.left,
      CONTROL_KEYS.right,
    ],
  ],
  functions: [
    [
      { label: "sin", insert: "sin()", hint: "sin()", cursorOffset: -1, wrapSelection: true },
      { label: "cos", insert: "cos()", hint: "cos()", cursorOffset: -1, wrapSelection: true },
      { label: "tan", insert: "tan()", hint: "tan()", cursorOffset: -1, wrapSelection: true },
      { label: "cot", insert: "cot()", hint: "cot()", cursorOffset: -1, wrapSelection: true },
      { label: "sec", insert: "sec()", hint: "sec()", cursorOffset: -1, wrapSelection: true },
      { label: "csc", insert: "csc()", hint: "csc()", cursorOffset: -1, wrapSelection: true },
    ],
    [
      { label: "asin", insert: "asin()", hint: "asin()", cursorOffset: -1, wrapSelection: true },
      { label: "acos", insert: "acos()", hint: "acos()", cursorOffset: -1, wrapSelection: true },
      { label: "atan", insert: "atan()", hint: "atan()", cursorOffset: -1, wrapSelection: true },
      { label: "ln", insert: "log()", hint: "mathjs log()", cursorOffset: -1, wrapSelection: true },
      { label: "log₁₀", insert: "log10()", hint: "log10()", cursorOffset: -1, wrapSelection: true },
      { label: "exp", insert: "exp()", hint: "exp()", cursorOffset: -1, wrapSelection: true },
    ],
    [
      { label: "√", insert: "sqrt()", hint: "sqrt()", cursorOffset: -1, wrapSelection: true },
      { label: "∛", insert: "nthRoot(,3)", hint: "nthRoot(,3)", cursorOffset: -3 },
      { label: "|x|", insert: "abs()", hint: "abs()", cursorOffset: -1, wrapSelection: true },
      { label: "min", insert: "min(,)", hint: "min(,)", cursorOffset: -2 },
      { label: "max", insert: "max(,)", hint: "max(,)", cursorOffset: -2 },
      CONTROL_KEYS.backspace,
    ],
    [
      { label: "floor", insert: "floor()", hint: "floor()", cursorOffset: -1, wrapSelection: true },
      { label: "ceil", insert: "ceil()", hint: "ceil()", cursorOffset: -1, wrapSelection: true },
      { label: "round", insert: "round()", hint: "round()", cursorOffset: -1, wrapSelection: true },
      { label: "π", insert: "pi", hint: "pi" },
      CONTROL_KEYS.left,
      CONTROL_KEYS.right,
    ],
  ],
  letters: [
    [
      { label: "x", insert: "x", hint: "x" },
      { label: "y", insert: "y", hint: "y" },
      { label: "z", insert: "z", hint: "z" },
      { label: "a", insert: "a", hint: "a" },
      { label: "b", insert: "b", hint: "b" },
      { label: "c", insert: "c", hint: "c" },
    ],
    [
      { label: "t", insert: "t", hint: "t" },
      { label: "n", insert: "n", hint: "n" },
      { label: "h", insert: "h", hint: "h" },
      { label: "i", insert: "i", hint: "虚数单位 i" },
      { label: "π", insert: "pi", hint: "pi" },
      { label: "e", insert: "e", hint: "e" },
    ],
    [
      { label: "α", insert: "alpha", hint: "alpha" },
      { label: "β", insert: "beta", hint: "beta" },
      { label: "γ", insert: "gamma", hint: "gamma" },
      { label: "θ", insert: "theta", hint: "theta" },
      { label: "λ", insert: "lambda", hint: "lambda" },
      CONTROL_KEYS.backspace,
    ],
    [
      { label: "(", insert: "(", hint: "左括号" },
      { label: ")", insert: ")", hint: "右括号" },
      { label: ",", insert: ",", hint: "逗号" },
      { label: "_", insert: "_", hint: "下划线" },
      CONTROL_KEYS.left,
      CONTROL_KEYS.right,
    ],
  ],
  symbols: [
    [
      { label: "+", insert: "+", hint: "加" },
      { label: "-", insert: "-", hint: "减" },
      { label: "×", insert: "*", hint: "乘" },
      { label: "÷", insert: "/", hint: "除" },
      { label: "^", insert: "^", hint: "幂" },
      { label: "!", insert: "!", hint: "阶乘" },
    ],
    [
      { label: "(", insert: "(", hint: "左括号" },
      { label: ")", insert: ")", hint: "右括号" },
      { label: "[", insert: "[", hint: "左中括号" },
      { label: "]", insert: "]", hint: "右中括号" },
      { label: ",", insert: ",", hint: "逗号" },
      { label: ".", insert: ".", hint: "小数点" },
    ],
    [
      { label: "π", insert: "pi", hint: "pi" },
      { label: "e", insert: "e", hint: "e" },
      { label: "∞", insert: "Infinity", hint: "Infinity" },
      { label: "%", insert: "%", hint: "百分号" },
      { label: "=", insert: "=", hint: "等号" },
      CONTROL_KEYS.backspace,
    ],
    [
      { label: "abs", insert: "abs()", hint: "abs()", cursorOffset: -1, wrapSelection: true },
      { label: "mod", insert: "mod(,)", hint: "mod(,)", cursorOffset: -2 },
      { label: ":", insert: ":", hint: "冒号" },
      { label: ";", insert: ";", hint: "分号" },
      CONTROL_KEYS.left,
      CONTROL_KEYS.right,
    ],
  ],
};

const fabStyle: CSSProperties = {
  position: "fixed",
  right: "max(1rem, env(safe-area-inset-right))",
  bottom: "calc(1rem + env(safe-area-inset-bottom))",
  zIndex: 80,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3.2rem",
  height: "3.2rem",
  border: "1px solid rgb(15 23 42 / 0.14)",
  borderRadius: 9999,
  background: "rgb(15 23 42)",
  color: "white",
  boxShadow: "0 18px 35px -20px rgb(15 23 42 / 0.95)",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  right: "50%",
  bottom: 0,
  zIndex: 75,
  width: "min(980px, calc(100vw - 1rem))",
  transform: "translateX(50%)",
  border: "1px solid rgb(15 23 42 / 0.1)",
  borderBottom: "none",
  borderRadius: "1rem 1rem 0 0",
  background: "rgb(239 240 246 / 0.98)",
  padding: "0.7rem 0.85rem calc(0.75rem + env(safe-area-inset-bottom))",
  boxShadow: "0 -18px 42px -36px rgb(15 23 42 / 0.75)",
};

const tabRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.55rem",
};

const keyboardRowsStyle: CSSProperties = {
  display: "grid",
  gap: "0.42rem",
  marginTop: "0.62rem",
};

const keyboardRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(9, minmax(2.2rem, 1fr))",
  gap: "0.42rem",
};

const keyStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: "3.75rem",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgb(15 23 42 / 0.06)",
  borderRadius: "0.7rem",
  background: "white",
  color: "rgb(15 23 42)",
  fontFamily: "var(--font-mono)",
  fontSize: "1.18rem",
  fontWeight: 700,
  boxShadow: "0 1px 0 rgb(15 23 42 / 0.04)",
};

const controlKeyStyle: CSSProperties = {
  ...keyStyle,
  background: "rgb(209 210 216)",
};

function isMathInputElement(target: EventTarget | null): target is MathInputElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }

  if (target.disabled || target.readOnly) return false;
  if (target.type && ["button", "checkbox", "radio", "range", "submit"].includes(target.type)) {
    return false;
  }

  return (
    target.classList.contains("studio-input") ||
    target.classList.contains("matrix-input") ||
    target.dataset.mathInput === "true"
  );
}

function applyMobileInputMode(element: MathInputElement, enabled: boolean) {
  if (enabled) {
    if (!element.dataset.previousInputMode) {
      element.dataset.previousInputMode = element.getAttribute("inputmode") ?? "";
    }
    element.setAttribute("inputmode", "none");
    element.autocomplete = "off";
    element.spellcheck = false;
    return;
  }

  if (!("previousInputMode" in element.dataset)) return;
  const previous = element.dataset.previousInputMode;
  if (previous) {
    element.setAttribute("inputmode", previous);
  } else {
    element.removeAttribute("inputmode");
  }
  delete element.dataset.previousInputMode;
}

function applyMobileInputModeToPage(enabled: boolean) {
  document
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      ".studio-input, .matrix-input, [data-math-input='true']"
    )
    .forEach((element) => {
      if (isMathInputElement(element)) applyMobileInputMode(element, enabled);
    });
}

function inferInputKind(element: MathInputElement): MathInputKind {
  if (element.classList.contains("matrix-input")) return "matrix";
  if (element.tagName === "TEXTAREA") return "text";
  if (element.classList.contains("font-mono")) return "expression";
  return "number";
}

function getElementLabel(element: MathInputElement, kind: MathInputKind): string {
  if (element.getAttribute("aria-label")) return element.getAttribute("aria-label") ?? "当前输入框";
  if (kind === "matrix") return "矩阵单元格";
  if (kind === "text") return "文本输入框";
  if (kind === "expression") return "表达式输入框";
  return "数学输入框";
}

function getNativeValueSetter(element: MathInputElement) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(prototype, "value")?.set;
}

function dispatchInput(element: MathInputElement, value: string) {
  const setter = getNativeValueSetter(element);
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  const inputEvent =
    typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })
      : new Event("input", { bubbles: true });
  element.dispatchEvent(inputEvent);
}

function focusWithCaret(element: MathInputElement, cursor: number) {
  element.focus({ preventScroll: true });
  element.setSelectionRange(cursor, cursor);

  window.requestAnimationFrame(() => {
    element.focus({ preventScroll: true });
    element.setSelectionRange(cursor, cursor);
  });
}

function insertIntoElement(element: MathInputElement, key: SymbolKey) {
  if (!key.insert) return;

  const value = element.value;
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? start;
  const selected = value.slice(start, end);
  const insertion =
    key.wrapSelection && selected
      ? key.insert.replace("()", `(${selected})`)
      : key.appendToSelection && selected
        ? `${selected}${key.insert}`
        : key.insert;
  const next = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
  const baseCursor = start + insertion.length;
  const nextCursor = key.wrapSelection && selected
    ? start + insertion.length
    : baseCursor + (key.cursorOffset ?? 0);

  dispatchInput(element, next);
  focusWithCaret(element, Math.max(0, Math.min(next.length, nextCursor)));
}

function backspaceElement(element: MathInputElement) {
  const value = element.value;
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? start;

  if (start !== end) {
    const next = `${value.slice(0, start)}${value.slice(end)}`;
    dispatchInput(element, next);
    focusWithCaret(element, start);
    return;
  }

  if (start <= 0) {
    focusWithCaret(element, 0);
    return;
  }

  const next = `${value.slice(0, start - 1)}${value.slice(end)}`;
  dispatchInput(element, next);
  focusWithCaret(element, start - 1);
}

function moveCursor(element: MathInputElement, direction: -1 | 1) {
  const value = element.value;
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? start;
  const nextCursor = direction < 0
    ? Math.max(0, start === end ? start - 1 : start)
    : Math.min(value.length, start === end ? end + 1 : end);

  focusWithCaret(element, nextCursor);
}

function runKeyAction(element: MathInputElement, key: SymbolKey) {
  if (key.action === "backspace") {
    backspaceElement(element);
    return;
  }

  if (key.action === "moveLeft") {
    moveCursor(element, -1);
    return;
  }

  if (key.action === "moveRight") {
    moveCursor(element, 1);
    return;
  }

  insertIntoElement(element, key);
}

export function MathInputProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<MathInputTarget | null>(null);
  const [isMobileKeyboardMode, setIsMobileKeyboardMode] = useState(false);
  const [keyboardOpenRequest, setKeyboardOpenRequest] = useState(0);
  const targetRef = useRef<MathInputTarget | null>(null);

  const registerTarget = useCallback((nextTarget: MathInputTarget) => {
    targetRef.current = nextTarget;
    setTarget(nextTarget);
  }, []);

  const focusTarget = useCallback(() => {
    const current = targetRef.current;
    if (!current || !document.contains(current.element)) return;
    current.element.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_KEYBOARD_QUERY);
    const syncMobileMode = () => {
      setIsMobileKeyboardMode(mobileQuery.matches);
      applyMobileInputModeToPage(mobileQuery.matches);
    };

    syncMobileMode();
    mobileQuery.addEventListener("change", syncMobileMode);

    const observer = new MutationObserver(() => {
      applyMobileInputModeToPage(mobileQuery.matches);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileQuery.matches || !isMathInputElement(event.target)) return;
      applyMobileInputMode(event.target, true);
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isMathInputElement(event.target)) return;

      const element = event.target;
      applyMobileInputMode(element, mobileQuery.matches);
      registerTarget({
        id: element.id || element.name || element.getAttribute("aria-label") || `math-input-${Date.now()}`,
        kind: inferInputKind(element),
        element,
      });
      if (mobileQuery.matches) {
        setKeyboardOpenRequest((current) => current + 1);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      observer.disconnect();
      mobileQuery.removeEventListener("change", syncMobileMode);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      applyMobileInputModeToPage(false);
    };
  }, [registerTarget]);

  const pressKey = useCallback((key: SymbolKey) => {
    const current = targetRef.current;
    if (!current || !document.contains(current.element)) return;
    runKeyAction(current.element, key);
  }, []);

  const value = useMemo<MathInputContextValue>(() => {
    const validTarget =
      target && typeof document !== "undefined" && document.contains(target.element)
        ? target
        : null;
    return {
      hasTarget: Boolean(validTarget),
      isMobileKeyboardMode,
      keyboardOpenRequest,
      targetLabel: validTarget ? getElementLabel(validTarget.element, validTarget.kind) : "先选择输入框",
      focusTarget,
      pressKey,
      registerTarget,
    };
  }, [focusTarget, isMobileKeyboardMode, keyboardOpenRequest, pressKey, registerTarget, target]);

  return <MathInputContext.Provider value={value}>{children}</MathInputContext.Provider>;
}

export function useMathInputTarget<T extends MathInputElement>({
  id,
  kind = "expression",
}: {
  id: string;
  kind?: MathInputKind;
}): {
  ref: MutableRefObject<T | null>;
  onFocus: () => void;
  onSelect: () => void;
} {
  const context = useContext(MathInputContext);
  const ref = useRef<T | null>(null);
  const register = useCallback(() => {
    if (!context || !ref.current) return;
    context.registerTarget({ id, kind, element: ref.current });
  }, [context, id, kind]);

  return {
    ref,
    onFocus: register,
    onSelect: register,
  };
}

function renderKeyIcon(key: SymbolKey) {
  if (key.action === "moveLeft") return <MoveLeft size={23} />;
  if (key.action === "moveRight") return <MoveRight size={23} />;
  if (key.action === "backspace") return <Delete size={24} />;
  return key.label;
}

export function SymbolKeyboard() {
  const context = useContext(MathInputContext);
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<SymbolGroup>("numbers");
  const hasTarget = context?.hasTarget ?? false;
  const isMobileKeyboardMode = context?.isMobileKeyboardMode ?? false;
  const keyboardOpenRequest = context?.keyboardOpenRequest ?? 0;
  const focusTarget = context?.focusTarget;

  useEffect(() => {
    if (!isMobileKeyboardMode || !hasTarget) return undefined;

    const frame = window.requestAnimationFrame(() => {
      setIsOpen(true);
      focusTarget?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTarget, hasTarget, isMobileKeyboardMode, keyboardOpenRequest]);

  useEffect(() => {
    document.body.classList.toggle("symbol-keyboard-open", isOpen);
    return () => document.body.classList.remove("symbol-keyboard-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="symbol-keyboard-fab"
        style={fabStyle}
        aria-label={isOpen ? "收起符号键盘" : "打开符号键盘"}
        title={isOpen ? "收起符号键盘" : "打开符号键盘"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setIsOpen((current) => !current);
          window.requestAnimationFrame(() => context?.focusTarget());
        }}
      >
        {isOpen ? <X size={22} /> : <Keyboard size={22} />}
      </button>

      {isOpen ? (
        <section className="symbol-keyboard-panel" style={panelStyle} aria-label="符号键盘">
          <div className="symbol-keyboard-tabs" style={tabRowStyle} role="tablist" aria-label="符号分组">
            {GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={activeGroup === group.id}
                className={`symbol-keyboard-tab ${activeGroup === group.id ? "symbol-keyboard-tab-active" : ""}`}
                style={{
                  border: 0,
                  borderRadius: 9999,
                  background: activeGroup === group.id ? "rgb(153 135 245)" : "transparent",
                  color: "rgb(15 23 42)",
                  padding: "0.28rem 0.86rem",
                  fontSize: "1.08rem",
                  fontWeight: activeGroup === group.id ? 700 : 600,
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setActiveGroup(group.id);
                  context?.focusTarget();
                }}
              >
                {group.label}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                {context?.targetLabel ?? "先选择输入框"}
              </span>
              <button
                type="button"
                className="symbol-keyboard-close"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  border: 0,
                  borderRadius: 9999,
                  background: "transparent",
                  color: "rgb(51 65 85)",
                }}
                aria-label="关闭符号键盘面板"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setIsOpen(false);
                  window.requestAnimationFrame(() => context?.focusTarget());
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="symbol-keyboard-rows" style={keyboardRowsStyle}>
            {KEYBOARD_LAYOUTS[activeGroup].map((row, rowIndex) => (
              <div key={`${activeGroup}-${rowIndex}`} className="symbol-keyboard-row" style={keyboardRowStyle}>
                {row.map((key, keyIndex) => {
                  const isControl = key.action === "backspace" || key.action === "moveLeft" || key.action === "moveRight";
                  return (
                    <button
                      key={`${activeGroup}-${rowIndex}-${key.label}-${keyIndex}`}
                      type="button"
                      className={`symbol-key ${isControl ? "symbol-key-control" : ""}`}
                      style={{
                        ...(isControl ? controlKeyStyle : keyStyle),
                        gridColumn: key.wide ? "span 2" : undefined,
                      }}
                      title={hasTarget ? key.hint : "先选择输入框"}
                      aria-label={`插入 ${key.hint}`}
                      disabled={!hasTarget}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => context?.pressKey(key)}
                    >
                      {renderKeyIcon(key)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
