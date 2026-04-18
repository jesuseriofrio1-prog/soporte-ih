<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import PedidoStatusBadge from '../components/pedidos/PedidoStatusBadge.vue'
import WhatsAppModal from '../components/pedidos/WhatsAppModal.vue'
import pedidosService, { type Pedido } from '../services/pedidosService'
import { useTiendaStore } from '../stores/tienda'

const router = useRouter()
const toast = useToast()
const tiendaStore = useTiendaStore()

const novedades = ref<Pedido[]>([])
const riesgoRetencion = ref<Pedido[]>([])
const loading = ref(false)

// WhatsApp modal
const waModalVisible = ref(false)
const waPedido = ref<Pedido | null>(null)

function abrirWA(pedido: Pedido) {
  waPedido.value = pedido
  waModalVisible.value = true
}

function irAPedidoEnLista(pedido: Pedido) {
  router.push({ path: '/pedidos', query: { open: pedido.id } })
}

async function cargar() {
  const tiendaId = tiendaStore.tiendaActiva?.id
  if (!tiendaId) return

  loading.value = true
  try {
    // Pedidos en estado problemático
    const probl = await pedidosService.getAll({
      tienda_id: tiendaId,
      estado: 'NOVEDAD,NO_ENTREGADO',
    })
    novedades.value = probl

    // Pedidos en riesgo de retención (retencion_inicio != null o RETIRO_EN_AGENCIA >= 6 días)
    const enAgencia = await pedidosService.getAll({
      tienda_id: tiendaId,
      estado: 'RETIRO_EN_AGENCIA',
    })
    riesgoRetencion.value = enAgencia.filter(
      (p) => p.retencion_inicio !== null || (p.dias_en_agencia ?? 0) >= 6,
    )
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al cargar novedades')
  } finally {
    loading.value = false
  }
}

onMounted(() => cargar())

// Recargar si cambia la tienda activa
watch(() => tiendaStore.tiendaActivaId, () => cargar())

const totalNovedades = computed(() => novedades.value.length + riesgoRetencion.value.length)

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header con refresh -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-navy/60">
          Pedidos que requieren atención:
          <b class="text-navy">{{ totalNovedades }}</b>
        </p>
      </div>
      <button
        @click="cargar"
        :disabled="loading"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-lavanda-medio hover:bg-lavanda/50 transition text-sm text-navy disabled:opacity-50"
      >
        <i class="pi pi-refresh" :class="{ 'pi-spin': loading }" aria-hidden="true"></i>
        Refrescar
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading && totalNovedades === 0" class="text-center py-20">
      <i class="pi pi-spin pi-spinner text-4xl text-mauve" aria-hidden="true"></i>
      <p class="text-navy/60 mt-2">Cargando novedades...</p>
    </div>

    <!-- Empty state global -->
    <div
      v-else-if="totalNovedades === 0"
      class="bg-white p-12 rounded-xl border border-lavanda-medio text-center"
    >
      <i class="pi pi-check-circle text-5xl text-green-500 mb-3" aria-hidden="true"></i>
      <h3 class="text-xl font-bold text-navy mb-1">Todo bajo control</h3>
      <p class="text-navy/60">No hay pedidos con novedades ni en riesgo de devolución.</p>
    </div>

    <template v-else>
      <!-- ================== Riesgo de retención ================== -->
      <section v-if="riesgoRetencion.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-clock text-red-600" aria-hidden="true"></i>
          <h3 class="text-lg font-bold text-navy">
            Riesgo de devolución ({{ riesgoRetencion.length }})
          </h3>
          <span class="text-xs text-navy/50">
            Esperando en agencia desde hace 6+ días
          </span>
        </div>

        <div class="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-red-100 text-red-800">
              <tr class="text-left">
                <th class="px-4 py-2 font-bold">Cliente</th>
                <th class="px-4 py-2 font-bold">Producto</th>
                <th class="px-4 py-2 font-bold">Guía</th>
                <th class="px-4 py-2 font-bold">Días en agencia</th>
                <th class="px-4 py-2 font-bold">Monto</th>
                <th class="px-4 py-2 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in riesgoRetencion"
                :key="p.id"
                class="border-t border-red-200 hover:bg-red-100/50 transition"
              >
                <td class="px-4 py-3 text-navy">
                  <div class="font-medium">{{ p.cliente_nombre || p.clientes?.nombre || '—' }}</div>
                  <div class="text-xs text-navy/50">{{ p.cliente_telefono || p.clientes?.telefono || '—' }}</div>
                </td>
                <td class="px-4 py-3 text-navy">{{ p.productos?.nombre || '—' }}</td>
                <td class="px-4 py-3 text-navy font-mono text-xs">{{ p.guia }}</td>
                <td class="px-4 py-3">
                  <span class="font-bold text-red-700">{{ p.dias_en_agencia ?? 0 }} días</span>
                </td>
                <td class="px-4 py-3 font-bold text-navy">${{ (p.monto ?? 0).toFixed(2) }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    @click="abrirWA(p)"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition"
                    title="Enviar WhatsApp"
                  >
                    <i class="pi pi-whatsapp" aria-hidden="true"></i>
                  </button>
                  <button
                    @click="irAPedidoEnLista(p)"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy hover:opacity-90 text-white text-xs font-bold transition ml-1"
                    title="Ver pedido"
                  >
                    <i class="pi pi-external-link" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ================== Novedades de entrega ================== -->
      <section v-if="novedades.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-exclamation-triangle text-orange-600" aria-hidden="true"></i>
          <h3 class="text-lg font-bold text-navy">
            Novedades de entrega ({{ novedades.length }})
          </h3>
          <span class="text-xs text-navy/50">
            NOVEDAD y NO_ENTREGADO — necesitan seguimiento
          </span>
        </div>

        <div class="bg-white border border-lavanda-medio rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-lavanda/40 text-navy">
              <tr class="text-left">
                <th class="px-4 py-2 font-bold">Cliente</th>
                <th class="px-4 py-2 font-bold">Producto</th>
                <th class="px-4 py-2 font-bold">Guía</th>
                <th class="px-4 py-2 font-bold">Estado</th>
                <th class="px-4 py-2 font-bold">Fecha</th>
                <th class="px-4 py-2 font-bold">Monto</th>
                <th class="px-4 py-2 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in novedades"
                :key="p.id"
                class="border-t border-lavanda-medio hover:bg-lavanda/20 transition"
              >
                <td class="px-4 py-3 text-navy">
                  <div class="font-medium">{{ p.cliente_nombre || p.clientes?.nombre || '—' }}</div>
                  <div class="text-xs text-navy/50">{{ p.cliente_telefono || p.clientes?.telefono || '—' }}</div>
                </td>
                <td class="px-4 py-3 text-navy">{{ p.productos?.nombre || '—' }}</td>
                <td class="px-4 py-3 text-navy font-mono text-xs">{{ p.guia }}</td>
                <td class="px-4 py-3">
                  <PedidoStatusBadge :estado="p.estado" />
                </td>
                <td class="px-4 py-3 text-navy/70 text-xs">
                  <div>{{ formatFecha(p.created_at) }}</div>
                  <div class="text-xs text-navy/40">hace {{ diasDesde(p.created_at) }} días</div>
                </td>
                <td class="px-4 py-3 font-bold text-navy">${{ (p.monto ?? 0).toFixed(2) }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    @click="abrirWA(p)"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition"
                    title="Enviar WhatsApp"
                  >
                    <i class="pi pi-whatsapp" aria-hidden="true"></i>
                  </button>
                  <button
                    @click="irAPedidoEnLista(p)"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy hover:opacity-90 text-white text-xs font-bold transition ml-1"
                    title="Ver pedido"
                  >
                    <i class="pi pi-external-link" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- Modal WhatsApp -->
    <WhatsAppModal
      v-if="waPedido"
      v-model:visible="waModalVisible"
      :nombre="waPedido.cliente_nombre || waPedido.clientes?.nombre || ''"
      :telefono="waPedido.cliente_telefono || waPedido.clientes?.telefono || ''"
      :producto="waPedido.productos?.nombre || ''"
      :guia="waPedido.guia"
      :estado="waPedido.estado"
      :direccion="waPedido.direccion"
    />
  </div>
</template>
