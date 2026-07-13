/**
 * Precomputed world map geometry (paths + projection helper).
 * Built once at module load from local world-atlas topojson.
 */

import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import topology from 'world-atlas/countries-110m.json'

export const MAP_WIDTH = 980
export const MAP_HEIGHT = 560

type CountryProps = GeoJSON.GeoJsonProperties

const topo = topology as unknown as Topology<{
  countries: GeometryCollection<CountryProps>
}>

const countriesFc = feature(
  topo,
  topo.objects.countries,
) as GeoJSON.FeatureCollection<GeoJSON.Geometry, CountryProps>

/** Mercator fitted to world land so the full globe is visible. */
export const mapProjection = geoMercator().fitExtent(
  [
    [12, 12],
    [MAP_WIDTH - 12, MAP_HEIGHT - 12],
  ],
  countriesFc,
)

const pathGen = geoPath(mapProjection)

/** Precomputed SVG path `d` strings for each country. */
export const countryPathDs: string[] = countriesFc.features
  .map((f) => pathGen(f))
  .filter((d): d is string => typeof d === 'string' && d.length > 0)

/** Project [lng, lat] → SVG [x, y], or null if unprojectable. */
export function projectLngLat(
  lng: number,
  lat: number,
): [number, number] | null {
  const p = mapProjection([lng, lat])
  if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return null
  return [p[0], p[1]]
}
