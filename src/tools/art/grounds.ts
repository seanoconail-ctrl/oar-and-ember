/**
 * The ground sheet each zone is drawn with (Book 7 section 14; Stage 14, decision S14-32), and
 * what each ground sheet paints. A zone's plan names its sheet (`ground`, default tile_strand);
 * this table is what art lint and the sheet generator hold the zones to.
 */
import type { GroundSet } from './strandArt.ts';

export const ZONE_GROUND: Readonly<Record<string, string>> = {
  ZONE_SK_STRAND: 'tile_strand',
  ZONE_SK_MACHAIR: 'tile_strand',
  ZONE_SK_HAGSEAT: 'tile_strand',
  ZONE_SK_CAIRN: 'tile_strand',
  ZONE_SK_SEALCAVE: 'tile_strand',
  ZONE_SEA_WRECK: 'tile_strand',
  // Stage 14: the moor's and the new coast's scenes, and the two interiors.
  ZONE_SK_NAUST: 'tile_strand',
  ZONE_SK_SKERRY: 'tile_moor',
  ZONE_SK_GEO: 'tile_moor',
  ZONE_SK_CLIFFS: 'tile_moor',
  ZONE_SK_ROOK: 'tile_moor',
  ZONE_SK_BOG: 'tile_moor',
  ZONE_SK_SEALCAVE_DEEP: 'tile_cave',
  ZONE_SK_CAIRN_IN: 'tile_cave',
};

/** How each ground sheet paints its tiles. */
export const GROUND_SETS: Readonly<Record<string, GroundSet>> = {
  tile_strand: 'strand',
  tile_moor: 'moor',
  tile_cave: 'cave',
};

/** The plant sheet each ground's zones draw their plants from. */
export const GROUND_PLANTS: Readonly<Record<string, string>> = {
  tile_strand: 'plant_strand',
  tile_moor: 'plant_moor',
  tile_cave: 'plant_moor',
};
