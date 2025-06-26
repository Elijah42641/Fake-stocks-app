import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    resolve: {
      alias: {
        fs: require.resolve("rollup-pligin-node-builtins"),
        // http: require.resolve('rollup-plugin-node-builtins'),
        // util: require.resolve('rollup-plugin-node-builtins'),
        // stream: require.resolve('rollup-plugin-node-builtins'),
        // buffer: require.resolve('rollup-plugin-node-builtins'),
        // process: require.resolve('rollup-plugin-node-builtins'),
        // url: require.resolve('rollup-plugin-node-builtins'),
        // querystring: require.resolve('rollup-plugin-node-builtins'),
      },
    },
    optimizeDeps: {
      exclude: ["ws"], // Tell Vite to ignore `ws`
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
      "/sessions": {
        target: "http://localhost:4000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "../dist", // puts build output outside the frontend folder
    emptyOutDir: true,
    rollupOptions: {
      input: {},
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
