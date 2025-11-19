'use client';

import { useAuth } from "@/context/AuthProvider";
import Login from "@/components/Login";
import Lobby from "@/components/Lobby";

export default function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="p-4">
      <Lobby />
    </div>
  );
}
