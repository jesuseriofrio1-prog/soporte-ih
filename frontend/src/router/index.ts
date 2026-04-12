import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
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
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard: proteger rutas si no hay token
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('skinna_token')

  if (!to.meta.public && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
