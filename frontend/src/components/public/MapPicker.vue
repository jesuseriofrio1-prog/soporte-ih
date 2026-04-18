<script setup lang="ts">
/**
 * MapPicker: el cliente final ubica su dirección exacta arrastrando un pin.
 * El mapa está siempre abierto y el cliente tiene que mover/confirmar el
 * marker — lat/lng son obligatorios en el submit del formulario.
 *
 * Interacción externa:
 *  - prop `targetLocation` (ej. "Guayaquil, Guayas, Ecuador"): cuando cambia,
 *    hacemos forward-geocoding y re-centramos el mapa + movemos el pin ahí.
 *    Así el cliente empieza con el pin en su ciudad y solo lo ajusta unas
 *    cuadras hasta su casa.
 *  - emit 'address' / 'coords' / 'locality' cuando mueve el pin.
 *
 * Privacy: la API key está restringida por HTTP-referrer a soporteih.vercel.app
 * + localhost, así que exponerla en el bundle no permite abuso externo.
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  /** Coords actuales (si el cliente ya pickeó una vez). */
  value?: { lat: number; lng: number } | null
  /** Texto "Ciudad, Provincia, Ecuador" — al cambiar, re-centra + mueve pin. */
  targetLocation?: string
}>()

const emit = defineEmits<{
  (e: 'address', address: string): void
  (e: 'coords', coords: { lat: number; lng: number }): void
  (e: 'locality', locality: { provincia?: string; ciudad?: string }): void
}>()

// Centro por defecto: Quito. Se re-centra apenas el cliente elija ciudad.
const DEFAULT_CENTER = { lat: -0.1807, lng: -78.4678 }
const DEFAULT_ZOOM_COUNTRY = 13
const DEFAULT_ZOOM_PIN = 17

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

const loading = ref(true)
const errorMsg = ref<string | null>(null)
const mapEl = ref<HTMLDivElement | null>(null)

// shallowRef: los objetos de Google Maps son reactive-hostiles.
const map = shallowRef<google.maps.Map | null>(null)
const marker = shallowRef<google.maps.Marker | null>(null)
const geocoder = shallowRef<google.maps.Geocoder | null>(null)

// --- Carga perezosa del script (una sola vez aunque haya varias instancias) -

let scriptPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (scriptPromise) return scriptPromise
  if (typeof window !== 'undefined' && window.google?.maps) {
    scriptPromise = Promise.resolve()
    return scriptPromise
  }
  if (!API_KEY) {
    return Promise.reject(new Error('Falta VITE_GOOGLE_MAPS_API_KEY'))
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      API_KEY,
    )}&v=weekly&language=es&region=EC`
    script.async = true
    script.defer = true
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'))
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
  return scriptPromise
}

// --- Inicialización del mapa -----------------------------------------------

async function initMap() {
  loading.value = true
  errorMsg.value = null
  try {
    await loadGoogleMaps()
    await new Promise((r) => requestAnimationFrame(r))
    if (!mapEl.value) throw new Error('Contenedor del mapa no disponible')

    const center = props.value ?? DEFAULT_CENTER
    const zoom = props.value ? DEFAULT_ZOOM_PIN : DEFAULT_ZOOM_COUNTRY

    const g = window.google.maps
    map.value = new g.Map(mapEl.value, {
      center,
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    })
    marker.value = new g.Marker({
      position: center,
      map: map.value,
      draggable: true,
    })
    geocoder.value = new g.Geocoder()

    marker.value.addListener('dragend', onPinMoved)
    map.value.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !marker.value) return
      marker.value.setPosition(e.latLng)
      onPinMoved()
    })

    // Si ya tenemos coords (cliente vuelve al form), reverse-geocode una vez.
    if (props.value) {
      await reverseGeocode(props.value)
    }
    // Si ya viene una ciudad elegida, re-centramos al toque.
    if (props.targetLocation) {
      await centrarEnCiudad(props.targetLocation)
    }
  } catch (err: unknown) {
    errorMsg.value =
      err instanceof Error ? err.message : 'No se pudo inicializar el mapa'
  } finally {
    loading.value = false
  }
}

// --- Reverse geocoding -----------------------------------------------------

async function onPinMoved() {
  const pos = marker.value?.getPosition()
  if (!pos) return
  const coords = { lat: pos.lat(), lng: pos.lng() }
  emit('coords', coords)
  await reverseGeocode(coords)
}

async function reverseGeocode(coords: { lat: number; lng: number }) {
  if (!geocoder.value) return
  try {
    const res = await geocoder.value.geocode({ location: coords })
    const best = res.results?.[0]
    if (!best) return
    emit('address', best.formatted_address)
    const comps = best.address_components || []
    const locality = {
      provincia: comps.find((c) =>
        c.types.includes('administrative_area_level_1'),
      )?.long_name,
      ciudad:
        comps.find((c) => c.types.includes('locality'))?.long_name ||
        comps.find((c) => c.types.includes('administrative_area_level_2'))
          ?.long_name,
    }
    emit('locality', locality)
  } catch {
    // El cliente puede escribir a mano, no bloqueamos.
  }
}

// --- Forward geocoding (cuando cambia la ciudad elegida) -------------------

async function centrarEnCiudad(query: string) {
  if (!geocoder.value || !map.value || !marker.value) return
  try {
    const res = await geocoder.value.geocode({
      address: query,
      componentRestrictions: { country: 'ec' },
    })
    const first = res.results?.[0]
    if (!first) return
    const loc = first.geometry.location
    const ll = new window.google.maps.LatLng(loc.lat(), loc.lng())
    map.value.setCenter(ll)
    map.value.setZoom(DEFAULT_ZOOM_PIN - 2) // un poco más amplio para que ubique su sector
    marker.value.setPosition(ll)
    // Emitimos coords inmediatamente — punto de partida. El cliente
    // igual debería arrastrar el pin a su cuadra exacta.
    emit('coords', { lat: loc.lat(), lng: loc.lng() })
    // Reverse-geocode para llenar la dirección textual aproximada.
    await reverseGeocode({ lat: loc.lat(), lng: loc.lng() })
  } catch {
    // Silencio — si falla el geocoding, el mapa se queda donde estaba.
  }
}

// Watch: cuando el padre cambia la ciudad elegida, re-centramos.
watch(
  () => props.targetLocation,
  (q) => {
    if (q && map.value) centrarEnCiudad(q)
  },
)

// Watch: si el padre cambia `value` (poco común), sincronizamos marker.
watch(
  () => props.value,
  (v) => {
    if (!v || !map.value || !marker.value) return
    const ll = new window.google.maps.LatLng(v.lat, v.lng)
    marker.value.setPosition(ll)
    map.value.panTo(ll)
  },
)

// --- Geolocation como atajo -----------------------------------------------

const gpsLoading = ref(false)
const gpsError = ref<string | null>(null)

function usarMiUbicacion() {
  if (!navigator.geolocation) {
    gpsError.value = 'Tu navegador no soporta geolocalización.'
    return
  }
  gpsLoading.value = true
  gpsError.value = null
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsLoading.value = false
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      emit('coords', coords)
      if (map.value && marker.value) {
        const ll = new window.google.maps.LatLng(coords.lat, coords.lng)
        marker.value.setPosition(ll)
        map.value.setCenter(ll)
        map.value.setZoom(DEFAULT_ZOOM_PIN)
        reverseGeocode(coords)
      }
    },
    (err) => {
      gpsLoading.value = false
      gpsError.value =
        err.code === err.PERMISSION_DENIED
          ? 'No diste permiso de ubicación. Arrastra el pin manualmente.'
          : 'No se pudo obtener tu ubicación. Arrastra el pin manualmente.'
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
  )
}

// --- Lifecycle --------------------------------------------------------------

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  if (marker.value) marker.value.setMap(null)
  map.value = null
  marker.value = null
  geocoder.value = null
})
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <p class="text-xs" style="color: #52525b;">
        Arrastra el pin hasta tu casa para que el mensajero llegue exacto.
      </p>
      <button
        type="button"
        @click="usarMiUbicacion"
        :disabled="gpsLoading || loading"
        class="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition disabled:opacity-50"
        style="border-color: #d4d4d8; color: #18181b; background: #fafafa;"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke-linecap="round" />
        </svg>
        {{ gpsLoading ? 'Buscando…' : 'Usar mi ubicación' }}
      </button>
    </div>

    <p
      v-if="errorMsg || gpsError"
      class="text-xs"
      style="color: #b91c1c;"
    >
      {{ errorMsg || gpsError }}
    </p>

    <div
      ref="mapEl"
      class="w-full rounded-lg border overflow-hidden"
      style="height: 320px; border-color: #d4d4d8; background: #f4f4f5;"
    ></div>
    <div
      v-if="loading"
      class="text-xs"
      style="color: #52525b;"
    >
      Cargando mapa…
    </div>
  </div>
</template>
