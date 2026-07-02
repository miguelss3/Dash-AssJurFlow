import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	server: {
		proxy: {
			"/api/deleteUserAccount": {
				target: "https://us-central1-assjur-flow-12rm.cloudfunctions.net",
				changeOrigin: true,
				rewrite: () => "/deleteUserAccount",
			},
			"/api/criarUsuarioAdmin": {
				target: "https://us-central1-assjur-flow-12rm.cloudfunctions.net",
				changeOrigin: true,
				rewrite: () => "/criarUsuarioAdmin",
			},
			"/api/geminiChat": {
				target: "https://us-central1-assjur-flow-12rm.cloudfunctions.net",
				changeOrigin: true,
				rewrite: () => "/geminiChat",
			},
		},
	},
	plugins: [
		TanStackRouterVite({
			autoCodeSplitting: true,
		}),
		react(),
		tsconfigPaths(),
		tailwindcss(),
	],
	build: {
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/firebase")) {
						return "firebase-vendor";
					}
					if (id.includes("node_modules/recharts") || id.includes("node_modules/victory-vendor") || id.includes("node_modules/d3-")) {
						return "recharts-vendor";
					}
					if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
						return "react-vendor";
					}
				},
			},
		},
	},
});
