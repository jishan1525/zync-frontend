import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;


const AVATAR_COLORS = [
  "from-violet-500 to-purple-700",
  "from-sky-500 to-cyan-600",
  "from-amber-400 to-orange-600",
  "from-emerald-400 to-teal-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-700",
];

function avatarColor(name = "") {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function initials(name = "") {
  return name.slice(0, 2).toUpperCase();
}

function formatTime(iso) {
  const d = new Date(iso || Date.now());
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

function formatDayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function groupByDay(messages) {
  const groups = [];
  let lastLabel = null;
  for (const m of messages) {
    const label = formatDayLabel(m.createdAt);
    if (label !== lastLabel) { groups.push({ type: "label", label }); lastLabel = label; }
    groups.push({ type: "msg", ...m });
  }
  return groups;
}


function Avatar({ name, size = "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}


function Tick({ status }) {
  if (status === "read") return <span className="text-[10px] text-violet-400 leading-none">✓✓</span>;
  if (status === "delivered") return <span className="text-[10px] text-[#6b6880] leading-none">✓✓</span>;
  return <span className="text-[10px] text-white/40 leading-none">✓</span>;
}


function TypingDots() {
  return (
    <div className="flex items-end gap-2 px-1">
      <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#7b78a8] inline-block animate-bounce"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
    </div>
  );
}


function MessageBubble({ msg, isSent, showAvatar, senderName }) {
  return (
    <div className={`flex items-end gap-2 ${isSent ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-7 flex-shrink-0">
        {!isSent && showAvatar && <Avatar name={senderName} size="sm" />}
      </div>

      <div className={`max-w-[68%] flex flex-col gap-0.5 ${isSent ? "items-end" : "items-start"}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words
            ${isSent
              ? "bg-violet-600 text-white rounded-br-sm"
              : "bg-white/[0.06] border border-white/[0.07] text-[#e2e0f0] rounded-bl-sm"
            }`}
        >
          {msg.message}
        </div>
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px] text-[#4a4865]">{formatTime(msg.createdAt)}</span>
          {isSent && <Tick status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

function ContactItem({ user, active, lastMsg, unread, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left
        ${active
          ? "bg-violet-600/20 border border-violet-500/20"
          : "hover:bg-white/[0.04] border border-transparent"
        }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={user.username} />
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0a0a14] rounded-full" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium truncate ${active ? "text-violet-300" : "text-[#e2e0f0]"}`}>
            {user.username}
          </span>
          {lastMsg && (
            <span className="text-[10px] text-[#4a4865] flex-shrink-0 ml-1">
              {formatTime(lastMsg.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-[#5a5778] truncate">
            {lastMsg ? lastMsg.message : "Start chatting ⚡"}
          </span>
          {unread > 0 && (
            <span className="ml-1 flex-shrink-0 bg-violet-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}


export default function ChatPage({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lastMsgs, setLastMsgs] = useState({});   
  const [unread, setUnread] = useState({});         

  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  
  const scrollBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // ── socket init ──
  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;
    socket.emit("join", currentUser);

    socket.on("receive_message", (msg) => {
      // update last message preview
      const other = msg.sender === currentUser ? msg.receiver : msg.sender;
      setLastMsgs((prev) => ({ ...prev, [other]: msg }));

      setMessages((prev) => {
        const relevant =
          (msg.sender === currentUser) ||
          (msg.receiver === currentUser);
        if (!relevant) return prev;

        // avoid duplicate
        if (prev.find((m) => m._id === msg._id)) return prev;

        // mark delivered if we are receiver and not in that chat
        if (msg.receiver === currentUser) {
          socket.emit("message_delivered", msg._id);
        }
        return [...prev, msg];
      });

      // unread badge
      setActiveChat((active) => {
        if (msg.sender !== currentUser && msg.sender !== active) {
          setUnread((prev) => ({ ...prev, [msg.sender]: (prev[msg.sender] || 0) + 1 }));
        }
        return active;
      });
    });

    socket.on("message_delivered_update", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status: "delivered" } : m))
      );
    });

    socket.on("message_read_update", ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status: "read" } : m))
      );
    });

    socket.on("typing", ({ sender }) => {
      setActiveChat((active) => { if (sender === active) setIsTyping(true); return active; });
    });
    socket.on("stop_typing", ({ sender }) => {
      setActiveChat((active) => { if (sender === active) setIsTyping(false); return active; });
    });

    return () => socket.disconnect();
  }, [currentUser]);

  // ── load users ──
  useEffect(() => {
    fetch(`${BACKEND_URL}/users?currentUser=${currentUser}`)
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, [currentUser]);

  // ── open chat ──
  const openChat = useCallback(async (username) => {
    setActiveChat(username);
    setIsTyping(false);
    setSidebarOpen(false);
    setUnread((prev) => ({ ...prev, [username]: 0 }));

    try {
      const r = await fetch(`${BACKEND_URL}/messages?sender=${currentUser}&receiver=${username}`);
      const msgs = await r.json();
      setMessages(msgs);

      // mark all received as read
      msgs
        .filter((m) => m.receiver === currentUser && m.status !== "read")
        .forEach((m) => socketRef.current?.emit("message_read", m._id));

      // update last msg preview
      if (msgs.length > 0) {
        setLastMsgs((prev) => ({ ...prev, [username]: msgs[msgs.length - 1] }));
      }
    } catch {}

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      inputRef.current?.focus();
    }, 80);
  }, [currentUser]);

  // ── send ──
  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !activeChat || !socketRef.current) return;
    socketRef.current.emit("send_message", {
      sender: currentUser,
      receiver: activeChat,
      message: text,
    });
    setInput("");
    stopTypingEmit();
    scrollBottom();
  }, [input, activeChat, currentUser, scrollBottom]);

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  // ── typing emit ──
  const onInputChange = (e) => {
    setInput(e.target.value);
    if (!activeChat || !socketRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit("typing", { sender: currentUser, receiver: activeChat });
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTypingEmit, 1500);
  };

  const stopTypingEmit = () => {
    if (isTypingRef.current && socketRef.current && activeChat) {
      isTypingRef.current = false;
      socketRef.current.emit("stop_typing", { sender: currentUser, receiver: activeChat });
    }
    clearTimeout(typingTimerRef.current);
  };

  // ── scroll on new messages ──
  useEffect(() => { scrollBottom(); }, [messages, isTyping]);

  const filtered = users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));
  const grouped = groupByDay(messages.filter((m) =>
    (m.sender === currentUser && m.receiver === activeChat) ||
    (m.sender === activeChat && m.receiver === currentUser)
  ));


  return (
    <div className="h-screen bg-[#050509] flex overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2840; border-radius: 4px; }
        textarea:focus { outline: none; }
      `}</style>

      
      <aside
        className={`
          flex-shrink-0 w-[280px] bg-[#08080f] border-r border-white/[0.06]
          flex flex-col h-full
          absolute md:relative z-30 transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* header */}
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
              <span className="text-violet-400 text-xl drop-shadow-[0_0_8px_#7c3aed]">⚡</span>
              <span className="text-white text-lg font-black tracking-tight">Zync</span>
            </div>
            <button
              onClick={onLogout}
              className="text-[#4a4865] hover:text-red-400 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
              title="Logout"
            >
              Logout
            </button>
          </div>

          {/* me */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="relative">
              <Avatar name={currentUser} size="md" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#08080f] rounded-full" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#e2e0f0]">{currentUser}</p>
            </div>
          </div>
        </div>

        {/* search */}
        <div className="px-3 py-3 border-b border-white/[0.04]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4865] text-sm">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-[#4a4865] outline-none focus:border-violet-500/40 transition-all"
            />
          </div>
        </div>

        {/* contacts */}
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
          <p className="text-[10px] text-[#3a3855] uppercase tracking-widest px-2 pb-1 pt-1">Messages</p>
          {filtered.length === 0 && (
            <p className="text-xs text-[#3a3855] text-center mt-6">No users found</p>
          )}
          {filtered.map((u) => (
            <ContactItem
              key={u._id}
              user={u}
              active={activeChat === u.username}
              lastMsg={lastMsgs[u.username]}
              unread={unread[u.username] || 0}
              onClick={() => openChat(u.username)}
            />
          ))}
        </div>
      </aside>

      {/* mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── MAIN CHAT ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full">

        {/* no chat selected */}
        {!activeChat && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            {/* mobile menu btn */}
            <button
              className="md:hidden absolute top-4 left-4 text-[#6b6880] hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="text-6xl opacity-10" style={{ fontFamily: "'Syne', sans-serif" }}>⚡</div>
            <p className="text-[#3a3855] text-sm">Select a conversation to start</p>
          </div>
        )}

        {/* chat view */}
        {activeChat && (
          <>
            {/* chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] bg-[#08080f] flex-shrink-0">
              <button
                className="md:hidden text-[#6b6880] hover:text-white mr-1"
                onClick={() => setSidebarOpen(true)}
              >
                ←
              </button>
              <div className="relative">
                <Avatar name={activeChat} />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#08080f] rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {activeChat}
                </p>
                {isTyping ? (
                  <p className="text-xs text-violet-400 italic animate-pulse">typing...</p>
                ) : (
                  <p className="text-xs text-emerald-400">● online</p>
                )}
              </div>
              <div className="flex gap-2">
                {["◎", "▷"].map((icon, i) => (
                  <button
                    key={i}
                    className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[#6b6880] hover:text-violet-400 hover:border-violet-500/30 transition-all text-sm flex items-center justify-center"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 bg-[#050509]">
              {/* bg pattern */}
              <div
                className="fixed inset-0 pointer-events-none opacity-[0.018]"
                style={{
                  backgroundImage: "radial-gradient(circle, #a78bfa 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              {grouped.map((item, i) => {
                if (item.type === "label") {
                  return (
                    <div key={`label-${i}`} className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-white/[0.04]" />
                      <span className="text-[10px] text-[#3a3855] uppercase tracking-widest">{item.label}</span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                    </div>
                  );
                }
                const isSent = item.sender === currentUser;
                const prevMsg = grouped[i - 1];
                const showAvatar = !isSent && (
                  !prevMsg || prevMsg.type === "label" || prevMsg.sender !== item.sender
                );
                return (
                  <MessageBubble
                    key={item._id}
                    msg={item}
                    isSent={isSent}
                    showAvatar={showAvatar}
                    senderName={item.sender}
                  />
                );
              })}

              {isTyping && (
                <div className="flex items-end gap-2">
                  <Avatar name={activeChat} size="sm" />
                  <TypingDots />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* input bar */}
            <div className="px-4 py-3 border-t border-white/[0.05] bg-[#08080f] flex-shrink-0">
              <div className="flex items-end gap-2">
                <button className="w-9 h-9 flex-shrink-0 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[#6b6880] hover:text-violet-400 hover:border-violet-500/30 transition-all flex items-center justify-center text-sm">
                  +
                </button>

                <div className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-2.5 flex items-end gap-2 focus-within:border-violet-500/40 transition-all">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={onInputChange}
                    onKeyDown={onKey}
                    placeholder="Message..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-[#4a4865] resize-none max-h-28 outline-none leading-relaxed"
                    style={{ scrollbarWidth: "none" }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                  />
                  <span className="text-[10px] text-[#3a3855] pb-0.5 flex-shrink-0">↵</span>
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="w-9 h-9 flex-shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
              <p className="text-center text-[10px] text-[#2a2840] mt-2">
                End-to-end vibes only ⚡
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
