import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // Ruta pública de login
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: 'Iniciar sesión' },
  },
  // Formulario público de compra: siempre por producto. El link genérico
  // de catálogo (/p/:slug sin producto) fue eliminado por decisión de
  // producto — cada pedido se inicia desde el link de un producto.
  {
    path: '/p/:tiendaSlug/:productoSlug',
    name: 'public-solicitud',
    component: () => import('../views/PublicSolicitudView.vue'),
    meta: { public: true },
  },
  // Tracking público con marca — el link que compartimos al cliente final
  {
    path: '/t/:code',
    name: 'public-tracking',
    component: () => import('../views/PublicTrackingView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/',
    component: () => import('../components/layout/AppLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: 'Dashboard General' },
      },
      {
        path: 'pedidos',
        name: 'pedidos',
        component: () => import('../views/PedidosView.vue'),
        meta: { title: 'Envíos / Pedidos' },
      },
      { path: 'novedades', redirect: '/pedidos?filtro=novedades' },
      {
        path: 'catalogo',
        name: 'catalogo',
        component: () => import('../views/CatalogoView.vue'),
        meta: { title: 'Catálogo' },
      },
      {
        path: 'clientes',
        name: 'clientes',
        component: () => import('../views/ClientesView.vue'),
        meta: { title: 'Clientes' },
      },
      {
        path: 'tiendas',
        name: 'tiendas',
        component: () => import('../views/TiendasView.vue'),
        meta: { title: 'Administrar Tiendas' },
      },
      {
        path: 'integraciones',
        name: 'integraciones',
        component: () => import('../views/IntegracionesView.vue'),
        meta: { title: 'Integraciones' },
      },
      {
        path: 'plantillas',
        name: 'plantillas',
        component: () => import('../views/PlantillasView.vue'),
        meta: { title: 'Plantillas WhatsApp' },
      },
      {
        path: 'upsell',
        name: 'upsell',
        component: () => import('../views/UpsellView.vue'),
        meta: { title: 'Oportunidades de upsell' },
      },
      {
        path: 'economics',
        name: 'economics',
        component: () => import('../views/EconomicsView.vue'),
        meta: { title: 'Unit economics' },
      },
      {
        path: 'referidos',
        name: 'referidos',
        component: () => import('../views/ReferidosView.vue'),
        meta: { title: 'Referidos' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * Guard de auth.
 *
 * Reglas:
 *  - Formularios públicos (/p/:slug/*) no llaman a /auth/me. Los navegadores
 *    de clientes finales nunca deben tocar endpoints de sesión — reduce ruido
 *    de 401s y superficie de contacto con el backend admin.
 *  - /login sí llama a /auth/me: si ya hay sesión, redirige a /dashboard.
 *  - Rutas privadas: si no hay sesión, a /login con ?redirect=.
 */
router.beforeEach(async (to) => {
  // Rutas de cliente final (form público + tracking público): no
  // tocamos auth. El navegador del cliente nunca pide /auth/me.
  const isPublicClient = to.name === 'public-solicitud' || to.name === 'public-tracking'
  if (isPublicClient) return

  const { useAuthStore } = await import('../stores/auth')
  const auth = useAuthStore()

  if (!auth.checked) {
    await auth.checkToken()
  }

  if (to.name === 'login') {
    return auth.isAuthenticated ? { path: '/dashboard' } : undefined
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

export default router
