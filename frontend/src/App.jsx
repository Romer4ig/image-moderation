import React from "react";
import GenerationGrid from "./features/generation/GenerationGrid";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProjectsPage from "./pages/ProjectsPage";
import Layout from "./components/layout/Layout";
import { CollectionProvider } from "./context/CollectionContext";
import { useWebSocketContext } from "./context/WebSocketContext";
import "./styles/App.css";

const AppContent = () => {
  const { isConnected, lastMessage } = useWebSocketContext();

  return (
    <Layout isConnected={isConnected}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <h1>Сравнение и выбор обложек</h1>
              {import.meta.env.VITE_SHOW_DEBUG === "true" && lastMessage && (
                <div
                  style={{
                    margin: "10px",
                    padding: "10px",
                    border: "1px solid grey",
                    fontSize: "0.8em",
                  }}
                >
                  <strong>Last WS Update (Context):</strong>
                  <pre style={{ maxHeight: "100px", overflowY: "auto" }}>
                    {JSON.stringify(lastMessage, null, 2)}
                  </pre>
                </div>
              )}
              <GenerationGrid />
            </>
          }
        />
        <Route path="/projects" element={<ProjectsPage />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <CollectionProvider>
        <AppContent />
      </CollectionProvider>
    </Router>
  );
}

export default App;
