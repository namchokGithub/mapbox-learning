import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapProps {
  center?: [number, number]
  zoom?: number
}

export function Map({ center = [100.5018, 13.7563], zoom = 10 }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
    })

    mapRef.current.addControl(new mapboxgl.NavigationControl())

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
