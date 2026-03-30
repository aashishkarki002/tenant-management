/**
 * Maintenance.jsx
 * 
 * LEGACY FILE - For backward compatibility only
 * 
 * This file now exports the refactored MaintenancePage component.
 * The original monolithic component has been split into:
 * 
 * - constants/maintenance.constants.js - Configuration and style helpers
 * - utils/maintenance.utils.js - Pure utility functions
 * - hooks/useMaintenance.js - Data fetching and state management
 * - hooks/useMaintenanceFilters.js - Filter logic
 * - components/ - Modular UI components
 * - MaintenancePage.jsx - Main orchestrator component
 * 
 * To use the new architecture, import from MaintenancePage.jsx directly.
 */

import MaintenancePage from './MaintenancePage';

export default MaintenancePage;

// Re-export style helpers for backward compatibility with existing components
export { getPriorityStyle, getStatusStyle } from './constants/maintenance.constants';