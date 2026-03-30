/**
 * MaintenanceCardSection Component
 * 
 * Renders grouped sections of maintenance cards.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SECTION_CONFIG } from '../constants/maintenance.constants';

export const MaintenanceCardSection = ({ groupedTickets, renderCard }) => {
  return (
    <>
      {SECTION_CONFIG.map(({ key, label, dot, textColor }) => {
        const items = groupedTickets[key];
        if (!items || items.length === 0) return null;

        return (
          <div key={key}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={cn('h-2 w-2 rounded-full', dot)} />
              <h3 className={cn('text-sm font-semibold', textColor)}>{label}</h3>
              <span className="text-xs text-text-sub tabular-nums">{items.length}</span>
              <div className="flex-1 border-t border-gray-100" />
            </div>
            <div className="space-y-4">{items.map(renderCard)}</div>
          </div>
        );
      })}
    </>
  );
};
