import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      ".claude/**",
      "public/assets/**",
    ],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts", "*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        AudioContext: "readonly",
        console: "readonly",
        window: "readonly",
        document: "readonly",
        HTMLButtonElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        OscillatorType: "readonly",
        PointerEvent: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        URLSearchParams: "readonly",
        location: "readonly",
        performance: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
];
