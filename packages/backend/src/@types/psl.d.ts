declare module 'psl' {
        export const enum ErrorCodes {
                DOMAIN_TOO_SHORT = 'Domain name too short',
                DOMAIN_TOO_LONG = 'Domain name too long. It should be no more than 255 chars.',
                LABEL_STARTS_WITH_DASH = 'Domain name label can not start with a dash.',
                LABEL_ENDS_WITH_DASH = 'Domain name label can not end with a dash.',
                LABEL_TOO_LONG = 'Domain name label should be at most 63 chars long.',
                LABEL_TOO_SHORT = 'Domain name label should be at least 1 character long.',
                LABEL_INVALID_CHARS = 'Domain name label can only contain alphanumeric characters or dashes.'
        }

        export type ParsedDomain = {
                input: string;
                tld: string | null;
                sld: string | null;
                domain: string | null;
                subdomain: string | null;
                listed: boolean;
        };

        export type ErrorResult<T extends keyof typeof ErrorCodes> = {
                input: string;
                error: {
                        code: T;
                        message: (typeof ErrorCodes)[T];
                };
        };

        export function parse(input: string): ParsedDomain | ErrorResult<keyof typeof ErrorCodes>;
        export function get(domain: string): string | null;
        export function isValid(domain: string): boolean;
}
