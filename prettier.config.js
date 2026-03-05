/** @type {import('prettier').Config & import('prettier-package-json') & import ('@trivago/prettier-plugin-sort-imports')*/
export default {
  // Configuration for prettier
  plugins: [
    "prettier-package-json",
    "@trivago/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  semi: false,

  // Configuration for @trivago/prettier-plugin-sort-import
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}
