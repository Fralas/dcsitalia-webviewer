import ammoCrateImg from '../../img/crates/ammo_crate.webp';
import buildCrateImg from '../../img/crates/build_crate.webp';
import fuelCrateImg from '../../img/crates/fuel_crate.png';
import hmmwvImg from '../../img/wiki/veh/HMMWV.png';
import l118Img from '../../img/wiki/veh/L118.png';
import manpadImg from '../../img/wiki/veh/MANPAD.png';
import scoutImg from '../../img/wiki/veh/SCOUT.png';
import towImg from '../../img/wiki/veh/TOW.png';

const SPAWN_IMAGES = {
  MANPAD: manpadImg,
  SCOUT: scoutImg,
  AMMO: ammoCrateImg,
  FUEL: fuelCrateImg,
  BUILD: buildCrateImg,
  HMMWV: hmmwvImg,
  TOW: towImg,
  L118: l118Img,
};

export function getHidcSpawnImageUrl(keyword) {
  const key = String(keyword || '').trim().toUpperCase();
  return SPAWN_IMAGES[key] || null;
}
