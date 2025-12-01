/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */
/** WARNING: DON'T EDIT THIS FILE */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { apiPlugin } from "./vite-plugin-api";

function getPlugins() {
  const plugins = [react(), tsconfigPaths(), apiPlugin()];
  return plugins;
}

export default defineConfig({
  plugins: getPlugins(),
});
