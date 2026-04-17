export function createSessionId(): string {
  // Достаточно уникально для сессии: time + random
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
