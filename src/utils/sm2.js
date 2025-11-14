/**
 * Рассчитывает новый интервал и фактор легкости по алгоритму SuperMemo-2.
 * @param {object} card - Объект карточки.
 * @param {number} q - Оценка качества ответа (0-5).
 * @returns {object} Обновленный объект карточки.
 */
export function calculateSM2(card, q) {
  let { repetitionCount, easeFactor, interval } = card;

  // 1. Обновление Ease Factor (EF)
  let newEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const MIN_EASE_FACTOR = 1.3;
  if (newEaseFactor < MIN_EASE_FACTOR) {
    newEaseFactor = MIN_EASE_FACTOR;
  }

  // 2. Расчет нового Интервала (I)
  let newInterval;
  let newRepetitionCount;

  if (q >= 3) {
    // Успешное повторение (Легко, Нормально)
    newRepetitionCount = repetitionCount + 1;

    if (newRepetitionCount === 1) {
      newInterval = 1;
    } else if (newRepetitionCount === 2) {
      newInterval = 6;
    } else {
      // I(n) = I(n-1) * EF
      newInterval = Math.round(interval * newEaseFactor);
    }
  } else {
    // Неуспешное повторение (Сложно, Ошибка)
    newRepetitionCount = 0;
    newInterval = 0;
  }

  // 3. Расчет даты следующего повторения
  const nextReviewDate = new Date();
  if (newInterval > 0) {
        nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  }
  
  // 4. Возвращаем обновленную карточку
  return {
    ...card,
    repetitionCount: newRepetitionCount,
    easeFactor: newEaseFactor,
    interval: newInterval,
    nextReviewDate: nextReviewDate.toISOString(),
  };
}
