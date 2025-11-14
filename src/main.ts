import { createApp } from 'vue'
import App from './App.vue'
import router from './router';
import { createPinia } from 'pinia';
import { IonicVue } from '@ionic/vue';
import { initStorage } from '@/services/storageService'; // Оставляем, но вызываем до монтирования

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';
/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
/* Theme variables */
import '@ionic/vue/css/palettes/dark.system.css';
import './theme/variables.css';

// --- НАЧАЛО: СТАНДАРТНАЯ ИНИЦИАЛИЗАЦИЯ VUE/PINIA ---

const app = createApp(App);
const pinia = createPinia();

// 1. Инициализируем хранилище без блокировки main.ts.
// Мы запускаем это, чтобы убедиться, что хранилище готово,
// но не ждем его завершения, чтобы не блокировать UI.
initStorage().catch(e => console.error("Ошибка инициализации StorageService:", e));

// 2. ⚡️ КРИТИЧЕСКИ ВАЖНО: Pinia должна быть подключена ДО роутера.
app.use(pinia);

// 3. Подключаем Ionic и роутер.
app.use(IonicVue);
app.use(router);

// 4. Монтируем приложение, как только роутер будет готов.
router.isReady().then(() => {
    console.log("3. Роутер готов. Монтирование приложения...");
    app.mount('#app');
});
