
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { getCards, saveCards as persistCards } from '@/services/storageService'; 
import { getDefaultCards } from '@/data/defaultCards'; 

// === КОНСТАНТЫ С ЛИМИТАМИ ===
const NEW_CARDS_LIMIT = 20; 
const REVIEW_CARDS_LIMIT = 30; 

const SHORT_INTERVAL_MINUTES = 10; 
const REVIEW_HORIZON_DAYS = 7; 

// === РУЧНОЕ ХРАНИЛИЩЕ СЕССИИ (LocalStorage) ===
const SESSION_STORAGE_KEY = 'flashcards_active_session_state'; 
const SESSION_LAST_COMPLETED_TIME_KEY = 'flashcards_session_completed_time'; 
// 🚨 NEW_SESSION_DELAY_HOURS УДАЛЕНА - теперь используем логику даты.


// === УТИЛИТЫ (без изменений) ===
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

    const statistics = computed(() => {
        let completedInSession;

        if (initialSessionSize.value > 0) {
            completedInSession = Math.max(0, initialSessionSize.value - sessionCards.value.length);
        } else {
            completedInSession = 0; 
        }

        return {
            totalCards: cards.value.length,
            dueToday: initialDueCards.value.length, 
            totalInSession: initialSessionSize.value, 
            completedInSession: completedInSession, 
        };
    });
    
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
    
    // === РУЧНОЕ СОХРАНЕНИЕ / ЗАГРУЗКА СЕССИИ (СИНХРОННО!) ===
    
    const saveSessionState = () => {
        try {
            const stateToSave = {
                cards: sessionCards.value,
                size: initialSessionSize.value,
                index: currentCardIndex.value, 
                direction: isFrontToBack.value,
            };
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stateToSave));
            // Если сессия активна, чистим ключ завершения
            localStorage.removeItem(SESSION_LAST_COMPLETED_TIME_KEY); 
        } catch (e) {
            console.error('Ошибка ручного сохранения сессии:', e); 
        }
    };

    const loadSessionState = () => {
        try {
            const storedState = localStorage.getItem(SESSION_STORAGE_KEY);
            if (storedState) {
                const state = JSON.parse(storedState);
                
                // СИНХРОННОЕ ВОССТАНОВЛЕНИЕ
                sessionCards.value = state.cards || [];
                initialSessionSize.value = state.size || 0;
                currentCardIndex.value = state.index || 0;
                isFrontToBack.value = state.direction === undefined ? true : state.direction;
                
                return sessionCards.value.length > 0 && initialSessionSize.value > 0;
            }
        } catch (e) {
            console.error('Ошибка ручной загрузки сессии:', e);
        }
        return false;
    };
    
    // 🚨 ИЗМЕНЕННАЯ ЛОГИКА: Временной гвард (До следующего календарного дня)
    const shouldAssembleNewSession = () => {
        const completedTimeStr = localStorage.getItem(SESSION_LAST_COMPLETED_TIME_KEY);
        if (!completedTimeStr) return true; // Если ключ отсутствует, значит, сессию можно собирать

        const completedDate = new Date(completedTimeStr);
        const today = new Date();

        // Устанавливаем время на 00:00:00 для сравнения только даты
        const completedDay = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate()).getTime();
        const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        
        // Если дата завершения совпадает с сегодняшней датой, блокируем сборку.
        if (completedDay === currentDay) {
            return false; 
        }
        
        // Если дата завершения была вчера или раньше, разрешаем сборку и чистим ключ
        localStorage.removeItem(SESSION_LAST_COMPLETED_TIME_KEY); 
        return true; 
    }
    
    // ===========================================

    const loadCards = async () => { 
        isLoading.value = true;
        
        // ШАГ 1: Загрузка словаря (АСИНХРОННО)
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
            
            // ШАГ 2: Проверка сессии (СИНХРОННО)
            const sessionRestored = loadSessionState(); 

            // ШАГ 3: Сборка новой сессии, если:
            // 1. Словарь не пуст
            // 2. Сессия не была восстановлена
            // 3. ГВАРД ПРОПУСКАЕТ: дата завершения была вчера или раньше
            if (cards.value.length > 0 && !sessionRestored && shouldAssembleNewSession()) {
                
                const nowTime = new Date().getTime();
                const reviewHorizon = new Date();
                reviewHorizon.setDate(reviewHorizon.getDate() + REVIEW_HORIZON_DAYS); 
                const reviewHorizonTime = reviewHorizon.getTime();
                
                // === ЛОГИКА СБОРА НОВОЙ СЕССИИ (без изменений) ===
                
                let newCards = cards.value.filter(card => card.repetitionCount === 0);
                newCards = shuffleArray(newCards); 
                const limitedNewCards = newCards.slice(0, NEW_CARDS_LIMIT);
                
                const newCardShortfall = NEW_CARDS_LIMIT - limitedNewCards.length;
                
                let dueReviewCards = cards.value.filter(card => 
                    card.repetitionCount > 0 && new Date(card.nextReviewDate).getTime() <= nowTime
                );
                
                let horizonReviewCards = cards.value.filter(card => 
                    card.repetitionCount > 0 && 
                    new Date(card.nextReviewDate).getTime() > nowTime &&
                    new Date(card.nextReviewDate).getTime() <= reviewHorizonTime
                );

                dueReviewCards = shuffleArray(dueReviewCards); 
                horizonReviewCards = shuffleArray(horizonReviewCards);

                const allReviewCards = [...dueReviewCards, ...horizonReviewCards];
                
                allReviewCards.sort((a, b) => {
                    if (a.interval === 0 && b.interval !== 0) return -1;
                    if (a.interval !== 0 && b.interval === 0) return 1;
                    
                    const dateA = new Date(a.nextReviewDate).getTime();
                    const dateB = new Date(b.nextReviewDate).getTime();
                    return dateA - dateB;
                });
                
                const finalReviewLimit = REVIEW_CARDS_LIMIT + newCardShortfall; 
                const limitedReviewCards = allReviewCards.slice(0, finalReviewLimit);
                
                const cardsForSession = [...limitedNewCards, ...limitedReviewCards];
                
                sessionCards.value = shuffleArray(cardsForSession);
                
                initialSessionSize.value = sessionCards.value.length;
                currentCardIndex.value = 0;
                isFrontToBack.value = Math.random() > 0.5;
                
                saveSessionState(); // Сохраняем НОВУЮ сессию
            }
            
            isLoading.value = false;
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
            const failedCard = sessionCards.value.splice(sessionIndex, 1)[0];
            sessionCards.value.push(failedCard);
            
        } else {
            sessionCards.value.splice(sessionIndex, 1);
        }

        if (sessionCards.value.length === 0) {
            // Сессия завершена. Чистим ключ сессии и устанавливаем время завершения.
            localStorage.removeItem(SESSION_STORAGE_KEY); 
            // 🚨 Устанавливаем время завершения, чтобы гвард его проверил
            localStorage.setItem(SESSION_LAST_COMPLETED_TIME_KEY, new Date().toISOString()); 
            currentCardIndex.value = 0;
            initialSessionSize.value = 0; 
        } else {
            // Сессия активна. Обновляем и сохраняем.
            if (currentCardIndex.value >= sessionCards.value.length) {
                currentCardIndex.value = 0; 
            }
            isFrontToBack.value = Math.random() > 0.5;
            saveSessionState(); 
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
            
            if (initialSessionSize.value === 0) {
                 // Чистим оба ключа, если сессия стала пустой из-за удаления
                 localStorage.removeItem(SESSION_STORAGE_KEY);
                 localStorage.removeItem(SESSION_LAST_COMPLETED_TIME_KEY); // Чистим, чтобы не блокировать сборку
            } else {
                 saveSessionState();
            }

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
            if (sessionCards.value.length > 0) {
                 saveSessionState(); 
            }
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
