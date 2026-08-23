const unitImages = import.meta.glob('../../img/aircrafts/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
});

const unitImagesById = Object.fromEntries(
  Object.entries(unitImages).map(([path, url]) => {
    const filename = path.split('/').pop() || '';
    const id = filename.replace(/\.(png|jpe?g|webp)$/i, '').toLowerCase();
    return [id, url];
  }),
);

export function getLidcUnitImageUrl(unitId) {
  const normalized = String(unitId || '').trim().toLowerCase();
  if (!normalized) return null;
  return unitImagesById[normalized] || null;
}
