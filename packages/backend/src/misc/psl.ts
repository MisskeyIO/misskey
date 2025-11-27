import { parse } from 'psl';

type PslParseResult = ReturnType<typeof parse>;
type PslErrorResult = Extract<PslParseResult, { error: unknown }>;

export const isPslError = (result: PslParseResult): result is PslErrorResult => 'error' in result;
