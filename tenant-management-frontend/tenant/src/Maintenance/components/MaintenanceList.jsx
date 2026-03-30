/**
 * MaintenanceList Component
 * 
 * Renders maintenance items in either card or table view.
 */

import React from 'react';
import MaintenanceTable from './MaintenanceTable';
import { MaintenanceCardSection } from './MaintenanceCardSection';
import { Empty, EmptyTitle } from '@/components/ui/empty';

export const MaintenanceList = ({
  viewMode,
  groupedTickets,
  filteredMaintenance,
  renderCard,
  formatStatus,
  formatDate,
  onUpdate,
  bankAccounts,
  staffs,
  hasAnyTickets,
  emptyAction,
  totalMaintenanceCount,
}) => {
  if (!hasAnyTickets) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <Empty>
          <EmptyTitle className="text-text-sub">
            {totalMaintenanceCount === 0
              ? 'No maintenance tasks yet'
              : 'No tasks match the current filters'}
          </EmptyTitle>
        </Empty>
        {totalMaintenanceCount === 0 && emptyAction}
      </div>
    );
  }

  if (viewMode === 'table') {
    return (
      <MaintenanceTable
        data={filteredMaintenance}
        formatStatus={formatStatus}
        formatDate={formatDate}
        onUpdate={onUpdate}
        bankAccounts={bankAccounts}
        staffs={staffs}
      />
    );
  }

  return (
    <div className="space-y-8">
      <MaintenanceCardSection groupedTickets={groupedTickets} renderCard={renderCard} />
    </div>
  );
};
