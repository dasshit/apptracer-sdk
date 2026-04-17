import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts", "src/integrations/react-native-logs.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2019",
  external: ["react", "react-native", "react-native-logs"],
  define: {
    __APPTRACER_SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
