'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function AuthCodeError() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full text-center border border-gray-700">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-red-900/30 rounded-full">
                        <AlertTriangle className="w-12 h-12 text-red-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>

                <p className="text-gray-400 mb-8">
                    We couldn't sign you in. The login link may have expired or was already used. Please try signing in again.
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center justify-center w-full px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
