<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import solicitudesService, {
  type TiendaPublica,
  type ProductoPublico,
} from '../services/solicitudesService'
import referidosService from '../services/referidosService'
import MapPicker from '../components/public/MapPicker.vue'
import {
  PROVINCIAS_EC,
  CANTONES_POR_PROVINCIA,
  geocodeQuery,
  type ProvinciaEC,
} from '../data/ecuador-geo'
import {
  agenciasDeCiudad,
  type AgenciaServientrega,
} from '../data/servientrega-agencias'

const route = useRoute()

const tiendaSlug = computed(() => route.params.tiendaSlug as string)
const productoSlug = computed(() => (route.params.productoSlug as string) || '')

// Captura el código de referido del query ?ref=XXX. Se envía con la
// solicitud y se muestra validado en la UI ("Has sido referido por X").
const referidoCodigo = computed(() =>
  typeof route.query.ref === 'string' ? route.query.ref.trim().toUpperCase() : '',
)
const referidoInfo = ref<{ referente_nombre: string; valido: boolean } | null>(null)

const loading = ref(true)
const loadError = ref<string | null>(null)
const tienda = ref<TiendaPublica | null>(null)
const producto = ref<ProductoPublico | null>(null)
const catalogo = ref<ProductoPublico[]>([])

const form = ref({
  cliente_nombre: '',
  cliente_telefono: '',
  tipo_entrega: 'DOMICILIO' as 'DOMICILIO' | 'AGENCIA',
  provincia: '',
  ciudad: '',
  direccion: '',
  direccion_referencia: '',
  agencia_id: '' as string, // índice dentro de agenciasParaCiudad (como key del <select>)
  cantidad: 1,
  notas: '',
  producto_id: '' as string,
})

// Coordenadas elegidas en el map picker. Obligatorias al enviar el form:
// exigimos que el cliente confirme el marker para reducir novedades del
// mensajero por direcciones ambiguas.
const coords = ref<{ lat: number; lng: number } | null>(null)

// Cantones disponibles según la provincia elegida. Cascada: al cambiar de
// provincia, si la ciudad ya seleccionada no pertenece a la nueva lista la
// limpiamos.
const ciudadesDisponibles = computed<string[]>(() => {
  const p = form.value.provincia as ProvinciaEC
  return (p && CANTONES_POR_PROVINCIA[p]) || []
})

watch(
  () => form.value.provincia,
  (nueva) => {
    const ciudades = (nueva && CANTONES_POR_PROVINCIA[nueva as ProvinciaEC]) || []
    if (form.value.ciudad && !ciudades.includes(form.value.ciudad)) {
      form.value.ciudad = ''
    }
  },
)

// Query para el map picker: "Guayaquil, Guayas, Ecuador". Cuando cambia,
// MapPicker hace forward-geocoding y re-centra el mapa + mueve el pin.
const mapTargetLocation = computed(() =>
  form.value.provincia && form.value.ciudad
    ? geocodeQuery(form.value.provincia, form.value.ciudad)
    : '',
)

// Agencias Servientrega disponibles para la ciudad elegida. El v-model del
// dropdown es el índice (stringified) dentro de este array.
const agenciasParaCiudad = computed<AgenciaServientrega[]>(() =>
  agenciasDeCiudad(form.value.provincia, form.value.ciudad),
)

// Si cambia la ciudad, resetear la agencia elegida (la anterior podría
// pertenecer a otra ciudad).
watch(
  () => [form.value.provincia, form.value.ciudad],
  () => {
    form.value.agencia_id = ''
  },
)

// El mapa solo entrega coordenadas. La dirección textual la escribe el
// cliente y NO se toca — así evitamos Plus Codes ("R4X4+VCW…") y direcciones
// basura que salen del reverse-geocoding en zonas mal indexadas.
function onMapCoords(c: { lat: number; lng: number }) {
  coords.value = c
}

const submitting = ref(false)
const done = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  // Validar código de referido (si viene en el URL) — es fire-and-forget
  // porque no queremos bloquear la carga principal si falla.
  if (referidoCodigo.value) {
    referidosService.validarPublico(tiendaSlug.value, referidoCodigo.value)
      .then((v) => { referidoInfo.value = v })
      .catch(() => { referidoInfo.value = null })
  }

  try {
    // El formulario público siempre exige producto (el link genérico de
    // catálogo fue removido). Si alguien llega sin productoSlug, la ruta
    // del router ya rechaza — acá asumimos que viene.
    const { tienda: t, producto: p } = await solicitudesService.productoPublico(
      tiendaSlug.value,
      productoSlug.value,
    )
    tienda.value = t
    producto.value = p

    // Cargamos el catálogo completo SOLO para que bundleSugerido pueda
    // encontrar upgrades asociados al producto elegido. No se muestra
    // dropdown de productos al cliente.
    try {
      const { catalogo: c } = await solicitudesService.tiendaPublica(tiendaSlug.value)
      catalogo.value = c
    } catch {
      catalogo.value = [p]
    }

    aplicarColores()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } }
    if (err.response?.status === 404) {
      loadError.value = 'Este enlace ya no está disponible.'
    } else {
      loadError.value = 'No se pudo cargar el formulario. Intenta de nuevo.'
    }
  } finally {
    loading.value = false
  }
})

function aplicarColores() {
  if (!tienda.value) return
  // Los colores por tienda se eliminaron; usamos tokens del design system.
  // Estos alias --brand-* se mantienen como puente para no reescribir cada
  // referencia del template.
  const root = document.documentElement
  root.style.setProperty('--brand-primary', 'var(--ink)')
  root.style.setProperty('--brand-secondary', 'var(--accent-soft)')
  root.style.setProperty('--brand-fondo', 'var(--paper-alt)')
  document.title = `Comprar en ${tienda.value.nombre}`
}

function onTelefonoInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  // Solo dígitos, máx 10. Si escribe + o 593 al inicio, lo limpia.
  const digitsOnly = raw.replace(/\D/g, '').slice(0, 10)
  form.value.cliente_telefono = digitsOnly
  // Forzar el valor visible a coincidir (por si el navegador coló un char raro).
  ;(e.target as HTMLInputElement).value = digitsOnly
}

async function submit() {
  error.value = null
  if (!form.value.cliente_nombre.trim() || form.value.cliente_nombre.trim().length < 2) {
    error.value = 'Escribe tu nombre completo.'
    return
  }
  if (!/^09\d{8}$/.test(form.value.cliente_telefono)) {
    error.value = 'Teléfono inválido. Debe empezar con 09 y tener 10 dígitos (ej. 0991234567).'
    return
  }
  if (!form.value.provincia) {
    error.value = 'Selecciona tu provincia.'
    return
  }
  if (!form.value.ciudad) {
    error.value = 'Selecciona tu ciudad.'
    return
  }

  // Validación diferenciada por tipo de entrega.
  const esDomicilio = form.value.tipo_entrega === 'DOMICILIO'
  let agenciaElegida: AgenciaServientrega | null = null

  if (esDomicilio) {
    if (!form.value.direccion.trim() || form.value.direccion.trim().length < 5) {
      error.value = 'Escribe tu dirección completa.'
      return
    }
    if (!coords.value) {
      error.value = 'Ubica tu casa en el mapa moviendo el pin.'
      return
    }
  } else {
    const idx = Number(form.value.agencia_id)
    agenciaElegida = agenciasParaCiudad.value[idx] ?? null
    if (!agenciaElegida) {
      error.value = 'Elige la agencia Servientrega donde quieres retirar.'
      return
    }
  }

  if (!productoSlug.value && !form.value.producto_id) {
    error.value = 'Selecciona el producto que deseas.'
    return
  }

  submitting.value = true
  try {
    await solicitudesService.crearDesdePublico(
      tiendaSlug.value,
      {
        cliente_nombre: form.value.cliente_nombre.trim(),
        cliente_telefono: form.value.cliente_telefono.trim(),
        tipo_entrega: form.value.tipo_entrega,
        provincia: form.value.provincia || undefined,
        ciudad: form.value.ciudad.trim() || undefined,
        direccion: esDomicilio ? form.value.direccion.trim() : undefined,
        direccion_referencia: esDomicilio
          ? form.value.direccion_referencia.trim() || undefined
          : undefined,
        lat: esDomicilio ? coords.value?.lat : undefined,
        lng: esDomicilio ? coords.value?.lng : undefined,
        agencia_nombre: !esDomicilio ? agenciaElegida!.nombre : undefined,
        agencia_direccion: !esDomicilio ? agenciaElegida!.direccion : undefined,
        cantidad: form.value.cantidad,
        notas: form.value.notas.trim() || undefined,
        producto_id: productoSlug.value ? undefined : form.value.producto_id || undefined,
        referido_codigo: referidoCodigo.value || undefined,
      },
      productoSlug.value || undefined,
    )
    done.value = true
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string | string[] } } }
    const msg = err.response?.data?.message
    error.value = Array.isArray(msg) ? msg[0] : msg || 'No se pudo enviar. Intenta de nuevo.'
  } finally {
    submitting.value = false
  }
}

const productoActivo = computed<ProductoPublico | null>(() => {
  if (producto.value) return producto.value
  if (form.value.producto_id) {
    return catalogo.value.find((p) => p.id === form.value.producto_id) ?? null
  }
  return null
})

/**
 * Bundle sugerido para el producto activo: primer bundle (activo) cuyo
 * bundle_upgrade_desde coincide con el ID del producto elegido.
 * Solo aparece si el cliente aún NO eligió ya el bundle.
 */
const bundleSugerido = computed<ProductoPublico | null>(() => {
  const activo = productoActivo.value
  if (!activo || activo.es_bundle) return null
  const match = catalogo.value.find(
    (p) => p.es_bundle && p.bundle_upgrade_desde === activo.id,
  )
  return match ?? null
})

function aceptarBundle() {
  if (!bundleSugerido.value) return
  form.value.producto_id = bundleSugerido.value.id
}
</script>

<template>
  <div
    class="min-h-screen py-8 px-4"
    :style="{ background: 'var(--brand-fondo, #E6E6FB)' }"
  >
    <div class="max-w-xl mx-auto">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <i class="pi pi-spin pi-spinner text-4xl" :style="{ color: 'var(--brand-primary)' }"></i>
      </div>

      <!-- Error de carga -->
      <div
        v-else-if="loadError"
        class="bg-white rounded-2xl shadow-lg p-10 text-center"
      >
        <i class="pi pi-exclamation-circle text-5xl text-red-500 mb-3" aria-hidden="true"></i>
        <h2 class="text-xl font-bold text-gray-800">{{ loadError }}</h2>
        <p class="text-sm text-gray-500 mt-2">Revisa el enlace o contacta al vendedor.</p>
      </div>

      <!-- Éxito -->
      <div
        v-else-if="done"
        class="bg-white rounded-2xl shadow-lg p-10 text-center"
      >
        <div
          class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
          :style="{ backgroundColor: 'var(--brand-secondary)' }"
        >
          <i class="pi pi-check text-white text-3xl" aria-hidden="true"></i>
        </div>
        <h2 class="text-2xl font-black text-gray-800">¡Pedido recibido!</h2>
        <p class="text-gray-600 mt-2">
          Te contactaremos muy pronto para confirmar tu compra y coordinar la entrega.
        </p>
        <p class="text-xs text-gray-400 mt-6">Gracias por confiar en {{ tienda?.nombre }}</p>
      </div>

      <!-- Formulario -->
      <div v-else class="bg-white rounded-2xl shadow-lg overflow-hidden">
        <!-- Header branding -->
        <div class="p-6 text-white" :style="{ backgroundColor: 'var(--brand-primary)' }">
          <div class="flex items-center gap-3">
            <img
              v-if="tienda?.logo_url"
              :src="tienda.logo_url"
              :alt="tienda.nombre"
              class="w-12 h-12 rounded-lg bg-white/10 object-cover"
            />
            <div>
              <p class="text-xs uppercase tracking-wider opacity-80">Comprar en</p>
              <h1 class="text-xl font-black">{{ tienda?.nombre }}</h1>
            </div>
          </div>
        </div>

        <!-- Producto (si viene fijo por URL) -->
        <div
          v-if="productoActivo"
          class="p-5 border-b flex items-center gap-4"
          :style="{ backgroundColor: 'var(--brand-fondo)' }"
        >
          <!-- Foto real si existe, sino placeholder con emoji/icono -->
          <div
            class="w-16 h-16 rounded-xl overflow-hidden shrink-0"
            :style="productoActivo.foto_url
              ? { background: 'var(--paper-alt)' }
              : { backgroundColor: 'var(--brand-secondary)' }"
          >
            <img
              v-if="productoActivo.foto_url"
              :src="productoActivo.foto_url"
              :alt="productoActivo.nombre"
              loading="lazy"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-2xl">
              {{ productoActivo.icono || '📦' }}
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs uppercase tracking-wider text-gray-500">Producto</p>
            <p class="font-bold text-gray-800 truncate">{{ productoActivo.nombre }}</p>
            <p v-if="productoActivo.precio" class="text-sm font-bold" :style="{ color: 'var(--brand-primary)' }">
              ${{ productoActivo.precio.toFixed(2) }}
            </p>
          </div>
        </div>

        <!-- Bundle upgrade sugerido -->
        <div
          v-if="bundleSugerido"
          class="mx-5 mt-5 p-4 rounded-xl border-2 border-dashed relative"
          :style="{ borderColor: 'var(--brand-primary)', background: 'var(--brand-fondo)' }"
        >
          <div class="absolute -top-2.5 left-4 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white" :style="{ background: 'var(--brand-primary)' }">
            ✨ Oferta recomendada
          </div>
          <div class="flex items-start gap-3">
            <div
              class="w-12 h-12 rounded-lg overflow-hidden shrink-0"
              :style="bundleSugerido.foto_url
                ? { background: 'var(--paper-alt)' }
                : { backgroundColor: 'var(--brand-secondary)' }"
            >
              <img
                v-if="bundleSugerido.foto_url"
                :src="bundleSugerido.foto_url"
                :alt="bundleSugerido.nombre"
                loading="lazy"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-xl">
                {{ bundleSugerido.icono || '🎁' }}
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-gray-800 text-sm">{{ bundleSugerido.nombre }}</p>
              <p v-if="bundleSugerido.precio && productoActivo?.precio" class="text-xs text-gray-600 mt-0.5">
                Mejora tu pedido a
                <span class="font-bold" :style="{ color: 'var(--brand-primary)' }">${{ bundleSugerido.precio.toFixed(2) }}</span>
                (antes sólo ${{ productoActivo.precio.toFixed(2) }})
              </p>
              <button
                type="button"
                @click="aceptarBundle"
                class="mt-2 w-full py-2 rounded-lg text-white font-bold text-xs hover:opacity-90 transition"
                :style="{ backgroundColor: 'var(--brand-primary)' }"
              >
                Quiero esta oferta
              </button>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="submit" class="p-6 space-y-4">
          <p class="text-sm text-gray-600">
            Completa tus datos para recibir tu pedido. Nos pondremos en contacto por WhatsApp.
          </p>
          <div
            v-if="referidoInfo?.valido"
            class="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium"
            style="background: var(--emerald-bg); color: var(--emerald-fg);"
          >
            <span>🎁</span>
            <span>
              Has sido referido por <b>{{ referidoInfo.referente_nombre }}</b>.
              Mencioná el código <code class="font-mono font-bold">{{ referidoCodigo }}</code> al confirmar tu pedido.
            </span>
          </div>

          <!-- Selector de producto si es catálogo general -->
          <div v-if="!productoSlug" class="space-y-1">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
              ¿Qué producto deseas?<span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.producto_id"
              required
              class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              :style="{ '--tw-ring-color': 'var(--brand-primary)' }"
            >
              <option value="">— Elige un producto —</option>
              <option v-for="p in catalogo.filter((x) => !x.es_bundle)" :key="p.id" :value="p.id">
                {{ p.nombre }}{{ p.precio ? ` — $${p.precio.toFixed(2)}` : '' }}
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Nombre completo<span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.cliente_nombre"
              type="text"
              required
              placeholder="Ej. María García"
              autocomplete="name"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Teléfono (WhatsApp)<span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.cliente_telefono"
              @input="onTelefonoInput"
              type="tel"
              required
              placeholder="0991234567"
              inputmode="numeric"
              autocomplete="tel"
              maxlength="10"
              pattern="09[0-9]{8}"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
            />
            <p class="text-xs text-gray-500">Número ecuatoriano: 10 dígitos empezando con 09.</p>
          </div>

          <!-- ── Tipo de entrega ── -->
          <div class="space-y-2">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
              ¿Cómo quieres recibir tu pedido?<span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                class="flex items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition"
                :class="
                  form.tipo_entrega === 'DOMICILIO'
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                "
              >
                <input
                  type="radio"
                  v-model="form.tipo_entrega"
                  value="DOMICILIO"
                  class="mt-0.5"
                />
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-900">Envío a domicilio</p>
                  <p class="text-xs text-gray-500">
                    Te lo llevamos hasta tu puerta.
                  </p>
                </div>
              </label>
              <label
                class="flex items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition"
                :class="
                  form.tipo_entrega === 'AGENCIA'
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                "
              >
                <input
                  type="radio"
                  v-model="form.tipo_entrega"
                  value="AGENCIA"
                  class="mt-0.5"
                />
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-900">Retiro en agencia</p>
                  <p class="text-xs text-gray-500">
                    Retíralo en una oficina Servientrega.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Provincia<span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.provincia"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 bg-white"
              >
                <option value="">— Elegir provincia —</option>
                <option v-for="p in PROVINCIAS_EC" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Ciudad<span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.ciudad"
                :disabled="!form.provincia"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {{ form.provincia ? '— Elegir ciudad —' : 'Elige primero la provincia' }}
                </option>
                <option v-for="c in ciudadesDisponibles" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
          </div>

          <!-- ── Rama DOMICILIO: dirección + mapa ── -->
          <template v-if="form.tipo_entrega === 'DOMICILIO'">
            <div class="space-y-2">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Dirección completa<span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.direccion"
                type="text"
                required
                placeholder="Ej. Av. Amazonas N22-30 y Veintimilla, Urb. El Bosque"
                autocomplete="street-address"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
              <p class="text-[11px] text-gray-500">
                Escribe calle, número y sector. Luego ubica tu casa en el mapa.
              </p>
              <MapPicker
                :value="coords"
                :target-location="mapTargetLocation"
                @coords="onMapCoords"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Referencia (opcional)
              </label>
              <input
                v-model="form.direccion_referencia"
                type="text"
                placeholder="Ej. casa blanca con reja verde, timbre del medio"
                maxlength="200"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
            <p class="text-[11px] text-gray-500">
              Ayuda al mensajero a encontrarte más rápido.
            </p>
          </div>
          </template>

          <!-- ── Rama AGENCIA: dropdown Servientrega filtrado por ciudad ── -->
          <template v-else>
            <div class="space-y-2">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Agencia Servientrega<span class="text-red-500">*</span>
              </label>
              <select
                v-model="form.agencia_id"
                :disabled="!form.ciudad || agenciasParaCiudad.length === 0"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {{
                    !form.ciudad
                      ? 'Elige primero provincia y ciudad'
                      : agenciasParaCiudad.length === 0
                        ? 'No hay agencias en esta ciudad'
                        : '— Elegir agencia —'
                  }}
                </option>
                <option
                  v-for="(a, i) in agenciasParaCiudad"
                  :key="i"
                  :value="String(i)"
                >
                  {{ a.nombre }} — {{ a.direccion }}
                </option>
              </select>
              <p
                v-if="form.ciudad && agenciasParaCiudad.length === 0"
                class="text-[11px] text-amber-700"
              >
                Aún no tenemos agencias registradas en {{ form.ciudad }}. Por
                favor elige "Envío a domicilio" o escríbenos por WhatsApp.
              </p>
            </div>
          </template>

          <div class="grid grid-cols-3 gap-3 items-end">
            <div class="space-y-1 col-span-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Cantidad</label>
              <input
                v-model.number="form.cantidad"
                type="number"
                min="1"
                max="99"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
            </div>
            <div class="space-y-1 col-span-2">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Notas (opcional)</label>
              <input
                v-model="form.notas"
                type="text"
                placeholder="Ej. Entregar en la tarde"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            <i class="pi pi-exclamation-circle mr-1" aria-hidden="true"></i>
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full py-3 rounded-xl text-white font-black text-base shadow-md hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            :style="{ backgroundColor: 'var(--brand-primary)' }"
          >
            <i :class="submitting ? 'pi pi-spin pi-spinner' : 'pi pi-send'" aria-hidden="true"></i>
            {{ submitting ? 'Enviando...' : 'Enviar pedido' }}
          </button>

          <p class="text-[10px] text-center text-gray-400 mt-2">
            Al enviar aceptas ser contactado para confirmar tu compra. Tus datos sólo se usan
            para procesar este pedido.
          </p>
        </form>
      </div>

      <p class="text-center text-xs text-gray-500 mt-4">
        Powered by <span class="font-bold">Soporte IH</span>
      </p>
    </div>
  </div>
</template>
