import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hammer, Globe, Activity, SlidersHorizontal } from 'lucide-react';

export default async function AdminDashboardPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;

    const tools = [
        {
            title: "Game Settings",
            description: "Tune the daily game's hints without a deploy.",
            href: `/${locale}/admin/game-settings`,
            icon: SlidersHorizontal,
            color: "text-emerald-500"
        },
        {
            title: "Translation Cache",
            description: "Inspect and verify daily game translations.",
            href: `/${locale}/admin/translations`,
            icon: Globe,
            color: "text-blue-500"
        },
        {
            title: "Test Playground",
            description: "Manage test games and inject mock data.",
            href: `/${locale}/admin/playground`,
            icon: Hammer,
            color: "text-purple-500",
            external: false
        },
        {
            title: "PostHog Debug",
            description: "Verify analytics and client-side events.",
            href: `/${locale}/admin/posthog`,
            icon: Activity,
            color: "text-orange-500",
            external: false
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tools.map((tool) => (
                    <Link key={tool.href} href={tool.href} target={tool.external ? "_blank" : undefined}>
                        <Card className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {tool.title}
                                </CardTitle>
                                <tool.icon className={`h-4 w-4 ${tool.color}`} />
                            </CardHeader>
                            <CardContent>
                                <CardDescription>
                                    {tool.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
