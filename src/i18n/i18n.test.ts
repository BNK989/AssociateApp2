import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

describe('i18n Consistency', () => {
    const messagesDir = path.resolve(__dirname, '../../messages');
    const enPath = path.join(messagesDir, 'en.json');
    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

    // Get all other language files
    const otherLocales = fs
        .readdirSync(messagesDir)
        .filter((file) => file.endsWith('.json') && file !== 'en.json');

    const flattenKeys = (obj: any, prefix = ''): string[] => {
        return Object.keys(obj).reduce((acc: string[], key) => {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return acc.concat(flattenKeys(value, newKey));
            } else {
                return acc.concat(newKey);
            }
        }, []);
    };

    const enKeys = new Set(flattenKeys(enContent));

    otherLocales.forEach((localeFile) => {
        it(`should have all keys from en.json in ${localeFile}`, () => {
            const localePath = path.join(messagesDir, localeFile);
            const localeContent = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
            const localeKeys = new Set(flattenKeys(localeContent));

            const missingKeys: string[] = [];
            enKeys.forEach((key) => {
                if (!localeKeys.has(key)) {
                    missingKeys.push(key);
                }
            });

            expect(missingKeys, `Missing keys in ${localeFile}`).toEqual([]);
        });
    });
});
