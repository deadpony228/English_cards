export function initStorage(): Promise<void>;
export function getCards(): Promise<any[]>;
export function saveCards(cards: any[]): Promise<void>;
export function clearStorage(): Promise<void>;
