/**
 * FormSection Component
 * 
 * Collapsible form section with toggle functionality.
 */

import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export const FormSection = ({ title, open, toggle, children }) => {
  return (
    <div className="rounded-lg border border-muted-fill bg-muted-fill/50">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-text-strong"
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-text-sub" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-sub" />
        )}
      </button>
      {open && (
        <div className="space-y-4 border-t border-muted-fill px-4 pb-4 pt-3">{children}</div>
      )}
    </div>
  );
};
