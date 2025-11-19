'use client';

import { useAuth } from "@/context/AuthProvider";
import Login from "@/components/Login";
import Settings from "@/components/Settings";
import Lobby from "@/components/Lobby";
import { useState } from "react";

export default function Home() {
  const { session, loading } = useAuth();
  const [view, setView] = useState<'lobby' | 'settings'>('lobby');

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="p-4">
      <nav className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-xl font-bold">Associate Game 2.0</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setView('lobby')}
            className={`px-3 py-1 rounded ${view === 'lobby' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Lobby
          </button>
          <button
            onClick={() => setView('settings')}
            className={`px-3 py-1 rounded ${view === 'settings' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Settings
          </button>
        </div>
      </nav>

      {view === 'settings' && <Settings />}

      {view === 'lobby' && <Lobby />}
    </div>
  );
}
