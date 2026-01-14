import { createNavigation } from 'next-intl/navigation';
import { routing } from './proxy';

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
