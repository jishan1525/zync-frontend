import { useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function AuthPage({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      triggerError("Please fill in all fields.");
      return;
    }
    if (password.length < 4) {
      triggerError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        triggerError(data.message || "Something went wrong.");
        setLoading(false);
        return;
      }

      // Pass username + token (if any) up to parent
      onAuth({ username: username.trim(), token: data.token || null });
    } catch {
      triggerError("Cannot reach server. Check your connection.");
      setLoading(false);
    }
  };

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    setError("");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-[#050509] flex items-center justify-center px-4 relative overflow-hidden">

  {/* Animated gradient background */}
  <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-indigo-900/20 animate-pulse" />

  {/* Glow blobs */}
  <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[160px]" />
  <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[140px]" />

  {/* Card */}
  <div className={`relative z-10 w-full max-w-sm transition-all duration-300 ${shake ? "animate-[shake_0.4s_ease]" : ""}`}>

    {/* Logo */}
    <div className="text-center mb-8">
      <div className="text-4xl font-black text-white tracking-tight flex items-center justify-center gap-2">
        <span className="text-violet-400 drop-shadow-[0_0_12px_#7c3aed]">⚡</span>
        Zync
      </div>
      <p className="text-[#7a78a1] text-xs tracking-widest uppercase mt-2">
        {isLogin ? "Welcome back" : "Create your account"}
      </p>
    </div>

    {/* Glass Card */}
    <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-7 shadow-[0_10px_80px_#00000060]">

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Username */}
        <div>
          <label className="text-xs text-[#7a78a1] uppercase tracking-widest">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            className="mt-1 w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
            placeholder="thundercat99"
          />
        </div>

        {/* Password */}
        <div>
          <label className="text-xs text-[#7a78a1] uppercase tracking-widest">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            className="mt-1 w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
            placeholder="••••••••"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}

        {/* Button */}
        <button
          type="submit"
          disabled={loading}
          className="relative mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl transition-all duration-300 overflow-hidden group"
        >
          <span className={`${loading ? "opacity-0" : "opacity-100"}`}>
            {isLogin ? "Sign In" : "Create Account"}
          </span>

          {/* Shine effect */}
          <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 blur-md transition-all"></span>

          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </span>
          )}
        </button>

      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[#5c5a7a] text-xs">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Toggle */}
      <p className="text-center text-[#5c5a7a] text-sm">
        {isLogin ? "New here?" : "Already have an account?"}
        <button
          onClick={toggleMode}
          className="ml-2 text-violet-400 hover:text-violet-300"
        >
          {isLogin ? "Register" : "Login"}
        </button>
      </p>
    </div>

    {/* Footer */}
    <p className="text-center text-[#3a3855] text-xs mt-6">
      Fast. Clean. Connected.
    </p>
  </div>
</div>
  );
}
