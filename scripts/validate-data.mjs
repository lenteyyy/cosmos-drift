import { readFile } from 'node:fs/promises';
const { objects } = JSON.parse(
  await readFile(new URL('../public/data/universe-catalog.json', import.meta.url), 'utf8'),
);
const { sources } = JSON.parse(
  await readFile(new URL('../public/data/sources.json', import.meta.url), 'utf8'),
);
const sourceIds = new Set(sources.map((s) => s.id)),
  ids = new Set(),
  names = new Set(),
  errors = [];
const check = (v, msg) => {
  if (!v) errors.push(msg);
};
for (const o of objects) {
  check(!ids.has(o.id), `Duplicate ID: ${o.id}`);
  ids.add(o.id);
  const key = o.category + '/' + o.nameEn.toLowerCase();
  check(!names.has(key), `Duplicate catalogue object: ${key}`);
  names.add(key);
  check(
    o.nameEn && o.nameZh && o.descriptionEn && o.descriptionZh,
    `Missing bilingual fields: ${o.id}`,
  );
  check(o.isProcedural === false, `Interactive procedural object: ${o.id}`);
  check(
    o.sourceIds.length && o.sourceIds.every((s) => sourceIds.has(s)),
    `Missing source: ${o.id}`,
  );
  check(Object.values(o.cartesian).every(Number.isFinite), `Non-finite coordinate: ${o.id}`);
  check(Number.isFinite(o.distanceLy) && o.distanceLy >= 0, `Invalid distance: ${o.id}`);
  check(
    o.raDeg >= 0 && o.raDeg <= 360 && Math.abs(o.decDeg) <= 90,
    `Invalid sky direction: ${o.id}`,
  );
  check(o.scienceStatus && o.visual && o.scaleLy >= 0, `Invalid schema: ${o.id}`);
  if (o.distanceMethod === 'redshift-derived')
    check(
      o.redshift > 0 && o.descriptionEn.includes('approximate cosmological distance'),
      `Unlabelled cosmological distance: ${o.id}`,
    );
}
const count = (categories) => objects.filter((o) => categories.includes(o.category)).length;
check(objects.length > 1000, 'Need more than 1000 real space objects');
check(count(['star']) >= 350, 'Need at least 350 stars');
check(count(['exoplanet']) >= 280, 'Need at least 280 confirmed exoplanets');
check(
  count(['star', 'planet', 'exoplanet', 'dwarf_planet', 'moon']) >= 140,
  'Need at least 140 stellar/planetary objects',
);
check(count(['galaxy']) >= 500, 'Need at least 500 galaxies');
check(count(['black_hole']) >= 30, 'Need at least 30 black-hole systems');
check(
  count(['galaxy_group', 'galaxy_cluster', 'supercluster', 'wall', 'filament', 'void']) >= 100,
  'Need at least 100 structures',
);
check(
  [
    'mercury',
    'venus',
    'earth',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'horizon',
    'proxima',
    'sgr-a',
    'NGC0224',
    'virgo',
    'laniakea',
    'quipu',
  ].every((id) => ids.has(id)),
  'Missing a required route destination',
);
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  `Validated ${objects.length} real interactive entries; bilingual fields, sources, finite coordinates, counts and unique IDs passed.`,
);
