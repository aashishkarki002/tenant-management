/**
 * Maintenance Utility Functions
 */

export const formatStatus = (status) => {
  if (!status) return "Open";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
};

export const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return date;
  }
};

const isOverdue = (item, today) => {
  const status = (item.status || "").toUpperCase();
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  try {
    const scheduledDate = new Date(item.scheduledDate);
    scheduledDate.setHours(0, 0, 0, 0);
    return scheduledDate < today;
  } catch {
    return false;
  }
};

/**
 * Group maintenance tickets by status and priority.
 * Now includes a `pendingSettlement` bucket.
 */
export const groupMaintenanceTickets = (maintenanceList) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups = {
    overdue: [],
    urgent: [],
    open: [],
    inProgress: [],
    pendingSettlement: [],
    completed: [],
  };

  maintenanceList.forEach((item) => {
    const status = (item.status || "OPEN").toUpperCase();
    const priority = (item.priority || "").toUpperCase();

    if (isOverdue(item, today)) {
      groups.overdue.push(item);
    } else if (status === "PENDING_SETTLEMENT") {
      groups.pendingSettlement.push(item);
    } else if (
      priority === "URGENT" &&
      status !== "COMPLETED" &&
      status !== "CANCELLED"
    ) {
      groups.urgent.push(item);
    } else if (status === "OPEN") {
      groups.open.push(item);
    } else if (status === "IN_PROGRESS") {
      groups.inProgress.push(item);
    } else {
      groups.completed.push(item);
    }
  });

  return groups;
};

export const calculateMaintenanceStats = (maintenanceList) => {
  const list = maintenanceList || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const open = list.filter(
    (m) => (m.status || "OPEN").toUpperCase() === "OPEN",
  ).length;

  const inProgress = list.filter(
    (m) => (m.status || "").toUpperCase() === "IN_PROGRESS",
  ).length;

  const pendingSettlement = list.filter(
    (m) => (m.status || "").toUpperCase() === "PENDING_SETTLEMENT",
  ).length;

  const overdue = list.filter((m) => isOverdue(m, today)).length;

  const completedThisWeek = list.filter((m) => {
    if ((m.status || "").toUpperCase() !== "COMPLETED") return false;
    try {
      const completedDate = new Date(m.updatedAt || m.scheduledDate);
      return completedDate >= weekAgo;
    } catch {
      return false;
    }
  }).length;

  return { open, inProgress, pendingSettlement, overdue, completedThisWeek };
};

export const generateWorkOrderId = (item) =>
  `#WO-${String(item._id || "")
    .slice(-4)
    .toUpperCase()}`;

export const transformUnitsToOptions = (units) => {
  const safeUnits = Array.isArray(units) ? units.filter(Boolean) : [];
  return safeUnits.map((u) => ({
    value: u._id,
    label: u.name ?? u.unitName ?? u._id,
    blockName: u.blockName ?? u.block?.name ?? undefined,
    floor: u.floor ?? u.floorName ?? undefined,
    isOccupied:
      Boolean(u.currentLease) ||
      Boolean(u.tenantId) ||
      Boolean(u.tenant?._id) ||
      Boolean(u.tenant),
  }));
};
