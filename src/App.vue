<template>
  <ion-app>
    <ion-router-outlet v-if="store.isInitialized" /> 
    <div v-else class="initial-loading">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Инициализация приложения...</p>
    </div>
  </ion-app>
</template>

<script setup>
import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/vue';
import { useFlashcardsStore } from '@/stores/useFlashcardsStore';
import { initStorage } from '@/services/storageService';

const store = useFlashcardsStore();

async function initializeApp() {
    try {
        // 1. Сначала ждем, пока хранилище будет полностью готово
        await initStorage();
        console.log("Хранилище инициализировано. Запускаем загрузку данных.");
        
        // 2. Затем запускаем загрузку данных (эта функция установит isInitialized в true в конце)
        await store.loadCards(); 
        
    } catch (e) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА ЗАПУСКА:", e);
        // В случае критической ошибки инициализации, мы все равно должны разблокировать UI, 
        // чтобы показать дефолтные карточки или сообщение об ошибке.
        store.storageFailed = true;
        store.isInitialized = true;
    }
}

// 3. Вызываем асинхронную функцию при старте компонента
initializeApp();
</script>
