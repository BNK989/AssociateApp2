'use client';

import { useAuth } from "@/context/AuthProvider";
import LandingPage from '@/components/home/LandingPage';
import Lobby from "@/components/Lobby";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32 md:w-48 rounded-lg" />
          <Skeleton className="h-10 w-32 md:w-40 rounded-lg" />
        </div>

        {/* Daily Challenge Card */}
        <Skeleton className="h-32 md:h-40 w-full rounded-2xl" />

        {/* Game Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
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
