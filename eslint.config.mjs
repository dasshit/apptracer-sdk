import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        // чтобы eslint понимал типы и синтаксис TS
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // полезные базовые правила для библиотек
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // тесты и jest setup
  {
    files: ["**/__tests__/**/*.ts", "jest.setup.ts"],
    rules: {
      // в тестах часто удобно
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // dist не линтим
  {
    ignores: ["dist/**"],
  },
    prettier,
];
