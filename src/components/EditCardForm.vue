<template>
  <form @submit.prevent="submitUpdate">
    <ion-item class="ion-margin-bottom">
      <ion-label position="stacked">Слово</ion-label>
      <ion-input :value="formData.word" disabled></ion-input>
    </ion-item>
    
    <ion-item class="ion-margin-bottom">
      <ion-label position="stacked">Перевод </ion-label>
      <ion-input v-model="formData.translation" required></ion-input>
    </ion-item>
    
    <ion-item class="ion-margin-bottom">
      <ion-label position="stacked">Синонимы / Примеры (через запятую)</ion-label>
      <ion-textarea v-model="formData.meaningsInput" rows="3" auto-grow></ion-textarea>
    </ion-item>

    <ion-grid class="ion-margin-top">
        <ion-row>
            <ion-col size="8">
                <ion-button 
                    type="submit" 
                    expand="block" 
                    color="primary"
                    :disabled="!formData.translation.trim()"
                >
                    Сохранить Изменения
                </ion-button>
            </ion-col>
            <ion-col size="4">
                <ion-button 
                    @click="openDeleteAlert"
                    expand="block" 
                    color="danger" 
                    fill="outline"
                >
                    Удалить
                </ion-button>
            </ion-col>
        </ion-row>
    </ion-grid>

    <ion-alert
        ref="deleteAlertRef"
        header="Подтвердите удаление"
        :message="`Вы уверены, что хотите удалить слово «${formData.word}»?`"
        :buttons="[
            {
                text: 'Отмена',
                role: 'cancel',
            },
            {
                text: 'Удалить',
                role: 'destructive',
                handler: confirmDelete, // Вызываем метод удаления
            },
        ]"
    ></ion-alert>

  </form>
</template>

<script setup>
import { reactive, watch, ref } from 'vue';
import { IonItem, IonLabel, IonInput, IonTextarea, IonButton, IonAlert, IonGrid, IonRow, IonCol } from '@ionic/vue';
import { useFlashcardsStore } from '@/stores/useFlashcardsStore';

const props = defineProps({
  card: Object // Получаем объект карточки для инициализации
});

const emit = defineEmits(['card-updated', 'card-deleted']);

const deleteAlertRef = ref(null);

const store = useFlashcardsStore();

// Локальное реактивное состояние формы, инициализированное через props
const formData = reactive({
    id: props.card.id, 
    word: props.card.word, 
    translation: props.card.translation, 
    meaningsInput: props.card.meanings ? props.card.meanings.join(', ') : ''
});

// Слушаем изменения props.card (если модальное окно переиспользуется)
watch(() => props.card, (newCard) => {
    if (newCard) {
        formData.id = newCard.id;
        formData.word = newCard.word;
        formData.translation = newCard.translation;
        formData.meaningsInput = newCard.meanings ? newCard.meanings.join(', ') : '';
    }
}, { immediate: true });

const openDeleteAlert = () => {
    if (deleteAlertRef.value && deleteAlertRef.value.$el) {
        deleteAlertRef.value.$el.present();
    }
};


const submitUpdate = () => {
    // Преобразование строки обратно в массив
    const meaningsArray = formData.meaningsInput
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);

    // Полный обновленный объект для Store
    const updatedCard = {
        ...props.card, // 💡 КРИТИЧНО: СОХРАНЯЕТ ВСЕ SRS ПАРАМЕТРЫ!
        id: formData.id,
        word: formData.word,
        translation: formData.translation.trim(),
        meanings: meaningsArray,
    };
    
    // Отправляем обновленную карточку родительскому компоненту
    emit('card-updated', updatedCard);
};

const confirmDelete = () => {
      // Отправляем событие на родительский компонент
      emit('card-deleted', formData.id);
    };

</script>

<style scoped>
/* Унифицированный стиль кнопок */
ion-button {
    --border-radius: 8px; /* Стильный скругленный радиус */
    height: 44px; /* Единая высота */
    font-weight: 600;
}

/* 💡 НОВЫЕ СТИЛИ ДЛЯ РАСТЯЖЕНИЯ СЕТКИ КНОПОК */
.button-grid {
    margin-top: 15px; /* Отступ сверху от последнего поля */
    padding-left: 0; 
    padding-right: 0;
}

ion-col {
    padding-left: 5px; /* Уменьшаем внутренние отступы между кнопками */
    padding-right: 5px; 
}

/* Прижимаем крайние кнопки к краям ion-content */
ion-row > ion-col:first-child {
    padding-left: 0;
}
ion-row > ion-col:last-child {
    padding-right: 0;
}
</style>
