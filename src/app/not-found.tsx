'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push('/');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full text-center border border-gray-200 dark:border-gray-700">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                        <FileQuestion className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>

                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    The page you are looking for doesn't exist or has been moved.
                </p>

                <div className="space-y-4">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Home
                    </Link>

                    <p className="text-sm text-gray-500 dark:text-gray-500">
                        Redirecting in {countdown} seconds...
                    </p>
                </div>
            </div>
        </div>
    );
}
