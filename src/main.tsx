
  import { createRoot } from "react-dom/client";

  import { StrictMode, Suspense } from "react";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  
  createRoot(document.getElementById("root")!).render(
  <StrictMode>
  <Suspense fallback={null}>
  <App />
  </Suspense>
  </StrictMode>
  );
  