<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import Drawer from 'primevue/drawer'
import { useClientesStore } from '../stores/clientes'
import { useTiendaStore } from '../stores/tienda'
import { abrirWhatsApp } from '../composables/useWhatsApp'
import Dialog from 'primevue/dialog'
import Swal from 'sweetalert2'
import clientesService from '../services/clientesService'
import type { Cliente } from '../services/clientesService'

const toast = useToast()
const store = useClientesStore()
const tiendaStore = useTiendaStore()

// Modal crear cliente
const crearModalVisible = ref(false)
const crearLoading = ref(false)
const crearForm = ref({ nombre: '', telefono: '', ciudad: '', notas: '' })

function abrirCrearCliente() {
  crearForm.value = { nombre: '', telefono: '', ciudad: '', notas: '' }
  crearModalVisible.value = true
}

async function guardarNuevoCliente() {
  if (!crearForm.value.nombre.trim()) {
    toast.warning('El nombre es requerido')
    return
  }
  if (!crearForm.value.telefono.trim()) {
    toast.warning('El teléfono es requerido')
    return
  }

  crearLoading.value = true
  try {
    await clientesService.create({
      nombre: crearForm.value.nombre,
      telefono: crearForm.value.telefono,
      ciudad: crearForm.value.ciudad || undefined,
      notas: crearForm.value.notas || undefined,
    })
    toast.success('Cliente creado')
    crearModalVisible.value = false
    store.fetchClientes(busqueda.value || undefined)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al crear cliente')
  } finally {
    crearLoading.value = false
  }
}

// Eliminar cliente
async function eliminarCliente(cliente: Cliente) {
  const result = await Swal.fire({
    title: '¿Eliminar cliente?',
    text: `Se eliminará "${cliente.nombre}" permanentemente.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#C8C8E9',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    try {
      await clientesService.remove(cliente.id)
      toast.success('Cliente eliminado')
      store.fetchClientes(busqueda.value || undefined)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Error al eliminar. El cliente puede tener pedidos asociados.')
    }
  }
}

// Edición de cliente
const editandoCliente = ref(false)
const editClienteForm = ref({ nombre: '', telefono: '', ciudad: '', notas: '' })

function iniciarEdicionCliente() {
  if (!store.clienteActivo) return
  editClienteForm.value = {
    nombre: store.clienteActivo.nombre,
    telefono: store.clienteActivo.telefono,
    ciudad: store.clienteActivo.ciudad || '',
    notas: store.clienteActivo.notas || '',
  }
  editandoCliente.value = true
}

async function guardarEdicionCliente() {
  if (!store.clienteActivo) return
  if (!editClienteForm.value.nombre.trim()) {
    toast.warning('El nombre es requerido')
    return
  }
  try {
    await clientesService.update(store.clienteActivo.id, {
      nombre: editClienteForm.value.nombre,
      telefono: editClienteForm.value.telefono || undefined,
      ciudad: editClienteForm.value.ciudad || undefined,
      notas: editClienteForm.value.notas || undefined,
    })
    toast.success('Cliente actualizado')
    editandoCliente.value = false
    await store.fetchClienteDetalle(store.clienteActivo.id)
    store.fetchClientes(busqueda.value || undefined)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al actualizar cliente')
  }
}

// Búsqueda con debounce
const busqueda = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onBuscar() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    store.fetchClientes(busqueda.value || undefined)
  }, 300)
}

// Panel de perfil
const perfilVisible = ref(false)
const perfilLoading = ref(false)

async function verPerfil(cliente: Cliente) {
  perfilVisible.value = true
  perfilLoading.value = true
  try {
    await store.fetchClienteDetalle(cliente.id)
  } catch {
    toast.error('Error al cargar perfil del cliente')
  } finally {
    perfilLoading.value = false
  }
}

// Iniciales para avatar
function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Total comprado por un cliente (suma de pedidos en la lista principal — se calcula en detalle)
function totalComprado(pedidos: any[]): number {
  return pedidos.reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0)
}

// Formato fecha corto
function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Estilos de badge de estado
const estadoEstilos: Record<string, string> = {
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

function enviarWA(telefono: string, nombre: string) {
  const tienda = tiendaStore.tiendaActiva?.nombre || 'nuestra tienda'
  const msg = `¡Hola ${nombre}! ✨ Te escribimos del equipo de ${tienda}. ¿En qué podemos ayudarte?`
  abrirWhatsApp(telefono, msg)
}

onMounted(() => {
  store.fetchClientes()
})
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ store.clientes.length }} clientes
        </div>
        <h1 class="h-display text-[40px] leading-none">Clientes</h1>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 px-3 h-9 rounded-md surface">
          <svg class="w-3.5 h-3.5 text-ink-faint" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="7" cy="7" r="4.5"/><path d="M13 13l-2.5-2.5"/>
          </svg>
          <input
            v-model="busqueda"
            @input="onBuscar"
            type="text"
            placeholder="Buscar por nombre, teléfono…"
            class="bg-transparent outline-none text-[12px] w-64 placeholder:text-ink-faint text-ink"
          />
        </div>
        <button
          @click="abrirCrearCliente"
          class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center gap-2"
          style="background: var(--ink); color: var(--paper);"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 3v10M3 8h10" stroke-linecap="round"/>
          </svg>
          Nuevo cliente
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="surface rounded-xl p-16 text-center">
      <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
      <p class="text-[13px] text-ink-muted mt-3">Cargando clientes…</p>
    </div>

    <!-- Tabla -->
    <div v-else class="surface rounded-xl overflow-hidden">
      <div v-if="store.clientes.length === 0" class="empty-pattern py-16 text-center">
        <p class="text-[13px] text-ink-muted">No se encontraron clientes</p>
      </div>
      <table v-else class="w-full text-[13px]">
        <thead>
          <tr
            class="border-b hairline text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold"
            style="background: var(--paper-alt);"
          >
            <th class="py-2.5 pl-5 pr-2 text-left">Cliente</th>
            <th class="py-2.5 px-2 text-left">Ciudad</th>
            <th class="py-2.5 px-2 text-right">Pedidos</th>
            <th class="py-2.5 px-2 text-right">LTV</th>
            <th class="py-2.5 pl-2 pr-5 text-right w-24"></th>
          </tr>
        </thead>
        <tbody class="divide-y hairline">
          <tr
            v-for="cliente in store.clientes"
            :key="cliente.id"
            class="hover:bg-paper-alt cursor-pointer row-parent"
            @click="verPerfil(cliente)"
          >
            <td class="py-3 pl-5 pr-2">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full grid place-items-center text-[11px] font-semibold shrink-0"
                  style="background: linear-gradient(135deg, var(--rose-bg), var(--accent-soft)); color: var(--rose-fg);"
                >
                  {{ iniciales(cliente.nombre) }}
                </div>
                <div class="min-w-0">
                  <div class="font-medium truncate">{{ cliente.nombre }}</div>
                  <div class="text-[11px] text-ink-faint tabular font-mono">{{ cliente.telefono }}</div>
                </div>
              </div>
            </td>
            <td class="py-3 px-2 text-[12px] text-ink-muted">
              {{ [cliente.ciudad, cliente.provincia].filter(Boolean).join(', ') || '—' }}
            </td>
            <td class="py-3 px-2 text-right font-mono tabular">{{ cliente.pedidos_total }}</td>
            <td class="py-3 px-2 text-right font-mono tabular">${{ Number(cliente.monto_total).toFixed(2) }}</td>
            <td class="py-3 pl-2 pr-5 text-right">
              <button
                @click.stop="eliminarCliente(cliente)"
                class="row-actions w-6 h-6 grid place-items-center rounded hover:bg-paper-alt ml-auto"
                title="Eliminar"
              >
                <svg class="w-3.5 h-3.5" style="color: var(--rose-dot);" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m-5 0v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke-linecap="round"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sidebar perfil del cliente -->
    <Drawer
      v-model:visible="perfilVisible"
      position="right"
      :style="{ width: '420px' }"
      :pt="{
        root: { class: 'border-l border-lavanda-medio' },
        header: { class: 'bg-ink text-paper p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-0' },
        headerActions: { class: 'text-paper' },
      }"
    >
      <template #header>
        <span class="font-bold text-lg">Perfil del Cliente</span>
      </template>

      <!-- Loading -->
      <div v-if="perfilLoading" class="flex items-center justify-center py-20">
        <i class="pi pi-spin pi-spinner text-3xl text-mauve"></i>
      </div>

      <!-- Contenido del perfil -->
      <div v-else-if="store.clienteActivo" class="flex flex-col h-full">
        <!-- Cabecera del cliente -->
        <div class="bg-lavanda/50 p-6 text-center border-b border-lavanda-medio">
          <div class="w-16 h-16 bg-ink rounded-full flex items-center justify-center text-paper text-xl font-bold mx-auto mb-3">
            {{ iniciales(store.clienteActivo.nombre) }}
          </div>
          <h3 class="text-lg font-bold text-navy">{{ store.clienteActivo.nombre }}</h3>
          <p class="text-sm text-navy/60">{{ store.clienteActivo.telefono }}</p>
          <p v-if="store.clienteActivo.ciudad || store.clienteActivo.provincia" class="text-xs text-navy/40 mt-1">
            <i class="pi pi-map-marker"></i>
            {{ [store.clienteActivo.ciudad, store.clienteActivo.provincia].filter(Boolean).join(', ') }}
          </p>

          <!-- Estadísticas rápidas -->
          <div class="flex justify-center gap-6 mt-4">
            <div class="text-center">
              <p class="text-2xl font-black text-mauve">{{ store.clienteActivo.pedidos.length }}</p>
              <p class="text-xs text-navy/50 font-medium">Pedidos</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-black text-navy">${{ totalComprado(store.clienteActivo.pedidos).toFixed(2) }}</p>
              <p class="text-xs text-navy/50 font-medium">Total</p>
            </div>
          </div>

          <!-- Botones -->
          <div class="flex justify-center gap-2 mt-4">
            <button
              @click="enviarWA(store.clienteActivo.telefono, store.clienteActivo.nombre)"
              class="inline-flex items-center gap-2 bg-wa-green text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition"
            >
              <i class="pi pi-whatsapp"></i> WA
            </button>
            <button
              @click="iniciarEdicionCliente"
              class="inline-flex items-center gap-2 border border-lavanda-medio text-navy px-4 py-2 rounded-lg text-sm font-bold hover:bg-lavanda transition"
            >
              <i class="pi pi-pencil"></i> Editar
            </button>
          </div>
        </div>

        <!-- Formulario edición cliente -->
        <div v-if="editandoCliente" class="p-5 border-b border-lavanda-medio space-y-3">
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Nombre</label>
            <input v-model="editClienteForm.nombre" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
          </div>
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Teléfono</label>
            <input v-model="editClienteForm.telefono" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
          </div>
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Ciudad</label>
            <input v-model="editClienteForm.ciudad" type="text" placeholder="Quito, Guayaquil..." class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
          </div>
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Notas</label>
            <textarea v-model="editClienteForm.notas" rows="2" placeholder="Notas sobre el cliente..." class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve resize-none"></textarea>
          </div>
          <div class="flex gap-2">
            <button @click="editandoCliente = false" class="px-3 py-1.5 text-xs font-bold border border-lavanda-medio rounded-lg text-navy hover:bg-lavanda transition">
              Cancelar
            </button>
            <button @click="guardarEdicionCliente" class="px-3 py-1.5 text-xs font-bold bg-mauve text-white rounded-lg hover:opacity-90 transition">
              Guardar
            </button>
          </div>
        </div>

        <!-- Notas -->
        <div v-if="store.clienteActivo.notas && !editandoCliente" class="px-6 py-3 bg-yellow-50 border-b border-lavanda-medio">
          <p class="text-xs font-bold text-navy/60 mb-1"><i class="pi pi-bookmark"></i> Notas</p>
          <p class="text-sm text-navy">{{ store.clienteActivo.notas }}</p>
        </div>

        <!-- Lista de pedidos -->
        <div class="flex-1 overflow-y-auto p-6">
          <h4 class="text-sm font-bold text-navy/60 uppercase tracking-wider mb-3">
            Historial de Pedidos
          </h4>

          <div v-if="store.clienteActivo.pedidos.length === 0" class="text-center py-8">
            <p class="text-sm text-navy/40">Sin pedidos registrados</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="pedido in store.clienteActivo.pedidos"
              :key="pedido.id"
              class="bg-white border border-lavanda-medio rounded-lg p-3 hover:shadow-sm transition"
            >
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-bold text-navy text-sm">
                    {{ (pedido as any).productos?.nombre || 'Producto' }}
                  </p>
                  <p class="text-xs text-navy/50 mt-0.5">
                    {{ formatFecha(pedido.created_at) }} · Guía: {{ pedido.guia }}
                  </p>
                </div>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  :class="estadoEstilos[pedido.estado] || 'bg-gray-100 text-gray-700'"
                >
                  {{ pedido.estado.replace(/_/g, ' ') }}
                </span>
              </div>
              <div class="flex justify-between mt-2 text-xs">
                <span class="text-navy/50">{{ pedido.tipo_entrega }}</span>
                <span class="font-bold text-navy">${{ Number(pedido.monto).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>

    <!-- Modal crear cliente -->
    <Dialog
      v-model:visible="crearModalVisible"
      header="Nuevo Cliente"
      modal
      :style="{ width: '420px' }"
      :pt="{
        root: { class: 'border border-lavanda-medio rounded-xl' },
        header: { class: 'bg-ink text-paper rounded-t-xl p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-6' },
        headerActions: { class: 'text-paper' },
      }"
    >
      <form @submit.prevent="guardarNuevoCliente" class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Nombre *</label>
          <input
            v-model="crearForm.nombre"
            type="text"
            placeholder="María López"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
          />
        </div>
        <div>
          <label class="block text-sm font-bold text-navy mb-1">WhatsApp *</label>
          <input
            v-model="crearForm.telefono"
            type="text"
            placeholder="0991234567"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
          />
        </div>
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Ciudad</label>
          <input
            v-model="crearForm.ciudad"
            type="text"
            placeholder="Quito, Guayaquil..."
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
          />
        </div>
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Notas</label>
          <textarea
            v-model="crearForm.notas"
            rows="2"
            placeholder="Notas sobre el cliente..."
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition resize-none"
          ></textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            @click="crearModalVisible = false"
            class="px-4 py-2 rounded-lg font-bold border border-lavanda-medio text-navy hover:bg-lavanda transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="crearLoading"
            class="px-6 py-2 rounded-lg font-bold bg-mauve text-white hover:opacity-90 transition shadow-sm disabled:opacity-50"
          >
            {{ crearLoading ? 'Guardando...' : 'Crear Cliente' }}
          </button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
