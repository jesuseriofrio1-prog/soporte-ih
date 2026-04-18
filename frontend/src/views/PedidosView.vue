<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import Swal from 'sweetalert2'
import WhatsAppModal from '../components/pedidos/WhatsAppModal.vue'
import PedidosFiltersBar from '../components/pedidos/PedidosFiltersBar.vue'
import PedidosTable from '../components/pedidos/PedidosTable.vue'
import PedidoDetailDrawer from '../components/pedidos/PedidoDetailDrawer.vue'
import PedidoCrearModal from '../components/pedidos/PedidoCrearModal.vue'
import { usePedidosStore } from '../stores/pedidos'
import { useProductosStore } from '../stores/productos'
import { useTiendaStore } from '../stores/tienda'
import pedidosService from '../services/pedidosService'
import type { EstadoPedido, Pedido, CreatePedidoPayload } from '../services/pedidosService'
import { usePedidosFiltros, ANTIGUEDAD_KEYS, type AntiguedadKey } from '../composables/usePedidosFiltros'
import api from '../services/api'

const route = useRoute()
const routerInstance = useRouter()
const toast = useToast()
const pedidosStore = usePedidosStore()
const productosStore = useProductosStore()
const tiendaStore = useTiendaStore()

// ──────────────── Filtros, chips y ordenamiento ────────────────
const pedidos = computed(() => pedidosStore.pedidos)
const {
  filtroAntiguedad,
  filtroEstado,
  filtroProducto,
  sortKey,
  sortLabel,
  toggleSort,
  chipsAntiguedad,
  pedidosOrdenados,
} = usePedidosFiltros(pedidos)

// ──────────────── Modal WhatsApp ────────────────
const waModalVisible = ref(false)
const waPedido = ref<Pedido | null>(null)

function abrirWAModal(pedido: Pedido) {
  waPedido.value = pedido
  waModalVisible.value = true
}

// ──────────────── Panel lateral de detalle ────────────────
const detalleVisible = ref(false)
const detalleLoading = ref(false)
const pedidoDetalle = ref<Pedido | null>(null)

async function abrirDetalle(pedido: Pedido) {
  detalleVisible.value = true
  detalleLoading.value = true
  try {
    pedidoDetalle.value = await pedidosService.getById(pedido.id)
  } catch {
    toast.error('Error al cargar detalle del pedido')
  } finally {
    detalleLoading.value = false
  }
}

async function cambiarEstadoDesdePanel(nuevoEstado: EstadoPedido) {
  if (!pedidoDetalle.value) return
  try {
    await pedidosStore.actualizarEstado(pedidoDetalle.value.id, nuevoEstado)
    toast.success(`Estado actualizado a ${nuevoEstado.replace(/_/g, ' ')}`)
    pedidoDetalle.value = await pedidosService.getById(pedidoDetalle.value.id)
    pedidosStore.fetchPedidos()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al cambiar estado')
  }
}

async function guardarEdicion(payload: {
  cliente_nombre: string
  cliente_telefono: string
  direccion: string
  notas: string
  dias_en_agencia: number
  monto: number
  guia: string
}) {
  if (!pedidoDetalle.value) return
  // Validaciones mínimas de UX (el backend las repite).
  if (!payload.cliente_nombre.trim()) return toast.warning('El nombre del cliente es requerido')
  if (!payload.cliente_telefono.trim()) return toast.warning('El teléfono es requerido')
  if (!payload.direccion.trim()) return toast.warning('La dirección no puede estar vacía')
  if (!payload.guia.trim()) return toast.warning('La guía es requerida')
  if (payload.monto <= 0) return toast.warning('El monto debe ser mayor a 0')

  try {
    await pedidosService.update(pedidoDetalle.value.id, {
      cliente_nombre: payload.cliente_nombre,
      cliente_telefono: payload.cliente_telefono,
      direccion: payload.direccion,
      notas: payload.notas || undefined,
      dias_en_agencia: payload.dias_en_agencia,
      guia: payload.guia,
      monto: payload.monto,
    })
    toast.success('Pedido actualizado')
    pedidoDetalle.value = await pedidosService.getById(pedidoDetalle.value.id)
    pedidosStore.fetchPedidos()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al actualizar')
  }
}

// ──────────────── Acciones: retención, eliminar, tracking ────────────────
async function toggleRetencion(pedido: Pedido) {
  try {
    await pedidosService.toggleRetencion(pedido.id)
    const accion = pedido.retencion_inicio ? 'desactivado' : 'activado'
    toast.success(`Conteo de retención ${accion}`)
    if (pedidoDetalle.value?.id === pedido.id) {
      pedidoDetalle.value = await pedidosService.getById(pedido.id)
    }
    pedidosStore.fetchPedidos()
  } catch {
    toast.error('Error al cambiar retención')
  }
}

async function eliminarPedido(pedido: Pedido) {
  const result = await Swal.fire({
    title: '¿Eliminar pedido?',
    text: `Se eliminará el pedido ${pedido.guia} permanentemente.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#C8C8E9',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })
  if (!result.isConfirmed) return

  try {
    await pedidosService.remove(pedido.id)
    toast.success('Pedido eliminado')
    detalleVisible.value = false
    pedidosStore.fetchPedidos()
  } catch {
    toast.error('Error al eliminar pedido')
  }
}

async function onCambiarEstado(pedidoId: string, nuevoEstado: EstadoPedido) {
  try {
    await pedidosStore.actualizarEstado(pedidoId, nuevoEstado)
    toast.success(`Estado actualizado a ${nuevoEstado.replace(/_/g, ' ')}`)
    pedidosStore.fetchPedidos()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al cambiar estado')
  }
}

function abrirTracking(guia: string) {
  navigator.clipboard.writeText(guia).then(() => toast.success(`Guía ${guia} copiada`))
  window.open(`https://www.servientrega.com.ec/Tracking/?guia=${guia}&tipo=GUIA`, '_blank')
}

// ──────────────── Sincronización Servientrega ────────────────
const sincronizando = ref(false)

async function sincronizarServientrega() {
  const tiendaId = tiendaStore.tiendaActiva?.id
  if (!tiendaId) return toast.warning('Selecciona una tienda primero')

  sincronizando.value = true
  try {
    const { data } = await api.post(`/tracking/sincronizar?tienda_id=${tiendaId}`)
    if (data.total === 0) toast.info('No hay pedidos activos para sincronizar')
    else if (data.actualizados === 0) toast.info(`${data.total} guías consultadas — sin cambios`)
    else toast.success(`${data.actualizados} de ${data.total} pedidos actualizados`)
    pedidosStore.fetchPedidos()
  } catch {
    toast.error('Error al sincronizar con Servientrega')
  } finally {
    sincronizando.value = false
  }
}

// ──────────────── Creación de pedido ────────────────
const modalVisible = ref(false)
const formLoading = ref(false)

function abrirModal() {
  if (productosStore.productos.length === 0) productosStore.fetchProductos(true)
  modalVisible.value = true
}

async function onCrearPedido(payload: CreatePedidoPayload) {
  formLoading.value = true
  try {
    await pedidosStore.crearPedido(payload)
    toast.success('Pedido creado exitosamente')
    modalVisible.value = false
    pedidosStore.fetchPedidos()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al crear pedido')
  } finally {
    formLoading.value = false
  }
}

// ──────────────── Mount + query params ────────────────
onMounted(() => {
  pedidosStore.fetchPedidos()
  productosStore.fetchProductos(true)

  // ?nuevo=true → abrir modal de creación automáticamente.
  if (route.query.nuevo === 'true') {
    abrirModal()
    routerInstance.replace({ path: '/pedidos' })
  }

  // ?filtro=novedades (redirect desde /novedades o click en dashboard).
  const filtroParam = route.query.filtro
  if (typeof filtroParam === 'string' && (ANTIGUEDAD_KEYS as readonly string[]).includes(filtroParam)) {
    filtroAntiguedad.value = filtroParam as AntiguedadKey
  }
})
</script>

<template>
  <div class="px-8 py-8 space-y-6">
    <!-- Header de página -->
    <div class="flex items-end justify-between mb-2 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ pedidosStore.pedidos.length }} registros
        </div>
        <h1 class="h-display text-[40px] leading-none">Pedidos</h1>
      </div>
    </div>

    <PedidosFiltersBar
      :chips="chipsAntiguedad"
      v-model:filtroAntiguedad="filtroAntiguedad"
      v-model:filtroProducto="filtroProducto"
      v-model:filtroEstado="filtroEstado"
      :productos="productosStore.productos"
      :sincronizando="sincronizando"
      :pedidos="pedidosStore.pedidos"
      @sincronizar="sincronizarServientrega"
      @importar="routerInstance.push('/integraciones')"
      @nuevo-pedido="abrirModal"
    />

    <PedidosTable
      :pedidos="pedidosOrdenados"
      :sort-key="sortKey"
      :sort-label="sortLabel"
      :loading="pedidosStore.loading"
      :empty="pedidosStore.pedidos.length === 0"
      @sort="toggleSort"
      @abrir-detalle="abrirDetalle"
      @cambiar-estado="onCambiarEstado"
      @toggle-retencion="toggleRetencion"
      @abrir-wa="abrirWAModal"
      @abrir-tracking="abrirTracking"
    />

    <PedidoDetailDrawer
      v-model:visible="detalleVisible"
      :pedido="pedidoDetalle"
      :loading="detalleLoading"
      @cambiar-estado="cambiarEstadoDesdePanel"
      @toggle-retencion="toggleRetencion"
      @editar="guardarEdicion"
      @abrir-wa="abrirWAModal"
      @abrir-tracking="abrirTracking"
      @eliminar="eliminarPedido"
    />

    <PedidoCrearModal
      v-model:visible="modalVisible"
      :productos="productosStore.productos"
      :loading="formLoading"
      @submit="onCrearPedido"
    />

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
