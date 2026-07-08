import * as THREE from 'three';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import { isHidcTheaterFeature } from './globeTheaterColor';

const _sphere = new THREE.Sphere();
const _hitPoint = new THREE.Vector3();

/**
 * Doubles each orange theater dot hit radius (matches three-globe dot sizing).
 */
export function expandHidcTheaterHitboxes(
  world,
  {
    margin = 0.3,
    altitude = 0.001,
    multiplier = 2,
  } = {},
) {
  const baseRaycast = THREE.Mesh.prototype.raycast;

  world.scene().traverse((obj) => {
    if (obj.__globeObjType !== 'hexPolygon' || obj.__expandedHitbox) return;

    const feature = obj.__data;
    if (!isHidcTheaterFeature(feature)) return;

    const cellIds = feature?.properties?.theaterCellIds;
    if (!Array.isArray(cellIds) || cellIds.length === 0) return;

    const hitSpheres = cellIds.map((cellId) => {
      const [lat, lng] = cellToLatLng(cellId);
      const [edgeLat, edgeLng] = cellToBoundary(cellId, true)[0];
      const center = new THREE.Vector3().copy(world.getCoords(lat, lng, altitude));
      const edge = new THREE.Vector3().copy(world.getCoords(edgeLat, edgeLng, altitude));
      const visualRadius = center.distanceTo(edge) * 0.85 * (1 - margin);
      return { center, radius: visualRadius * multiplier };
    });

    obj.__expandedHitbox = true;
    obj.raycast = function expandedTheaterRaycast(raycaster, intersects) {
      baseRaycast.call(this, raycaster, intersects);
      if (intersects.some((hit) => hit.object === this)) return;

      const ray = raycaster.ray;
      let closestDist = Infinity;
      let closestPoint = null;

      hitSpheres.forEach(({ center, radius }) => {
        _sphere.set(center, radius);
        const point = ray.intersectSphere(_sphere, _hitPoint);
        if (!point) return;

        const dist = ray.origin.distanceTo(point);
        if (dist < closestDist) {
          closestDist = dist;
          closestPoint = point.clone();
        }
      });

      if (closestPoint) {
        intersects.push({
          distance: closestDist,
          point: closestPoint,
          object: this,
        });
      }
    };
  });
}
