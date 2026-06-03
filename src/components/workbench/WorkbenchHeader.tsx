import { CircleHelp, Menu } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/common/ThemeToggle";
import type { NavSection } from "@/types/workbench";

type WorkbenchHeaderProps = {
  navSections: NavSection[];
  activeSectionTitle?: string;
  onOpenNavDrawer: () => void;
  onSectionSwitch: (sectionTitle: string) => void;
};

export function WorkbenchHeader({
  navSections,
  activeSectionTitle,
  onOpenNavDrawer,
  onSectionSwitch,
}: WorkbenchHeaderProps) {
  return (
    <header className="mx-auto w-full max-w-[1540px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNavDrawer}
            className="step-control lg:hidden"
            aria-label="打开导航菜单"
          >
            <Menu size={14} />
            菜单
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
            数值分析实验室
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/about" className="header-icon-action step-control" aria-label="打开关于页面">
            <CircleHelp size={14} />
            <span className="header-action-label">关于页面</span>
          </Link>
        </div>
      </div>
      <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
        数值分析工作台
      </h1>
      <p className="max-w-3xl text-base text-slate-700">
        按数值分析学习路径组织功能：从数值线性代数出发，继续探索非线性方程、插值逼近、数值积分、常微分方程，以及误差与稳定性分析。
      </p>
      <div 
        role="tablist"
        aria-label="数值分析路径导航"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-border-soft bg-surface/90 p-2 sticky top-2 z-30 backdrop-blur-md shadow-sm"
      >
        {navSections.map((section) => {
          const isActive = section.title === activeSectionTitle;
          return (
            <button
              key={section.title}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSectionSwitch(section.title)}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 ${
                isActive
                  ? "bg-accent text-white dark:text-slate-950 shadow-sm"
                  : "text-text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {section.title}
            </button>
          );
        })}
      </div>
    </header>
  );
}
