import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function SubAgentSessionView({ subAgentView, onBack }) {
  return (
    <div className="chat-area">
      <div className="subagent-view-header">
        <button className="chat-back-btn" onClick={onBack}>
          ← Back to orchestrator
        </button>
        <span className="chat-agent-name">{subAgentView.name}</span>
        <span className="sap-agent-tag sap-tag-stateful">Stateful</span>
      </div>
      <div className="chat-messages">
        {subAgentView.messages.length === 0 && (
          <div className="chat-empty"><p>No messages yet.</p></div>
        )}
        {subAgentView.messages.map((msg, idx) => {
          if (msg.role === 'user') {
            const text = typeof msg.content === 'string'
              ? msg.content
              : msg.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
            return (
              <div key={idx} className="chat-bubble-row user">
                <div className="chat-bubble user">{text}</div>
              </div>
            );
          }
          if (msg.role === 'assistant') {
            const thinkingBlocks = msg.content?.filter(b => b.type === 'thinking') || [];
            const textBlocks = msg.content?.filter(b => b.type === 'text') || [];
            const toolCalls = msg.content?.filter(b => b.type === 'tool_use') || [];
            return (
              <React.Fragment key={idx}>
                {thinkingBlocks.map((b, i) => (
                  <div key={`think-${idx}-${i}`} className="chat-bubble-row assistant">
                    <div className="chat-bubble-thinking">
                      <button className="thinking-header" onClick={(e) => {
                        const body = e.currentTarget.nextSibling;
                        if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
                      }}>
                        <span className="thinking-icon">🧠</span>
                        <span className="thinking-label">Thinking</span>
                        <span className="thinking-toggle">▼</span>
                      </button>
                      <div className="thinking-body" style={{ display: 'none' }}>
                        <pre className="thinking-text">{b.thinking}</pre>
                      </div>
                    </div>
                  </div>
                ))}
                {toolCalls.map((tc, i) => (
                  <div key={`tool-${idx}-${i}`} className="chat-tool-block">
                    <div className="chat-tool-event" onClick={(e) => {
                      const details = e.currentTarget.nextSibling;
                      if (details) details.style.display = details.style.display === 'none' ? '' : 'none';
                    }}>
                      <span className="tool-icon">⚙</span>
                      <span><code>{tc.name}</code></span>
                      <span className="tool-chevron">›</span>
                    </div>
                    <div className="tool-details" style={{ display: 'none' }}>
                      <span className="tool-details-label">Input</span>
                      <pre>{JSON.stringify(tc.input, null, 2)}</pre>
                    </div>
                  </div>
                ))}
                {textBlocks.length > 0 && (
                  <div className="chat-bubble-row assistant">
                    <div className="chat-bubble assistant">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>{children}</code>
                          );
                        },
                      }}>
                        {textBlocks.map(b => b.text).join('\n')}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          }
          if (msg.role === 'toolResult') {
            const resultText = typeof msg.content === 'string'
              ? msg.content
              : msg.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
            const lines = resultText.split('\n');
            const truncated = lines.length > 10;
            return (
              <div key={idx} className={`chat-tool-block${msg.isError ? ' error' : ' done'}`}>
                <div className="chat-tool-event" onClick={(e) => {
                  const details = e.currentTarget.nextSibling;
                  if (details) details.style.display = details.style.display === 'none' ? '' : 'none';
                }}>
                  <span className="tool-icon">{msg.isError ? '✕' : '✓'}</span>
                  <span><code>{msg.toolName}</code> {msg.isError ? 'failed' : 'done'}</span>
                  <span className="tool-chevron">›</span>
                </div>
                <div className="tool-details" style={{ display: 'none' }}>
                  <span className="tool-details-label">Output</span>
                  <pre>{truncated ? lines.slice(0, 10).join('\n') + '\n…' : resultText}</pre>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default SubAgentSessionView;
