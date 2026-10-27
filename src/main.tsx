import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { iniciarCapturaGlobalDeErros } from "@/lib/errorLog";
import "./styles.css";

iniciarCapturaGlobalDeErros();

const router = getRouter();
const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Elemento #app nao encontrado no index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
