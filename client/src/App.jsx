import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowDown, ArrowUp, Check, Hash, Menu, MessageCircle, Plus, Search,
  Smile, Sparkles, Users, Wifi, WifiOff, X,
} from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
const DEFAULT_ROOMS = ['general', 'design', 'engineering', 'random'];
const AVATAR_COLORS = ['#dce9ff', '#fce2d6', '#e6e2fb', '#d9efe6', '#f8e8b8', '#f4dce9'];

function initials(name = '?') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function avatarColor(name = '') {
  return AVATAR_COLORS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function readProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem('chatterbox-profile') || '{}');
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
    return {
      name: typeof profile.name === 'string' ? profile.name.trim().replace(/\s+/g, ' ').slice(0, 32) : '',
      room: typeof profile.room === 'string'
        ? profile.room.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 48)
        : '',
    };
  } catch {
    return {};
  }
}

function AccessibleDialog({ className, labelledBy, onClose, dismissible = true, children, onClick }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const handleClose = () => onCloseRef.current();
    dialog.showModal();
    dialog.querySelector('input')?.focus();
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        if (!dismissible) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        dialogRef.current?.close();
      }}
      onClick={onClick}
    >
      {children}
    </dialog>
  );
}

function App() {
  const initialProfile = useMemo(readProfile, []);
  const [name, setName] = useState(initialProfile.name || '');
  const [room, setRoom] = useState(initialProfile.room || 'general');
  const [draft, setDraft] = useState('');
  const [joined, setJoined] = useState(Boolean(initialProfile.name));
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('connecting');
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const [notice, setNotice] = useState('');
  const [showPeople, setShowPeople] = useState(true);
  const [mobilePeopleOpen, setMobilePeopleOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobilePanel, setMobilePanel] = useState('chat');
  const [customRoom, setCustomRoom] = useState('');
  const [showRoomInput, setShowRoomInput] = useState(false);
  const socketRef = useRef(null);
  const typingTimeout = useRef(null);
  const noticeTimeout = useRef(null);
  const composerRef = useRef(null);
  const bottomRef = useRef(null);
  const joinedRef = useRef(joined);
  const profileRef = useRef({ name, room });

  useEffect(() => { joinedRef.current = joined; }, [joined]);
  profileRef.current = { name, room };

  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      setConnectionState('connected');
      setNotice('');
      const profile = profileRef.current;
      if (joinedRef.current) socket.emit('room:join', profile);
    });
    socket.on('disconnect', (reason) => {
      setConnected(false);
      setTyping([]);
      setConnectionState(reason === 'io server disconnect' ? 'disconnected' : 'reconnecting');
      if (joinedRef.current && reason !== 'io client disconnect') setNotice('Connection lost. Reconnecting automatically…');
    });
    socket.on('connect_error', () => {
      setConnectionState('reconnecting');
      setNotice('Could not reach the chat server. Reconnecting…');
    });
    socket.on('room:history', (history) => setMessages(Array.isArray(history) ? history : []));
    socket.on('room:participants', (list) => setParticipants(Array.isArray(list) ? list : []));
    socket.on('message:new', (message) => setMessages((current) => [...current, message].slice(-100)));
    socket.on('presence:update', ({ type, participant }) => {
      if (type === 'joined') setNotice(`${participant.name} joined the room`);
      if (type === 'left') setNotice(`${participant.name} left the room`);
      window.clearTimeout(noticeTimeout.current);
      noticeTimeout.current = window.setTimeout(() => setNotice(''), 2600);
    });
    socket.on('typing:update', ({ name: typingName, isTyping }) => {
      setTyping((current) => isTyping
        ? [...new Set([...current, typingName])]
        : current.filter((person) => person !== typingName));
    });
    socket.on('chat:error', ({ message }) => setNotice(message || 'That action could not be completed.'));
    socket.connect();
    return () => {
      window.clearTimeout(typingTimeout.current);
      window.clearTimeout(noticeTimeout.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typing]);

  const joinRoom = useCallback((nextRoom = room, nextName = name) => {
    const cleanName = nextName.trim().replace(/\s+/g, ' ').slice(0, 32);
    const cleanRoom = nextRoom.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 48);
    if (!cleanName || !cleanRoom) return;
    setName(cleanName);
    setRoom(cleanRoom);
    setJoined(true);
    setDraft('');
    setMessages([]);
    setParticipants([]);
    setTyping([]);
    window.clearTimeout(typingTimeout.current);
    setMobilePanel('chat');
    try {
      localStorage.setItem('chatterbox-profile', JSON.stringify({ name: cleanName, room: cleanRoom }));
    } catch {
      setNotice('Your browser could not save this profile. You can still chat in this tab.');
    }
    if (socketRef.current?.connected) socketRef.current.emit('room:join', { name: cleanName, room: cleanRoom });
  }, [name, room]);

  const sendMessage = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit('message:send', { text });
    socketRef.current.emit('typing:stop');
    setDraft('');
    if (composerRef.current) composerRef.current.style.height = '29px';
  };

  const updateDraft = (value, textarea) => {
    setDraft(value);
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(value.trim() ? 'typing:start' : 'typing:stop');
    window.clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => socketRef.current?.emit('typing:stop'), 1500);
  };

  const activePeople = participants.length;
  const searchResults = searchQuery.trim()
    ? messages.filter((message) => `${message.name} ${message.text}`.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 8)
    : [];
  const addRoom = (event) => {
    event.preventDefault();
    const roomName = customRoom.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 48);
    if (!roomName) return;
    joinRoom(roomName, name);
    setCustomRoom('');
    setShowRoomInput(false);
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobilePanel === 'sidebar' ? 'mobile-visible' : ''}`} aria-label="Workspace navigation">
        <div className="workspace-switcher">
          <div className="workspace-mark"><MessageCircle size={18} strokeWidth={2.4} /></div>
          <div className="workspace-copy"><strong>chatterbox</strong><span>Product team</span></div>
          <button className="icon-button mobile-close-sidebar" onClick={() => setMobilePanel('chat')} aria-label="Close room list"><X size={19} /></button>
        </div>
        <div className="sidebar-actions">
          <button className="sidebar-action" onClick={() => { setSearchQuery(''); setSearchOpen(true); }}><Search size={16} /><span>Search this room</span></button>
        </div>
        <div className="sidebar-section">
          <div className="section-heading"><span>YOUR ROOMS</span><button className="icon-button tiny" onClick={() => setShowRoomInput((value) => !value)} aria-label="Add a room"><Plus size={16} /></button></div>
          {showRoomInput && <form className="room-add-form" onSubmit={addRoom}><Hash size={14} /><input autoFocus maxLength={48} value={customRoom} onChange={(event) => setCustomRoom(event.target.value)} aria-label="New room name" placeholder="room-name" /><button aria-label="Create room"><ArrowUp size={14} /></button></form>}
          <nav className="room-list" aria-label="Rooms">
            {DEFAULT_ROOMS.map((item) => <button key={item} className={`room-link ${room === item ? 'active' : ''}`} onClick={() => joinRoom(item)}><Hash size={16} /><span>{item}</span></button>)}
            {!DEFAULT_ROOMS.includes(room) && <button className="room-link active" onClick={() => setMobilePanel('chat')}><Hash size={16} /><span>{room}</span></button>}
          </nav>
        </div>
        <div className="sidebar-note">
          <span>ROOMS ARE OPEN</span>
          <p>Everyone who joins a room can read its messages.</p>
        </div>
        <div className="sidebar-bottom">
          <button className="user-profile" onClick={() => { setJoined(false); setMobilePanel('chat'); }} title="Change your display name">
            <div className="avatar avatar-small avatar-blue">{initials(name || 'You')}</div><span><strong>{name || 'Guest'}</strong><small>Change display name</small></span>
          </button>
        </div>
      </aside>
      {mobilePanel === 'sidebar' && <button className="sidebar-scrim" onClick={() => setMobilePanel('chat')} aria-label="Close room list" />}

      <section className="chat-panel">
        <header className="chat-header">
          <button className="icon-button mobile-menu" aria-label="Open room list" aria-expanded={mobilePanel === 'sidebar'} onClick={() => setMobilePanel('sidebar')}><Menu size={19} /></button>
          <div className="room-title"><div className="title-icon"><Hash size={19} /></div><div><h1>{room}</h1><p>A place for everything and everyone.</p></div></div>
          <div className="header-right">
            <div className={`connection ${connectionState === 'connected' ? 'is-connected' : ''}`} role="status" aria-live="polite"><span className="connection-dot" />{connectionState === 'connected' ? 'Connected' : connectionState === 'reconnecting' ? 'Reconnecting' : connectionState === 'disconnected' ? 'Disconnected' : 'Connecting'}</div>
            {joined && connectionState === 'disconnected' && <button className="reconnect-button" onClick={() => { setConnectionState('reconnecting'); setNotice('Reconnecting to the chat…'); socketRef.current?.connect(); }}>Reconnect</button>}
            <button className="member-count" aria-label={`Show ${activePeople} room members`} onClick={() => { if (window.matchMedia('(max-width: 900px)').matches) setMobilePeopleOpen((visible) => !visible); else { setMobilePeopleOpen(false); setShowPeople((visible) => !visible); } }} aria-expanded={window.matchMedia('(max-width: 900px)').matches ? mobilePeopleOpen : showPeople}><Users size={16} /><span>{activePeople}</span></button>
          </div>
        </header>
        <div className="conversation-layout">
          <div className="conversation-column">
            <div className="message-scroll" role="log" aria-label={`Messages in #${room}`} aria-live="polite" aria-relevant="additions">
              <div className="room-intro">
                <div className="intro-hash"><Hash size={26} /></div><h2>Welcome to #{room}</h2>
                <p>This is the beginning of the <strong>#{room}</strong> room. Say hello and get the conversation going.</p>
                <div className="intro-rule"><span>Today</span></div>
              </div>
              {messages.map((message, index) => {
                const previous = messages[index - 1];
                const compact = previous?.name === message.name && new Date(message.createdAt) - new Date(previous.createdAt) < 300000;
                return (
                  <article className={`message ${compact ? 'compact' : ''}`} id={`message-${message.id}`} key={message.id}>
                    {!compact && <div className="avatar message-avatar" style={{ background: avatarColor(message.name) }}>{initials(message.name)}</div>}
                    <div className="message-body">
                      {!compact && <div className="message-meta"><strong>{message.name}</strong><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>}
                      <p>{message.text}</p>
                    </div>
                  </article>
                );
              })}
              {typing.length > 0 && <div className="typing-line"><span className="typing-dots"><i /><i /><i /></span><span><strong>{typing.slice(0, 2).join(', ')}</strong>{typing.length > 2 ? ` and ${typing.length - 2} more` : ''} {typing.length === 1 ? 'is' : 'are'} typing</span></div>}
              {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={13} /></button></div>}
              <div ref={bottomRef} />
            </div>
            <div className="composer-wrap">
              {!joined && <div className="join-prompt"><Sparkles size={16} /><span>Make yourself at home — choose a name to join the conversation.</span></div>}
              <form className="composer" onSubmit={joined ? sendMessage : (event) => { event.preventDefault(); joinRoom(); }}>
                <textarea
                  ref={composerRef}
                  aria-label={joined ? `Message #${room}` : 'Your display name'}
                  placeholder={joined ? `Message #${room}` : 'Enter your display name to join…'}
                  maxLength={joined ? 2000 : 32}
                  value={joined ? draft : name}
                  onChange={(event) => joined ? updateDraft(event.target.value, event.currentTarget) : setName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); joined ? sendMessage(event) : joinRoom(); } }}
                  rows={1}
                />
                <div className="composer-footer">
                  <span className="composer-hint">{joined ? <><strong>Enter</strong> to send · <strong>Shift + Enter</strong> for a new line</> : 'Your name is only visible in this room'}</span>
                  <div className="composer-tools">
                    {joined && <button type="button" className="icon-button emoji-button" aria-label="Add emoji"><Smile size={18} /></button>}
                    <button className={`send-button ${!joined && name.trim() ? 'ready' : ''}`} disabled={joined ? !draft.trim() || !connected : !name.trim()} aria-label={joined ? 'Send message' : 'Join chat'}>{joined ? <ArrowUp size={17} /> : <Check size={17} />}</button>
                  </div>
                </div>
              </form>
              {joined && <p className="privacy-note"><Wifi size={12} /> Your messages are shared with everyone in #{room}</p>}
            </div>
          </div>
          {(showPeople || mobilePeopleOpen) && <aside className={`people-panel ${mobilePeopleOpen ? 'mobile-open' : ''}`} aria-label="Room members"><div className="people-heading"><h2>People</h2><button className="icon-button people-close" onClick={() => setMobilePeopleOpen(false)} aria-label="Close room members"><X size={16} /></button><span>{participants.length}</span></div><p className="people-status"><i className="presence online" />Online — {participants.length}</p>{participants.map((person) => <div className="person-row" key={person.id}><div className="avatar avatar-small" style={{ background: avatarColor(person.name) }}>{initials(person.name)}</div><span>{person.name}{person.name === name && <small>You</small>}</span><i className="presence online" /></div>)}{participants.length === 0 && <p className="people-empty">No one here just yet.</p>}</aside>}
        </div>
      </section>

      {searchOpen && <AccessibleDialog className="search-overlay" labelledBy="search-title" onClose={() => setSearchOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <div className="search-dialog">
          <div className="search-dialog-heading"><div><h2 id="search-title">Search #{room}</h2><p>Find a message in this room's recent history.</p></div><button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button></div>
          <div className="search-input-wrap"><Search size={17} /><input autoFocus autoComplete="off" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label={`Search messages in ${room}`} placeholder="Search messages or people…" /></div>
          <div className="search-results">{!searchQuery.trim() ? <p className="search-empty">Type a word, phrase, or name to search.</p> : searchResults.length === 0 ? <p className="search-empty">No recent messages match “{searchQuery}”.</p> : searchResults.map((message) => <button className="search-result" key={message.id} onClick={() => { setSearchOpen(false); window.setTimeout(() => document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }}><span className="search-result-meta"><strong>{message.name}</strong><time>{formatTime(message.createdAt)}</time></span><span>{message.text}</span></button>)}</div>
        </div>
      </AccessibleDialog>}

      {!joined && <AccessibleDialog className="join-overlay" labelledBy="join-title" dismissible={false} onClose={() => {}}>
        <div className="join-card"><div className="join-brand"><div className="workspace-mark"><MessageCircle size={18} /></div><span>chatterbox</span></div><div className="join-art"><div className="art-bubble bubble-one"><span>Hey there</span></div><div className="art-bubble bubble-two"><span>Welcome to the team</span><i /></div><div className="art-spark spark-one"><Sparkles size={18} /></div><div className="art-spark spark-two"><Sparkles size={13} /></div><div className="art-orbit" /></div><span className="eyebrow">YOUR TEAM, IN SYNC</span><h2 id="join-title">Good conversations<br />start here.</h2><p>Join your people, share an idea, or just say hi. Your team is waiting.</p><form onSubmit={(event) => { event.preventDefault(); joinRoom(); }}><label htmlFor="display-name">What should we call you?</label><input id="display-name" autoFocus maxLength={32} placeholder="e.g. Taylor" value={name} onChange={(event) => setName(event.target.value)} /><button type="submit" disabled={!name.trim()}>Join the conversation <ArrowDown size={16} /></button></form><small className="join-footnote"><WifiOff size={13} /> Your name is only saved on this device.</small></div>
      </AccessibleDialog>}
    </main>
  );
}

export default App;
