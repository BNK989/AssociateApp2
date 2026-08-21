
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { createLogger } from '@/lib/logger';

const log = createLogger('utils');


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getURL(path: string = '') {
  // Check if we are on the client side
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }

  // Server-side: use environment variables
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process.env.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/';

  // Include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`;

  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;

  // Remove the trailing slash from the base URL if the path also starts with one, 
  // or just concatenate if path is empty or clean.
  // Actually simpler: Make sure base has NO trailing slash, and path starts WITH slash.

  // Normalize base url to NOT have trailing slash
  url = url.endsWith('/') ? url.slice(0, -1) : url;

  // Normalize path to HAVE leading slash if it exists
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';

  return `${url}${normalizedPath}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-secure contexts (like HTTP IP access)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  } catch (err) {
    log.error('copy_to_clipboard', 'Failed to copy text to clipboard', undefined, err);
    return false;
  }
}
