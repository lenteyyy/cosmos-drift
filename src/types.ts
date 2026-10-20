export type Category =
  | 'planet'
  | 'dwarf_planet'
  | 'moon'
  | 'star'
  | 'exoplanet'
  | 'galaxy'
  | 'black_hole'
  | 'galaxy_group'
  | 'galaxy_cluster'
  | 'supercluster'
  | 'wall'
  | 'filament'
  | 'void'
  | 'cosmic_boundary';
export interface CosmicObject {
  id: string;
  category: Category;
  nameEn: string;
  nameZh: string;
  aliases: string[];
  raDeg: number;
  decDeg: number;
  distanceLy: number;
  redshift?: number;
  cartesian: { x: number; y: number; z: number };
  scaleLy: number;
  hostId?: string;
  descriptionZh: string;
  descriptionEn: string;
  scienceStatus: 'confirmed' | 'catalogued' | 'candidate' | 'reported' | 'debated';
  isProcedural: boolean;
  sourceIds: string[];
  distanceMethod?: 'direct' | 'catalog' | 'redshift-derived';
  physical: Record<string, number | string | boolean | null>;
  visual: { renderer: string; visualScaleMultiplier: number };
}
export interface Catalog {
  objects: CosmicObject[];
  generatedAt: string;
  counts: Record<string, number>;
}
export interface Source {
  id: string;
  name: string;
  url: string;
  license: string;
  attribution: string;
  retrievedAt?: string;
}
export type Panel = 'map' | 'info' | 'log' | 'settings' | 'help' | null;
