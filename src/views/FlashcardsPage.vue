<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button router-link="/list" router-direction="forward">
            <ion-icon :icon="list" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>

        <ion-title>
          <span v-if="store.isLoading">
            Загрузка...
          </span>
          <span v-else>
            Повторено: {{ store.statistics.completedInSession }} / {{ store.statistics.totalInSession }}
          </span>
        </ion-title>

        <ion-buttons slot="end">
          <ion-button router-link="/add-card" router-direction="forward">
            <ion-icon :icon="add" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding ion-text-center">
      
      <div v-if="store.isLoading" class="loading-state">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Загрузка словаря...</p>
      </div>

      <div v-else-if="!store.isLoading && store.statistics.totalCards === 0" class="empty-state ion-padding">
        <h2>Словарь пуст!</h2>
        <p>Добавьте свои первые слова, чтобы начать повторение.</p>
        <ion-button router-link="/add-card">Добавить слово</ion-button>
      </div>
      
      <div 
        v-else-if="store.statistics.totalInSession > 0 && store.currentCardWithDirection" 
        class="card-review-container"
      >
        <FlashcardReview
          :card="store.currentCardWithDirection"
          :is-disabled="isTransitioning"
          @start-transition="startTransition"
          @review-complete="handleReviewComplete"
          :key="store.currentCardWithDirection.id"
        />
        
        </div>

      <div v-else class="all-done-message ion-padding">
        <ion-icon :icon="checkmarkCircle" color="success" class="done-icon"></ion-icon>
        <h2>Поздравляем! 🎉</h2>
        <p>Вы повторили все запланированные карточки на сегодня.</p>
        <p>Возвращайтесь завтра или добавьте новые слова!</p>
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useFlashcardsStore } from '@/stores/useFlashcardsStore';
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButtons, IonButton, IonIcon, IonSpinner 
} from '@ionic/vue';
import { add, list, checkmarkCircle } from 'ionicons/icons';

// 💡 ИСПОЛЬЗУЕМ ПУТЬ, который вы указали как правильный:
import FlashcardReview from '@/views/FlashcardReview.vue'; 

const store = useFlashcardsStore();
const isTransitioning = ref(false); 

onMounted(() => {
    store.loadCards(); 
});

// --- Обработка действий пользователя ---

const handleReviewComplete = (card, quality) => {
  store.processReview(card, quality); 
  // Сбрасываем блокировку после завершения процесса review в Store
  isTransitioning.value = false;
};

// Блокируем взаимодействие, пока FlashcardReview выполняет анимацию
const startTransition = () => {
    isTransitioning.value = true;
};
</script>

<style scoped>
.done-icon {
  font-size: 80px;
  margin-bottom: 15px;
}
.loading-state, .empty-state, .all-done-message {
    padding-top: 50px;
}
</style>
