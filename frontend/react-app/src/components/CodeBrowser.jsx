import React, { useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import './CodeBrowser.css';

function CodeBrowser({ agentId }) {
  const [tree, setTree] = useState([]);
  const [root, setRoot] = useState('');
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [fileLanguage, setFileLanguage] = useState('plaintext');
  const [loadingFile, setLoadingFile] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  // Fetch directory tree on mount
  useEffect(() => {
    setError(null);
    fetch(`http://localhost:5000/runtime/agents/${agentId}/files/tree`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setTree(data.entries || []);
          setRoot(data.root || '');
        }
      })
      .catch((err) => setError(err.message));
  }, [agentId]);

  const handleFileClick = useCallback(async (filePath) => {
    setSelectedFile(filePath);
    setLoadingFile(true);
    setFileContent(null);
    try {
      const res = await fetch(
        `http://localhost:5000/runtime/agents/${agentId}/files/read?path=${encodeURIComponent(filePath)}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setFileContent(null);
      } else {
        setError(null);
        setFileContent(data.content);
        setFileLanguage(data.language || 'plaintext');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingFile(false);
    }
  }, [agentId]);

  const toggleDir = useCallback((dirPath) => {
    setCollapsed((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  }, []);

  // Build visible entries respecting collapsed directories
  const visibleEntries = [];
  const hiddenPrefixes = new Set();

  for (const entry of tree) {
    // Check if any parent directory is collapsed
    let hidden = false;
    for (const prefix of hiddenPrefixes) {
      if (entry.path.startsWith(prefix + '/')) {
        hidden = true;
        break;
      }
    }
    if (hidden) continue;

    visibleEntries.push(entry);

    if (entry.type === 'directory' && collapsed[entry.path]) {
      hiddenPrefixes.add(entry.path);
    }
  }

  return (
    <div className="cb-container">
      {/* Sidebar */}
      <div className="cb-sidebar">
        <div className="cb-sidebar-header" title={root}>
          {root ? root.split('/').pop() : 'Files'}
        </div>
        <div className="cb-tree">
          {error && !tree.length && (
            <div className="cb-error">{error}</div>
          )}
          {visibleEntries.map((entry) => {
            const depth = entry.path.split('/').length - 1;
            const isDir = entry.type === 'directory';
            const isOpen = isDir && !collapsed[entry.path];
            return (
              <button
                key={entry.path}
                className={`cb-tree-item${isDir ? ' directory' : ''}${entry.path === selectedFile ? ' active' : ''}`}
                style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
                onClick={() => isDir ? toggleDir(entry.path) : handleFileClick(entry.path)}
              >
                <span className="cb-tree-icon">
                  {isDir ? (isOpen ? '▾' : '▸') : ''}
                </span>
                <span className="cb-tree-name">{entry.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor */}
      <div className="cb-editor">
        {selectedFile && (
          <div className="cb-editor-header">{selectedFile}</div>
        )}
        {!selectedFile && !loadingFile && (
          <div className="cb-editor-empty">Select a file to view</div>
        )}
        {loadingFile && (
          <div className="cb-editor-loading">Loading...</div>
        )}
        {error && selectedFile && (
          <div className="cb-error">{error}</div>
        )}
        {fileContent !== null && !loadingFile && (
          <Editor
            height="100%"
            language={fileLanguage}
            value={fileContent}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 13,
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}

export default CodeBrowser;
