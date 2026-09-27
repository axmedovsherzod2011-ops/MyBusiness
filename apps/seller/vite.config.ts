import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Seller is served from the Worker root, so asset URLs must be absolute.
  // Relative "./assets/..." paths can resolve incorrectly after Worker routing
  // and produce a blank React shell with 404 asset requests.
  base: "/",
});
