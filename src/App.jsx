// src/App.jsx
import { useState } from "react";
import AuthPage from "./pages/AuthPage";

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) return <AuthPage onAuth={setUser} />;

  return <div>Welcome, {user.username}!</div>; // swap with ChatPage later
}