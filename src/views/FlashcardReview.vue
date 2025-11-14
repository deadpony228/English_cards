<template>
  <ion-card class="flashcard-container" :class="{ 'is-disabled': isDisabled }">
    <div 
      class="flashcard" 
      :class="{ 'is-flipped': isFlipped }"
      @click="!isDisabled && (isFlipped = !isFlipped)"     
    >
      <div class="flashcard-face flashcard-front">
          <h1 class="ion-padding-top">
              {{ card.isFrontToBack ? card.word : card.translation }}
          </h1>

          <p class="direction-hint">
            Переведите на {{ card.isFrontToBack ? 'русский' : 'английский' }}
          </p>

          <p class="flip-hint">Нажмите, чтобы увидеть перевод</p>
      </div>

      <div class="flashcard-face flashcard-back">
        <ion-card-content>
          <h2 class="translation-text">
              {{ card.isFrontToBack ? card.translation : card.word }}
          </h2>

          <div class="meanings-list ion-margin-top">
            <ion-chip v-for="m in card.meanings" :key="m" color="medium">{{ m }}</ion-chip>
          </div>

          <ion-grid class="ion-margin-top">
            <ion-row>
              <ion-col>
                <ion-button expand="block" color="danger" @click.stop="rateCard(1)" class="ion-text-wrap">
                  <span class="button-text">Сложно</span>
                </ion-button>
              </ion-col>
              <ion-col>
                <ion-button expand="block" color="warning" @click.stop="rateCard(3)" class="ion-text-wrap">
                  <span class="button-text">Нормально</span>
                </ion-button>
              </ion-col>
              <ion-col>
                <ion-button expand="block" color="success" @click.stop="rateCard(5)" class="ion-text-wrap">
                  <span class="button-text">Легко</span>
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-grid>
          
        </ion-card-content>
      </div>
    </div>
  </ion-card>
</template>

<script setup>
import { ref, watch } from 'vue';
import { 
  IonCard, IonCardContent, IonChip, IonButton, 
  IonGrid, IonRow, IonCol 
} from '@ionic/vue';

const props = defineProps({
  card: Object,
  isDisabled: {
    type: Boolean,
    default: false
  } 
});

const emit = defineEmits(['review-complete', 'start-transition']);
// 💡 КОНСТАНТА: Задержка для смены данных (300 мс, как вы просили)
const DATA_SWAP_DELAY = 300; 

const isFlipped = ref(false);

watch(() => props.card, () => {
    isFlipped.value = false;
}, { immediate: true });


const rateCard = (quality) => { 
  if (props.isDisabled) return;

  // 1. Сбрасываем переворот (запускается анимация)
  isFlipped.value = false;
  
  // 2. Сообщаем родителю, что анимация переворота началась (родитель запустит блокировку)
  emit('start-transition'); 

  // 3. ⚡️ КРИТИЧЕСКИЙ ШАГ: Вызываем событие обновления данных через 300 мс.
  setTimeout(() => {
    emit('review-complete', props.card, quality);
  }, DATA_SWAP_DELAY);
};
</script>

<style scoped>
ion-card {
  height: 400px; 
  perspective: 1000px;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2); 
  border-radius: 12px;
  margin: 20px auto; 
  max-width: 450px; 
  transition: opacity 0.3s ease;
}
/* Стили для заблокированного состояния */
.flashcard-container.is-disabled {
  pointer-events: none; 
  opacity: 0.5;
}
.flashcard {
  width: 100%;
  height: 100%;
  /* 💡 ВАЖНО: Анимация остается 600 мс */
  transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
  transform-style: preserve-3d;
  position: relative;
}
.is-flipped {
  transform: rotateY(180deg);
}
.flashcard-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  
  background: var(--ion-background-color, #ffffff);
  border-radius: 12px;
  padding-top: 30px; 
  padding-bottom: 5px;
}
.flashcard-back {
  transform: rotateY(180deg);
  justify-content: flex-start; 
  padding: 20px;
}

h1 { font-size: 2.5em; font-weight: bold; }
h2 { font-size: 1.8em; font-weight: 500; }
.direction-hint { color: var(--ion-color-medium); font-size: 0.9em; }
.flip-hint { 
    position: absolute; 
    bottom: 10px; 
    color: var(--ion-color-tertiary);
    font-size: 0.8em;
}
</style>
