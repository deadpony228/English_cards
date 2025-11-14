import { Storage } from '@ionic/storage';

const storage = new Storage();
const CARDS_KEY = 'flashcards';

export async function initStorage() {
    await storage.create();
    console.log("Storage Service Initialized."); // Добавим для проверки
}

export async function getCards() {
  const cards = await storage.get(CARDS_KEY);
  return cards || [];
}

export async function saveCards(cards) {
  await storage.set(CARDS_KEY, cards);
}
