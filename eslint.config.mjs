import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

/** Flat ESLint config for the ArenaPilot repo (scripts, harness, CI tools and Android JS tests). */
export default [
  {
    ignores: [
      "node_modules/**",
      ".cache/**",
      // Generated or vendored: build outputs and the minified engine bundles.
      "dist-android/**",
      "android/**/build/**",
      "android/app/src/main/assets/**",
      "android/app/src/main/bds-assets/bds/content.js",
      "android/app/src/main/bds-assets/bds/injected.js",
      "android/app/src/main/bds-assets/bds/sandbox.js",
      "tools/harness/artifacts/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          // `catch (e) {}` is the engine's best-effort idiom; do not warn on it.
          caughtErrors: "none",
        },
      ],
      // `catch (_) {}` is the deliberate "best effort" idiom in the engine.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Disable rules that conflict with Prettier formatting.
  prettier,
];
