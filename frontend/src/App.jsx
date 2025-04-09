import React from "react";
import GenerationGrid from "./features/generation/GenerationGrid";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProjectsPage from "./pages/ProjectsPage";
import Layout from "./components/layout/Layout";
import { CollectionProvider, useCollections } from "./context/CollectionContext";
import "./styles/App.css";

const AppContent = () => {
  const { isConnected, lastMessage } = useCollections();

  return (
    <Layout isConnected={isConnected}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <h1>Сравнение и выбор обложек</h1>
              {/* Условное отображение отладочного блока */}
              {import.meta.env.VITE_SHOW_DEBUG === 'true' && lastMessage && (
                <div style={{ margin: "10px", padding: "10px", border: "1px solid grey", fontSize: "0.8em" }}>
                  <strong>Last WS Update:</strong>
                  <pre style={{ maxHeight: "100px", overflowY: "auto" }}>{JSON.stringify(lastMessage, null, 2)}</pre>
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
