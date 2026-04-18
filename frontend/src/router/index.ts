import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // Ruta pública de login
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: 'Iniciar sesión' },
  },
  // Formulario público sin layout: link compartible con clientes finales
  {
    path: '/p/:tiendaSlug/:productoSlug?',
    name: 'public-solicitud',
    component: () => import('../views/PublicSolicitudView.vue'),
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
        path: 'solicitudes',
        name: 'solicitudes',
        component: () => import('../views/SolicitudesView.vue'),
        meta: { title: 'Solicitudes públicas' },
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
 * Guard de auth. Las rutas `meta.public === true` no requieren login. Para el
 * resto, validamos la cookie de sesión con GET /auth/me en el primer hit y
 * cacheamos el resultado en `authStore.checked`. Si /auth/me falla, redirect
 * a /login con ?redirect= para volver después.
 */
router.beforeEach(async (to) => {
  // Lazy import para evitar ciclos pinia ↔ router.
  const { useAuthStore } = await import('../stores/auth')
  const auth = useAuthStore()

  const isPublic = to.matched.some((r) => r.meta?.public)

  // Validamos sesión una vez por carga (cubre refresh de página).
  if (!auth.checked) {
    await auth.checkToken()
  }

  if (!isPublic && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { path: '/dashboard' }
  }
})

export default router
