import { useState } from "react";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";

export default function App() {
  const [user, setUser] = useState(() => {
    // persist login across refresh
    const saved = sessionStorage.getItem("zync_user");
    return saved ? JSON.parse(saved) : null;
  });

  const handleAuth = (userData) => {
    sessionStorage.setItem("zync_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("zync_user");
    setUser(null);
  };

  if (!user) return <AuthPage onAuth={handleAuth} />;

  return <ChatPage currentUser={user.username} onLogout={handleLogout} />;
}
