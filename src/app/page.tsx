'use client';

import { useAuth } from "@/context/AuthProvider";
import LandingPage from '@/components/home/LandingPage';
import Lobby from "@/components/Lobby";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-12 w-3/4 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return (
    <div className="p-4">
      <Lobby />
    </div>
  );
}
