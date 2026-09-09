import { describe, it, expect } from 'vitest';
import {
    SHARE_REF_PARAM,
    buildAppShareMessage,
    buildAppShareUrl,
    isShareDismissal,
} from './appShare';

describe('buildAppShareUrl', () => {
    it('tags the link with the surface it was shared from', () => {
        expect(buildAppShareUrl('https://associ8.app', 'lobby_card'))
            .toBe(`https://associ8.app/?${SHARE_REF_PARAM}=lobby_card`);
    });

    it('keeps a trailing slash from turning into a double slash', () => {
        expect(buildAppShareUrl('https://associ8.app/', 'landing_header'))
            .toBe(`https://associ8.app/?${SHARE_REF_PARAM}=landing_header`);
    });

    it('replaces an existing ref rather than appending a second one', () => {
        const once = buildAppShareUrl('https://associ8.app/?ref=lobby_header', 'lobby_card');
        expect(once).toBe(`https://associ8.app/?${SHARE_REF_PARAM}=lobby_card`);
    });

    it('preserves unrelated query parameters', () => {
        expect(buildAppShareUrl('https://associ8.app/?utm_source=x', 'lobby_header'))
            .toBe(`https://associ8.app/?utm_source=x&${SHARE_REF_PARAM}=lobby_header`);
    });

    it('still produces a usable link when the base is not absolute', () => {
        expect(buildAppShareUrl('/daily', 'lobby_header'))
            .toBe(`/daily?${SHARE_REF_PARAM}=lobby_header`);
    });
});

describe('buildAppShareMessage', () => {
    it('puts the link on its own line so previews attach to it', () => {
        expect(buildAppShareMessage('Play Associate with me', 'https://associ8.app/'))
            .toBe('Play Associate with me\n\nhttps://associ8.app/');
    });
});

describe('isShareDismissal', () => {
    it('treats an AbortError as the player closing the sheet', () => {
        const error = new Error('share canceled');
        error.name = 'AbortError';
        expect(isShareDismissal(error)).toBe(true);
    });

    it('recognises a dismissal reported only in the message', () => {
        expect(isShareDismissal(new Error('Share canceled by user'))).toBe(true);
        expect(isShareDismissal('AbortError: share aborted')).toBe(true);
    });

    it('does not swallow a real failure', () => {
        const error = new Error('Permission denied');
        error.name = 'NotAllowedError';
        expect(isShareDismissal(error)).toBe(false);
        expect(isShareDismissal(undefined)).toBe(false);
    });
});
