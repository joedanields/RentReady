/** Tabs — WAI-ARIA tabs pattern (roving tabindex, arrow keys) */

import React, { useRef } from 'react';
import { clsx } from 'clsx';

export interface TabDef {
  id: string;
  label: string;
  controlId: string;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
  label,
  idPrefix = 'tab',
  children,
}: {
  tabs: TabDef[];
  activeId: string;
  onChange: (id: string) => void;
  /** Accessible name of the tablist (translated by the caller). */
  label: string;
  /** Namespaces element ids so two tab sets can't collide. */
  idPrefix?: string;
  children?: React.ReactNode;
}) {
  const tabDomId = (id: string) => `${idPrefix}-${id}`;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;

    e.preventDefault();
    const def = tabs[next];
    if (def) {
      onChange(def.id);
      tabRefs.current[def.id]?.focus();
    }
  };

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="flex border-b border-border">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={el => {
              tabRefs.current[tab.id] = el;
            }}
            role="tab"
            id={tabDomId(tab.id)}
            aria-controls={tab.controlId}
            aria-selected={activeId === tab.id}
            tabIndex={activeId === tab.id ? 0 : -1}
            className={clsx(
              'min-h-[44px] px-4 text-sm font-medium border-b-2 -mb-px text-center',
              activeId === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            )}
            onClick={() => onChange(tab.id)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={tabs.find(t => t.id === activeId)?.controlId}
        aria-labelledby={tabDomId(activeId)}
        tabIndex={0}
        className="pt-4 focus-visible:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
