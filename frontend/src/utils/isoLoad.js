const ISO_CONTAINERS = [
  { id: 'iso-1', label: 'ISO-1', capacity: 1.0 },
  { id: 'iso-2', label: 'ISO-2', capacity: 1.0 },
  { id: 'iso-s', label: 'ISO-S', capacity: 0.5, small: true },
];

export function buildIsoContainerPlan(orders = []) {
  const containers = ISO_CONTAINERS.map(container => ({
    ...container,
    used: 0,
    items: [],
  }));
  const overflow = [];

  const sortedOrders = [...orders].sort((a, b) => (b.iso_units || 0) - (a.iso_units || 0));

  sortedOrders.forEach(order => {
    let remaining = Number(order.iso_units || 0);
    if (remaining <= 0) return;

    containers.forEach(container => {
      if (remaining <= 0) return;
      const available = container.capacity - container.used;
      if (available <= 0) return;

      const amount = Math.min(available, remaining);
      container.used += amount;
      container.items.push({
        weapon_id: order.weapon_id,
        units: amount,
      });
      remaining -= amount;
    });

    if (remaining > 0) {
      overflow.push({
        weapon_id: order.weapon_id,
        units: remaining,
      });
    }
  });

  const totalUsed = containers.reduce((sum, container) => sum + container.used, 0);

  return { containers, overflow, totalUsed };
}

export function formatIsoUnits(units) {
  if (!Number.isFinite(units)) return '-';
  return units.toFixed(1);
}
