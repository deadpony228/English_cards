import { Storage } from '@ionic/storage';

const CARDS_KEY = 'flashcards_data'; // Ключ, под которым будем хранить массив карточек

// Функция инициализации
let storageInstance = null;
let isReady = false;

export async function initStorage() {
    if (!isReady) {
        console.log("STORAGE-LOG 1: Начинаем инициализацию.");
        const storage = new Storage();
        storageInstance = await storage.create();
    console.log("STORAGE-LOG 2: Инициализация завершена.");
        isReady = true;
        console.log("Storage initialized.");
    }
}
// ------------------------------------

/**
 * Получает все карточки из хранилища.
 * @returns {Promise<Array>} Массив объектов карточек.
 */
export async function getCards() {
  try {
    // 💡 БЕЗОПАСНАЯ ПРОВЕРКА: 
    console.log("STORAGE-LOG 3: Попытка получить данные.");
    if (!storageInstance) {
        // Это не должно произойти, если main.ts работает, но лучше проверить.
        console.error("Storage not initialized when calling getCards.");
        return []; 
    }
    
    // Используем инициализированный экземпляр
    const cards = await storageInstance.get(CARDS_KEY);
      console.log("STORAGE-LOG 4: Данные получены.");
    // 💡 Упрощено чтение: проверяем, что это не null, и возвращаем копию
    if (!cards) {
        return [];
    }
    
    // Делаем глубокую копию, чтобы избежать проблем с реактивностью Vue
    return JSON.parse(JSON.stringify(cards));
    
  } catch (e) {
    console.error('Error fetching cards from storage:', e);
    return [];
  }
}

/**
 * Сохраняет массив карточек в хранилище.
 * @param {Array} cards - Массив объектов карточек для сохранения.
 */
export async function saveCards(cards) {
  try {
    if (!storageInstance) {
        console.error("Storage not initialized when calling saveCards.");
        return; 
    }
    
    const plainCards = JSON.parse(JSON.stringify(cards)); // Получаем чистый объект

    await storageInstance.set(CARDS_KEY, plainCards); // Используем инициализированный экземпляр

  } catch (error) {
    console.error('Error saving cards to storage:', error);
  }
}
