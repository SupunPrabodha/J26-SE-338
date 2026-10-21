import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["**/.next/**", "**/next-env.d.ts", "**/contracts.d.ts", ".venv/**", ".local/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ["**/*.tsx"], plugins: { "react-hooks": hooks }, rules: hooks.configs.recommended.rules },
  { files: ["**/*.mjs"], languageOptions: { globals: { process: "readonly", URL: "readonly" } } },
  { rules: { "no-console": "error" } },
];
