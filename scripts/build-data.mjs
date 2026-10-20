import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as C from '../data/curated.mjs';
const AU = 1 / 63241.077,
  KM = 1 / 9.4607304725808e12,
  PC = 3.261563777;
const rawArg = process.argv.indexOf('--raw-dir');
const out = new URL('../public/data/', import.meta.url),
  raw =
    rawArg >= 0
      ? pathToFileURL(resolve(process.argv[rawArg + 1]) + '/')
      : new URL('../data/raw/', import.meta.url),
  snap = new URL('../data/snapshots/', import.meta.url);
await mkdir(out, { recursive: true });
await mkdir(raw, { recursive: true });
await mkdir(snap, { recursive: true });
const sources = [
  {
    id: 'abell',
    name: 'Measured Redshifts of Abell Clusters — CDS VII/165A',
    url: 'https://heasarc.gsfc.nasa.gov/W3Browse/all/abellzcat.html',
    downloadUrl: 'https://cdsarc.cds.unistra.fr/ftp/cats/VII/165A/catalog.dat',
    license: 'Public scientific catalogue; source acknowledgement retained',
    attribution:
      'H. Andernach (1991), ASP Conf. Ser. 15, 279; Abell, Corwin & Olowin (1989); CDS VII/165A. Only unflagged measured redshifts selected.',
  },
  {
    id: 'hyg',
    name: 'HYG Stellar Database v4.1',
    url: 'https://github.com/astronexus/HYG-Database',
    license: 'CC BY-SA 4.0',
    attribution: 'David Nash / Astronexus; Hipparcos, Yale Bright Star and Gliese catalogues',
    downloadUrl:
      'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv',
  },
  {
    id: 'nasa-exo',
    name: 'NASA Exoplanet Archive — PSCompPars',
    url: 'https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html',
    license: 'Public scientific data; archive acknowledgement and upstream references retained',
    attribution:
      'NASA Exoplanet Archive, operated by Caltech under contract with NASA; DOI 10.26133/NEA13',
    downloadUrl:
      'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?' +
      new URLSearchParams({
        query:
          'select pl_name,hostname,ra,dec,sy_dist,pl_rade,pl_bmasse,pl_orbper,pl_orbsmax,disc_year,discoverymethod from pscomppars where sy_dist is not null order by pl_name',
        format: 'json',
      }),
  },
  {
    id: 'openngc',
    name: 'OpenNGC',
    url: 'https://github.com/mattiaverga/OpenNGC',
    license: 'CC BY-SA 4.0',
    attribution:
      'Mattia Verga; upstream NASA/IPAC NED (JPL/Caltech under NASA contract), HyperLEDA, SIMBAD (CDS Strasbourg)',
    downloadUrl:
      'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv',
  },
  {
    id: 'nasa-solar',
    name: 'NASA Solar System facts',
    url: 'https://science.nasa.gov/solar-system/solar-system-facts/',
    license: 'NASA public information; third-party content excluded',
    attribution: 'NASA Science; rounded radii and semi-major axes, schematic orbital phases',
  },
  {
    id: 'simbad',
    name: 'SIMBAD astronomical database',
    url: 'https://simbad.cds.unistra.fr/simbad/',
    license: 'Scientific facts, with acknowledgement',
    attribution:
      'SIMBAD database, operated at CDS, Strasbourg, France; rounded representative sky anchors',
  },
  {
    id: 'eht',
    name: 'Event Horizon Telescope',
    url: 'https://eventhorizontelescope.org/press-release-may-12-2022',
    license: 'Factual summaries rewritten; no imagery copied',
    attribution: 'Event Horizon Telescope Collaboration',
  },
  {
    id: 'bh',
    name: 'Black-hole systems — NASA / ESO / scientific literature',
    url: 'https://science.nasa.gov/universe/black-holes/',
    license: 'Factual summaries rewritten; no media copied',
    attribution: 'NASA Science; positions and distances are approximate system anchors',
    references: [
      'https://www.eso.org/public/news/eso2408/',
      'https://www.eso.org/public/news/eso2117/',
      'https://arxiv.org/abs/1510.08869',
      'https://arxiv.org/abs/2209.14385',
      'https://arxiv.org/abs/2302.07880',
    ],
  },
  {
    id: 'structures',
    name: 'Large-scale structure literature / NASA NED',
    url: 'https://ned.ipac.caltech.edu/',
    license: 'Factual summaries rewritten; schematic centres and extents',
    attribution:
      'NASA/IPAC NED; Böhringer et al. 2025, A&A 695 A59; Tully et al. 2014 Nature 513, 71; representative centres are approximate',
    references: [
      'https://www.aanda.org/articles/aa/pdf/2025/03/aa53582-24.pdf',
      'https://arxiv.org/abs/1409.0880',
      'https://arxiv.org/abs/2007.04414',
    ],
  },
  {
    id: 'cosmology',
    name: 'Planck 2018 cosmological parameters',
    url: 'https://arxiv.org/abs/1807.06209',
    license: 'Factual parameters',
    attribution: 'Planck Collaboration; flat ΛCDM, H0=67.4 km/s/Mpc, Ωm=0.315, ΩΛ=0.685',
  },
  {
    id: 'earth-texture',
    name: 'NASA Blue Marble via WebGL Earth',
    url: 'https://github.com/turban/webgl-earth',
    license: 'NASA Blue Marble public-domain imagery; repository attribution retained',
    attribution: 'NASA / Reto Stöckli; WebGL Earth texture mirror; used only for Earth surface',
  },
];
function csv(text, sep = ',') {
  let rows = [],
    row = [],
    s = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        s += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      row.push(s);
      s = '';
    } else if (c === '\n' && !quoted) {
      row.push(s.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      s = '';
    } else s += c;
  }
  if (s || row.length) {
    row.push(s);
    rows.push(row);
  }
  const h = rows.shift();
  return rows
    .filter((x) => x.length >= h.length)
    .map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]])));
}
async function input(file, source, parser) {
  let content;
  const url = new URL(file, raw);
  if (process.argv.includes('--refresh')) {
    const res = await fetch(source.downloadUrl, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw Error(`${source.name}: HTTP ${res.status}`);
    content = await res.text();
    await writeFile(url, content);
  } else {
    try {
      content = await readFile(url, 'utf8');
    } catch {
      try {
        return JSON.parse(await readFile(new URL(file + '.json', snap), 'utf8'));
      } catch {
        const res = await fetch(source.downloadUrl, { signal: AbortSignal.timeout(120000) });
        if (!res.ok) throw Error(`${source.name}: HTTP ${res.status}`);
        content = await res.text();
        await writeFile(url, content);
      }
    }
  }
  return parser(content);
}
const num = (v) =>
  v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
const round = (n, p = 5) => Number(n.toPrecision(p));
function xyz(ra, dec, d) {
  const r = (ra * Math.PI) / 180,
    c = (dec * Math.PI) / 180;
  return {
    x: d * Math.cos(c) * Math.cos(r),
    y: d * Math.sin(c),
    z: -d * Math.cos(c) * Math.sin(r),
  };
}
function angle(v, h = false) {
  const [a, b, c] = v.split(':').map(Number);
  return (Math.abs(a) + b / 60 + c / 3600) * (v.startsWith('-') ? -1 : 1) * (h ? 15 : 1);
}
export function comoving(z) {
  const n = 512,
    h = z / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const x = i * h,
      f = 1 / Math.sqrt(0.315 * (1 + x) ** 3 + 0.685);
    sum += f * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return (((299792.458 / 67.4) * h) / 3) * sum * 3.261563777e6;
}
const base = (id, category, nameEn, nameZh, ra, dec, d, scale = 1) => ({
  id,
  category,
  nameEn,
  nameZh,
  aliases: [],
  raDeg: ra,
  decDeg: dec,
  distanceLy: d,
  cartesian: xyz(ra, dec, d),
  scaleLy: scale,
  scienceStatus: 'catalogued',
  isProcedural: false,
  sourceIds: [],
  physical: {},
  visual: { renderer: 'point', visualScaleMultiplier: 1 },
});
let objects = [];
const add = (o) => (objects.push(o), o);
for (const p of C.solar) {
  const [id, en, zh, a, r, phase, color, dzh, den] = p;
  const t = (phase * Math.PI) / 180,
    ob = (23.439 * Math.PI) / 180,
    pos = {
      x: a * AU * Math.cos(t),
      y: a * AU * Math.sin(t) * Math.sin(ob),
      z: -a * AU * Math.sin(t) * Math.cos(ob),
    };
  add({
    ...base(
      id,
      objects.length < 8 ? 'planet' : 'dwarf_planet',
      en,
      zh,
      0,
      0,
      Math.hypot(pos.x - AU, pos.y, pos.z),
      r * KM * 2,
    ),
    cartesian: pos,
    descriptionZh: `${zh}是太阳系的${id === 'earth' ? '岩石行星' : '天体'}。${dzh}平均日心轨道半长轴约 ${a} AU；轨道相位为示意，不是实时星历。`,
    descriptionEn: `${den} Its mean heliocentric semi-major axis is approximately ${a} AU. Orbital phases are schematic, not a live ephemeris.`,
    sourceIds: ['nasa-solar'],
    scienceStatus: 'confirmed',
    physical: { radiusKm: r, semiMajorAxisAu: a, orbitalPhase: 'schematic', color },
    visual: { renderer: 'planet', visualScaleMultiplier: 1 },
  });
}
for (const [id, en, zh, host, orbit, r] of C.moons) {
  const parent = objects.find((o) => o.id === host);
  const pos = {
    ...parent.cartesian,
    x: parent.cartesian.x + orbit * KM * 0.82,
    z: parent.cartesian.z - orbit * KM * 0.57,
  };
  add({
    ...base(id, 'moon', en, zh, 0, 0, Math.hypot(pos.x - AU, pos.y, pos.z), r * KM * 2),
    cartesian: pos,
    hostId: host,
    physical: { radiusKm: r, orbitKm: orbit, color: '#a6a7a5' },
    sourceIds: ['nasa-solar'],
    scienceStatus: 'confirmed',
    descriptionZh: `${zh}是${parent.nameZh}的天然卫星，平均半径约 ${r} km。轨道相位仅为示意。`,
    descriptionEn: `${en} is a natural satellite of ${parent.nameEn}, with a mean radius of approximately ${r} km. Orbital phase is schematic.`,
    visual: { renderer: 'planet', visualScaleMultiplier: 1 },
  });
}
const allStars = await input(
  'hyg.csv',
  sources.find((s) => s.id === 'hyg'),
  (x) => csv(x),
);
const selected = new Map();
for (const s of allStars) {
  if (C.priorityStars.includes(s.proper) || C.nearbyNames[s.hip]) selected.set(s.id, s);
}
for (const s of allStars
  .filter((s) => s.proper && +s.dist > 0 && +s.dist < 10000 && s.spect)
  .sort((a, b) => +a.mag - +b.mag)) {
  if (selected.size >= 350) break;
  selected.set(s.id, s);
}
for (const s of selected.values()) {
  const names = C.nearbyNames[s.hip];
  let en = names?.[0] || s.proper;
  if (en === 'Proxima') en = 'Proxima Centauri';
  if (en === 'Sirius') en = 'Sirius A';
  const zh = names?.[1] || C.starTranslations[s.proper] || en;
  const d = +s.dist * PC,
    ra = +s.ra * 15,
    dec = +s.dec;
  const o = base(
    s.proper === 'Proxima' || s.proper === 'Proxima Centauri' ? 'proxima' : `hyg-${s.id}`,
    'star',
    en,
    zh,
    ra,
    dec,
    d,
    696340 * KM * 2,
  );
  o.aliases = [s.proper, s.hip && `HIP ${s.hip}`, s.gl].filter(Boolean);
  o.physical = {
    spectralType: s.spect,
    magnitude: num(s.mag),
    absoluteMagnitude: num(s.absmag),
    constellation: s.con,
    ProperName: s.proper,
    X: num(s.x),
    Y: num(s.y),
    Z: num(s.z),
    radiusKm: null,
    renderRadiusKm: 696340,
    radiusNotMeasured: true,
  };
  o.sourceIds = ['hyg'];
  o.visual.renderer = 'star';
  o.descriptionZh = `${zh}是${s.con ? '位于 ' + s.con + ' 方向的' : ''}${s.spect ? s.spect + ' 型' : ''}恒星，距离太阳系约 ${round(d)} 光年${num(s.mag) !== undefined ? '，视星等约 ' + s.mag : ''}。`;
  o.descriptionEn = `${en} is a ${s.spect || ''} star${s.con ? ' in the direction of ' + s.con : ''}, approximately ${round(d)} light-years from the Solar System${s.mag ? ', with an apparent magnitude of about ' + s.mag : ''}.`;
  add(o);
}
add({
  ...base('sun', 'star', 'Sun', '太阳', 0, 0, AU, 696340 * KM * 2),
  cartesian: { x: 0, y: 0, z: 0 },
  sourceIds: ['nasa-solar'],
  scienceStatus: 'confirmed',
  physical: { radiusKm: 696340, spectralType: 'G2V', color: '#fff0c2' },
  descriptionZh: '太阳是太阳系中心的 G2V 型恒星。半径约 69.6 万千米。',
  descriptionEn:
    'The Sun is the G2V star at the centre of the Solar System, with a radius of approximately 696,000 km.',
  visual: { renderer: 'star', visualScaleMultiplier: 1 },
});
// Supplementary nearby components; rounded system coordinates, not resolved component astrometry.
for (const [id, en, zh, ra, dec, d, spec] of [
  ['sirius-b', 'Sirius B', '天狼星 B', 101.287, -16.716, 8.6, 'DA2'],
  ['wolf359', 'Wolf 359', '沃尔夫 359', 164.12, 7.01, 7.86, 'M6V'],
  ['ross248', 'Ross 248', '罗斯 248', 355.48, 44.17, 10.32, 'M6V'],
  ['teegarden', 'Teegarden’s Star', '蒂加登星', 43.25, 16.88, 12.5, 'M7V'],
  ['groombridge-b', 'Groombridge 34 B', '格鲁姆布里奇 34 B', 4.6, 44.0, 11.6, 'M6V'],
  ['ez-aquarii', 'EZ Aquarii', '宝瓶座 EZ', 339.6, -15.3, 11.1, 'M5V'],
  ['tau-ceti', 'Tau Ceti', '天仓五', 26.017, -15.937, 11.9, 'G8V'],
  ['epsilon-eridani', 'Epsilon Eridani', '天苑四', 53.233, -9.458, 10.5, 'K2V'],
]) {
  if (objects.some((o) => o.nameEn === en || o.aliases.includes(en))) continue;
  add({
    ...base(id, 'star', en, zh, ra, dec, d, 696340 * KM * 2),
    sourceIds: ['simbad'],
    physical: {
      spectralType: spec,
      radiusKm: id === 'sirius-b' ? 5840 : null,
      renderRadiusKm: 696340,
      representativeSystemAnchor: true,
    },
    descriptionZh: `${zh}是一颗 ${spec} 型恒星，距离太阳系约 ${d} 光年。位置采用近似系统锚点。`,
    descriptionEn: `${en} is a ${spec}-type star approximately ${d} light-years away. The position is a rounded system anchor.`,
    visual: { renderer: 'star', visualScaleMultiplier: 1 },
  });
}
const exo = await input(
  'exoplanets.json',
  sources.find((s) => s.id === 'nasa-exo'),
  JSON.parse,
);
const byName = new Map(exo.map((p) => [p.pl_name, p]));
let planets = C.exoplanetPriority.map((n) => byName.get(n)).filter(Boolean);
const selectedHosts = new Set(planets.map((p) => p.hostname));
for (const p of [...exo].sort(
  (a, b) => a.sy_dist - b.sy_dist || a.pl_name.localeCompare(b.pl_name),
)) {
  if (planets.length >= 280) break;
  if (selectedHosts.has(p.hostname)) continue;
  selectedHosts.add(p.hostname);
  if (!planets.includes(p)) planets.push(p);
}
for (const p of planets) {
  const d = p.sy_dist * PC;
  const en = p.pl_name === 'Proxima Cen b' ? 'Proxima Centauri b' : p.pl_name;
  const o = base(
    'exo-' + p.pl_name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
    'exoplanet',
    en,
    en,
    p.ra,
    p.dec,
    d,
    (p.pl_rade || 1) * 6371 * KM * 2,
  );
  o.sourceIds = ['nasa-exo'];
  o.scienceStatus = 'confirmed';
  o.aliases = [p.pl_name, p.hostname];
  o.physical = {
    ...p,
    radiusKm: p.pl_rade ? p.pl_rade * 6371 : null,
    hostPositionOnly: true,
    color: '#ac907f',
  };
  o.visual.renderer = 'planet';
  o.descriptionZh = `${en}是一颗已确认的系外行星，围绕 ${p.hostname} 运行，距离太阳系约 ${round(d)} 光年。${p.pl_orbper ? '公转周期约 ' + round(p.pl_orbper) + ' 天。' : ''}${p.pl_rade ? '半径约为地球的 ' + round(p.pl_rade) + ' 倍。' : ''}发现年份约 ${p.disc_year} 年。轨道方向未知时显示在宿主系统位置。`;
  o.descriptionEn = `${en} is a confirmed exoplanet orbiting ${p.hostname}, approximately ${round(d)} light-years away.${p.pl_orbper ? ' Its orbital period is approximately ' + round(p.pl_orbper) + ' days.' : ''}${p.pl_rade ? ' Its radius is approximately ' + round(p.pl_rade) + ' Earth radii.' : ''} Discovery year: approximately ${p.disc_year}. Its host-system position is shown where orbital orientation is unknown.`;
  add(o);
}
const ngc = await input(
  'ngc.csv',
  sources.find((s) => s.id === 'openngc'),
  (x) => csv(x, ';'),
);
const valid = ngc.filter(
  (g) =>
    (g.Type === 'G' ||
      (C.priorityGalaxies.includes(g.Name) && ['GPair', 'GGroup', 'GTrpl'].includes(g.Type))) &&
    g.RA &&
    g.Dec &&
    (C.galaxyDistances[g.Name] || +g.Redshift > 0.002),
);
const gal = new Map();
for (const id of C.priorityGalaxies) {
  const g = valid.find((g) => g.Name === id);
  if (g) gal.set(id, g);
}
// Stratified round-robin across equal-solid-angle sky cells, redshift bins and Hubble classes.
const buckets = new Map();
for (const g of valid) {
  if (gal.has(g.Name)) continue;
  const ra = angle(g.RA, true),
    dec = angle(g.Dec),
    z = +g.Redshift;
  const k = [
    Math.floor(ra / 30),
    Math.min(3, Math.floor((Math.sin((dec * Math.PI) / 180) + 1) * 2)),
    z < 0.01 ? 0 : z < 0.03 ? 1 : z < 0.1 ? 2 : 3,
    (g.Hubble || 'U').slice(0, 2),
  ].join('/');
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(g);
}
const cells = new Map();
for (const [key, b] of buckets) {
  const sky = key.split('/').slice(0, 2).join('/');
  if (!cells.has(sky)) cells.set(sky, []);
  cells.get(sky).push(b);
}
const pool = [...cells.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((x) => x[1]);
for (let i = 0; gal.size < 512 && i < 1000; i++) {
  for (const cell of pool) {
    if (gal.size >= 512) break;
    const b = cell[i % cell.length];
    const g = b[Math.floor(i / cell.length)];
    if (g) gal.set(g.Name, g);
  }
}
for (const g of gal.values()) {
  const direct = C.galaxyDistances[g.Name],
    z = num(g.Redshift),
    d = direct ? direct * 1e6 : comoving(z),
    ra = angle(g.RA, true),
    dec = angle(g.Dec),
    en =
      C.galaxyNames[g.Name]?.[0] ||
      g['Common names']?.split(',')[0] ||
      (g.M ? `M${+g.M}` : g.Name.replace(/^(NGC|IC)0*/, '$1 ')),
    zh = C.galaxyNames[g.Name]?.[1] || en,
    scale = num(g.MajAx) ? d * (((+g.MajAx / 60) * Math.PI) / 180) : 60000;
  const o = base(g.Name, g.Type === 'G' ? 'galaxy' : 'galaxy_group', en, zh, ra, dec, d, scale);
  o.aliases = [
    g.Name,
    g.M && `M${+g.M}`,
    g['Common names'],
    ...(g.Identifiers || '').split(','),
  ].filter(Boolean);
  o.distanceMethod = direct ? 'direct' : 'redshift-derived';
  o.redshift = z;
  o.physical = {
    catalogueType: g.Type,
    hubbleType: g.Hubble || null,
    constellation: g.Const,
    majorAxisArcmin: num(g.MajAx),
    minorAxisArcmin: num(g.MinAx),
    positionAngleDeg: num(g.PosAng),
    radialVelocityKms: num(g.RadVel),
    upstreamSources: g.Sources,
  };
  o.sourceIds = ['openngc', direct ? 'simbad' : 'cosmology'];
  o.visual.renderer = 'galaxy';
  o.descriptionZh = `${zh}是一座${g.Hubble ? ' ' + g.Hubble + ' 型' : ''}星系，位于 ${g.Const} 方向。${z !== undefined ? '红移约 ' + z + '。' : ''}可视化距离约 ${round(d / 1e6)} 百万光年${direct ? '（近邻距离锚点）' : '（近似宇宙学距离）'}。${g.MajAx ? '视直径约 ' + g.MajAx + ' 角分。' : ''}`;
  o.descriptionEn = `${en} is a ${g.Hubble || ''} galaxy in the direction of ${g.Const}.${z !== undefined ? ' Its redshift is approximately ' + z + '.' : ''} Visualization distance: approximately ${round(d / 1e6)} Mly (${direct ? 'rounded nearby distance anchor' : 'approximate cosmological distance'}).${g.MajAx ? ' Its angular diameter is approximately ' + g.MajAx + ' arcmin.' : ''}`;
  const facts = {
    NGC0224: ['One of the largest members of the Local Group.', '本星系群最大的成员之一。'],
    NGC4486: [
      'Its central black hole was the first target imaged by the Event Horizon Telescope.',
      '其中心黑洞是事件视界望远镜首张黑洞阴影图像的目标。',
    ],
    NGC5194: [
      'A grand-design spiral interacting with NGC 5195.',
      '一座与 NGC 5195 相互作用的宏观旋涡星系。',
    ],
    NGC3034: ['A nearby starburst galaxy.', '一座邻近的星暴星系。'],
    NGC5128: [
      'An active galaxy with a prominent dust lane and jets.',
      '具有显著尘埃带和喷流的活动星系。',
    ],
  }[g.Name];
  if (facts) {
    o.descriptionEn += ' ' + facts[0];
    o.descriptionZh += facts[1];
  }
  add(o);
}
for (const [id, en, zh, ra, dec, md, size, type] of C.extraGalaxies) {
  add({
    ...base(id, 'galaxy', en, zh, ra, dec, md * 1e6, size),
    distanceMethod: 'direct',
    sourceIds: ['simbad'],
    physical: { hubbleType: type, representativeSystemAnchor: true },
    descriptionZh: `${zh}是一座 ${type} 型星系。可视化采用的近似距离约 ${md} 百万光年。`,
    descriptionEn: `${en} is a ${type}-type galaxy. Its rounded visualization distance is approximately ${md} Mly.`,
    visual: { renderer: 'galaxy', visualScaleMultiplier: 1 },
  });
}
const centre = xyz(266.4168, -29.0078, 26000);
add({
  ...base('milky-way', 'galaxy', 'Milky Way', '银河系', 266.4168, -29.0078, 26000, 106000),
  cartesian: centre,
  distanceMethod: 'direct',
  sourceIds: ['nasa-solar'],
  physical: { hubbleType: 'SBbc' },
  descriptionZh:
    '太阳系所在的棒旋星系。盘面、旋臂、星晕与尘埃为程序生成的示意；命名恒星使用目录位置。',
  descriptionEn:
    'Our barred spiral galaxy. The disk, arms, halo and dust are procedural approximations; named stars retain catalogue positions.',
  visual: { renderer: 'galaxy', visualScaleMultiplier: 1 },
});
for (const [id, en, zh, ra, dec, d, status, enFact, zhFact, host] of C.blackHoles) {
  add({
    ...base(id, 'black_hole', en, zh, ra, dec, d, id === 'sgr-a' ? 0.000008 : 1e-7),
    hostId: host,
    scienceStatus: status,
    sourceIds: ['simbad', 'bh', ...(id === 'sgr-a' || id === 'm87-bh' ? ['eht'] : [])],
    physical: {
      representativeSystemAnchor: true,
      visualisation: 'schematic accretion disk, not a ray-traced GR simulation',
    },
    descriptionZh: `${zhFact} 采用约 ${round(d)} 光年的系统距离锚点。`,
    descriptionEn: `${enFact} A system-distance anchor of approximately ${round(d)} light-years is used.`,
    visual: { renderer: 'blackHole', visualScaleMultiplier: 1000 },
  });
}
for (const [id, en, zh, category, ra, dec, md, extent, status] of C.structures) {
  const facts = C.structureFacts[id] || [
    'An extended cosmic region; the centre and extent are approximate schematic anchors.',
    '一个延展的宇宙区域；中心与范围均采用近似示意锚点。',
  ];
  add({
    ...base(id, category, en, zh, ra, dec, md * 1e6, extent * 1e6),
    scienceStatus: status,
    sourceIds: ['structures'],
    physical: { extentLy: extent * 1e6, representativeCentre: true },
    descriptionZh: `${facts[1]} 大尺度结构以示意方式表示，真实边界弥散。${status === 'debated' ? '该结构的存在或解释尚有争议。' : ''}`,
    descriptionEn: `${facts[0]} Large-scale structures are represented schematically; their real boundaries are diffuse.${status === 'debated' ? ' Reported / debated; its existence or interpretation is not established.' : ''}`,
    visual: {
      renderer: category === 'galaxy_cluster' ? 'cluster' : 'volume',
      visualScaleMultiplier: 1,
    },
  });
}
for (const [id, en, zh, ra, dec, d] of [
  ['orion-spur', 'Orion–Cygnus Arm / Local Spur', '猎户–天鹅臂 / 本地支臂', 80, 20, 1500],
  ['perseus-arm', 'Perseus Arm', '英仙臂', 60, 50, 6500],
  ['sagittarius-arm', 'Sagittarius Arm', '人马臂', 280, -20, 6500],
  ['scutum-arm', 'Scutum–Centaurus Arm', '盾牌–半人马臂', 265, -30, 15000],
])
  add({
    ...base(id, 'filament', en, zh, ra, dec, d, 12000),
    sourceIds: ['nasa-solar'],
    physical: { extentLy: 12000, representativeCentre: true },
    descriptionZh: `${zh}是银河系的旋臂或支臂区域。位置与边界为程序示意。`,
    descriptionEn: `${en} is an arm or spur region of the Milky Way. Its anchor and boundaries are schematic.`,
    visual: { renderer: 'volume', visualScaleMultiplier: 1 },
  });
// Abell centres are rounded B1950 directions, rotated approximately to J2000.
// Seidelmann 1992 position matrix, also tabulated in ERFA eraFk45z. E-terms are
// below the source's arcminute precision and are omitted for these cluster anchors.
function clusterDirection(ra, dec) {
  const a = (ra * Math.PI) / 180,
    d = (dec * Math.PI) / 180;
  const v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const m = [
    [0.9999256782, -0.0111820611, -0.0048579477],
    [0.011182061, 0.9999374784, -0.0000271765],
    [0.0048579479, -0.0000271474, 0.9999881997],
  ];
  const p = m.map((row) => row.reduce((s, n, i) => s + n * v[i], 0));
  return [
    ((Math.atan2(p[1], p[0]) * 180) / Math.PI + 360) % 360,
    (Math.atan2(p[2], Math.hypot(p[0], p[1])) * 180) / Math.PI,
  ];
}
const clusters = await input(
  'abell.dat',
  sources.find((s) => s.id === 'abell'),
  (text) =>
    text
      .split('\n')
      .filter(Boolean)
      .map((line) => ({
        prefix: line[1],
        number: Number(line.slice(2, 6)),
        suffix: line[6].trim(),
        raB1950: (Number(line.slice(7, 9)) + Number(line.slice(9, 12)) / 600) * 15,
        decB1950:
          (line[12] === '-' ? -1 : 1) *
          (Number(line.slice(13, 15)) + Number(line.slice(15, 17)) / 60),
        richness: Number(line[18]),
        redshiftFlag: line[26].trim(),
        redshift: Number(line.slice(27, 31)) / 10000,
        reference: line[31],
        abellRadiusArcmin: Number(line.slice(35, 39)) / 10,
      })),
);
const existingAbell = new Set([426, 1060, 1656, 1689, 2218, 2744, 3526, 3627]);
const clusterBuckets = Array.from({ length: 12 }, () => []);
for (const c of clusters) {
  if (
    c.prefix !== 'A' ||
    c.suffix ||
    c.redshiftFlag ||
    !(c.redshift > 0.005 && c.redshift < 0.4) ||
    existingAbell.has(c.number)
  )
    continue;
  clusterBuckets[Math.min(11, Math.floor(c.raB1950 / 30))].push(c);
}
const selectedClusters = [];
for (let i = 0; selectedClusters.length < 64 && i < 100; i++)
  for (const bucket of clusterBuckets) {
    if (bucket[i] && selectedClusters.length < 64) selectedClusters.push(bucket[i]);
  }
for (const c of selectedClusters) {
  const [ra, dec] = clusterDirection(c.raB1950, c.decB1950),
    d = comoving(c.redshift);
  add({
    ...base(
      `aco-${c.number}`,
      'galaxy_cluster',
      `Abell ${c.number}`,
      `阿贝尔 ${c.number}`,
      ra,
      dec,
      d,
      12e6,
    ),
    aliases: [`ACO ${c.number}`],
    redshift: c.redshift,
    distanceMethod: 'redshift-derived',
    sourceIds: ['abell', 'cosmology'],
    physical: {
      richnessClass: c.richness,
      sourceFrame: 'B1950 FK4',
      raB1950: c.raB1950,
      decB1950: c.decB1950,
      redshiftQuality: 'unflagged measured redshift',
      abellRadiusArcmin: c.abellRadiusArcmin,
      redshiftReference: c.reference,
      extentLy: 12e6,
      extentSchematic: true,
    },
    descriptionZh: `阿贝尔 ${c.number}是一座目录星系团。测量红移约 ${c.redshift}，近似宇宙学距离约 ${round(d / 1e6)} 百万光年。中心由原目录 B1950 方向近似转换到 J2000；显示范围为示意。`,
    descriptionEn: `Abell ${c.number} is a catalogued galaxy cluster with measured redshift ${c.redshift}; approximate cosmological distance ${round(d / 1e6)} Mly. Its rounded B1950 centre is approximately rotated to J2000. The displayed extent is schematic.`,
    visual: { renderer: 'cluster', visualScaleMultiplier: 1 },
  });
}
add({
  ...base('horizon', 'cosmic_boundary', 'Observable Horizon', '可观测宇宙视界', 0, 0, 46.5e9, 93e9),
  sourceIds: ['cosmology'],
  scienceStatus: 'confirmed',
  descriptionZh:
    '你已到达本模拟中的可观测宇宙边界。这里代表我们的宇宙观测视界，而不代表整个宇宙存在实体边缘。',
  descriptionEn:
    'You have reached the observable horizon represented by this simulation. This is the limit of our observable region, not a physical wall or a known edge of the entire universe.',
  visual: { renderer: 'volume', visualScaleMultiplier: 1 },
});
// Solar directions follow the explicitly schematic phase, rather than placeholder RA/Dec.
const earthPosition = objects.find((o) => o.id === 'earth').cartesian;
for (const o of objects.filter(
  (o) =>
    o.sourceIds.includes('nasa-solar') &&
    ['planet', 'dwarf_planet', 'moon', 'star'].includes(o.category),
)) {
  const r = {
    x: o.cartesian.x - earthPosition.x,
    y: o.cartesian.y - earthPosition.y,
    z: o.cartesian.z - earthPosition.z,
  };
  const d = Math.hypot(r.x, r.y, r.z);
  if (d > 0) {
    o.raDeg = ((Math.atan2(-r.z, r.x) * 180) / Math.PI + 360) % 360;
    o.decDeg = (Math.asin(r.y / d) * 180) / Math.PI;
  }
  o.physical.skyDirectionSchematic = true;
}
const retrievedAt = new Date().toISOString();
const counts = Object.fromEntries(
  [...new Set(objects.map((o) => o.category))].map((c) => [
    c,
    objects.filter((o) => o.category === c).length,
  ]),
);
await writeFile(
  new URL('universe-catalog.json', out),
  JSON.stringify(
    {
      version: 1,
      generatedAt: retrievedAt,
      coordinateFrame:
        'ICRS equatorial axes, heliocentric origin; x toward RA 0, y north, -z toward RA 90; ly. Solar phases schematic.',
      counts,
      objects,
    },
    null,
    2,
  ),
);
for (const [file, rows] of [
  ['hyg.csv', [...selected.values()]],
  ['ngc.csv', [...gal.values()]],
  ['exoplanets.json', planets],
  ['abell.dat', selectedClusters],
]) {
  const content = JSON.stringify(rows);
  await writeFile(new URL(file + '.json', snap), content);
  const source = sources.find(
    (s) =>
      s.id ===
      {
        'hyg.csv': 'hyg',
        'ngc.csv': 'openngc',
        'exoplanets.json': 'nasa-exo',
        'abell.dat': 'abell',
      }[file],
  );
  source.snapshotSha256 = createHash('sha256').update(content).digest('hex');
  source.snapshotEntries = rows.length;
  const prior = await readFile(new URL('sources.json', out), 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  source.retrievedAt = process.argv.includes('--refresh')
    ? retrievedAt
    : prior?.sources?.find((s) => s.id === source.id)?.retrievedAt || retrievedAt;
}
await writeFile(
  new URL('sources.json', out),
  JSON.stringify(
    {
      generatedAt: retrievedAt,
      license:
        'HYG/OpenNGC-derived catalogue portions are CC BY-SA 4.0; code is separately licensed.',
      notes: [
        'Coordinates and radii are rounded. Solar orbital phases are schematic, not date-specific ephemerides.',
        'Exoplanets use host-system coordinates; no orbital orientation is invented.',
        'Large-scale structures use approximate representative centres and extents.',
        'Curated black-hole distances are approximate system anchors, not precision astrometry.',
      ],
      sources,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ total: objects.length, counts }, null, 2));
await import('./validate-data.mjs');
