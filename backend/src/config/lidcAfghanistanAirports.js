/** Afghanistan airbases shown on the LIDC theater map. Keep in sync with frontend config. */
export const LIDC_AFGHANISTAN_AIRPORTS = [
  {
    id: 'kandahar',
    name: 'KANDAHAR',
    subtitle: 'AIRPORT',
  },
  {
    id: 'camp-bastion',
    name: 'CAMP BASTION',
    subtitle: 'AIRBASE',
  },
  {
    id: 'herat',
    name: 'HERAT',
    subtitle: 'AIRPORT',
  },
  {
    id: 'kabul',
    name: 'KABUL',
    subtitle: 'AIRPORT',
  },
  {
    id: 'bagram',
    name: 'BAGRAM',
    subtitle: 'AIRBASE',
  },
];

export function getLidcAirportById(id) {
  const target = String(id || '');
  if (!target) return null;
  return LIDC_AFGHANISTAN_AIRPORTS.find((entry) => entry.id === target) || null;
}
