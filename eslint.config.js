// @ts-check
/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["**/drizzle/*"],
        },
      ],
    },
  },
];
