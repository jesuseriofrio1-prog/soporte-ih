import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
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
      // Redirect legacy /novedades al filtro chip de Pedidos
      {
        path: 'novedades',
        redirect: '/pedidos?filtro=novedades',
      },
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
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
