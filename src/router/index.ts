import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';
import FlashcardsPage from '@/views/FlashcardsPage.vue';
import AddCardPage from '@/views/AddCardPage.vue';
import CardListPage from '@/views/CardListPage.vue'; // Главный компонент для списка/редактирования

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/review'
  },
  {
    path: '/review',
    name: 'Review',
    component: FlashcardsPage 
  },
  {
    path: '/add-card',
    name: 'AddCard',
    component: AddCardPage 
  },
  // 1. Маршрут для списка
  {
    path: '/list',
    name: 'CardList',
    component: CardListPage
  },
  // 2. 💡 Новый Маршрут для редактирования (использует тот же компонент)
  {
    path: '/edit-card/:id',
    name: 'EditCard',
    component: CardListPage
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
