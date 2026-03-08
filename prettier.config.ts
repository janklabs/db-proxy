import type { Config } from "prettier"

export default {
  plugins: [
    "prettier-package-json",
    "@trivago/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  semi: false,

  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
} satisfies Config
