"use strict";

module.exports = {
  overrides: [
    {
      files: ["*.ts"],
      extends: [
        "@susisu/eslint-config/preset/ts",
        "prettier",
        "plugin:eslint-comments/recommended",
      ],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      env: {
        es6: true,
        node: true,
      },
      globals: {
        NodeJS: true,
      },
      rules: {
        "@typescript-eslint/naming-convention": "off",
        "eslint-comments/no-unused-disable": "error",
      },
    },
    {
      files: ["*.js"],
      extends: [
        "@susisu/eslint-config/preset/js",
        "prettier",
        "plugin:eslint-comments/recommended",
      ],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "script",
      },
      env: {
        es6: true,
        node: true,
      },
      rules: {
        "eslint-comments/no-unused-disable": "error",
      },
    },
  ],
};
