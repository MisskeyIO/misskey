export function normalizeInstanceUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Instance URL is required');

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Unsupported protocol');
  }

  return `${url.protocol}//${url.host}`;
}
