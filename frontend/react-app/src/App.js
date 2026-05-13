import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import WorkflowBuilder from './WorkflowBuilder';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import ToolsPage from './pages/ToolsPage';
import TeamOfAgentsPage from './pages/TeamOfAgentsPage';
import OrchestratorPage from './pages/OrchestratorPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workflow" element={<WorkflowBuilder />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:agentId" element={<ChatPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/team-of-agents" element={<TeamOfAgentsPage />} />
        <Route path="/orchestrators" element={<OrchestratorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
