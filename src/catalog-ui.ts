import type { Category } from './types';
export const categoryNames: Record<Category, [string, string]> = {
  planet: ['行星', 'Planet'],
  dwarf_planet: ['矮行星', 'Dwarf planet'],
  moon: ['卫星', 'Moon'],
  star: ['恒星', 'Star'],
  exoplanet: ['系外行星', 'Exoplanet'],
  galaxy: ['星系', 'Galaxy'],
  black_hole: ['黑洞系统', 'Black-hole system'],
  galaxy_group: ['星系群', 'Galaxy group'],
  galaxy_cluster: ['星系团', 'Galaxy cluster'],
  supercluster: ['超星系团', 'Supercluster'],
  wall: ['宇宙墙', 'Wall'],
  filament: ['丝状结构', 'Filament'],
  void: ['空洞', 'Void'],
  cosmic_boundary: ['观测视界', 'Horizon'],
};
