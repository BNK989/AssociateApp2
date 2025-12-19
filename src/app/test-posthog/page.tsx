"use client";

import { useState, useEffect } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";

export default function TestPostHog() {
    const { isAdmin, loading } = useAdmin();
    const [isReady, setIsReady] = useState(false);
    const [distinctId, setDistinctId] = useState<string>("");

    useEffect(() => {
        // Check if posthog is loaded
        if (posthog.__loaded) {
            setIsReady(true);
            setDistinctId(posthog.get_distinct_id());
        } else {
            posthog.onFeatureFlags(() => {
                setIsReady(true);
                setDistinctId(posthog.get_distinct_id());
            });
        }
    }, []);

    const triggerError = () => {
        throw new Error("This is a manually triggered client-side test error form /test-posthog");
    };

    const captureEvent = () => {
        posthog.capture("manual_test_event", { test: true });
        alert("Event captured! Check 'Activity' in PostHog.");
    };

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    if (!isAdmin) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <h1 className="text-2xl font-bold text-red-500">Unauthorized</h1>
                <p className="text-muted-foreground">Only administrators can view this page.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">PostHog Verification</h1>

            <div className="p-4 border rounded bg-muted/50">
                <h2 className="font-semibold mb-2">Status</h2>
                <div className="grid grid-cols-2 gap-2">
                    <span>Library Loaded:</span>
                    <span className={isReady ? "text-green-600 font-bold" : "text-red-500"}>
                        {isReady ? "YES" : "NO"}
                    </span>
                    <span>Distinct ID:</span>
                    <span className="font-mono text-xs">{distinctId || "..."}</span>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="font-semibold">Actions</h2>
                <div className="flex gap-4">
                    <Button onClick={captureEvent} variant="secondary">
                        Capture Test Event
                    </Button>
                    <Button onClick={triggerError} variant="destructive">
                        Trigger Error (Crash App)
                    </Button>
                </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-muted-foreground">
                <p>
                    <strong>For Feedback:</strong> If you have enabled the Feedback widget in your PostHog Project Settings,
                    it should appear on this page (or globally) automatically.
                </p>
            </div>
        </div>
    );
}
