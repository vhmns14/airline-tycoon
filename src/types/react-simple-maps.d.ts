/**
 * Minimal typings for react-simple-maps (no official @types package).
 */

declare module 'react-simple-maps' {
  import type {
    CSSProperties,
    ReactNode,
    Ref,
    SVGProps,
  } from 'react'

  export type Point = [number, number]

  export interface ProjectionConfig {
    center?: [number, number]
    rotate?: [number, number, number]
    scale?: number
    parallels?: [number, number]
  }

  export interface ComposableMapProps {
    width?: number
    height?: number
    projection?: string
    projectionConfig?: ProjectionConfig
    className?: string
    style?: CSSProperties
    children?: ReactNode
  }

  export interface ZoomableGroupProps {
    center?: [number, number]
    zoom?: number
    minZoom?: number
    maxZoom?: number
    translateExtent?: [[number, number], [number, number]]
    filterZoomEvent?: (event: Event) => boolean
    onMoveStart?: (position: unknown, event: unknown) => void
    onMove?: (position: unknown, event: unknown) => void
    onMoveEnd?: (position: unknown, event: unknown) => void
    className?: string
    children?: ReactNode
  }

  export interface GeographiesChildrenArgs {
    geographies: Array<{ rsmKey: string; svgPath: string; [key: string]: unknown }>
    outline?: unknown
    borders?: unknown
  }

  export interface GeographiesProps {
    geography: string | object
    children: (args: GeographiesChildrenArgs) => ReactNode
    parseGeographies?: (geos: unknown[]) => unknown[]
  }

  export interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: unknown
    style?: {
      default?: CSSProperties
      hover?: CSSProperties
      pressed?: CSSProperties
    }
  }

  export interface MarkerProps {
    coordinates: Point
    children?: ReactNode
    onClick?: (event: React.MouseEvent) => void
    style?: CSSProperties
    className?: string
  }

  export interface MapContextValue {
    width: number
    height: number
    // d3 geo projection — callable [lng, lat] → [x, y] | null
    projection: ((coords: Point) => Point | null) & {
      invert?: (point: Point) => Point | null
    }
    path: (object: unknown) => string | null
  }

  export const ComposableMap: (props: ComposableMapProps) => JSX.Element
  export const ZoomableGroup: (props: ZoomableGroupProps) => JSX.Element
  export const Geographies: (props: GeographiesProps) => JSX.Element
  export const Geography: (props: GeographyProps) => JSX.Element
  export const Marker: (props: MarkerProps) => JSX.Element
  export const Sphere: (props: SVGProps<SVGPathElement>) => JSX.Element
  export const Graticule: (props: SVGProps<SVGPathElement> & { step?: Point }) => JSX.Element
  export function useMapContext(): MapContextValue
}
