<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import solicitudesService, {
  type TiendaPublica,
  type ProductoPublico,
} from '../services/solicitudesService'
import referidosService from '../services/referidosService'

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
  cliente_email: '',
  provincia: '',
  ciudad: '',
  direccion: '',
  cantidad: 1,
  notas: '',
  producto_id: '' as string,
})

const submitting = ref(false)
const done = ref(false)
const error = ref<string | null>(null)

// Provincias de Ecuador (para dropdown sin teclear mal)
const PROVINCIAS_EC = [
  'Azuay','Bolívar','Cañar','Carchi','Chimborazo','Cotopaxi','El Oro','Esmeraldas',
  'Galápagos','Guayas','Imbabura','Loja','Los Ríos','Manabí','Morona Santiago',
  'Napo','Orellana','Pastaza','Pichincha','Santa Elena','Santo Domingo de los Tsáchilas',
  'Sucumbíos','Tungurahua','Zamora Chinchipe',
]

onMounted(async () => {
  // Validar código de referido (si viene en el URL) — es fire-and-forget
  // porque no queremos bloquear la carga principal si falla.
  if (referidoCodigo.value) {
    referidosService.validarPublico(tiendaSlug.value, referidoCodigo.value)
      .then((v) => { referidoInfo.value = v })
      .catch(() => { referidoInfo.value = null })
  }

  try {
    if (productoSlug.value) {
      const { tienda: t, producto: p } = await solicitudesService.productoPublico(
        tiendaSlug.value,
        productoSlug.value,
      )
      tienda.value = t
      producto.value = p
    } else {
      const { tienda: t, catalogo: c } = await solicitudesService.tiendaPublica(tiendaSlug.value)
      tienda.value = t
      catalogo.value = c
      if (c.length === 1) form.value.producto_id = c[0].id
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

async function submit() {
  error.value = null
  if (!form.value.cliente_nombre.trim() || form.value.cliente_nombre.trim().length < 2) {
    error.value = 'Escribe tu nombre completo.'
    return
  }
  if (!/^\d{7,15}$/.test(form.value.cliente_telefono.replace(/\D/g, ''))) {
    error.value = 'Teléfono inválido. Usa sólo números (mínimo 7 dígitos).'
    return
  }
  if (!form.value.direccion.trim() || form.value.direccion.trim().length < 5) {
    error.value = 'Escribe tu dirección completa.'
    return
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
        cliente_email: form.value.cliente_email.trim() || undefined,
        provincia: form.value.provincia || undefined,
        ciudad: form.value.ciudad.trim() || undefined,
        direccion: form.value.direccion.trim(),
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
          <div
            class="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
            :style="{ backgroundColor: 'var(--brand-secondary)' }"
          >
            {{ productoActivo.icono || '📦' }}
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
              class="w-12 h-12 rounded-lg flex items-center justify-center text-xl shrink-0"
              :style="{ backgroundColor: 'var(--brand-secondary)' }"
            >
              {{ bundleSugerido.icono || '🎁' }}
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

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Teléfono (WhatsApp)<span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.cliente_telefono"
                type="tel"
                required
                placeholder="09XXXXXXXX"
                inputmode="numeric"
                autocomplete="tel"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Email (opcional)
              </label>
              <input
                v-model="form.cliente_email"
                type="email"
                placeholder="tu@email.com"
                autocomplete="email"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Provincia</label>
              <select
                v-model="form.provincia"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 bg-white"
              >
                <option value="">— Elegir —</option>
                <option v-for="p in PROVINCIAS_EC" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">Ciudad</label>
              <input
                v-model="form.ciudad"
                type="text"
                placeholder="Ej. Quito"
                autocomplete="address-level2"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Dirección completa<span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.direccion"
              type="text"
              required
              placeholder="Calle, número, sector, referencia"
              autocomplete="street-address"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2"
            />
          </div>

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
