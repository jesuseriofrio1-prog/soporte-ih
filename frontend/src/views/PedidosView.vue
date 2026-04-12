<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import PedidoStatusBadge from '../components/pedidos/PedidoStatusBadge.vue'
import PedidoTimeline from '../components/pedidos/PedidoTimeline.vue'
import WhatsAppModal from '../components/pedidos/WhatsAppModal.vue'
import { usePedidosStore } from '../stores/pedidos'
import { useProductosStore } from '../stores/productos'
import pedidosService from '../services/pedidosService'
import { TRANSICIONES_VALIDAS } from '../services/pedidosService'
import type { EstadoPedido, Pedido } from '../services/pedidosService'

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
const editForm = ref({ direccion: '', notas: '', dias_en_agencia: 0 })

function iniciarEdicion() {
  if (!pedidoDetalle.value) return
  editForm.value = {
    direccion: pedidoDetalle.value.direccion,
    notas: pedidoDetalle.value.notas || '',
    dias_en_agencia: pedidoDetalle.value.dias_en_agencia,
  }
  editandoPanel.value = true
}

async function guardarEdicion() {
  if (!pedidoDetalle.value) return
  try {
    await pedidosService.update(pedidoDetalle.value.id, {
      direccion: editForm.value.direccion,
      notas: editForm.value.notas || undefined,
      dias_en_agencia: editForm.value.dias_en_agencia,
    })
    toast.success('Pedido actualizado')
    editandoPanel.value = false
    pedidoDetalle.value = await pedidosService.getById(pedidoDetalle.value.id)
    pedidosStore.fetchPedidos()
  } catch (e: any) {
    toast.error(e.response?.data?.message || 'Error al actualizar')
  }
}

// Estados para los dropdowns de filtro
const estadosDisponibles: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'INGRESANDO', label: 'Ingresando' },
  { value: 'EN_TRANSITO', label: 'En Tránsito' },
  { value: 'EN_AGENCIA', label: 'En Agencia' },
  { value: 'EN_REPARTO', label: 'En Reparto' },
  { value: 'NOVEDAD', label: 'Novedad' },
  { value: 'ENTREGADO', label: 'Entregado' },
  { value: 'DEVUELTO', label: 'Devuelto' },
]

const estadoLabels: Record<string, string> = {
  INGRESANDO: 'Ingresando',
  EN_TRANSITO: 'En Tránsito',
  EN_AGENCIA: 'En Agencia',
  EN_REPARTO: 'En Reparto',
  ENTREGADO: 'Entregado',
  NOVEDAD: 'Novedad',
  DEVUELTO: 'Devuelto',
}

const estadoBadge: Record<string, string> = {
  INGRESANDO: 'bg-gray-100 text-gray-700',
  EN_TRANSITO: 'bg-blue-100 text-blue-700',
  EN_AGENCIA: 'bg-purple-100 text-purple-700',
  EN_REPARTO: 'bg-yellow-100 text-yellow-700',
  ENTREGADO: 'bg-green-100 text-green-700',
  NOVEDAD: 'bg-orange-100 text-orange-700',
  DEVUELTO: 'bg-red-100 text-red-700',
}

const filtroEstado = ref('')
const filtroProducto = ref('')

function aplicarFiltroEstado() {
  pedidosStore.setFiltro('estado', filtroEstado.value || undefined)
}

function aplicarFiltroProducto() {
  pedidosStore.setFiltro('producto_id', filtroProducto.value || undefined)
}

// Modal nuevo pedido
const modalVisible = ref(false)
const formLoading = ref(false)
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
  modalVisible.value = true
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

function trackingUrl(guia: string): string {
  return `https://www.servientrega.com.ec/tracking/?guia=${guia}`
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
}

function formatFechaLarga(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

function filaAlerta(estado: string, dias: number): boolean {
  return estado === 'NOVEDAD' || (estado === 'EN_AGENCIA' && dias >= 6)
}

onMounted(() => {
  pedidosStore.fetchPedidos()
  productosStore.fetchProductos(true)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Barra de filtros -->
    <div class="bg-white p-4 rounded-xl shadow-sm border border-lavanda-medio flex flex-wrap gap-4 items-center justify-between">
      <div class="flex items-center gap-3 flex-wrap">
        <i class="pi pi-filter text-mauve"></i>
        <span class="font-bold text-navy">Filtrar:</span>

        <select
          v-model="filtroProducto"
          @change="aplicarFiltroProducto"
          class="p-2 bg-lavanda/50 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-navy font-medium min-w-[200px]"
        >
          <option value="">Todos los productos</option>
          <option v-for="p in productosStore.productos" :key="p.id" :value="p.id">
            {{ p.nombre }}
          </option>
        </select>

        <select
          v-model="filtroEstado"
          @change="aplicarFiltroEstado"
          class="p-2 bg-lavanda/50 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-navy font-medium min-w-[180px]"
        >
          <option v-for="e in estadosDisponibles" :key="e.value" :value="e.value">
            {{ e.label }}
          </option>
        </select>
      </div>

      <button
        @click="abrirModal"
        class="bg-mauve text-white px-5 py-2 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm"
      >
        <i class="pi pi-plus"></i> Nuevo Pedido
      </button>
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
            <th class="p-4">Detalles / Cliente</th>
            <th class="p-4">Producto</th>
            <th class="p-4">Destino</th>
            <th class="p-4">Estado / Tiempo</th>
            <th class="p-4 text-center">Acción</th>
          </tr>
        </thead>
        <tbody class="text-sm divide-y divide-lavanda">
          <tr
            v-for="pedido in pedidosStore.pedidos"
            :key="pedido.id"
            class="transition cursor-pointer"
            :class="filaAlerta(pedido.estado, pedido.dias_en_agencia) ? 'bg-red-50' : 'hover:bg-lavanda/50'"
            @click="abrirDetalle(pedido)"
          >
            <td class="p-4">
              <p class="font-bold text-navy">{{ pedido.clientes?.nombre || '—' }}</p>
              <p class="text-xs text-navy/60">{{ pedido.clientes?.telefono || '—' }}</p>
              <p class="text-xs text-navy/40 mt-1">
                {{ formatFecha(pedido.created_at) }} ·
                <a
                  :href="trackingUrl(pedido.guia)"
                  target="_blank"
                  class="text-mauve hover:underline font-medium"
                  @click.stop
                >
                  {{ pedido.guia }}
                </a>
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
            </td>

            <td class="p-4 text-center" @click.stop>
              <button
                v-if="pedido.clientes?.telefono"
                @click="abrirWAModal(pedido)"
                class="inline-flex items-center gap-1 bg-wa-green text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition"
              >
                <i class="pi pi-whatsapp"></i> WA
              </button>
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
            <a
              :href="trackingUrl(pedidoDetalle.guia)"
              target="_blank"
              class="text-sm text-mauve font-bold hover:underline"
            >
              {{ pedidoDetalle.guia }} <i class="pi pi-external-link text-xs"></i>
            </a>
          </div>

          <!-- Info cliente -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
              {{ (pedidoDetalle.clientes?.nombre || '?').charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="font-bold text-navy">{{ pedidoDetalle.clientes?.nombre }}</p>
              <p class="text-xs text-navy/60">{{ pedidoDetalle.clientes?.telefono }}</p>
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

        <!-- Botones de acción -->
        <div class="p-5 border-b border-lavanda-medio flex flex-wrap gap-2">
          <!-- Cambiar estado -->
          <template v-if="TRANSICIONES_VALIDAS[pedidoDetalle.estado]?.length">
            <button
              v-for="trans in TRANSICIONES_VALIDAS[pedidoDetalle.estado]"
              :key="trans"
              @click="cambiarEstadoDesdePanel(trans as EstadoPedido)"
              class="px-3 py-1.5 text-xs font-bold rounded-lg border transition"
              :class="estadoBadge[trans] || 'bg-gray-100 text-gray-700'"
            >
              → {{ estadoLabels[trans] || trans }}
            </button>
          </template>
          <span v-else class="text-xs text-navy/40 italic">Estado final</span>

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
                {{ p.nombre }} (${{ p.precio.toFixed(2) }})
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
      :nombre="waPedido.clientes?.nombre || ''"
      :telefono="waPedido.clientes?.telefono || ''"
      :producto="waPedido.productos?.nombre || ''"
      :guia="waPedido.guia"
      :estado="waPedido.estado"
      :direccion="waPedido.direccion"
    />
  </div>
</template>
