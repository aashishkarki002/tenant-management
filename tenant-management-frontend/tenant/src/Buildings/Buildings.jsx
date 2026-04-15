/**
 * Buildings.jsx — /buildings route
 *
 * Renders the full organization view: entities, block cards,
 * migration wizard, and audit log.
 */

import { OrganizationTab } from "./organization/OrganizationTab";

export default function Buildings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Buildings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage ownership entities, buildings, and migrations
        </p>
      </div>

      <OrganizationTab />
    </div>
  );
}
