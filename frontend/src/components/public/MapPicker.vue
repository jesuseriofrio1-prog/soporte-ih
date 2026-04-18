<script setup lang="ts">
/**
 * MapPicker: permite al cliente final ubicar su dirección exacta en un
 * mapa arrastrando un pin. Al soltar, hace reverse-geocoding y emite:
 *  - 'address'   → texto formateado de la dirección
 *  - 'coords'    → { lat, lng }
 *  - 'locality'  → { provincia, ciudad } si Google los detectó
 *
 * Carga el script de Google Maps SOLO cuando el usuario hace clic en
 * "Ubicar en mapa" (lazy) — así los clientes que solo escriben no
 * gastan una carga de mapa.
 *
 * Privacy: la API key está restringida por HTTP-referrer a
 * soporteih.vercel.app + localhost, así que exponerla en el bundle
 * no permite abuso desde otros dominios.
 */
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

const props = defineProps<{
  /** Centro inicial del mapa si el cliente no ha pickeado nada aún. */
  initialCenter?: { lat: number; lng: number } | null
  /** Coords actuales (si el cliente ya pickeó una vez y vuelve a abrir). */
  value?: { lat: number; lng: number } | null
}>()

const emit = defineEmits<{
  (e: 'address', address: string): void
  (e: 'coords', coords: { lat: number; lng: number }): void
  (e: 'locality', locality: { provincia?: string; ciudad?: string }): void
}>()

// Centro por defecto: Quito, Ecuador. Suficientemente neutro y el cliente
// siempre termina arrastrando el pin donde vive.
const DEFAULT_CENTER = { lat: -0.1807, lng: -78.4678 }
const DEFAULT_ZOOM_COUNTRY = 13
const DEFAULT_ZOOM_PIN = 17

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

const open = ref(false)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const mapEl = ref<HTMLDivElement | null>(null)

// shallowRef: los objetos de Google Maps son reactive-hostiles (miles de
// getters internos). shallowRef evita que Vue intente trackearlos.
const map = shallowRef<google.maps.Map | null>(null)
const marker = shallowRef<google.maps.Marker | null>(null)
const geocoder = shallowRef<google.maps.Geocoder | null>(null)

const hasKey = computed(() => Boolean(API_KEY && API_KEY.length > 10))

// --- Carga perezosa del script de Google Maps ------------------------------

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
    // v=weekly trae los bug-fixes; libraries=geocoding ya viene por default
    // pero lo pedimos explícito para que no falle si cambian los defaults.
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

async function abrirMapa() {
  if (open.value) return
  if (!hasKey.value) {
    errorMsg.value = 'El mapa no está configurado todavía.'
    return
  }
  open.value = true
  loading.value = true
  errorMsg.value = null
  try {
    await loadGoogleMaps()
    // Esperamos al próximo tick para que mapEl esté renderizado.
    await new Promise((r) => requestAnimationFrame(r))
    if (!mapEl.value) {
      throw new Error('El contenedor del mapa no está listo')
    }

    const center = props.value ?? props.initialCenter ?? DEFAULT_CENTER
    const zoom = props.value ? DEFAULT_ZOOM_PIN : DEFAULT_ZOOM_COUNTRY

    const g = window.google.maps
    map.value = new g.Map(mapEl.value, {
      center,
      zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      // En móvil evitamos que el mapa capture scrolls accidentales: el
      // usuario tiene que hacer gesto de dos dedos.
      gestureHandling: 'greedy',
    })
    marker.value = new g.Marker({
      position: center,
      map: map.value,
      draggable: true,
    })
    geocoder.value = new g.Geocoder()

    // Drag del pin
    marker.value.addListener('dragend', onPinMoved)
    // Clic en el mapa → mueve el pin ahí
    map.value.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !marker.value) return
      marker.value.setPosition(e.latLng)
      onPinMoved()
    })

    // Si ya había coords, disparamos reverse geocoding inmediato
    if (props.value) {
      await reverseGeocode(props.value)
    }
  } catch (err: unknown) {
    errorMsg.value =
      err instanceof Error ? err.message : 'No se pudo inicializar el mapa'
    open.value = false
  } finally {
    loading.value = false
  }
}

function cerrarMapa() {
  open.value = false
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
    // Extraemos provincia / ciudad de los address_components para que el
    // form los autocomplete también.
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
    // No pasa nada — el usuario puede escribir el texto a mano.
  }
}

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
      } else {
        // Abre el mapa si no estaba abierto
        abrirMapa().then(() => {
          if (marker.value && map.value) {
            const ll = new window.google.maps.LatLng(coords.lat, coords.lng)
            marker.value.setPosition(ll)
            map.value.setCenter(ll)
            map.value.setZoom(DEFAULT_ZOOM_PIN)
            reverseGeocode(coords)
          }
        })
      }
    },
    (err) => {
      gpsLoading.value = false
      gpsError.value =
        err.code === err.PERMISSION_DENIED
          ? 'No diste permiso de ubicación. Puedes arrastrar el pin manualmente.'
          : 'No se pudo obtener tu ubicación. Arrastra el pin manualmente.'
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
  )
}

// --- Cleanup ---------------------------------------------------------------

onBeforeUnmount(() => {
  if (marker.value) marker.value.setMap(null)
  // Los listeners se van con el map instance cuando se descarta.
  map.value = null
  marker.value = null
  geocoder.value = null
})

// Si el padre actualiza `value` mientras el mapa está cerrado, y luego
// lo abre, se reusa ese centro (ver abrirMapa).
watch(
  () => props.value,
  (v) => {
    if (!v || !map.value || !marker.value) return
    const ll = new window.google.maps.LatLng(v.lat, v.lng)
    marker.value.setPosition(ll)
    map.value.panTo(ll)
  },
)
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap gap-2">
      <button
        v-if="!open"
        type="button"
        @click="abrirMapa"
        :disabled="!hasKey"
        class="inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium transition"
        style="border-color: #d4d4d8; color: #18181b; background: #fafafa;"
      >
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.5 4.5 8 4.5 8s4.5-4.5 4.5-8c0-2.5-2-4.5-4.5-4.5z" />
          <circle cx="8" cy="6" r="1.5" />
        </svg>
        Ubicar en el mapa
      </button>
      <button
        v-else
        type="button"
        @click="cerrarMapa"
        class="inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium transition"
        style="border-color: #d4d4d8; color: #18181b; background: #fafafa;"
      >
        Cerrar mapa
      </button>
      <button
        type="button"
        @click="usarMiUbicacion"
        :disabled="gpsLoading"
        class="inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium transition disabled:opacity-50"
        style="border-color: #d4d4d8; color: #18181b; background: #fafafa;"
      >
        <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
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
      v-if="open"
      class="space-y-2"
    >
      <div class="text-xs" style="color: #52525b;">
        Arrastra el pin hasta tu casa para que el mensajero llegue exacto. Puedes
        hacer clic en el mapa para moverlo.
      </div>
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
  </div>
</template>
