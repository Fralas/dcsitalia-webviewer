import bboxClip from '@turf/bbox-clip';
import { CAMPAIGNS, getCampaignById } from '../config/campaigns';
import { GLOBE_REGION_SPECS } from '../config/globeRegionSpecs';

function featureCodes(feature) {
  const props = feature?.properties || {};
  return [props.ISO_A2, props.ISO_A2_EH, props.BRK_A3, props.ADM0_A3]
    .filter(Boolean)
    .map((code) => String(code).toUpperCase());
}

function findFeatureByCode(features, code) {
  const target = String(code).toUpperCase();
  return features.find((feature) => featureCodes(feature).includes(target)) || null;
}

function clipCountryToZone(feature, bbox) {
  try {
    const clipped = bboxClip(feature, bbox);
    const geometry = clipped?.geometry;
    if (!geometry) return null;
    if (geometry.type === 'Polygon' && !geometry.coordinates?.length) return null;
    if (geometry.type === 'MultiPolygon' && !geometry.coordinates?.length) return null;
    return clipped;
  } catch {
    return null;
  }
}

function hasArea(geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return geometry.coordinates?.[0]?.length > 3;
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => poly?.[0]?.length > 3);
  }
  return false;
}

/**
 * Assign globe polygons to campaigns (full countries + bbox-clipped zones).
 * Returns { features, ownerByFeature, centroidByCampaign }.
 */
export function buildGlobeRegionFeatures(countryFeatures) {
  const ownerByFeature = new WeakMap();
  const centroidByCampaign = new Map();
  const partialFeatures = [];
  const fullyAssignedCodes = new Set();

  const rememberCentroid = (campaign, feature) => {
    if (centroidByCampaign.has(campaign.id)) return;
    const centroid = featureCentroid(feature);
    if (centroid) centroidByCampaign.set(campaign.id, centroid);
  };

  CAMPAIGNS.forEach((campaign) => {
    const spec = GLOBE_REGION_SPECS[campaign.id];
    if (!spec) return;

    (spec.countries || []).forEach((code) => {
      const normalized = String(code).toUpperCase();
      if (fullyAssignedCodes.has(normalized)) return;

      const feature = findFeatureByCode(countryFeatures, normalized);
      if (!feature) return;

      ownerByFeature.set(feature, campaign);
      fullyAssignedCodes.add(normalized);
      rememberCentroid(campaign, feature);
    });

    (spec.zones || []).forEach((zone) => {
      (zone.countries || []).forEach((code) => {
        const normalized = String(code).toUpperCase();
        if (fullyAssignedCodes.has(normalized)) return;

        const feature = findFeatureByCode(countryFeatures, normalized);
        if (!feature || !zone.bbox) return;

        const clipped = clipCountryToZone(feature, zone.bbox);
        if (!clipped?.geometry || !hasArea(clipped.geometry)) return;

        const partial = {
          type: 'Feature',
          properties: {
            ...(clipped.properties || {}),
            _campaignId: campaign.id,
            _partialRegion: true,
          },
          geometry: clipped.geometry,
        };

        partialFeatures.push(partial);
        rememberCentroid(campaign, partial);
      });
    });
  });

  return {
    features: [...countryFeatures, ...partialFeatures],
    ownerByFeature,
    centroidByCampaign,
    getOwner(feature) {
      const campaignId = feature?.properties?._campaignId;
      if (campaignId) return getCampaignById(campaignId);
      return ownerByFeature.get(feature) || null;
    },
  };
}

function featureCentroid(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  const rings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.map((poly) => poly[0])
      : null;
  if (!rings?.length) return null;

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  rings.forEach((ring) => {
    (ring || []).forEach(([lng, lat]) => {
      sumLng += lng;
      sumLat += lat;
      count += 1;
    });
  });
  if (!count) return null;
  return { lat: sumLat / count, lng: sumLng / count };
}
