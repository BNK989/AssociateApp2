import LandingPage from '@/components/home/LandingPage';
import Lobby from "@/components/Lobby";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return <LandingPage />;
  }

  return (
    <div className="p-4">
      <Lobby />
    </div>
  );
}
