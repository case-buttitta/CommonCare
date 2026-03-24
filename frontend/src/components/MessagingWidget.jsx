import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import './MessagingWidget.css';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '💯', '🔥', '👏', '✅', '❌'];
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessagingWidget() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('list'); // list | chat | requests | search | newMessage
  const [activeTab, setActiveTab] = useState('contacts'); // contacts | messages

  // Data
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [messageRequests, setMessageRequests] = useState({ incoming: [], outgoing: [] });
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Message input
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [references, setReferences] = useState([]);
  const [refSearch, setRefSearch] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [expandedAppts, setExpandedAppts] = useState({});
  const [refDetail, setRefDetail] = useState(null);
  const [showRefDetail, setShowRefDetail] = useState(false);
  const [loadingRefDetail, setLoadingRefDetail] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const pollRef = useRef(null);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ── Fetching ────────────────────────────────────────────────────────────

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/messaging/unread-count', { headers });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count);
        setPendingRequests(data.pending_requests);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [token]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations', { headers });
      if (res.ok) setConversations(await res.json());
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/messaging/contacts', { headers });
      if (res.ok) setContacts(await res.json());
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    }
  };

  const fetchMessages = async (convoId) => {
    try {
      const res = await fetch(`/api/conversations/${convoId}/messages`, { headers });
      if (res.ok) {
        setMessages(await res.json());
        fetchUnreadCount();
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const fetchMessageRequests = async () => {
    try {
      const res = await fetch('/api/message-requests', { headers });
      if (res.ok) setMessageRequests(await res.json());
    } catch (err) {
      console.error('Failed to fetch message requests:', err);
    }
  };

  const fetchReferences = async (convoId, query = '') => {
    try {
      const url = `/api/messaging/references?conversation_id=${convoId}&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers });
      if (res.ok) setReferences(await res.json());
    } catch (err) {
      console.error('Failed to fetch references:', err);
    }
  };

  const fetchRefDetail = async (type, id) => {
    setLoadingRefDetail(true);
    try {
      const res = await fetch(`/api/messaging/reference-detail?type=${type}&id=${id}`, { headers });
      if (res.ok) {
        setRefDetail(await res.json());
        setShowRefDetail(true);
      }
    } catch (err) {
      console.error('Failed to fetch reference detail:', err);
    } finally {
      setLoadingRefDetail(false);
    }
  };

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
      fetchContacts();
      fetchMessageRequests();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeConvo && view === 'chat') {
      fetchMessages(activeConvo.id);
      pollRef.current = setInterval(() => fetchMessages(activeConvo.id), 5000);
      return () => clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [activeConvo, view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const openChat = async (contactOrConvo) => {
    // If it's a conversation object
    if (contactOrConvo.patient_id || contactOrConvo.staff_id) {
      setActiveConvo(contactOrConvo);
      setView('chat');
      return;
    }

    // It's a contact - find or create conversation
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: contactOrConvo.id }),
      });
      if (res.ok) {
        const convo = await res.json();
        setActiveConvo(convo);
        setView('chat');
        fetchConversations();
      } else {
        const data = await res.json();
        alert(data.error || 'Cannot open conversation');
      }
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && !imagePreview) || !activeConvo) return;

    const body = {
      content: messageText.trim(),
      message_type: imagePreview ? 'image' : selectedRef ? 'reference' : 'text',
      image_url: imagePreview || undefined,
      reference_type: selectedRef?.type || undefined,
      reference_id: selectedRef?.id || undefined,
    };

    try {
      const res = await fetch(`/api/conversations/${activeConvo.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessageText('');
        setImagePreview(null);
        setSelectedRef(null);
        setShowEmojiPicker(false);
        fetchMessages(activeConvo.id);
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    try {
      await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ emoji }),
      });
      fetchMessages(activeConvo.id);
      setShowReactionPicker(null);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/messaging/search-users?q=${encodeURIComponent(query)}`, { headers });
      if (res.ok) setSearchResults(await res.json());
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const sendRequest = async (toUserId) => {
    try {
      const res = await fetch('/api/message-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({ to_user_id: toUserId, message: requestMessage }),
      });
      if (res.ok) {
        setRequestMessage('');
        setView('list');
        fetchMessageRequests();
        alert('Message request sent!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send request');
      }
    } catch (err) {
      console.error('Failed to send request:', err);
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      const res = await fetch(`/api/message-requests/${requestId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchMessageRequests();
        fetchConversations();
        fetchUnreadCount();
      }
    } catch (err) {
      console.error('Failed to respond to request:', err);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleAtTrigger = (e) => {
    const val = e.target.value;
    setMessageText(val);

    // Detect @ trigger
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const query = val.substring(lastAt + 1);
      if (activeConvo) {
        setShowRefPicker(true);
        setRefSearch(query);
        fetchReferences(activeConvo.id, query);
      }
    } else {
      setShowRefPicker(false);
    }
  };

  const insertReference = (ref) => {
    const lastAt = messageText.lastIndexOf('@');
    const prefix = lastAt >= 0 ? messageText.substring(0, lastAt) : messageText;
    const label = ref.full_label || ref.label;
    setMessageText(`${prefix}@[${ref.type}:${ref.id}|${label}] `);
    setSelectedRef(ref);
    setShowRefPicker(false);
    setExpandedAppts({});
    messageInputRef.current?.focus();
  };

  const toggleApptExpand = (apptId) => {
    setExpandedAppts((prev) => ({ ...prev, [apptId]: !prev[apptId] }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getOtherName = (convo) => {
    if (!convo) return '';
    if (user.user_type === 'patient') return convo.staff_name;
    return convo.patient_name;
  };

  const getOtherId = (convo) => {
    if (!convo) return null;
    if (user.user_type === 'patient') return convo.staff_id;
    return convo.patient_id;
  };

  // ── Render Helpers ──────────────────────────────────────────────────────

  const renderMessageContent = (msg) => {
    // Parse @[type:id|label] references in content
    const parts = msg.content.split(/(@\[[^\]]+\])/g);
    return (
      <span>
        {parts.map((part, i) => {
          if (part.startsWith('@[') && part.endsWith(']')) {
            const inner = part.slice(2, -1);
            // New format: type:id|label
            const pipeIdx = inner.indexOf('|');
            let refType = null, refId = null, label = inner;
            if (pipeIdx > 0) {
              const meta = inner.substring(0, pipeIdx);
              label = inner.substring(pipeIdx + 1);
              const colonIdx = meta.indexOf(':');
              if (colonIdx > 0) {
                refType = meta.substring(0, colonIdx);
                refId = parseInt(meta.substring(colonIdx + 1), 10);
              }
            }
            const icon = refType === 'biomarker' ? '🔬' : '📅';
            return (
              <span
                key={i}
                className="msg-reference-inline clickable"
                title={`Click to view: ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (refType && refId) fetchRefDetail(refType, refId);
                }}
              >
                {icon} {label}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="msg-wrapper">
      {/* ── Tab Trigger ──────────────────────────────────────── */}
      <button
        className={`msg-tab-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) { setView('list'); setActiveConvo(null); } }}
      >
        <span className="msg-tab-trigger-icon">💬</span>
        <span className="msg-tab-trigger-label">Messages</span>
        {!isOpen && (unreadCount > 0 || pendingRequests > 0) && (
          <span className="msg-tab-trigger-badge">{unreadCount + pendingRequests}</span>
        )}
        <span className="msg-tab-trigger-arrow">{isOpen ? '▾' : '▴'}</span>
      </button>

      {/* ── Dropdown Panel ───────────────────────────────────── */}
      {isOpen && (
      <div className="msg-panel">
        {/* Header */}
        <div className="msg-header">
          <div className="msg-header-left">
            {view !== 'list' && (
              <button className="msg-back-btn" onClick={() => { setView('list'); setActiveConvo(null); }}>
                ←
              </button>
            )}
            <span className="msg-header-title">
              {view === 'list' && 'Messages'}
              {view === 'chat' && getOtherName(activeConvo)}
              {view === 'requests' && 'Message Requests'}
              {view === 'search' && 'New Message'}
              {view === 'newMessage' && 'Send Request'}
            </span>
          </div>
          <div className="msg-header-actions">
            <button className="msg-icon-btn" onClick={() => setIsOpen(false)} title="Close">✕</button>
          </div>
        </div>

      {/* Body */}
      <div className="msg-body">

        {/* ── List View ──────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            <div className="msg-tabs">
              <button
                className={`msg-tab ${activeTab === 'contacts' ? 'active' : ''}`}
                onClick={() => setActiveTab('contacts')}
              >
                Contacts
              </button>
              <button
                className={`msg-tab ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => setActiveTab('messages')}
              >
                Messages
                {unreadCount > 0 && <span className="msg-tab-badge">{unreadCount}</span>}
              </button>
            </div>

            {/* Action buttons */}
            <div className="msg-list-actions">
              <button className="msg-new-btn" onClick={() => setView('search')}>
                ✉ New Message
              </button>
              <button
                className="msg-requests-btn"
                onClick={() => { setView('requests'); fetchMessageRequests(); }}
              >
                Requests
                {pendingRequests > 0 && <span className="msg-tab-badge">{pendingRequests}</span>}
              </button>
            </div>

            {activeTab === 'contacts' && (
              <div className="msg-contact-list">
                {contacts.length === 0 && (
                  <div className="msg-empty">No contacts yet. Book an appointment to start messaging.</div>
                )}
                {contacts.map((c) => (
                  <div key={c.id} className="msg-contact-item" onClick={() => openChat(c)}>
                    <div className="msg-contact-avatar">
                      {c.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="msg-contact-info">
                      <div className="msg-contact-name">{c.full_name}</div>
                      <div className="msg-contact-type">{c.user_type === 'staff' ? 'Doctor' : 'Patient'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="msg-convo-list">
                {conversations.length === 0 && (
                  <div className="msg-empty">No conversations yet.</div>
                )}
                {conversations.map((c) => (
                  <div key={c.id} className="msg-convo-item" onClick={() => openChat(c)}>
                    <div className="msg-contact-avatar">
                      {getOtherName(c)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="msg-convo-info">
                      <div className="msg-convo-top">
                        <span className="msg-convo-name">{getOtherName(c)}</span>
                        {c.last_message && (
                          <span className="msg-convo-time">
                            {new Date(c.last_message.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="msg-convo-preview">
                        {c.last_message
                          ? c.last_message.content.substring(0, 40) + (c.last_message.content.length > 40 ? '...' : '')
                          : 'No messages yet'}
                      </div>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="msg-unread-badge">{c.unread_count}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Chat View ──────────────────────────────────────────── */}
        {view === 'chat' && activeConvo && (
          <>
            <div className="msg-messages">
              {messages.length === 0 && (
                <div className="msg-empty">No messages yet. Say hello!</div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`msg-bubble-wrap ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                >
                  <div className="msg-bubble">
                    {msg.image_url && (
                      <img src={msg.image_url} alt="Shared" className="msg-image" />
                    )}
                    {msg.content && (
                      <div className="msg-text">{renderMessageContent(msg)}</div>
                    )}
                    <div className="msg-time">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.sender_id === user.id && (
                        <span className="msg-read-status">{msg.is_read ? ' ✓✓' : ' ✓'}</span>
                      )}
                    </div>

                    {/* Reactions display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="msg-reactions">
                        {Object.entries(
                          msg.reactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || { count: 0, users: [] };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(r.user_name);
                            return acc;
                          }, {})
                        ).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            className="msg-reaction-chip"
                            onClick={() => toggleReaction(msg.id, emoji)}
                            title={data.users.join(', ')}
                          >
                            {emoji} {data.count > 1 ? data.count : ''}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reaction add button */}
                    <button
                      className="msg-add-reaction"
                      onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                    >
                      😊+
                    </button>

                    {/* Reaction picker */}
                    {showReactionPicker === msg.id && (
                      <div className="msg-reaction-picker">
                        {QUICK_EMOJIS.map((e) => (
                          <button key={e} onClick={() => toggleReaction(msg.id, e)}>{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Reference picker dropdown — grouped by appointment */}
            {showRefPicker && (
              <div className="msg-ref-picker">
                <div className="msg-ref-header">📎 Link a reference</div>
                {references.length === 0 && (
                  <div className="msg-ref-empty">No matching references found</div>
                )}
                {references.map((appt) => (
                  <div key={`appt-${appt.id}`} className="msg-ref-group">
                    {/* Appointment row — clickable to send as-is */}
                    <div className="msg-ref-appt-row">
                      <button
                        className="msg-ref-expand-btn"
                        onClick={(e) => { e.stopPropagation(); toggleApptExpand(appt.id); }}
                        title={appt.biomarkers.length ? 'Show biomarkers' : 'No biomarkers'}
                      >
                        {appt.biomarkers.length > 0 ? (expandedAppts[appt.id] ? '▾' : '▸') : '•'}
                      </button>
                      <div className="msg-ref-item" onClick={() => insertReference(appt)}>
                        <span className="msg-ref-type-badge">📅</span>
                        <div className="msg-ref-item-content">
                          <span className="msg-ref-label">{appt.label}</span>
                          {appt.reason && <span className="msg-ref-sublabel">{appt.reason}</span>}
                        </div>
                      </div>
                    </div>
                    {/* Expanded biomarkers */}
                    {expandedAppts[appt.id] && appt.biomarkers.length > 0 && (
                      <div className="msg-ref-biomarkers">
                        {appt.biomarkers.map((bm) => (
                          <div
                            key={`bm-${bm.id}`}
                            className="msg-ref-item msg-ref-bm-item"
                            onClick={() => insertReference(bm)}
                          >
                            <span className="msg-ref-type-badge">🔬</span>
                            <span className="msg-ref-label">{bm.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Image preview */}
            {imagePreview && (
              <div className="msg-image-preview">
                <img src={imagePreview} alt="Preview" />
                <button onClick={() => setImagePreview(null)}>✕</button>
              </div>
            )}

            {/* Selected reference display */}
            {selectedRef && (
              <div className="msg-selected-ref">
                <span>{selectedRef.type === 'appointment' ? '📅' : '🔬'} {selectedRef.full_label || selectedRef.label}</span>
                <button onClick={() => setSelectedRef(null)}>✕</button>
              </div>
            )}

            {/* Input bar */}
            <div className="msg-input-bar">
              <button
                className="msg-input-icon"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
              >
                📷
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <button
                className="msg-input-icon"
                onClick={() => {
                  if (activeConvo) {
                    setShowRefPicker(!showRefPicker);
                    if (!showRefPicker) fetchReferences(activeConvo.id, '');
                  }
                }}
                title="Link appointment or biomarker"
              >
                @
              </button>
              <textarea
                ref={messageInputRef}
                className="msg-input"
                placeholder="Type a message... (@ to reference)"
                value={messageText}
                onChange={handleAtTrigger}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="msg-input-icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emojis"
              >
                😊
              </button>
              <button
                className="msg-send-btn"
                onClick={sendMessage}
                disabled={!messageText.trim() && !imagePreview}
              >
                ➤
              </button>
            </div>

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="msg-emoji-picker">
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    className="msg-emoji-btn"
                    onClick={() => {
                      setMessageText(messageText + e);
                      messageInputRef.current?.focus();
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Requests View ──────────────────────────────────────── */}
        {view === 'requests' && (
          <div className="msg-requests">
            <div className="msg-req-section">
              <h4>Incoming Requests</h4>
              {messageRequests.incoming.length === 0 && (
                <div className="msg-empty">No pending requests</div>
              )}
              {messageRequests.incoming.map((req) => (
                <div key={req.id} className="msg-req-item">
                  <div className="msg-req-info">
                    <div className="msg-req-name">{req.from_user_name}</div>
                    <div className="msg-req-type">{req.from_user_type === 'staff' ? 'Doctor' : 'Patient'}</div>
                    {req.message && <div className="msg-req-msg">"{req.message}"</div>}
                  </div>
                  <div className="msg-req-actions">
                    <button className="msg-req-accept" onClick={() => respondToRequest(req.id, 'accepted')}>
                      Accept
                    </button>
                    <button className="msg-req-reject" onClick={() => respondToRequest(req.id, 'rejected')}>
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="msg-req-section">
              <h4>Sent Requests</h4>
              {messageRequests.outgoing.length === 0 && (
                <div className="msg-empty">No sent requests</div>
              )}
              {messageRequests.outgoing.map((req) => (
                <div key={req.id} className="msg-req-item">
                  <div className="msg-req-info">
                    <div className="msg-req-name">To: {req.to_user_name}</div>
                    <div className={`msg-req-status status-${req.status}`}>{req.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search / New Message View ──────────────────────────── */}
        {view === 'search' && (
          <div className="msg-search-view">
            <input
              className="msg-search-input"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              autoFocus
            />
            <div className="msg-search-results">
              {searchResults.map((u) => {
                const isContact = contacts.some((c) => c.id === u.id);
                return (
                  <div key={u.id} className="msg-search-item">
                    <div className="msg-contact-avatar">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="msg-contact-info">
                      <div className="msg-contact-name">{u.full_name}</div>
                      <div className="msg-contact-type">
                        {u.user_type === 'staff' ? 'Doctor' : 'Patient'}
                        {isContact && ' • In contacts'}
                      </div>
                    </div>
                    {isContact ? (
                      <button className="msg-search-action" onClick={() => openChat(u)}>
                        Message
                      </button>
                    ) : (
                      <button
                        className="msg-search-action request"
                        onClick={() => {
                          setView('newMessage');
                          setSearchResults([u]);
                        }}
                      >
                        Request
                      </button>
                    )}
                  </div>
                );
              })}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="msg-empty">No users found</div>
              )}
              {searchQuery.length < 2 && (
                <div className="msg-empty">Type at least 2 characters to search</div>
              )}
            </div>
          </div>
        )}

        {/* ── New Message Request View ───────────────────────────── */}
        {view === 'newMessage' && searchResults.length > 0 && (
          <div className="msg-new-request">
            <div className="msg-req-target">
              <div className="msg-contact-avatar">
                {searchResults[0].full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="msg-contact-name">{searchResults[0].full_name}</div>
                <div className="msg-contact-type">
                  {searchResults[0].user_type === 'staff' ? 'Doctor' : 'Patient'}
                </div>
              </div>
            </div>
            <p className="msg-req-explain">
              You don't have an existing relationship with this person.
              Send a message request for them to approve.
            </p>
            <textarea
              className="msg-req-textarea"
              placeholder="Add an optional message..."
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={3}
            />
            <button
              className="msg-req-send-btn"
              onClick={() => sendRequest(searchResults[0].id)}
            >
              Send Request
            </button>
          </div>
        )}
      </div>
    </div>
    )}

    {/* ── Reference Detail Modal ──────────────────────────────── */}
    {showRefDetail && refDetail && (
      <div className="msg-ref-detail-overlay" onClick={() => setShowRefDetail(false)}>
        <div className="msg-ref-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="msg-ref-detail-header">
            <span>{refDetail.type === 'appointment' ? '📅' : '🔬'} {refDetail.type === 'appointment' ? 'Appointment Details' : 'Biomarker Details'}</span>
            <button onClick={() => setShowRefDetail(false)}>✕</button>
          </div>
          <div className="msg-ref-detail-body">
            {refDetail.type === 'appointment' && (
              <>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Date</span>
                  <span className="msg-ref-detail-value">{refDetail.date}</span>
                </div>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Doctor</span>
                  <span className="msg-ref-detail-value">{refDetail.doctor_name}</span>
                </div>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Patient</span>
                  <span className="msg-ref-detail-value">{refDetail.patient_name}</span>
                </div>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Status</span>
                  <span className={`msg-ref-detail-status status-${refDetail.status}`}>{refDetail.status}</span>
                </div>
                {refDetail.reason && (
                  <div className="msg-ref-detail-row">
                    <span className="msg-ref-detail-label">Reason</span>
                    <span className="msg-ref-detail-value">{refDetail.reason}</span>
                  </div>
                )}
                {refDetail.notes && (
                  <div className="msg-ref-detail-row">
                    <span className="msg-ref-detail-label">Notes</span>
                    <span className="msg-ref-detail-value">{refDetail.notes}</span>
                  </div>
                )}
                {refDetail.biomarkers && refDetail.biomarkers.length > 0 && (
                  <div className="msg-ref-detail-section">
                    <div className="msg-ref-detail-section-title">Biomarker Readings</div>
                    {refDetail.biomarkers.map((bm) => (
                      <div key={bm.id} className="msg-ref-detail-bm">
                        <span className="msg-ref-detail-bm-name">{bm.display_name}</span>
                        <span className="msg-ref-detail-bm-value">{bm.value} {bm.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {refDetail.type === 'biomarker' && (
              <>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Biomarker</span>
                  <span className="msg-ref-detail-value">{refDetail.display_name}</span>
                </div>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Value</span>
                  <span className="msg-ref-detail-value msg-ref-detail-highlight">{refDetail.value} {refDetail.unit}</span>
                </div>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Appointment</span>
                  <span className="msg-ref-detail-value">{refDetail.appointment_date} — {refDetail.doctor_name}</span>
                </div>
                <div className="msg-ref-detail-row">
                  <span className="msg-ref-detail-label">Patient</span>
                  <span className="msg-ref-detail-value">{refDetail.patient_name}</span>
                </div>
                {refDetail.history && refDetail.history.length > 1 && (
                  <div className="msg-ref-detail-section">
                    <div className="msg-ref-detail-section-title">History ({refDetail.display_name})</div>
                    <div className="msg-ref-detail-history">
                      {refDetail.history.map((h) => (
                        <div key={h.id} className={`msg-ref-detail-history-row ${h.is_current ? 'current' : ''}`}>
                          <span className="msg-ref-detail-history-date">{h.date}</span>
                          <span className="msg-ref-detail-history-val">{h.value} {h.unit}</span>
                          <span className="msg-ref-detail-history-doc">{h.doctor_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
