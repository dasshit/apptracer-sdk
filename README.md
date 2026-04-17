# AppTracer SDK for React Native / Expo

[![npm version](https://img.shields.io/npm/v/@ddastter/apptracer-sdk.svg)](https://www.npmjs.com/package/@ddastter/apptracer-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SDK для отслеживания ошибок и крашей в React Native и Expo приложениях. Автоматически перехватывает JavaScript ошибки, unhandled promise rejections и собирает логи (breadcrumbs) для диагностики проблем.

## Возможности

- ✅ Автоматический перехват глобальных ошибок и крашей
- ✅ Перехват unhandled promise rejections
- ✅ Сбор логов (breadcrumbs) перед ошибкой
- ✅ Персистентное хранение отчётов при ошибках сети
- ✅ Ручной захват ошибок из try/catch блоков
- ✅ Интеграция с react-native-logs
- ✅ TypeScript из коробки
- ✅ Минимальный размер бандла

## Установка

### npm

```bash
npm install @ddastter/apptracer-sdk
```

### pnpm

```bash
pnpm add @ddastter/apptracer-sdk
```

### Yarn

```bash
yarn add @ddastter/apptracer-sdk
```

### Expo

Для Expo проектов установите дополнительные зависимости:

```bash
npx expo install @ddastter/apptracer-sdk @react-native-async-storage/async-storage
```

## Быстрый старт

### 1. Инициализация

Инициализируйте SDK как можно раньше в точке входа приложения:

```typescript
// App.tsx или index.js
import AppTracer from "@ddastter/apptracer-sdk";

AppTracer.init({
  appToken: "YOUR_APP_TOKEN",      // Получите в dashboard AppTracer
  deviceId: "DEVICE_ID",           // Уникальный ID устройства
  versionCode: 1,                  // Числовой код версии
  versionName: "1.0.0",            // Строковая версия
});
```

### 2. Проверка работы

```typescript
// Тестовая ошибка для проверки
throw new Error("Test error from AppTracer SDK");
```

После запуска проверьте dashboard AppTracer - ошибка должна появиться в списке.

## Инициализация

### Полный пример

```typescript
import AppTracer from "@ddastter/apptracer-sdk";
import { getDeviceId } from "react-native-device-info";

// Инициализация при старте приложения
AppTracer.init({
  // Обязательные параметры
  appToken: "YOUR_APP_TOKEN",
  deviceId: await getDeviceId(),
  versionCode: 1,
  versionName: "1.0.0",
  
  // Опциональные параметры
  maxLogs: 200,                    // Макс. количество логов (по умолчанию 100)
  maxLogBytes: 128 * 1024,         // Макс. размер файла логов (по умолчанию 64KB)
  persistNonFatal: true,           // Сохранять non-fatal ошибки (по умолчанию false)
  httpLogLevel: "error",           // Уровень логирования HTTP (none|error|info|debug)
});
```

### Параметры инициализации

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|--------------|--------------|----------|
| `appToken` | string | ✅ | - | Токен приложения из dashboard |
| `deviceId` | string | ✅ | - | Уникальный ID устройства |
| `versionCode` | number | ✅ | - | Числовой код версии |
| `versionName` | string | ✅ | - | Строковая версия (например, "1.0.0") |
| `maxLogs` | number | ❌ | 100 | Максимальное количество логов в буфере |
| `maxLogBytes` | number | ❌ | 65536 | Максимальный размер файла логов (байты) |
| `maxLineBytes` | number | ❌ | 2048 | Максимальный размер одной строки лога |
| `persistNonFatal` | boolean | ❌ | false | Сохранять non-fatal ошибки при сбое сети |
| `persistMaxItems` | number | ❌ | 50 | Макс. количество pending отчётов |
| `httpLogLevel` | string | ❌ | "error" | Уровень логирования HTTP |
| `endpointBaseUrl` | string | ❌ | https://sdk-api.apptracer.ru | URL сервера |

## Ручной захват ошибок

### Использование captureException

Для ошибок, перехваченных в try/catch блоках:

```typescript
import AppTracer from "@ddastter/apptracer-sdk";

try {
  await riskyOperation();
} catch (error) {
  // Отправить ошибку в AppTracer
  AppTracer.captureException(error);
  
  // Можно пометить как фатальную
  // AppTracer.captureException(error, true);
  
  // Обработка ошибки
  console.error("Operation failed:", error);
}
```

### Примеры использования

```typescript
// Обработка ошибок API
async function fetchUserData(userId: string) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    AppTracer.captureException(error);
    throw error;
  }
}

// Обработка ошибок бизнес-логики
function processPayment(amount: number) {
  if (amount <= 0) {
    const error = new Error("Invalid payment amount");
    AppTracer.captureException(error);
    throw error;
  }
  // ...
}
```

## Логирование (Breadcrumbs)

### Добавление логов

Добавляйте логи для отслеживания действий пользователя перед ошибкой:

```typescript
import AppTracer from "@ddastter/apptracer-sdk";

// Логирование пользовательских действий
AppTracer.addLog({
  level: { severity: 1, text: "INFO" },
  timestamp: Date.now(),
  msg: "User tapped 'Submit' button",
});

// Логирование навигации
AppTracer.addLog({
  level: { severity: 2, text: "DEBUG" },
  timestamp: Date.now(),
  msg: "Navigated to /profile screen",
});
```

### Уровни логирования

| Severity | Text | Описание |
|----------|------|----------|
| 0 | ERROR | Критические ошибки |
| 1 | WARN | Предупреждения |
| 2 | INFO | Информационные сообщения |
| 3 | DEBUG | Отладочная информация |

### Интеграция с react-native-logs

Для автоматического сбора логов из react-native-logs:

```typescript
import { logger } from "react-native-logs";
import { createAppTracerTransport } from "@ddastter/apptracer-sdk/react-native-logs";
import AppTracer from "@ddastter/apptracer-sdk";

// Инициализация AppTracer
AppTracer.init({
  appToken: "YOUR_TOKEN",
  deviceId: "device-id",
  versionCode: 1,
  versionName: "1.0.0",
});

// Создание логгера с транспортом AppTracer
const log = logger.createLogger({
  transport: createAppTracerTransport(AppTracer),
});

// Теперь все логи автоматически попадают в AppTracer
log.info("User logged in");
log.warn("API response slow");
log.error("Failed to load data", new Error("Network timeout"));
```

## API Reference

### AppTracer.init(options)

Инициализирует SDK. Должен быть вызван один раз при старте приложения.

```typescript
AppTracer.init({
  appToken: string,
  deviceId: string,
  versionCode: number,
  versionName: string,
  // ... опциональные параметры
});
```

### AppTracer.captureException(error, isFatal?)

Ручная отправка ошибки.

```typescript
AppTracer.captureException(error: unknown, isFatal?: boolean): void;
```

| Параметр | Тип | Описание |
|----------|-----|----------|
| error | unknown | Ошибка для отправки |
| isFatal | boolean | Пометить как фатальную (по умолчанию false) |

### AppTracer.addLog(row)

Добавить лог (breadcrumb) в буфер.

```typescript
AppTracer.addLog({
  level: { severity: number; text: string };
  timestamp: number;
  msg: string;
}): void;
```

### AppTracer.drainPending()

Отправить накопленные отчёты из хранилища.

```typescript
await AppTracer.drainPending();
```

### AppTracer.shutdown()

Отключить SDK и удалить обработчики ошибок.

```typescript
AppTracer.shutdown();
```

## Best Practices

### 1. Инициализация

```typescript
// ✅ Хорошо - ранняя инициализация
// index.js или App.tsx
import AppTracer from "@ddastter/apptracer-sdk";

AppTracer.init({ ... });

// Ваше приложение
function App() { ... }
```

### 2. Идентификатор устройства

```typescript
// ✅ Хорошо - используйте стабильный ID
import { getUniqueId } from "react-native-device-info";

AppTracer.init({
  deviceId: await getUniqueId(),
  // ...
});

// ❌ Плохо - случайный ID при каждом запуске
AppTracer.init({
  deviceId: Math.random().toString(),
  // ...
});
```

### 3. Логирование ключевых событий

```typescript
// ✅ Хорошо - логируйте важные действия
function checkout() {
  AppTracer.addLog({
    level: { severity: 2, text: "INFO" },
    timestamp: Date.now(),
    msg: "User started checkout",
  });
  
  // ...
}

// ❌ Плохо - слишком много логов
function onPress() {
  AppTracer.addLog({ ... msg: "Button pressed" }); // Слишком детально
}
```

### 4. Обработка ошибок API

```typescript
// ✅ Хорошо - контекст ошибки
async function fetchUser(id: string) {
  try {
    const response = await fetch(`/api/users/${id}`);
    return await response.json();
  } catch (error) {
    AppTracer.addLog({
      level: { severity: 1, text: "WARN" },
      timestamp: Date.now(),
      msg: `Failed to fetch user ${id}`,
    });
    AppTracer.captureException(error);
    throw error;
  }
}
```

## Troubleshooting

### Ошибки не появляются в dashboard

1. Проверьте правильность `appToken`
2. Убедитесь, что SDK инициализирован до возникновения ошибки
3. Проверьте сетевое подключение
4. Включите debug логирование:

```typescript
AppTracer.init({
  // ...
  httpLogLevel: "debug",
});
```

### Ошибки AsyncStorage

Если видите ошибки AsyncStorage, убедитесь, что пакет установлен:

```bash
# React Native CLI
npm install @react-native-async-storage/async-storage

# Expo
npx expo install @react-native-async-storage/async-storage
```

### TypeScript ошибки

Убедитесь, что `react` и `react-native` установлены как peer dependencies:

```bash
npm install react react-native
```

## Лицензия

MIT © [AppTracer](https://github.com/dasshit/apptracer-sdk)