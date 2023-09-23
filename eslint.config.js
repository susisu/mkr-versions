import { config, map } from "@susisu/eslint-config";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
  ...map(
    {
      files: ["scripts/**/*.ts"],
    },
    [
      config.tsTypeChecked,
      prettierConfig,
      {
        languageOptions: {
          sourceType: "module",
          parserOptions: {
            project: "./tsconfig.json",
          },
          globals: {
            ...globals.es2021,
            ...globals.node,
          },
        },
        rules: {
          "@typescript-eslint/naming-convention": "off",
        },
      },
    ]
  ),
  ...map(
    {
      files: ["*.js"],
    },
    [
      config.js,
      prettierConfig,
      {
        languageOptions: {
          sourceType: "module",
          globals: {
            ...globals.es2021,
            ...globals.node,
          },
        },
      },
    ]
  ),
];
