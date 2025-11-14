<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/review"></ion-back-button>
        </ion-buttons>
        <ion-title>Словарь ({{ store.cards?.length || 0 }})</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/add-card" router-direction="forward">
            <ion-icon :icon="add" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      
      <ion-toolbar>
        <ion-searchbar
          placeholder="Найти слово или перевод..."
          :debounce="300"
          v-model="searchTerm"
          animated
        ></ion-searchbar>
      </ion-toolbar>
      
    </ion-header>

    <ion-content :fullscreen="true">
      
      <div v-if="store.isLoading" class="ion-padding ion-text-center">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Загрузка словаря...</p>
      </div>

      <div v-else-if="store.cards && store.cards.length === 0" class="ion-padding ion-text-center mt-20">
        <h3 class="text-xl font-semibold text-gray-700">Ваш словарь пуст</h3>
        <p class="text-gray-500 mt-2">Нажмите на плюс, чтобы добавить первую карточку.</p>
      </div>
      
      <ion-list v-else>
        <ion-item 
          v-for="card in filteredAndSortedCards" 
          :key="card.id" 
          detail
          @click="openEditModal(card)"
        >
          <ion-label>
            <h2 class="word-text">{{ card.word }}</h2>
            <p>{{ card.translation }}</p>
          </ion-label>
          
          <ion-note 
            slot="end" 
            :color="getReviewStatusColor(card.nextReviewDate, card.repetitionCount)"
          >
            {{ getNextReviewStatus(card.nextReviewDate, card.repetitionCount) }}
          </ion-note>
        </ion-item>
        
        <ion-item v-if="searchTerm && filteredAndSortedCards.length === 0" lines="none">
          <ion-label class="ion-text-center text-gray-500">
            <p class="mt-4">Ничего не найдено по запросу "{{ searchTerm }}"</p>
          </ion-label>
        </ion-item>
        
      </ion-list>
      
      <ion-modal :is-open="isModalOpen" @did-dismiss="isModalOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Редактировать слово</ion-title>
            
            <ion-buttons slot="start">
              <ion-back-button default-href="#" @click="isModalOpen = false"></ion-back-button>
            </ion-buttons>

          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <EditCardForm
            v-if="selectedCard"
            :card="selectedCard"
            @card-updated="handleUpdate"
            @card-deleted="handleDelete"
          />
        </ion-content>
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed } from 'vue';
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButtons, IonButton, IonIcon, IonBackButton, 
  IonList, IonItem, IonLabel, IonNote, IonModal, IonSpinner,
  IonSearchbar 
} from '@ionic/vue';
import { add } from 'ionicons/icons';
import { onIonViewWillEnter } from '@ionic/vue';
import { useFlashcardsStore } from '@/stores/useFlashcardsStore';

import EditCardForm from '@/components/EditCardForm.vue'; 

const store = useFlashcardsStore();

const isModalOpen = ref(false);
const selectedCard = ref(null);
const searchTerm = ref(''); 

// --- ВЫЧИСЛЯЕМОЕ СВОЙСТВО ДЛЯ ФИЛЬТРАЦИИ И СОРТИРОВКИ ---
const filteredAndSortedCards = computed(() => {
    if (!store.cards || store.cards.length === 0) {
        return [];
    }
    
    const query = searchTerm.value.toLowerCase().trim();
    
    // 1. Фильтрация
    const filtered = query
        ? store.cards.filter(card => 
            card.word.toLowerCase().includes(query) || 
            card.translation.toLowerCase().includes(query)
        )
        : store.cards; // Если нет запроса, возвращаем все карточки

    // 2. Сортировка по приоритету повторения (дате следующего обзора)
    
    const newCards = filtered.filter(card => card.repetitionCount === 0);
    const reviewedCards = filtered.filter(card => card.repetitionCount > 0);
    
    // a) Сортируем повторяемые: по дате следующего повторения (ближайшие даты - сначала)
    reviewedCards.sort((a, b) => {
        const dateA = new Date(a.nextReviewDate).getTime();
        const dateB = new Date(b.nextReviewDate).getTime();
        return dateA - dateB; 
    });
    
    // b) Сортируем новые карточки: по ID (самые новые - сверху)
    newCards.sort((a, b) => {
        const idA = a.id.toString();
        const idB = b.id.toString();

        if (!isNaN(idA) && !isNaN(idB)) {
            return Number(idB) - Number(idA);
        }
        if (idA < idB) return 1;
        if (idA > idB) return -1;
        return 0;
    });
    
    // Объединяем: Сначала карточки для повторения, потом новые.
    return [...reviewedCards, ...newCards];
});
// ------------------------------------------

onIonViewWillEnter(() => {
    if (!store.isInitialized) { 
        store.loadCards(); 
    }
});

// --- УТИЛИТЫ ДЛЯ ОТОБРАЖЕНИЯ СТАТУСА ---

const getNextReviewStatus = (nextReviewDate, repetitionCount) => {
    const now = new Date();
    const reviewDate = new Date(nextReviewDate);

    if (repetitionCount === 0) {
        return 'Новая';
    }

    if (reviewDate <= now) {
        return 'СЕГОДНЯ';
    }

    const diffTime = Math.abs(reviewDate.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
        return `Через ${diffDays} дн.`;
    } else if (diffDays <= 365) {
        return `Через ${Math.round(diffDays / 30)} мес.`;
    } else {
        return `Через ${Math.round(diffDays / 365)} г.`;
    }
};

const getReviewStatusColor = (nextReviewDate, repetitionCount) => {
    const now = new Date();
    const reviewDate = new Date(nextReviewDate);

    if (repetitionCount === 0) {
        return 'primary'; 
    }
    
    if (reviewDate <= now) {
        return 'danger'; 
    }

    return 'medium'; 
};


// --- ЛОГИКА МОДАЛЬНОГО ОКНА И ОБРАБОТКИ СОБЫТИЙ ---

const openEditModal = (card) => {
    selectedCard.value = { ...card }; 
    isModalOpen.value = true;
};

const handleUpdate = async (updatedCard) => {
    await store.updateCard(updatedCard);
    isModalOpen.value = false;
};

const handleDelete = async (cardId) => {
    await store.deleteCard(cardId);
    isModalOpen.value = false;
};
</script>

<style scoped>
ion-item h2.word-text {
  font-weight: 600;
}
.mt-20 {
    margin-top: 5rem; 
}
</style>
