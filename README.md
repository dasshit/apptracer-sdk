# Install

```bash
# npm
npm install @ddastter/apptracer-sdk

# pnpm
pnpm add @ddastter/apptracer-sdk
```

# Basic usage

```typescript
import AppTracer from "@ddastter/apptracer-sdk/sdk";

AppTracer.init({
  appToken: "APP_TOKEN",
  deviceId: "YOUR_DEVICE_ID",
  versionCode: "APP_VERSION",
  versionName: "APP_VERSION",
})
```