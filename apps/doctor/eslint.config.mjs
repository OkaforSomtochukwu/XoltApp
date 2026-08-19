import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat";
import rootConfig from "../../eslint.config.mjs";

export default defineConfig([
  ...rootConfig,
  ...expoConfig,
  {
    ignores: ["dist/*"],
  },
]);
