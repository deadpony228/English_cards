<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/"></ion-back-button>
        </ion-buttons>
        <ion-title>➕ Добавить Карточку</ion-title>

        </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form @submit.prevent="saveCard">
        
        <ion-item class="ion-margin-bottom">
          <ion-label position="stacked">Английское слово (Word)</ion-label>
          <ion-input 
            v-model="newCard.word" 
            placeholder="Например, Serendipity" 
            required
          ></ion-input>
        </ion-item>
        
        <ion-item class="ion-margin-bottom">
          <ion-label position="stacked">Перевод (Translation)</ion-label>
          <ion-input 
            v-model="newCard.translation" 
            placeholder="Например, счастливая случайность" 
            required
          ></ion-input>
        </ion-item>
        
        <ion-item class="ion-margin-bottom">
          <ion-label position="stacked">Синонимы / Примеры (через запятую)</ion-label>
          <ion-textarea 
            v-model="newCard.meaningsInput" 
            rows="3" 
            auto-grow
            placeholder="Например: прозорливость, счастливая случайность"
          ></ion-textarea>
        </ion-item>

        <ion-button 
          type="submit" 
          expand="block" 
          color="primary" 
          class="ion-margin-top"
          :disabled="!newCard.word.trim() || !newCard.translation.trim()"
        >
          Сохранить карточку
        </ion-button>
        
      </form>
    </ion-content>

    <ion-toast 
      :is-open="isToastOpen"
      :message="messageToast"
      :duration="2000"
      :color="toastColor"
      @didDismiss="isToastOpen = false"
    ></ion-toast>

  </ion-page>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFlashcardsStore } from '@/stores/useFlashcardsStore';
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, 
  IonButton, IonButtons, IonBackButton, IonInput, 
  IonLabel, IonItem, IonTextarea, IonToast
} from '@ionic/vue';

const router = useRouter();
const store = useFlashcardsStore();

// --- 1. Состояние формы ---
const newCard = reactive({
  word: '',
  translation: '',
  meaningsInput: '', // Ввод через запятую
});

// --- 2. Уведомления ---
const isToastOpen = ref(false);
const messageToast = ref('');
const toastColor = ref('success');


// --- 3. Функция сохранения ---
const saveCard = async () => { // 💡 Добавлено async
  if (!newCard.word.trim() || !newCard.translation.trim()) {
    return;
  }
  
  // Преобразование строки дополнительных значений в массив
  const meaningsArray = newCard.meaningsInput
    .split(',')
    .map(m => m.trim())
    .filter(m => m.length > 0); 

  // Объект данных для передачи в Store
  const cardData = {
    word: newCard.word.trim(),
    translation: newCard.translation.trim(),
    meanings: meaningsArray
  };

  const success = await store.addCard(cardData); // 💡 Добавлено await

  // Вызов метода сохранения из хранилища (инициализирует SM-2 параметры)
  if (success) {
    // Успех: сброс формы и уведомление
    newCard.word = '';
    newCard.translation = '';
    newCard.meaningsInput = '';
    
    messageToast.value = 'Карточка успешно добавлена!';
    toastColor.value = 'success';
    isToastOpen.value = true;
    
    // Переход на главный экран (предполагаемый маршрут "/")
    setTimeout(() => {
      router.push('/');
    }, 1000);
    
  } else {
    // 💡 Неудача: уведомление о дубликате
    messageToast.value = 'Ошибка: Такая карточка уже есть в вашем словаре!';
    toastColor.value = 'danger';
    isToastOpen.value = true;
  }
};
</script>

<style scoped>
/* Унифицированный стиль кнопок */
ion-button {
    --border-radius: 8px; /* Стильный скругленный радиус */
    height: 44px; /* Единая высота */
    font-weight: 600;
}
</style>
