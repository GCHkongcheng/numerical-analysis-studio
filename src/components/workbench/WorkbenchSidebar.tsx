import { X } from "lucide-react";
import type { ReactNode } from "react";

import { SIDEBAR_TOOL_TABS } from "@/config/workbench";
import type { NavSection, SidebarToolTab, TabId } from "@/types/workbench";

type WorkbenchSidebarProps = {
  activeTab: TabId;
  activeToolTab: SidebarToolTab;
  activeNavSection: NavSection;
  isOpen: boolean;
  children: ReactNode;
  onClose: () => void;
  onTabSwitch: (tab: TabId) => void;
  onToolTabChange: (tab: SidebarToolTab) => void;
};

export function WorkbenchSidebar({
  activeTab,
  activeToolTab,
  activeNavSection,
  isOpen,
  children,
  onClose,
  onTabSwitch,
  onToolTabChange,
}: WorkbenchSidebarProps) {
  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
          isOpen
            ? "pointer-events-auto bg-slate-900/35 opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-label="关闭导航菜单"
        onClick={onClose}
      />

      <aside
        className={`studio-card space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:translate-x-0 ${
          isOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] overflow-y-auto rounded-none border-r border-slate-200 pb-6 pt-4 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] transform-gpu will-change-transform lg:visible lg:static lg:w-auto lg:rounded-3xl lg:border lg:border-slate-200 lg:p-5 lg:shadow-none`}
      >
        <div className="mb-1 flex items-center justify-between lg:hidden">
          <div className="text-sm font-semibold text-slate-700">导航菜单</div>
          <button
            type="button"
            onClick={onClose}
            className="step-control"
            aria-label="关闭导航菜单"
          >
            <X size={14} />
            关闭
          </button>
        </div>

        <div className="space-y-3">
          <div 
            role="tablist"
            aria-label="工具菜单"
            className="flex rounded-2xl border border-border-soft bg-surface-muted p-1"
          >
            {SIDEBAR_TOOL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeToolTab === tab.id}
                onClick={() => onToolTabChange(tab.id)}
                className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-all duration-200 active:scale-97 ${
                  activeToolTab === tab.id
                    ? "bg-surface-strong text-foreground shadow-sm"
                    : "text-text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeToolTab === "nav" ? (
            <div className="space-y-2">
              <div className="px-1 text-[11px] font-semibold tracking-wide text-text-muted">
                {activeNavSection.title}
              </div>
              <div className="grid gap-2">
                {activeNavSection.items.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabSwitch(tab.id)}
                      className={`nav-tab ${activeTab === tab.id ? "nav-tab-active" : ""}`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="min-w-0">
                        <span className="block">{tab.label}</span>
                        <span
                          className={`block text-[11px] font-medium ${
                            activeTab === tab.id ? "text-slate-200" : "text-text-muted"
                          }`}
                        >
                          {tab.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {children}
        </div>
      </aside>
    </>
  );
}
