import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/integrations/react-native-logs.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2019",
  external: ["react", "react-native", "react-native-logs"],
});
