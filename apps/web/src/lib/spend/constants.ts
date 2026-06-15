export const ACCOUNT_NUMBER_LENGTH = 10;
export const ACCOUNT_NUMBER_REGEX = /^[0-9]{10}$/;

export const FAVOURITES_STORAGE_KEY = "jahpay-spend-favourites";

export function isValidAccountNumber(value: string): boolean {
  return ACCOUNT_NUMBER_REGEX.test(value);
}

export function sanitizeAccountInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH);
}

export function getBankInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
