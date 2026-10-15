import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Flat ESLint config for the Super Deep Seek repo (scripts + harness + Android tests). */
export default tseslint.config(
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
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // `catch (_) {}` is the deliberate "best effort" idiom in the engine.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Disable rules that conflict with Prettier formatting.
  prettier,
);
