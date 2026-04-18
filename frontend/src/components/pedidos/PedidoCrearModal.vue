<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import { useToast } from 'vue-toastification'
import type { Producto } from '../../services/productosService'
import type { CreatePedidoPayload } from '../../services/pedidosService'
import { extraerDatosPedido, contarCamposExtraidos } from '../../composables/useTextExtractor'
import direccionesService, { type DireccionParseada } from '../../services/direccionesService'

/**
 * Modal de creación de pedido. Incluye extracción automática a partir
 * de un mensaje pegado de WhatsApp — es la magia que ahorra tiempo al
 * operador cuando un cliente manda los datos por ahí.
 *
 * El padre emite "creado" cuando la creación fue exitosa (para recargar
 * lista). La creación real vive en el padre — nosotros solo validamos
 * y emitimos el payload.
 */
const props = defineProps<{
  visible: boolean
  productos: Producto[]
  loading: boolean
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  submit: [payload: CreatePedidoPayload]
}>()

const toast = useToast()

const mensajeWA = ref('')
const verificandoDireccion = ref(false)
const analisisDireccion = ref<DireccionParseada | null>(null)

async function verificarDireccion() {
  if (!form.value.direccion.trim()) {
    toast.warning('Escribe una dirección primero')
    return
  }
  verificandoDireccion.value = true
  try {
    analisisDireccion.value = await direccionesService.parse(form.value.direccion)
  } catch {
    toast.error('No se pudo analizar la dirección')
    analisisDireccion.value = null
  } finally {
    verificandoDireccion.value = false
  }
}
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

function resetForm() {
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
}

// Reset cada vez que el modal se abre, para no arrastrar datos previos.
watch(() => props.visible, (v) => {
  if (v) {
    resetForm()
    analisisDireccion.value = null
  }
})

function procesarMensajeWA() {
  if (!mensajeWA.value.trim()) {
    toast.warning('Pega un mensaje de WhatsApp primero')
    return
  }

  const datos = extraerDatosPedido(mensajeWA.value, props.productos)
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
    toast.info('No se pudieron extraer datos. Completa el formulario manualmente.')
  }
}

function guardar() {
  if (!form.value.cliente_nombre || !form.value.cliente_telefono || !form.value.guia ||
      !form.value.producto_id || !form.value.direccion) {
    toast.warning('Completa todos los campos requeridos')
    return
  }
  if (form.value.monto <= 0) {
    toast.warning('El monto debe ser mayor a 0')
    return
  }

  emit('submit', {
    cliente_nombre: form.value.cliente_nombre,
    cliente_telefono: form.value.cliente_telefono,
    guia: form.value.guia,
    producto_id: form.value.producto_id,
    tipo_entrega: form.value.tipo_entrega,
    direccion: form.value.direccion,
    monto: form.value.monto,
    canal_origen: form.value.canal_origen || undefined,
  })
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    header="Nuevo Pedido"
    modal
    :style="{ width: '520px' }"
    :pt="{
      root: { class: 'border border-lavanda-medio rounded-xl' },
      header: { class: 'bg-ink text-paper rounded-t-xl p-4' },
      title: { class: 'font-bold text-lg' },
      content: { class: 'p-6' },
      headerActions: { class: 'text-paper' },
    }"
  >
    <form @submit.prevent="guardar" class="space-y-4">
      <!-- Extracción rápida de WhatsApp -->
      <div class="bg-wa-green/10 border border-wa-green/30 rounded-lg p-3">
        <label class="block text-xs font-bold text-navy mb-1.5">
          <i class="pi pi-whatsapp text-wa-green" aria-hidden="true"></i>
          Pedido rápido — Pega el mensaje de WhatsApp
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
          <input v-model="form.cliente_nombre" type="text" placeholder="María López"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
        </div>
        <div>
          <label class="block text-sm font-bold text-navy mb-1">WhatsApp *</label>
          <input v-model="form.cliente_telefono" type="text" placeholder="0991234567"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Guía *</label>
          <input v-model="form.guia" type="text" placeholder="SRV-123456"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
        </div>
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Producto *</label>
          <select v-model="form.producto_id"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition">
            <option value="">Seleccionar...</option>
            <option v-for="p in productos" :key="p.id" :value="p.id">
              {{ p.nombre }} (${{ Number(p.precio).toFixed(2) }})
            </option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Tipo entrega *</label>
          <select v-model="form.tipo_entrega"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition">
            <option value="DOMICILIO">Domicilio</option>
            <option value="AGENCIA">Agencia</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Monto ($) *</label>
          <input v-model.number="form.monto" type="number" step="0.01" min="0"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="block text-sm font-bold text-navy">
            {{ form.tipo_entrega === 'AGENCIA' ? 'Agencia destino' : 'Dirección' }} *
          </label>
          <button
            v-if="form.tipo_entrega === 'DOMICILIO'"
            type="button"
            @click="verificarDireccion"
            :disabled="verificandoDireccion || !form.direccion.trim()"
            class="text-[11px] font-semibold px-2 py-1 rounded border hairline hover:bg-paper-alt transition disabled:opacity-40"
            style="color: var(--accent);"
            title="Analiza la dirección con IA antes de enviar a Rocket"
          >
            {{ verificandoDireccion ? 'Analizando…' : '✨ Verificar con IA' }}
          </button>
        </div>
        <input v-model="form.direccion" type="text"
          :placeholder="form.tipo_entrega === 'AGENCIA' ? 'Agencia Guayaquil Norte' : 'Av. Principal 123, Quito'"
          class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition" />

        <!-- Análisis de dirección -->
        <div
          v-if="analisisDireccion"
          class="mt-2 p-3 rounded-md text-[12px]"
          :class="analisisDireccion.completa ? 'pill-emerald' : 'pill-amber'"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold">
              {{ analisisDireccion.completa ? '✓ Dirección completa' : '⚠ Dirección incompleta' }}
            </span>
            <button
              type="button"
              @click="analisisDireccion = null"
              class="opacity-60 hover:opacity-100"
              aria-label="Cerrar análisis"
            >×</button>
          </div>
          <div v-if="analisisDireccion.provincia || analisisDireccion.canton" class="flex flex-wrap gap-2 mb-1">
            <span v-if="analisisDireccion.provincia" class="font-mono text-[11px]">
              {{ analisisDireccion.provincia }}
            </span>
            <span v-if="analisisDireccion.canton" class="font-mono text-[11px]">· {{ analisisDireccion.canton }}</span>
            <span v-if="analisisDireccion.sector" class="font-mono text-[11px]">· {{ analisisDireccion.sector }}</span>
          </div>
          <ul v-if="analisisDireccion.problemas.length > 0" class="list-disc pl-4 space-y-0.5">
            <li v-for="(p, i) in analisisDireccion.problemas" :key="i">{{ p }}</li>
          </ul>
        </div>
      </div>

      <div>
        <label class="block text-sm font-bold text-navy mb-1">Canal de origen</label>
        <select v-model="form.canal_origen"
          class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition">
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
        <button type="button" @click="emit('update:visible', false)"
          class="px-4 py-2 rounded-lg font-bold border border-lavanda-medio text-navy hover:bg-lavanda transition">
          Cancelar
        </button>
        <button type="submit" :disabled="loading"
          class="px-6 py-2 rounded-lg font-bold bg-mauve text-white hover:opacity-90 transition shadow-sm disabled:opacity-50">
          {{ loading ? 'Guardando...' : 'Crear Pedido' }}
        </button>
      </div>
    </form>
  </Dialog>
</template>
