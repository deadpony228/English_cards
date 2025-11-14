import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { getCards, saveCards as persistCards } from '@/services/storageService';
import { getDefaultCards } from '@/data/defaultCards'; 

// === КОНСТАНТЫ С ЛИМИТАМИ ===
const NEW_CARDS_LIMIT = 20; // Максимальное количество новых карточек за сессию
const REVIEW_CARDS_LIMIT = 30; // Максимальное количество повторений (проваленных/плановых) за сессию
const DUE_LIMIT = NEW_CARDS_LIMIT + REVIEW_CARDS_LIMIT; // Общий лимит сессии: 50

const SHORT_INTERVAL_MINUTES = 10; // Интервал в минутах для проваленных карточек
const REVIEW_HORIZON_DAYS = 7; // Горизонт поиска карточек для заполнения лимита (на 7 дней вперед)

// === УТИЛИТЫ ===
const generateUniqueId = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const getInitialSRS = () => ({
    repetitionCount: 0,
    easeFactor: 2.5,
    interval: 0,
    nextReviewDate: new Date().toISOString()
});

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// === ЛОГИКА SRS ===
const calculateSRS = (card, quality) => {
    let { repetitionCount, easeFactor, interval } = card;

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);

    if (quality < 3) {
        interval = 0;
        repetitionCount = 0;
    } else if (repetitionCount === 0) {
        interval = 1;
        repetitionCount = 1;
    } else if (repetitionCount === 1) {
        interval = 6;
        repetitionCount = 2;
    } else {
        interval = Math.round(interval * easeFactor);
        repetitionCount += 1;
    }

    const nextReviewDate = new Date();
    if (quality < 3) {
        nextReviewDate.setMinutes(nextReviewDate.getMinutes() + SHORT_INTERVAL_MINUTES);
    } else {
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    }
    
    return { nextReviewDate, easeFactor, interval, repetitionCount };
};

// =================================================================
// === PINIA STORE ===
// =================================================================
export const useFlashcardsStore = defineStore('flashcards', () => {
    // === 1. STATE (СВОЙСТВА) ===
    const cards = ref([]);
    const isLoading = ref(true);
    const isInitialized = ref(false);
    const storageFailed = ref(false); 
    
    const currentCardIndex = ref(0); 
    const isFrontToBack = ref(true);
    const sessionCards = ref([]); 
    
    const completedCount = ref(0); 
    const initialSessionSize = ref(0); 

    // === 2. GETTERS (ВЫЧИСЛЯЕМЫЕ СВОЙСТВА) ===
    const initialDueCards = computed(() => {
        if (cards.value.length === 0) return [];
        
        const now = new Date().getTime();
        return cards.value.filter(card => 
            new Date(card.nextReviewDate).getTime() <= now
        );
    });

    const currentCardWithDirection = computed(() => {
        if (sessionCards.value.length === 0 || currentCardIndex.value >= sessionCards.value.length) return null;
        
        const card = sessionCards.value[currentCardIndex.value];
        return card ? { ...card, isFrontToBack: isFrontToBack.value } : null;
    });

    const statistics = computed(() => ({
        totalCards: cards.value.length,
        dueToday: initialDueCards.value.length, 
        totalInSession: initialSessionSize.value, 
        completedInSession: completedCount.value, 
    }));
    
    // === 3. ACTIONS (ДЕЙСТВИЯ) ===

    const saveCards = async () => {
        if (!storageFailed.value) {
             try {
                await persistCards(cards.value);
            } catch (e) {
                console.error('Ошибка сохранения карточек:', e);
                storageFailed.value = true;
            }
        }
    };

    const loadCards = async () => { 
        isLoading.value = true;
        
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Storage timeout: Data read operation blocked."))
        , 3000));

        try {
            const storedCards = await Promise.race([
                getCards(),
                timeoutPromise
            ]);
            
            if (storedCards && storedCards.length) {
                cards.value = storedCards;
            } else {
                cards.value = getDefaultCards();
                await saveCards();
            }

        } catch (error) {
            console.error('Ошибка или таймаут загрузки хранилища. Загружаем дефолтный набор:', error);
            cards.value = getDefaultCards();
            storageFailed.value = true;
            
        } finally {
            isLoading.value = false;
            
            const nowTime = new Date().getTime();
            const reviewHorizon = new Date();
            reviewHorizon.setDate(reviewHorizon.getDate() + REVIEW_HORIZON_DAYS); 
            const reviewHorizonTime = reviewHorizon.getTime();
            
            // =================================================================
            // 💡 ЛОГИКА СБОРА СЕССИИ С ПРИОРИТЕТОМ И ПЕРЕМЕШИВАНИЕМ
            // =================================================================
            
            // 1. Сбор НОВЫХ карточек
            let newCards = cards.value.filter(card => card.repetitionCount === 0);
            newCards = shuffleArray(newCards); 
            const limitedNewCards = newCards.slice(0, NEW_CARDS_LIMIT);
            
            // Расчет дефицита новых карточек для заполнения лимита повторений
            const newCardShortfall = NEW_CARDS_LIMIT - limitedNewCards.length;
            
            // 2. Сбор КАРТОЧЕК ДЛЯ ПОВТОРЕНИЯ (Review)
            
            // Карточки, срок которых наступил СЕГОДНЯ (или ранее)
            let dueReviewCards = cards.value.filter(card => 
                card.repetitionCount > 0 && new Date(card.nextReviewDate).getTime() <= nowTime
            );
            
            // Карточки, запланированные на БУДУЩЕЕ, но находящиеся в горизонте
            let horizonReviewCards = cards.value.filter(card => 
                card.repetitionCount > 0 && 
                new Date(card.nextReviewDate).getTime() > nowTime &&
                new Date(card.nextReviewDate).getTime() <= reviewHorizonTime
            );

            // 💡 Перемешиваем обе группы, чтобы обеспечить случайность внутри приоритета
            dueReviewCards = shuffleArray(dueReviewCards); 
            horizonReviewCards = shuffleArray(horizonReviewCards);

            // Объединяем просроченные и будущие
            const allReviewCards = [...dueReviewCards, ...horizonReviewCards];
            
            // Сортировка: проваленные (interval=0) -> просроченные -> ранние в горизонте
            allReviewCards.sort((a, b) => {
                // Приоритет 1: Проваленные (interval=0) всегда идут первыми
                if (a.interval === 0 && b.interval !== 0) return -1;
                if (a.interval !== 0 && b.interval === 0) return 1;
                
                // Приоритет 2: Сортировка по дате (ранние даты - раньше)
                const dateA = new Date(a.nextReviewDate).getTime();
                const dateB = new Date(b.nextReviewDate).getTime();
                return dateA - dateB;
            });
            
            // 3. Расчет динамического лимита и применение
            // Если новых карточек меньше 20, увеличиваем лимит повторений
            const finalReviewLimit = REVIEW_CARDS_LIMIT + newCardShortfall; 
            
            // Применяем лимит к отсортированному списку повторений
            const limitedReviewCards = allReviewCards.slice(0, finalReviewLimit);
            
            // 4. Финализация сессии
            const cardsForSession = [...limitedNewCards, ...limitedReviewCards];
            
            // 💡 ФИНАЛЬНОЕ ПЕРЕМЕШИВАНИЕ: Смешиваем Новые и Повторяемые для случайного порядка
            sessionCards.value = shuffleArray(cardsForSession);
            
            // =================================================================
            
            initialSessionSize.value = sessionCards.value.length;
            completedCount.value = 0;
            
            currentCardIndex.value = 0;
            isFrontToBack.value = Math.random() > 0.5;
            isInitialized.value = true;
        }
    };
    
    // === ЛОГИКА СЕССИИ, CRUD ===
    
    const processReview = (card, quality) => {
        const { nextReviewDate, easeFactor, interval, repetitionCount } = calculateSRS(card, quality);
        
        const sessionIndex = currentCardIndex.value;
        
        const globalIndex = cards.value.findIndex(c => c.id === card.id);
        if (globalIndex !== -1) {
            cards.value[globalIndex] = {
                ...cards.value[globalIndex],
                repetitionCount: repetitionCount,
                easeFactor: easeFactor,
                interval: interval,
                nextReviewDate: nextReviewDate.toISOString(),
            };
        }

        saveCards();
        
        if (quality < 3) {
            // Если провалено, перемещаем в конец сессии
            const failedCard = sessionCards.value.splice(sessionIndex, 1)[0];
            sessionCards.value.push(failedCard);
            
        } else {
            // Если успешно, удаляем из сессии
            sessionCards.value.splice(sessionIndex, 1);
            
            completedCount.value++; 
        }

        if (sessionCards.value.length === 0) {
            currentCardIndex.value = 0;
            initialSessionSize.value = 0; 
        } else if (currentCardIndex.value >= sessionCards.value.length) {
            currentCardIndex.value = 0; 
        }
    
        if (sessionCards.value.length > 0) {
            isFrontToBack.value = Math.random() > 0.5;
        }
    };
    
    const addCard = async (newCardData) => {
        const normalizedWord = newCardData.word.trim().toLowerCase();
        const exists = cards.value.some(card => 
            card.word.toLowerCase() === normalizedWord
        );

        if (exists) {
            return false; 
        }

        const cardWithDefaults = {
            ...newCardData,
            id: generateUniqueId(),
            ...getInitialSRS()
        };

        cards.value.push(cardWithDefaults);
        await saveCards();
        return true; 
    };
    
    const deleteCard = async (cardId) => {
        const initialLength = cards.value.length;
    
        cards.value = cards.value.filter(card => card.id !== cardId);
    
        if (cards.value.length < initialLength) {
            await saveCards();
            
            sessionCards.value = sessionCards.value.filter(card => card.id !== cardId);
            
            if (currentCardIndex.value >= sessionCards.value.length) {
                currentCardIndex.value = 0; 
            }
            initialSessionSize.value = sessionCards.value.length;

            return true;
        }
        return false;
    };
    
    const updateCard = async (updatedCard) => {
        const index = cards.value.findIndex(c => c.id === updatedCard.id);
        if (index !== -1) {
            
            const oldCard = cards.value[index];
            
            cards.value[index] = {
                ...updatedCard, 
                // Сохраняем SRS параметры
                repetitionCount: oldCard.repetitionCount,
                easeFactor: oldCard.easeFactor,
                interval: oldCard.interval,
                nextReviewDate: oldCard.nextReviewDate,
            };

            const sessionIndex = sessionCards.value.findIndex(c => c.id === updatedCard.id);
            if (sessionIndex !== -1) {
                const cardInSession = sessionCards.value[sessionIndex];
                cardInSession.word = updatedCard.word;
                cardInSession.translation = updatedCard.translation;
                cardInSession.meanings = updatedCard.meanings;
            }

            await saveCards();
            return true;
        }
        return false;
    };
    
    // === ВОЗВРАТ ПЕРЕМЕННЫХ И МЕТОДОВ ===
    return {
        cards,
        isLoading,
        isInitialized,
        storageFailed,
        dueCards: initialDueCards, 
        currentCardWithDirection,
        statistics,

        loadCards,
        saveCards,
        processReview,
        addCard,
        deleteCard,
        updateCard,
        
    };
});

