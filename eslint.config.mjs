import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  // Layer-boundary enforcement (Phase B Task 5).
  // Layers organizes src/ as: types, data, lib, components, app.
  // Dependency direction must be: types → data → lib → components → app.
  // A leaf layer must not import from a layer above it.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { import: importPlugin },
    rules: {
      "import/no-restricted-paths": [
        "warn",
        {
          zones: [
            {
              target: "./src/types",
              from: ["./src/data", "./src/lib", "./src/components", "./src/app"],
              message:
                "types/ is the base layer; do not import from data/lib/components/app",
            },
            {
              target: "./src/data",
              from: ["./src/lib", "./src/components", "./src/app"],
              message: "data/ may only import from types/",
            },
            {
              target: "./src/lib",
              from: ["./src/components", "./src/app"],
              message:
                "lib/ may only import from types/ and data/; pass UI/route deps via parameters",
            },
            {
              target: "./src/components",
              from: ["./src/app"],
              message:
                "components/ must not import from app/ (routes); compose components from lib + types",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      ".claude/**",
      ".ai-dev-kit/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      "nango-integrations/**",
      "next-env.d.ts",
      "docs/ai-sdk/**",
      "docs/ai-elements/**",
      "docs/ai-gateway/**",
      "supabase/.branches/**",
      "**/*.d.ts",
    ],
  },
];
