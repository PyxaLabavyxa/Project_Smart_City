import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: [
      "src/_pages/cameras/ui/camera-preview.tsx",
      "src/entities/issue/ui/issue-photos.tsx",
      "src/features/report-issue/ui/photo-picker.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([".next/**", "out/**", ".qa/**", "next-env.d.ts"]),
]);
