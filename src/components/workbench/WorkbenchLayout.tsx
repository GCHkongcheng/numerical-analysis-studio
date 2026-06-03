import type { ReactNode } from "react";

import { MathInputProvider, SymbolKeyboard } from "@/components/common/SymbolKeyboard";
import { ToastHost, type ToastItem } from "@/components/matrix/ToastHost";

type WorkbenchLayoutProps = {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  toasts: ToastItem[];
  onDismissToast: (id: number) => void;
};

export function WorkbenchLayout({
  header,
  sidebar,
  children,
  toasts,
  onDismissToast,
}: WorkbenchLayoutProps) {
  return (
    <MathInputProvider>
      <div className="min-h-screen px-4 py-6 md:px-6 md:py-10 text-[15px] text-slate-900">
      {header}

      <div className="mx-auto mt-8 grid w-full max-w-[1540px] gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        {sidebar}
        <main>{children}</main>
      </div>

      <ToastHost toasts={toasts} onDismiss={onDismissToast} />
      <SymbolKeyboard />

      <footer className="mx-auto mt-10 w-full max-w-[1540px] rounded-3xl border border-border-soft bg-surface-strong px-6 py-4 text-xs text-text-muted">
        数值分析工作流 · 默认启用可验证计算
      </footer>
      </div>
    </MathInputProvider>
  );
}
