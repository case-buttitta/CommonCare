import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import './AIChatWidget.css';

const SUGGESTED_PROMPTS = [
  "Summarize my latest biomarkers",
  "How is my blood pressure trending?",
  "What are my upcoming appointments?",
  "Explain my medical conditions",
  "What treatments have been recommended?",
  "Are any of my readings outside normal range?",
];

const IconBot = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconBlock = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

function formatAIMessage(text) {
  if (!text) return '';
  // Convert **bold** to <strong>
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Convert bullet points
  html = html.replace(/^[-•]\s+/gm, '&bull; ');
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br/>');
  return html;
}

export default function AIChatWidget() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isStaff = user?.user_type === 'staff';

  // Send welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0 && !isStaff) {
      loadWelcomeMessage();
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isStaff) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const loadWelcomeMessage = async () => {
    try {
      const res = await api('/api/ai-chat/context', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const welcome = `Hello ${data.patient_name?.split(' ')[0] || 'there'}! I'm **CareBot**, your personal health assistant on CommonCare.\n\nI have access to your health data and can help you with:\n\n- **Biomarkers** — I can see ${data.biomarker_types || 0} types of readings and explain trends\n- **Appointments** — I can review your ${data.appointments || 0} appointment(s)\n- **Medical History** — I can discuss your ${data.conditions || 0} recorded condition(s)\n- **Treatments** — I can explain recommended treatments from your doctors\n- **Normal Ranges** — I can tell you if your readings are within healthy limits\n\nHow can I help you today?`;
        setMessages([{ from: 'ai', text: welcome, time: new Date() }]);
      } else {
        setMessages([{
          from: 'ai',
          text: "Hello! I'm **CareBot**, your CommonCare health assistant. I can help you understand your biomarkers, appointments, treatments, and medical history. What would you like to know?",
          time: new Date(),
        }]);
      }
    } catch {
      setMessages([{
        from: 'ai',
        text: "Hello! I'm **CareBot**, your CommonCare health assistant. I can help you understand your biomarkers, appointments, treatments, and medical history. What would you like to know?",
        time: new Date(),
      }]);
    }
  };

  const sendMessage = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || isLoading) return;

    const newMessages = [...messages, { from: 'user', text: userMsg, time: new Date() }];
    setMessages(newMessages);
    setInput('');
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = newMessages.map((m) => ({ from: m.from, text: m.text }));

      const res = await api('/api/ai-chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMsg, history }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { from: 'ai', text: data.response, time: new Date(), filtered: data.filtered, reason: data.reason },
        ]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            from: 'ai',
            text: errData.message || 'Sorry, I encountered an error. Please try again.',
            time: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          from: 'ai',
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          time: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (prompt) => {
    sendMessage(prompt);
  };

  const togglePanel = () => {
    setIsOpen((prev) => !prev);
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Bubble */}
      <button
        className={`ai-chat-bubble ${isOpen ? 'open' : ''}`}
        onClick={togglePanel}
        title="AI Health Assistant"
      >
        <span className="ai-chat-bubble-icon">
          {isOpen ? <IconClose /> : <IconBot />}
        </span>
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="ai-chat-panel">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-left">
              <div className="ai-chat-header-icon">
                <IconBot />
              </div>
              <div className="ai-chat-header-info">
                <h3>CareBot</h3>
                <span>AI Health Assistant</span>
              </div>
            </div>
            <button className="ai-chat-close" onClick={() => setIsOpen(false)}>
              <IconClose />
            </button>
          </div>

          {/* Staff Blocked View */}
          {isStaff ? (
            <div className="ai-chat-blocked">
              <div className="ai-chat-blocked-icon">
                <IconBlock />
              </div>
              <h4>AI Assistant Unavailable</h4>
              <p>
                The AI Health Assistant is designed for patients only. As a medical
                professional, please use internal clinical services and tools for
                health information and decision support.
              </p>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="ai-chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`ai-msg-wrap ${msg.from}`}>
                    <div className={`ai-msg-bubble${msg.filtered ? ' ai-msg-filtered' : ''}`}>
                      {msg.filtered && msg.reason && (
                        <div className={`ai-msg-filter-label ai-msg-filter-${msg.reason}`}>
                          {msg.reason === 'privacy' ? '🔒 Privacy Protected' : '📋 Off-Topic'}
                        </div>
                      )}
                      <div
                        dangerouslySetInnerHTML={{ __html: formatAIMessage(msg.text) }}
                      />
                      <div className="ai-msg-time">
                        {msg.time instanceof Date
                          ? msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="ai-msg-wrap ai">
                    <div className="ai-typing-indicator">
                      <div className="ai-typing-dot" />
                      <div className="ai-typing-dot" />
                      <div className="ai-typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Prompts */}
              {showSuggestions && messages.length <= 1 && (
                <div className="ai-suggestions">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      className="ai-suggestion-chip"
                      onClick={() => handleSuggestionClick(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Bar */}
              <div className="ai-chat-input-bar">
                <textarea
                  ref={inputRef}
                  className="ai-chat-input"
                  placeholder="Ask about your health data..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  className="ai-chat-send"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                >
                  <IconSend />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
