const CARTO_RASTER_HOST = 'https://basemaps.cartocdn.com';
const STYLE_PATHS = {
  dark_matter: 'dark_all',
  dark_matter_nolabels: 'dark_nolabels',
  voyager: 'rastertiles/voyager',
};

function readCartoBasemapKey() {
  return String(process.env.CARTO_BASEMAP_KEY || '').trim();
}

function parseTileCoord(value) {
  const numeric = Number.parseInt(String(value || '').replace(/\.png$/i, ''), 10);
  if (!Number.isInteger(numeric) || numeric < 0) return null;
  return numeric;
}

export async function proxyCartoBasemapTile(req, res) {
  const key = readCartoBasemapKey();
  if (!key) {
    return res.status(503).json({ error: 'Basemap is not configured' });
  }

  const style = String(req.params.style || '').trim();
  const stylePath = STYLE_PATHS[style];
  const z = parseTileCoord(req.params.z);
  const x = parseTileCoord(req.params.x);
  const y = parseTileCoord(req.params.y);

  if (!stylePath || z === null || x === null || y === null || z > 22) {
    return res.status(400).json({ error: 'Invalid basemap tile' });
  }

  const upstreamUrl = `${CARTO_RASTER_HOST}/${stylePath}/${z}/${x}/${y}.png?key=${encodeURIComponent(key)}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'image/png' },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status === 404 ? 404 : 502).end();
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buffer);
  } catch {
    return res.status(502).end();
  }
}
