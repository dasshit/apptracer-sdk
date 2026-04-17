/**
 * Генерирует уникальный идентификатор сессии.
 *
 * Формат: `{timestamp}-{random}`
 * - timestamp в base36 (например, "lq3v8x7")
 * - случайная строка в base36 (8 символов)
 *
 * Обеспечивает достаточную уникальность для идентификации сессии
 * в рамках одного устройства и приложения.
 *
 * @returns Уникальный идентификатор сессии
 *
 * @example
 * ```typescript
 * const sessionId = createSessionId();
 * // Результат: "lq3v8x7-k4j2m9n3"
 * ```
 *
 * @example
 * ```typescript
 * // Использование в AppTracer
 * const sessionId = createSessionId();
 * console.log("Session started:", sessionId);
 * ```
 */
export function createSessionId(): string {
  // Достаточно уникально для сессии: time + random
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
