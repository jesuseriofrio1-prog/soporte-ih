<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import Drawer from 'primevue/drawer'
import { useClientesStore } from '../stores/clientes'
import { abrirWhatsApp } from '../composables/useWhatsApp'
import type { Cliente } from '../services/clientesService'

const toast = useToast()
const store = useClientesStore()

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
  INGRESANDO: 'bg-gray-100 text-gray-700',
  EN_TRANSITO: 'bg-blue-100 text-blue-700',
  EN_AGENCIA: 'bg-purple-100 text-purple-700',
  EN_REPARTO: 'bg-yellow-100 text-yellow-700',
  ENTREGADO: 'bg-green-100 text-green-700',
  NOVEDAD: 'bg-orange-100 text-orange-700',
  DEVUELTO: 'bg-red-100 text-red-700',
}

function enviarWA(telefono: string, nombre: string) {
  const msg = `¡Hola ${nombre}! ✨ Te escribimos del equipo de SKINNA. ¿En qué podemos ayudarte?`
  abrirWhatsApp(telefono, msg)
}

onMounted(() => {
  store.fetchClientes()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-lavanda-medio">
      <h3 class="text-xl font-bold text-navy">Base de Clientes Frecuentes</h3>
      <div class="relative">
        <input
          v-model="busqueda"
          @input="onBuscar"
          type="text"
          placeholder="Buscar cliente..."
          class="p-2 pl-9 bg-lavanda/50 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-sm text-navy min-w-[250px]"
        />
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-mauve text-sm"></i>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-12">
      <i class="pi pi-spin pi-spinner text-4xl text-mauve"></i>
      <p class="text-navy/60 mt-2">Cargando clientes...</p>
    </div>

    <!-- Tabla -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-lavanda-medio overflow-x-auto">
      <table class="w-full text-left min-w-[600px]">
        <thead class="bg-lavanda-medio text-navy text-xs uppercase font-bold tracking-wider">
          <tr>
            <th class="p-4">Cliente</th>
            <th class="p-4 text-center">Pedidos Totales</th>
            <th class="p-4">Monto Comprado</th>
            <th class="p-4 text-center">Acción</th>
          </tr>
        </thead>
        <tbody class="text-sm divide-y divide-lavanda">
          <tr
            v-for="cliente in store.clientes"
            :key="cliente.id"
            class="hover:bg-lavanda/50 transition"
          >
            <!-- Cliente -->
            <td class="p-4 flex items-center gap-3">
              <div class="w-10 h-10 bg-lavanda rounded-full flex items-center justify-center text-navy font-bold shrink-0">
                {{ iniciales(cliente.nombre) }}
              </div>
              <div>
                <p class="font-bold text-navy text-base">{{ cliente.nombre }}</p>
                <p class="text-xs text-navy/60">{{ cliente.telefono }}</p>
              </div>
            </td>

            <!-- Pedidos (se mostrará al ver detalle, aquí placeholder) -->
            <td class="p-4 text-center font-bold text-mauve text-lg">—</td>

            <!-- Monto -->
            <td class="p-4 font-bold text-navy">—</td>

            <!-- Acción -->
            <td class="p-4 text-center">
              <button
                @click="verPerfil(cliente)"
                class="bg-lavanda-medio text-navy px-3 py-1.5 rounded-lg font-medium hover:bg-mauve hover:text-white transition text-xs"
              >
                <i class="pi pi-user-edit mr-1"></i> Ver Perfil
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Vacío -->
      <div v-if="store.clientes.length === 0" class="text-center py-12">
        <i class="pi pi-users text-5xl text-lavanda-medio"></i>
        <p class="text-navy/60 mt-3">No se encontraron clientes</p>
      </div>
    </div>

    <!-- Sidebar perfil del cliente -->
    <Drawer
      v-model:visible="perfilVisible"
      position="right"
      :style="{ width: '420px' }"
      :pt="{
        root: { class: 'border-l border-lavanda-medio' },
        header: { class: 'bg-navy text-white p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-0' },
        headerActions: { class: 'text-white' },
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
          <div class="w-16 h-16 bg-navy rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
            {{ iniciales(store.clienteActivo.nombre) }}
          </div>
          <h3 class="text-lg font-bold text-navy">{{ store.clienteActivo.nombre }}</h3>
          <p class="text-sm text-navy/60">{{ store.clienteActivo.telefono }}</p>
          <p v-if="store.clienteActivo.ciudad" class="text-xs text-navy/40 mt-1">
            <i class="pi pi-map-marker"></i> {{ store.clienteActivo.ciudad }}
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

          <!-- Botón WA -->
          <button
            @click="enviarWA(store.clienteActivo.telefono, store.clienteActivo.nombre)"
            class="mt-4 inline-flex items-center gap-2 bg-wa-green text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition"
          >
            <i class="pi pi-whatsapp"></i> Enviar WhatsApp
          </button>
        </div>

        <!-- Notas -->
        <div v-if="store.clienteActivo.notas" class="px-6 py-3 bg-yellow-50 border-b border-lavanda-medio">
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
  </div>
</template>
