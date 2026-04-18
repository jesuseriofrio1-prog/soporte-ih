<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import Swal from 'sweetalert2'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import PedidoStatusBadge from '../components/pedidos/PedidoStatusBadge.vue'
import PedidoTimeline from '../components/pedidos/PedidoTimeline.vue'
import WhatsAppModal from '../components/pedidos/WhatsAppModal.vue'
import { usePedidosStore } from '../stores/pedidos'
import { useProductosStore } from '../stores/productos'
import pedidosService from '../services/pedidosService'
import { TODOS_LOS_ESTADOS } from '../services/pedidosService'
import type { EstadoPedido, Pedido } from '../services/pedidosService'
import { extraerDatosPedido, contarCamposExtraidos } from '../composables/useTextExtractor'
import { useTiendaStore } from '../stores/tienda'
import api from '../services/api'

const route = useRoute()
const routerInstance = useRouter()
const toast = useToast()
const pedidosStore = usePedidosStore()
const productosStore = useProductosStore()

// WhatsApp modal
const waModalVisible = ref(false)
const waPedido = ref<Pedido | null>(null)

function abrirWAModal(pedido: Pedido) {
  waPedido.value = pedido
  waModalVisible.value = true
}

// Panel lateral detalle
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
    // Recargar detalle y lista
    pedidoDetalle.value = await pedidosService.getById(pedidoDetalle.value.id)
    pedidosStore.fetchPedidos()
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Error al cambiar estado')
  }
}

// Edición inline en el panel
const editandoPanel = ref(false)
const editForm = ref({
  cliente_nombre: '',
  cliente_telefono: '',
  direccion: '',
  notas: '',
  dias_en_agencia: 0,
  monto: 0,
  guia: '',
})

function iniciarEdicion() {
  if (!pedidoDetalle.value) return
  editForm.value = {
    cliente_nombre: pedidoDetalle.value.cliente_nombre || pedidoDetalle.value.clientes?.nombre || '',
    cliente_telefono: pedidoDetalle.value.cliente_telefono || pedidoDetalle.value.clientes?.telefono || '',
    direccion: pedidoDetalle.value.direccion,
    notas: pedidoDetalle.value.notas || '',
    dias_en_agencia: pedidoDetalle.value.dias_en_agencia,
    monto: Number(pedidoDetalle.value.monto),
    guia: pedidoDetalle.value.guia,
  }
  editandoPanel.value = true
}

async function guardarEdicion() {
  if (!pedidoDetalle.value) return

  if (!editForm.value.cliente_nombre.trim()) {
    toast.warning('El nombre del cliente es requerido')
    return
  }
  if (!editForm.value.cliente_telefono.trim()) {
    toast.warning('El teléfono es requerido')
    return
  }
  if (!editForm.value.direccion.trim()) {
    toast.warning('La dirección no puede estar vacía')
    return
  }
  if (!editForm.value.guia.trim()) {
    toast.warning('La guía es requerida')
    return
  }
  if (editForm.value.monto <= 0) {
    toast.warning('El monto debe ser mayor a 0')
    return
  }

  try {
    await pedidosService.update(pedidoDetalle.value.id, {
      cliente_nombre: editForm.value.cliente_nombre,
      cliente_telefono: editForm.value.cliente_telefono,
      direccion: editForm.value.direccion,
      notas: editForm.value.notas || undefined,
      dias_en_agencia: editForm.value.dias_en_agencia,
      guia: editForm.value.guia,
      monto: editForm.value.monto,
    })
    toast.success('Pedido actualizado')
    editandoPanel.value = false
    pedidoDetalle.value = await pedidosService.getById(pedidoDetalle.value.id)
    pedidosStore.fetchPedidos()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al actualizar')
  }
}

// Eliminar pedido
// Toggle retención 8 días
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

// Calcular días de retención
function diasRetencion(retencionInicio: string | null): number {
  if (!retencionInicio) return -1
  const inicio = new Date(retencionInicio)
  const ahora = new Date()
  return Math.floor((ahora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
}

// Color del indicador de retención
function retencionColor(dias: number): string {
  if (dias < 0) return ''
  if (dias <= 4) return 'text-green-600 bg-green-50 border-green-200'
  if (dias <= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

function retencionDotColor(dias: number): string {
  if (dias < 0) return ''
  if (dias <= 4) return 'bg-green-500'
  if (dias <= 6) return 'bg-yellow-500'
  return 'bg-red-500 animate-pulse'
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

  if (result.isConfirmed) {
    try {
      await pedidosService.remove(pedido.id)
      toast.success('Pedido eliminado')
      detalleVisible.value = false
      pedidosStore.fetchPedidos()
    } catch {
      toast.error('Error al eliminar pedido')
    }
  }
}

// Estados para los dropdowns de filtro
const estadosDisponibles: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'EN_PREPARACION', label: 'En Preparación' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'EN_RUTA', label: 'En Ruta' },
  { value: 'NOVEDAD', label: 'Novedad' },
  { value: 'RETIRO_EN_AGENCIA', label: 'Retiro en Agencia' },
  { value: 'ENTREGADO', label: 'Entregado' },
  { value: 'NO_ENTREGADO', label: 'No Entregado' },
  { value: 'DEVUELTO', label: 'Devuelto' },
]

const estadoLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En Preparación',
  ENVIADO: 'Enviado',
  EN_RUTA: 'En Ruta',
  NOVEDAD: 'Novedad',
  RETIRO_EN_AGENCIA: 'Retiro en Agencia',
  ENTREGADO: 'Entregado',
  NO_ENTREGADO: 'No Entregado',
  DEVUELTO: 'Devuelto',
}

const estadoBadge: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  EN_PREPARACION: 'bg-indigo-100 text-indigo-700',
  ENVIADO: 'bg-cyan-100 text-cyan-700',
  EN_RUTA: 'bg-yellow-100 text-yellow-700',
  NOVEDAD: 'bg-orange-100 text-orange-700',
  RETIRO_EN_AGENCIA: 'bg-purple-100 text-purple-700',
  ENTREGADO: 'bg-green-100 text-green-700',
  NO_ENTREGADO: 'bg-red-100 text-red-700',
  DEVUELTO: 'bg-red-200 text-red-800',
}

// Filtros secundarios (producto + estado). Ahora son CLIENTE-side para que
// los conteos de los chips reflejen SIEMPRE el total real de la tienda,
// no el resultado de un fetch filtrado del servidor. Con volumen moderado
// (<2k pedidos) esto es más rápido y honesto que round-trips al backend.
const filtroEstado = ref('')
const filtroProducto = ref('')

// ─────────────────────────────────────────────
// Chips de antigüedad (cliente-side, sobre la lista ya cargada)
// ─────────────────────────────────────────────

type AntiguedadKey = 'todos' | 'hoy' | '1d' | '2d' | '3plus' | 'aplazados' | 'novedades'

const filtroAntiguedad = ref<AntiguedadKey>('todos')

// Estados "activos" = todavía no cerrados (aún requieren acción)
const ESTADOS_ACTIVOS = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION'] as const

// Estados considerados "novedad" — requieren atención del operador
const ESTADOS_NOVEDAD = ['NOVEDAD', 'NO_ENTREGADO'] as const

// Estados terminales — pedido ya cerrado, sin acción pendiente
const ESTADOS_TERMINALES = ['ENTREGADO', 'DEVUELTO', 'NO_ENTREGADO'] as const

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function matchesAntiguedad(p: Pedido, filtro: AntiguedadKey): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'aplazados') {
    // Sólo cuenta pedidos aún abiertos — si ya fue entregado/devuelto/
    // no entregado, la retención queda colgada (legado) y no debe
    // aparecer aquí.
    if (ESTADOS_TERMINALES.includes(p.estado as typeof ESTADOS_TERMINALES[number])) return false
    return p.retencion_inicio !== null
  }

  if (filtro === 'novedades') {
    const enNovedad = ESTADOS_NOVEDAD.includes(p.estado as typeof ESTADOS_NOVEDAD[number])
    const enRiesgo = p.estado === 'RETIRO_EN_AGENCIA' && (p.retencion_inicio !== null || (p.dias_en_agencia ?? 0) >= 6)
    return enNovedad || enRiesgo
  }

  // El resto de chips solo aplica a pedidos activos
  if (!ESTADOS_ACTIVOS.includes(p.estado as typeof ESTADOS_ACTIVOS[number])) return false

  const dias = diasDesde(p.created_at)
  switch (filtro) {
    case 'hoy': return dias === 0
    case '1d': return dias === 1
    case '2d': return dias === 2
    case '3plus': return dias >= 3
    default: return true
  }
}

const chipsAntiguedad = computed(() => {
  const countFor = (k: AntiguedadKey) => pedidosStore.pedidos.filter((p) => matchesAntiguedad(p, k)).length
  return [
    { key: 'todos' as const,     label: 'Todos',      count: pedidosStore.pedidos.length, alerta: false },
    { key: 'novedades' as const, label: 'Novedades',  count: countFor('novedades'),       alerta: true },
    { key: 'hoy' as const,       label: 'Nuevos hoy', count: countFor('hoy'),             alerta: false },
    { key: 'aplazados' as const, label: 'Aplazados',  count: countFor('aplazados'),       alerta: false },
  ]
})

// Sincronizar Servientrega
const sincronizando = ref(false)

// Ordenamiento de tabla
const sortKey = ref<string>('fecha')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    // Default: fecha y monto desc, el resto asc
    sortDir.value = (key === 'fecha' || key === 'monto') ? 'desc' : 'asc'
  }
}

function sortLabel(key: string): string {
  if (sortKey.value !== key) return '⇅'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// Prioridad de estados para ordenamiento lógico (flujo del pedido)
const ESTADO_PRIORIDAD: Record<string, number> = {
  PENDIENTE: 1,
  CONFIRMADO: 2,
  EN_PREPARACION: 3,
  ENVIADO: 4,
  EN_RUTA: 5,
  RETIRO_EN_AGENCIA: 6,
  NOVEDAD: 7,
  NO_ENTREGADO: 8,
  ENTREGADO: 9,
  DEVUELTO: 10,
}

function getEstadoPrioridad(estado: string): number {
  return ESTADO_PRIORIDAD[estado] ?? 5 // Estados de Servientrega van al medio
}

const pedidosOrdenados = computed(() => {
  // Pipeline cliente-side: chip antigüedad + producto + estado, luego orden.
  const lista = pedidosStore.pedidos.filter((p) => {
    if (!matchesAntiguedad(p, filtroAntiguedad.value)) return false
    if (filtroProducto.value && p.producto_id !== filtroProducto.value) return false
    if (filtroEstado.value && p.estado !== filtroEstado.value) return false
    return true
  })
  if (!sortKey.value) return lista

  return lista.sort((a, b) => {
    let cmp = 0

    switch (sortKey.value) {
      case 'cliente':
        cmp = (a.cliente_nombre || a.clientes?.nombre || '').localeCompare(
          b.cliente_nombre || b.clientes?.nombre || '', 'es'
        )
        break
      case 'producto':
        cmp = (a.productos?.nombre || '').localeCompare(b.productos?.nombre || '', 'es')
        break
      case 'destino':
        cmp = (a.tipo_entrega || '').localeCompare(b.tipo_entrega || '') ||
              (a.direccion || '').localeCompare(b.direccion || '', 'es')
        break
      case 'estado':
        cmp = getEstadoPrioridad(a.estado) - getEstadoPrioridad(b.estado)
        break
      case 'monto':
        cmp = Number(a.monto) - Number(b.monto)
        break
      case 'fecha':
        cmp = a.created_at.localeCompare(b.created_at)
        break
      default:
        return 0
    }

    return sortDir.value === 'asc' ? cmp : -cmp
  })
})
const tiendaStore = useTiendaStore()

async function sincronizarServientrega() {
  const tiendaId = tiendaStore.tiendaActiva?.id
  if (!tiendaId) {
    toast.warning('Selecciona una tienda primero')
    return
  }

  sincronizando.value = true
  try {
    const { data } = await api.post(`/tracking/sincronizar?tienda_id=${tiendaId}`)
    if (data.total === 0) {
      toast.info('No hay pedidos activos para sincronizar')
    } else if (data.actualizados === 0) {
      toast.info(`${data.total} guías consultadas — sin cambios`)
    } else {
      toast.success(`${data.actualizados} de ${data.total} pedidos actualizados`)
    }
    pedidosStore.fetchPedidos()
  } catch {
    toast.error('Error al sincronizar con Servientrega')
  } finally {
    sincronizando.value = false
  }
}

// Modal nuevo pedido
const modalVisible = ref(false)
const formLoading = ref(false)
const mensajeWA = ref('')
const form = ref({
  cliente_nombre: '',
  cliente_telefono: '',
  guia: '',
  producto_id: '',
  tipo_entrega: 'DOMICILIO' as 'DOMICILIO' | 'AGENCIA',
  direccion: '',
  monto: 0,
  canal_origen: '',
})

function abrirModal() {
  mensajeWA.value = ''
  form.value = {
    cliente_nombre: '',
    cliente_telefono: '',
    guia: '',
    producto_id: '',
    tipo_entrega: 'DOMICILIO',
    direccion: '',
    monto: 0,
    canal_origen: '',
  }
  // Asegurar que productos estén cargados
  if (productosStore.productos.length === 0) {
    productosStore.fetchProductos(true)
  }
  modalVisible.value = true
}

function procesarMensajeWA() {
  if (!mensajeWA.value.trim()) {
    toast.warning('Pega un mensaje de WhatsApp primero')
    return
  }

  const datos = extraerDatosPedido(mensajeWA.value, productosStore.productos)
  const campos = contarCamposExtraidos(datos)

  if (datos.cliente_nombre) form.value.cliente_nombre = datos.cliente_nombre
  if (datos.cliente_telefono) form.value.cliente_telefono = datos.cliente_telefono
  if (datos.direccion) form.value.direccion = datos.direccion
  if (datos.producto_id) form.value.producto_id = datos.producto_id
  if (datos.guia) form.value.guia = datos.guia
  if (datos.monto) form.value.monto = datos.monto
  if (datos.direccion?.toLowerCase().includes('agencia')) {
    form.value.tipo_entrega = 'AGENCIA'
  }
  form.value.canal_origen = 'WhatsApp Directo'

  if (campos > 0) {
    const detalles = []
    if (datos.cliente_nombre) detalles.push('nombre')
    if (datos.cliente_telefono) detalles.push('teléfono')
    if (datos.producto_nombre) detalles.push(datos.producto_nombre)
    if (datos.direccion) detalles.push('dirección')
    if (datos.guia) detalles.push('guía')
    if (datos.monto) detalles.push(`$${datos.monto}`)
    toast.success(`${campos} campos extraídos: ${detalles.join(', ')}`)
  } else {
    toast.info('No se pudieron extraer datos automáticamente. Completa el formulario manualmente.')
  }
}

async function guardarPedido() {
  if (!form.value.cliente_nombre || !form.value.cliente_telefono || !form.value.guia || !form.value.producto_id || !form.value.direccion) {
    toast.warning('Completa todos los campos requeridos')
    return
  }
  if (form.value.monto <= 0) {
    toast.warning('El monto debe ser mayor a 0')
    return
  }

  formLoading.value = true
  try {
    await pedidosStore.crearPedido({
      cliente_nombre: form.value.cliente_nombre,
      cliente_telefono: form.value.cliente_telefono,
      guia: form.value.guia,
      producto_id: form.value.producto_id,
      tipo_entrega: form.value.tipo_entrega,
      direccion: form.value.direccion,
      monto: form.value.monto,
      canal_origen: form.value.canal_origen || undefined,
    })
    toast.success('Pedido creado exitosamente')
    modalVisible.value = false
    pedidosStore.fetchPedidos()
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Error al crear pedido')
  } finally {
    formLoading.value = false
  }
}

// Cambiar estado desde la tabla
async function onCambiarEstado(pedidoId: string, nuevoEstado: EstadoPedido) {
  try {
    await pedidosStore.actualizarEstado(pedidoId, nuevoEstado)
    toast.success(`Estado actualizado a ${nuevoEstado.replace(/_/g, ' ')}`)
    pedidosStore.fetchPedidos()
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Error al cambiar estado')
  }
}

function abrirTracking(guia: string) {
  navigator.clipboard.writeText(guia).then(() => {
    toast.success(`Guía ${guia} copiada`)
  })
  window.open(`https://www.servientrega.com.ec/Tracking/?guia=${guia}&tipo=GUIA`, '_blank')
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
}

function formatFechaLarga(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

function filaAlerta(estado: string, dias: number): boolean {
  return estado === 'NOVEDAD' || estado === 'NO_ENTREGADO' || (estado === 'RETIRO_EN_AGENCIA' && dias >= 6)
}

onMounted(() => {
  pedidosStore.fetchPedidos()
  productosStore.fetchProductos(true)

  // Si viene con ?nuevo=true, abrir modal automáticamente
  if (route.query.nuevo === 'true') {
    abrirModal()
    routerInstance.replace({ path: '/pedidos' })
  }

  // Si viene con ?filtro=novedades (redirect desde /novedades o click en
  // dashboard), activar el chip correspondiente.
  const filtroParam = route.query.filtro
  if (typeof filtroParam === 'string') {
    const valid: AntiguedadKey[] = ['todos', 'hoy', '1d', '2d', '3plus', 'aplazados', 'novedades']
    if ((valid as string[]).includes(filtroParam)) {
      filtroAntiguedad.value = filtroParam as AntiguedadKey
    }
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Barra única: chips + filtros secundarios + acciones -->
    <div class="bg-white rounded-xl shadow-sm border border-lavanda-medio">
      <!-- Chips de vista rápida (primer nivel) -->
      <div class="px-3 pt-3 pb-2 flex flex-wrap gap-2 border-b border-lavanda-medio/60">
        <button
          v-for="chip in chipsAntiguedad"
          :key="chip.key"
          @click="filtroAntiguedad = chip.key"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition border"
          :class="[
            filtroAntiguedad === chip.key
              ? (chip.alerta && chip.count > 0
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-mauve text-white border-mauve shadow-sm')
              : (chip.alerta && chip.count > 0
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-white text-navy border-lavanda-medio hover:bg-lavanda/30')
          ]"
        >
          <i v-if="chip.alerta && chip.count > 0" class="pi pi-exclamation-triangle text-xs" aria-hidden="true"></i>
          <span>{{ chip.label }}</span>
          <span
            class="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[11px] rounded-full"
            :class="[
              filtroAntiguedad === chip.key
                ? 'bg-white/25 text-white'
                : (chip.alerta && chip.count > 0 ? 'bg-red-200 text-red-800' : 'bg-lavanda/60 text-navy/70')
            ]"
          >
            {{ chip.count }}
          </span>
        </button>
      </div>

      <!-- Filtros secundarios + acciones (segunda fila) -->
      <div class="px-3 py-2.5 flex flex-wrap gap-3 items-center justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          <i class="pi pi-filter text-mauve text-sm" aria-hidden="true"></i>
          <select
            v-model="filtroProducto"
            class="px-3 py-1.5 text-sm bg-lavanda/40 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-navy font-medium"
          >
            <option value="">Todos los productos</option>
            <option v-for="p in productosStore.productos" :key="p.id" :value="p.id">
              {{ p.nombre }}
            </option>
          </select>

          <select
            v-model="filtroEstado"
            class="px-3 py-1.5 text-sm bg-lavanda/40 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-navy font-medium"
          >
            <option v-for="e in estadosDisponibles" :key="e.value" :value="e.value">
              {{ e.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="sincronizarServientrega"
            :disabled="sincronizando"
            class="bg-navy text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <i :class="sincronizando ? 'pi pi-spin pi-spinner' : 'pi pi-sync'" aria-hidden="true"></i>
            <span class="hidden md:inline">{{ sincronizando ? 'Sincronizando...' : 'Sincronizar' }}</span>
          </button>
          <button
            @click="abrirModal"
            class="bg-mauve text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm"
          >
            <i class="pi pi-plus"></i> Nuevo Pedido
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="pedidosStore.loading" class="text-center py-12">
      <i class="pi pi-spin pi-spinner text-4xl text-mauve"></i>
      <p class="text-navy/60 mt-2">Cargando pedidos...</p>
    </div>

    <!-- Tabla -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-lavanda-medio overflow-x-auto">
      <table class="w-full text-left min-w-[700px]">
        <thead class="bg-lavanda-medio text-navy text-xs uppercase font-bold tracking-wider">
          <tr>
            <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="toggleSort('fecha')">
              <span class="flex items-center gap-1">Cliente / Fecha <span class="text-base" :class="sortKey === 'fecha' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('fecha') }}</span></span>
            </th>
            <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="toggleSort('monto')">
              <span class="flex items-center gap-1">Producto <span class="text-base" :class="sortKey === 'monto' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('monto') }}</span></span>
            </th>
            <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="toggleSort('destino')">
              <span class="flex items-center gap-1">Destino <span class="text-base" :class="sortKey === 'destino' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('destino') }}</span></span>
            </th>
            <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="toggleSort('estado')">
              <span class="flex items-center gap-1">Estado <span class="text-base" :class="sortKey === 'estado' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('estado') }}</span></span>
            </th>
            <th class="p-4 text-center">Acción</th>
          </tr>
        </thead>
        <tbody class="text-sm divide-y divide-lavanda">
          <tr
            v-for="pedido in pedidosOrdenados"
            :key="pedido.id"
            class="transition cursor-pointer"
            :class="filaAlerta(pedido.estado, pedido.dias_en_agencia) ? 'bg-red-50' : 'hover:bg-lavanda/50'"
            @click="abrirDetalle(pedido)"
          >
            <td class="p-4">
              <p class="font-bold text-navy">{{ pedido.cliente_nombre || pedido.clientes?.nombre || '—' }}</p>
              <p class="text-xs text-navy/60">{{ pedido.cliente_telefono || pedido.clientes?.telefono || '—' }}</p>
              <p class="text-xs text-navy/40 mt-1">
                {{ formatFecha(pedido.created_at) }} ·
                <button
                  @click.stop="abrirTracking(pedido.guia)"
                  class="text-mauve hover:underline font-medium"
                >
                  {{ pedido.guia }}
                </button>
              </p>
            </td>

            <td class="p-4">
              <span class="font-medium text-navy">{{ pedido.productos?.nombre || '—' }}</span>
              <p class="text-xs text-navy/50">${{ Number(pedido.monto).toFixed(2) }}</p>
            </td>

            <td class="p-4">
              <span
                class="inline-block px-2 py-0.5 rounded text-xs font-bold mb-1"
                :class="pedido.tipo_entrega === 'DOMICILIO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
              >
                {{ pedido.tipo_entrega }}
              </span>
              <p class="text-xs text-navy/60 max-w-[180px] truncate">{{ pedido.direccion }}</p>
            </td>

            <td class="p-4" @click.stop>
              <PedidoStatusBadge
                :estado="pedido.estado"
                :dias-en-agencia="pedido.dias_en_agencia"
                @cambiar="(nuevoEstado) => onCambiarEstado(pedido.id, nuevoEstado)"
              />
              <!-- Indicador de retención -->
              <div
                v-if="pedido.retencion_inicio"
                class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                :class="retencionColor(diasRetencion(pedido.retencion_inicio))"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="retencionDotColor(diasRetencion(pedido.retencion_inicio))"></span>
                Día {{ diasRetencion(pedido.retencion_inicio) }} / 8
              </div>
            </td>

            <td class="p-4 text-center" @click.stop>
              <div class="flex flex-col items-center gap-1">
                <!-- Botón retención -->
                <button
                  @click="toggleRetencion(pedido)"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  :class="pedido.retencion_inicio
                    ? 'bg-navy text-white hover:opacity-80'
                    : 'border border-lavanda-medio text-navy hover:bg-lavanda'"
                >
                  <i class="pi pi-clock" aria-hidden="true"></i>
                  {{ pedido.retencion_inicio ? 'Día ' + diasRetencion(pedido.retencion_inicio) : '8 días' }}
                </button>
                <!-- Botón WA -->
                <button
                  v-if="pedido.cliente_telefono || pedido.clientes?.telefono"
                  @click="abrirWAModal(pedido)"
                  class="inline-flex items-center gap-1 bg-wa-green text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition"
                >
                  <i class="pi pi-whatsapp"></i> WA
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="pedidosStore.pedidos.length === 0" class="text-center py-12">
        <i class="pi pi-truck text-5xl text-lavanda-medio"></i>
        <p class="text-navy/60 mt-3">No hay pedidos con estos filtros</p>
      </div>
    </div>

    <!-- Panel lateral detalle -->
    <Drawer
      v-model:visible="detalleVisible"
      position="right"
      :style="{ width: '460px' }"
      :pt="{
        root: { class: 'border-l border-lavanda-medio' },
        header: { class: 'bg-navy text-white p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-0' },
        headerActions: { class: 'text-white' },
      }"
    >
      <template #header>
        <span class="font-bold text-lg">Detalle del Pedido</span>
      </template>

      <!-- Loading -->
      <div v-if="detalleLoading" class="flex items-center justify-center py-20">
        <i class="pi pi-spin pi-spinner text-3xl text-mauve"></i>
      </div>

      <div v-else-if="pedidoDetalle" class="flex flex-col h-full overflow-y-auto">
        <!-- Cabecera: estado + guía -->
        <div class="bg-lavanda/50 p-5 border-b border-lavanda-medio">
          <div class="flex items-center justify-between mb-3">
            <span
              class="px-3 py-1 rounded-full text-xs font-bold"
              :class="estadoBadge[pedidoDetalle.estado] || 'bg-gray-100 text-gray-700'"
            >
              {{ estadoLabels[pedidoDetalle.estado] || pedidoDetalle.estado }}
            </span>
            <button
              @click="abrirTracking(pedidoDetalle.guia)"
              class="text-sm text-mauve font-bold hover:underline"
            >
              {{ pedidoDetalle.guia }} <i class="pi pi-copy text-xs" aria-hidden="true"></i>
            </button>
          </div>

          <!-- Info cliente -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
              {{ (pedidoDetalle.cliente_nombre || pedidoDetalle.clientes?.nombre || '?').charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="font-bold text-navy">{{ pedidoDetalle.cliente_nombre || pedidoDetalle.clientes?.nombre }}</p>
              <p class="text-xs text-navy/60">{{ pedidoDetalle.cliente_telefono || pedidoDetalle.clientes?.telefono }}</p>
            </div>
          </div>
        </div>

        <!-- Datos del pedido -->
        <div class="p-5 border-b border-lavanda-medio space-y-3">
          <template v-if="!editandoPanel">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-navy/50 font-bold">Producto</p>
                <p class="text-navy font-medium">{{ pedidoDetalle.productos?.nombre }}</p>
              </div>
              <div>
                <p class="text-xs text-navy/50 font-bold">Monto</p>
                <p class="text-navy font-medium">${{ Number(pedidoDetalle.monto).toFixed(2) }}</p>
              </div>
              <div>
                <p class="text-xs text-navy/50 font-bold">Tipo entrega</p>
                <p class="text-navy font-medium">{{ pedidoDetalle.tipo_entrega }}</p>
              </div>
              <div>
                <p class="text-xs text-navy/50 font-bold">Fecha despacho</p>
                <p class="text-navy font-medium">{{ formatFechaLarga(pedidoDetalle.fecha_despacho) }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-xs text-navy/50 font-bold">Dirección</p>
                <p class="text-navy font-medium">{{ pedidoDetalle.direccion }}</p>
              </div>
              <div v-if="pedidoDetalle.dias_en_agencia > 0" class="col-span-2">
                <p class="text-xs text-navy/50 font-bold">Días en agencia</p>
                <p class="font-medium" :class="pedidoDetalle.dias_en_agencia >= 6 ? 'text-alerta' : 'text-navy'">
                  {{ pedidoDetalle.dias_en_agencia }} de 8
                </p>
              </div>
              <div v-if="pedidoDetalle.notas" class="col-span-2">
                <p class="text-xs text-navy/50 font-bold">Notas</p>
                <p class="text-navy font-medium">{{ pedidoDetalle.notas }}</p>
              </div>
              <div v-if="pedidoDetalle.canal_origen" class="col-span-2">
                <p class="text-xs text-navy/50 font-bold">Canal origen</p>
                <p class="text-navy font-medium">{{ pedidoDetalle.canal_origen }}</p>
              </div>
            </div>
          </template>

          <!-- Formulario de edición inline -->
          <template v-else>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-navy mb-1">Nombre cliente</label>
                  <input v-model="editForm.cliente_nombre" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-navy mb-1">WhatsApp</label>
                  <input v-model="editForm.cliente_telefono" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-navy mb-1">Guía</label>
                  <input v-model="editForm.guia" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-navy mb-1">Monto ($)</label>
                  <input v-model.number="editForm.monto" type="number" step="0.01" min="0" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold text-navy mb-1">Dirección</label>
                <input v-model="editForm.direccion" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
              </div>
              <div>
                <label class="block text-xs font-bold text-navy mb-1">Notas</label>
                <textarea v-model="editForm.notas" rows="2" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve resize-none"></textarea>
              </div>
              <div>
                <label class="block text-xs font-bold text-navy mb-1">Días en agencia</label>
                <input v-model.number="editForm.dias_en_agencia" type="number" min="0" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
              </div>
              <div class="flex gap-2">
                <button @click="editandoPanel = false" class="px-3 py-1.5 text-xs font-bold border border-lavanda-medio rounded-lg text-navy hover:bg-lavanda transition">
                  Cancelar
                </button>
                <button @click="guardarEdicion" class="px-3 py-1.5 text-xs font-bold bg-mauve text-white rounded-lg hover:opacity-90 transition">
                  Guardar
                </button>
              </div>
            </div>
          </template>
        </div>

        <!-- Retención 8 días -->
        <div class="px-5 py-3 border-b border-lavanda-medio">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="pi pi-clock text-navy/50" aria-hidden="true"></i>
              <span class="text-xs font-bold text-navy/60">Retención 8 días</span>
            </div>
            <button
              @click="toggleRetencion(pedidoDetalle!)"
              class="px-3 py-1.5 text-xs font-bold rounded-lg transition"
              :class="pedidoDetalle!.retencion_inicio
                ? 'bg-navy text-white hover:opacity-80'
                : 'border border-lavanda-medio text-navy hover:bg-lavanda'"
            >
              {{ pedidoDetalle!.retencion_inicio ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
          <div
            v-if="pedidoDetalle!.retencion_inicio"
            class="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold"
            :class="retencionColor(diasRetencion(pedidoDetalle!.retencion_inicio))"
          >
            <span class="w-2 h-2 rounded-full" :class="retencionDotColor(diasRetencion(pedidoDetalle!.retencion_inicio))"></span>
            Día {{ diasRetencion(pedidoDetalle!.retencion_inicio) }} de 8
            <span v-if="diasRetencion(pedidoDetalle!.retencion_inicio) >= 7" class="ml-auto text-xs">Riesgo de devolución</span>
            <span v-else-if="diasRetencion(pedidoDetalle!.retencion_inicio) >= 5" class="ml-auto text-xs">Alerta</span>
            <span v-else class="ml-auto text-xs">En tiempo</span>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="p-5 border-b border-lavanda-medio flex flex-wrap gap-2">
          <!-- Cambiar estado -->
          <template v-if="TODOS_LOS_ESTADOS.length">
            <button
              v-for="trans in TODOS_LOS_ESTADOS.filter(e => e !== pedidoDetalle?.estado)"
              :key="trans"
              @click="cambiarEstadoDesdePanel(trans as EstadoPedido)"
              class="px-3 py-1.5 text-xs font-bold rounded-lg border transition"
              :class="estadoBadge[trans] || 'bg-gray-100 text-gray-700'"
            >
              → {{ estadoLabels[trans] || trans }}
            </button>
          </template>

          <div class="flex-1"></div>

          <!-- Editar -->
          <button
            v-if="!editandoPanel"
            @click="iniciarEdicion"
            class="px-3 py-1.5 text-xs font-bold border border-lavanda-medio rounded-lg text-navy hover:bg-lavanda transition"
          >
            <i class="pi pi-pencil"></i> Editar
          </button>

          <!-- WA -->
          <button
            @click="abrirWAModal(pedidoDetalle)"
            class="px-3 py-1.5 text-xs font-bold bg-wa-green text-white rounded-lg hover:opacity-90 transition"
          >
            <i class="pi pi-whatsapp"></i> WA
          </button>

          <!-- Eliminar -->
          <button
            @click="eliminarPedido(pedidoDetalle)"
            class="px-3 py-1.5 text-xs font-bold text-alerta border border-alerta/30 rounded-lg hover:bg-red-50 transition flex items-center gap-1"
          >
            <i class="pi pi-trash" aria-hidden="true"></i> Eliminar
          </button>
        </div>

        <!-- Timeline historial -->
        <div class="p-5 flex-1">
          <h4 class="text-sm font-bold text-navy/60 uppercase tracking-wider mb-4">
            <i class="pi pi-history"></i> Historial de Estados
          </h4>
          <PedidoTimeline :historial="pedidoDetalle.historial || []" />
        </div>
      </div>
    </Drawer>

    <!-- Modal nuevo pedido -->
    <Dialog
      v-model:visible="modalVisible"
      header="Nuevo Pedido"
      modal
      :style="{ width: '520px' }"
      :pt="{
        root: { class: 'border border-lavanda-medio rounded-xl' },
        header: { class: 'bg-navy text-white rounded-t-xl p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-6' },
        headerActions: { class: 'text-white' },
      }"
    >
      <form @submit.prevent="guardarPedido" class="space-y-4">
        <!-- Extracción rápida de WhatsApp -->
        <div class="bg-wa-green/10 border border-wa-green/30 rounded-lg p-3">
          <label class="block text-xs font-bold text-navy mb-1.5">
            <i class="pi pi-whatsapp text-wa-green" aria-hidden="true"></i> Pedido rápido — Pega el mensaje de WhatsApp
          </label>
          <textarea
            v-model="mensajeWA"
            rows="3"
            placeholder="Hola quiero una depiladora IPL, soy María López 0991234567, enviar a Av. Principal 123, Quito"
            class="w-full px-3 py-2 border border-wa-green/30 rounded-lg bg-white text-navy text-sm focus:outline-none focus:border-wa-green transition resize-none"
          ></textarea>
          <button
            type="button"
            @click="procesarMensajeWA"
            class="mt-2 w-full py-2 bg-wa-green text-white font-bold rounded-lg hover:opacity-90 transition text-sm flex items-center justify-center gap-2"
          >
            <i class="pi pi-bolt" aria-hidden="true"></i> Extraer datos del mensaje
          </button>
        </div>

        <div class="border-t border-lavanda-medio"></div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Nombre cliente *</label>
            <input v-model="form.cliente_nombre" type="text" placeholder="María López" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
          </div>
          <div>
            <label class="block text-sm font-bold text-navy mb-1">WhatsApp *</label>
            <input v-model="form.cliente_telefono" type="text" placeholder="0991234567" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Guía *</label>
            <input v-model="form.guia" type="text" placeholder="SRV-123456" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
          </div>
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Producto *</label>
            <select v-model="form.producto_id" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition">
              <option value="">Seleccionar...</option>
              <option v-for="p in productosStore.productos" :key="p.id" :value="p.id">
                {{ p.nombre }} (${{ Number(p.precio).toFixed(2) }})
              </option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Tipo entrega *</label>
            <select v-model="form.tipo_entrega" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition">
              <option value="DOMICILIO">Domicilio</option>
              <option value="AGENCIA">Agencia</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Monto ($) *</label>
            <input v-model.number="form.monto" type="number" step="0.01" min="0" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-bold text-navy mb-1">
            {{ form.tipo_entrega === 'AGENCIA' ? 'Agencia destino' : 'Dirección' }} *
          </label>
          <input v-model="form.direccion" type="text" :placeholder="form.tipo_entrega === 'AGENCIA' ? 'Agencia Guayaquil Norte' : 'Av. Principal 123, Quito'" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
        </div>

        <div>
          <label class="block text-sm font-bold text-navy mb-1">Canal de origen</label>
          <select v-model="form.canal_origen" class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition">
            <option value="">Sin especificar</option>
            <option value="Instagram">Instagram</option>
            <option value="TikTok">TikTok</option>
            <option value="WhatsApp Directo">WhatsApp Directo</option>
            <option value="Facebook">Facebook</option>
            <option value="Referido">Referido</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="modalVisible = false" class="px-4 py-2 rounded-lg font-bold border border-lavanda-medio text-navy hover:bg-lavanda transition">
            Cancelar
          </button>
          <button type="submit" :disabled="formLoading" class="px-6 py-2 rounded-lg font-bold bg-mauve text-white hover:opacity-90 transition shadow-sm disabled:opacity-50">
            {{ formLoading ? 'Guardando...' : 'Crear Pedido' }}
          </button>
        </div>
      </form>
    </Dialog>

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
