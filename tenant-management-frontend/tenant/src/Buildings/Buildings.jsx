/**
 * Buildings.jsx — /buildings route
 *
 * Renders the full organization view: entities, block cards,
 * migration wizard, and audit log.
 */

import { OrganizationTab } from "./organization/OrganizationTab";

export default function Buildings() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--color-bg)]">

      {/* Page header — pinned, never scrolls */}
      <div className="flex-shrink-0 px-4 sm:px-7 pt-5 pb-4 border-b border-[var(--color-border)]">
        <h1 className="text-lg font-semibold text-[var(--color-text-body)]">Buildings</h1>
        <p className="text-sm text-[var(--color-text-sub)] mt-0.5">
          Manage ownership entities, buildings, and migrations
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 sm:px-7 pb-10 pt-5">
          <OrganizationTab />
        </div>
      </div>

    </div>
  );
}
