import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebSocketProvider } from "./context/WebSocketContext";

// Создаем клиент
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Оборачиваем QueryClientProvider в WebSocketProvider */}
    <WebSocketProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WebSocketProvider>
  </React.StrictMode>
);
