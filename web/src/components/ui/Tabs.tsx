'use client';

import { useState, type ReactNode } from 'react';

interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabDef[];
}

export function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-subtle mb-6">
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-accent-primary text-primary'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div role="tabpanel" id={`tabpanel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
          {active.content}
        </div>
      )}
    </div>
  );
}
