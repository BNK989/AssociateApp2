"use client"

import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";

export function DynamicToaster() {
    const pathname = usePathname();
    const isGamePage = pathname?.startsWith('/game/');

    return (
        <Toaster
            position={isGamePage ? "bottom-center" : "top-center"}
            closeButton
            toastOptions={{
                style: isGamePage ? { marginBottom: '65px' } : undefined
            }}
        />
    );
}
