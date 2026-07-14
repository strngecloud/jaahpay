import { ValueTransformer } from 'typeorm';

/**
 * Postgres `decimal` columns come back from the driver as strings. Without
 * this transformer every numeric field on our entities is a string at
 * runtime, so arithmetic like `dailySpentUsdc += usdcAmount` silently
 * concatenates instead of adding.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null): number | null | undefined => value,
  from: (value?: string | null): number | null =>
    value == null ? null : parseFloat(value),
};
