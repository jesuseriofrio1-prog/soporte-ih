<script setup lang="ts">
/**
 * MapPicker: el cliente final ubica su dirección exacta arrastrando un pin.
 * El mapa está siempre abierto y el cliente tiene que mover/confirmar el
 * marker — lat/lng son obligatorios en el submit del formulario.
 *
 * IMPORTANTE: este componente NO toca el texto de la dirección. El cliente
 * escribe su dirección a mano y el mapa solo aporta las coordenadas GPS.
 * Esto evita el problema de Plus Codes (R4X4+VCW...) y direcciones basura
 * del reverse-geocoding en zonas residenciales mal indexadas.
 *
 * Interacción externa:
 *  - prop `targetLocation` (ej. "Guayaquil, Guayas, Ecuador"): cuando cambia,
 *    hacemos forward-geocoding y re-centramos el mapa + movemos el pin ahí.
 *    Así el cliente empieza con el pin en su ciudad y solo lo ajusta unas
 *    cuadras hasta su casa.
 *  - emit 'coords' cuando mueve el pin.
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
  (e: 'coords', coords: { lat: number; lng: number }): void
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

// --- Pin → coords (sin tocar texto) ----------------------------------------

function onPinMoved() {
  const pos = marker.value?.getPosition()
  if (!pos) return
  emit('coords', { lat: pos.lat(), lng: pos.lng() })
}

// --- Forward geocoding (cuando cambia la ciudad elegida) -------------------
// Solo re-centra el mapa y mueve el pin al centro de la ciudad como punto de
// partida. NO modifica el texto de dirección del formulario — eso lo escribe
// el cliente.

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
    map.value.setZoom(DEFAULT_ZOOM_PIN - 2)
    marker.value.setPosition(ll)
    emit('coords', { lat: loc.lat(), lng: loc.lng() })
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
// Modal de permiso bloqueado: el navegador no re-pregunta después de un deny,
// así que mostramos instrucciones para desbloquear desde la barra de dirección.
const showPermisoModal = ref(false)
const modalMotivo = ref<'denied' | 'unavailable'>('denied')

// Detecta si el navegador es iOS — las instrucciones cambian mucho.
function esIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

async function usarMiUbicacion() {
  if (!navigator.geolocation) {
    gpsError.value = 'Tu navegador no soporta geolocalización.'
    return
  }

  // Chequeo proactivo: si ya fue denegado, mostramos modal sin intentar pedir.
  // Safari no soporta Permissions API para geolocation — ahí caemos al try/catch.
  try {
    if (navigator.permissions) {
      const status = await navigator.permissions.query({
        name: 'geolocation' as PermissionName,
      })
      if (status.state === 'denied') {
        modalMotivo.value = 'denied'
        showPermisoModal.value = true
        return
      }
    }
  } catch {
    // Permissions API no soportada — seguimos con getCurrentPosition directo.
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
      }
    },
    (err) => {
      gpsLoading.value = false
      if (err.code === err.PERMISSION_DENIED) {
        modalMotivo.value = 'denied'
        showPermisoModal.value = true
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        // Típico en Mac con Location Services apagados a nivel del sistema.
        modalMotivo.value = 'unavailable'
        showPermisoModal.value = true
      } else if (err.code === err.TIMEOUT) {
        gpsError.value = 'Tardó demasiado. Intenta de nuevo o arrastra el pin manualmente.'
      } else {
        gpsError.value = 'No se pudo obtener tu ubicación. Arrastra el pin manualmente.'
      }
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

    <!-- Modal: permiso de ubicación bloqueado -->
    <div
      v-if="showPermisoModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.5);"
      @click.self="showPermisoModal = false"
    >
      <div
        class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        style="color: #18181b;"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style="background: #fef3c7;"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2">
              <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-base font-semibold">
              {{ modalMotivo === 'unavailable' ? 'Ubicación no disponible' : 'Permiso de ubicación bloqueado' }}
            </h3>
            <p class="mt-1 text-sm" style="color: #52525b;">
              {{
                modalMotivo === 'unavailable'
                  ? 'Tu dispositivo no pudo determinar tu ubicación. Revisa:'
                  : 'Tu navegador bloqueó el acceso a tu ubicación. Para activarlo:'
              }}
            </p>
          </div>
        </div>

        <div
          v-if="modalMotivo === 'unavailable'"
          class="mt-4 rounded-lg border p-3 text-sm"
          style="border-color: #e4e4e7; background: #fafafa;"
        >
          <p class="font-medium">En Mac:</p>
          <ol class="mt-1 list-decimal space-y-1 pl-5" style="color: #3f3f46;">
            <li>Abre <strong>Ajustes del Sistema</strong> → <strong>Privacidad y seguridad</strong> → <strong>Servicios de localización</strong>.</li>
            <li>Actívalos y asegúrate que <strong>Chrome/Safari</strong> esté permitido.</li>
            <li>Recarga la página y vuelve a tocar "Usar mi ubicación".</li>
          </ol>
          <p class="mt-2 font-medium">En Windows:</p>
          <ol class="mt-1 list-decimal space-y-1 pl-5" style="color: #3f3f46;">
            <li>Abre <strong>Configuración</strong> → <strong>Privacidad</strong> → <strong>Ubicación</strong>.</li>
            <li>Activa "Permitir que las apps accedan a tu ubicación".</li>
          </ol>
        </div>

        <div
          v-else
          class="mt-4 rounded-lg border p-3 text-sm"
          style="border-color: #e4e4e7; background: #fafafa;"
        >
          <template v-if="esIOS()">
            <p class="font-medium">En iPhone/iPad (Safari):</p>
            <ol class="mt-1 list-decimal space-y-1 pl-5" style="color: #3f3f46;">
              <li>Abre <strong>Ajustes</strong> → <strong>Safari</strong> → <strong>Ubicación</strong>.</li>
              <li>Selecciona <strong>Preguntar</strong> o <strong>Permitir</strong>.</li>
              <li>Vuelve aquí y recarga la página.</li>
            </ol>
          </template>
          <template v-else>
            <p class="font-medium">En tu navegador:</p>
            <ol class="mt-1 list-decimal space-y-1 pl-5" style="color: #3f3f46;">
              <li>Toca el ícono de candado 🔒 (o <strong>ⓘ</strong>) a la izquierda de la barra de dirección.</li>
              <li>Busca <strong>Ubicación</strong> y cámbialo a <strong>Permitir</strong>.</li>
              <li>Recarga la página y vuelve a tocar "Usar mi ubicación".</li>
            </ol>
          </template>
        </div>

        <p class="mt-3 text-xs" style="color: #71717a;">
          O simplemente arrastra el pin en el mapa hasta tu casa — también funciona.
        </p>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            @click="showPermisoModal = false"
            class="h-9 rounded-lg px-4 text-sm font-medium"
            style="background: #18181b; color: #fafafa;"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
