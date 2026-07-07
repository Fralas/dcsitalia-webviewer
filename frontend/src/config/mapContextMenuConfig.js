/**
 * Map right-click context menu hierarchy (root → section → action).
 * Costs in brackets match the design spec; shown in tooltips.
 */
export const MAP_CONTEXT_MENU_ROOT = {
  id: 'root',
  children: [
    {
      id: 'dbuild',
      label: 'DBUILD',
      icon: 'hammer',
      children: [
        {
          id: 'sam-site',
          label: 'SAM SITE',
          icon: 'shield',
          children: [
            { id: 'nasams', label: 'NASAMS', cost: 40, icon: 'shield', action: { type: 'dbuild', buildType: 'nasams' } },
            { id: 'rapier', label: 'RAPIER', cost: 15, icon: 'crosshair', action: { type: 'dbuild', buildType: 'rapier' } },
          ],
        },
        {
          id: 'construction',
          label: 'CONSTRUCTION',
          icon: 'factory',
          children: [
            { id: 'farp', label: 'FARP', cost: 40, icon: 'plane-landing', action: { type: 'dbuild', buildType: 'farp' } },
            { id: 'ewr', label: 'EWR', cost: 50, icon: 'radar', action: { type: 'dbuild', buildType: 'ewr' } },
            { id: 'mortar', label: 'MORTAR', cost: 10, icon: 'target', action: { type: 'dbuild', buildType: 'mortar' } },
          ],
        },
      ],
    },
    {
      id: 'air-asset',
      label: 'AIR ASSET',
      icon: 'plane',
      children: [
        {
          id: 'tanker',
          label: 'TANKER',
          icon: 'fuel',
          children: [
            { id: 'boom', label: 'BOOM', subtitle: 'KC-135 Shell', icon: 'fuel', action: { type: 'tanker', keyword: 'BOOM' } },
            { id: 'basket', label: 'BASKET', subtitle: 'KC-135 Texaco', icon: 'fuel', action: { type: 'tanker', keyword: 'BASKET' } },
          ],
        },
        {
          id: 'airplane',
          label: 'AIRPLANE',
          icon: 'plane',
          children: [
            { id: 'cas', label: 'CAS', subtitle: 'A-10CII', icon: 'plane', action: { type: 'air-asset', keyword: 'CAS' } },
            { id: 'cap', label: 'CAP', subtitle: 'F-15C', icon: 'plane', action: { type: 'air-asset', keyword: 'CAP' } },
            { id: 'ewar', label: 'EWAR', subtitle: 'F-18C', icon: 'radio', action: { type: 'air-asset', keyword: 'EWAR' } },
            { id: 'drone', label: 'DRONE', subtitle: 'MQ9', icon: 'drone', action: { type: 'air-asset', keyword: 'DRONE' } },
          ],
        },
      ],
    },
    {
      id: 'ground-asset',
      label: 'GROUND ASSET',
      icon: 'tank',
      children: [
        {
          id: 'ground',
          label: 'GROUND',
          icon: 'tank',
          children: [
            { id: 'mbt', label: 'MBT', cost: 90, icon: 'tank', action: { type: 'ground-asset', keyword: 'MBT' } },
            { id: 'lav25', label: 'LAV25', cost: 90, icon: 'tank', action: { type: 'ground-asset', keyword: 'LAV25' } },
            { id: 'tow', label: 'TOW', cost: 50, icon: 'crosshair', action: { type: 'ground-asset', keyword: 'TOW' } },
            { id: 'hmmwv', label: 'HMMWV', cost: 50, icon: 'truck', action: { type: 'ground-asset', keyword: 'HMMWV' } },
            { id: 'scorpion', label: 'SCORPION', cost: 50, icon: 'tank', action: { type: 'ground-asset', keyword: 'SCORPION' } },
            { id: 'scimitar', label: 'SCIMITAR', cost: 50, icon: 'tank', action: { type: 'ground-asset', keyword: 'SCIMITAR' } },
            { id: 'firtina', label: 'FIRTINA', cost: 50, icon: 'tank', action: { type: 'ground-asset', keyword: 'FIRTINA' } },
            { id: 'atacms', label: 'ATACMS', cost: 50, icon: 'rocket', action: { type: 'ground-asset', keyword: 'ATACMS' } },
            { id: 'gmlrs', label: 'GMRLS', cost: 50, icon: 'rocket', action: { type: 'ground-asset', keyword: 'GMRLS' } },
          ],
        },
        {
          id: 'air-defence',
          label: 'AIR DEFENCE',
          icon: 'shield',
          children: [
            { id: 'gepard', label: 'GEPARD', cost: 30, icon: 'shield', action: { type: 'ground-asset', keyword: 'GEPARD' } },
            { id: 'avenger', label: 'AVENGER', cost: 50, icon: 'shield', action: { type: 'ground-asset', keyword: 'AVENGER' } },
            { id: 'roland', label: 'ROLAND', cost: 50, icon: 'shield', action: { type: 'ground-asset', keyword: 'ROLAND' } },
          ],
        },
        {
          id: 'ground-logistic',
          label: 'LOGISTIC',
          icon: 'truck',
          children: [
            { id: 'adv', label: 'ADV', icon: 'truck', action: { type: 'ground-asset', keyword: 'ADV' } },
            { id: 'fmtv', label: 'FMTV', icon: 'truck', action: { type: 'ground-asset', keyword: 'FMTV' } },
          ],
        },
      ],
    },
    {
      id: 'mark-attack',
      label: 'MARK ATTACK',
      icon: 'target',
      children: [
        { id: 'bomb', label: 'BOMB', subtitle: 'F117', icon: 'bomb', action: { type: 'mark-attack', keyword: 'BOMB' } },
        { id: 'cruise', label: 'CRUISE', subtitle: 'B-52 CRUISE', icon: 'rocket', action: { type: 'mark-attack', keyword: 'CRUISE' } },
        { id: 'ship', label: 'SHIP', subtitle: 'NAVAL ATTACK', icon: 'anchor', action: { type: 'mark-attack', keyword: 'SHIP' } },
      ],
    },
    {
      id: 'logi-supply',
      label: 'LOGI & SUPPLY',
      icon: 'truck',
      children: [
        {
          id: 'logistic',
          label: 'LOGISTIC',
          icon: 'truck',
          children: [
            { id: 'logi-adv', label: 'ADV', icon: 'truck', action: { type: 'logi-supply', keyword: 'ADV' } },
            { id: 'logi-fmtv', label: 'FMTV', icon: 'truck', action: { type: 'logi-supply', keyword: 'FMTV' } },
          ],
        },
        {
          id: 'supply',
          label: 'SUPPLY',
          icon: 'boxes',
          children: [
            { id: 'helisupply', label: 'HELISUPPLY', icon: 'boxes', action: { type: 'logi-supply', keyword: 'HELISUPPLY' } },
            { id: 'supply', label: 'SUPPLY', icon: 'boxes', action: { type: 'logi-supply', keyword: 'SUPPLY' } },
          ],
        },
      ],
    },
  ],
};

export function resolveContextMenuNode(path = []) {
  let node = MAP_CONTEXT_MENU_ROOT;
  for (const segment of path) {
    const next = node.children?.find((entry) => entry.id === segment);
    if (!next) return null;
    node = next;
  }
  return node;
}

export function formatContextMenuTooltip(entry) {
  const parts = [entry.label];
  if (Number.isFinite(entry.cost)) parts.push(`[${entry.cost}]`);
  if (entry.subtitle) parts.push(entry.subtitle);
  return parts.join(' · ');
}
