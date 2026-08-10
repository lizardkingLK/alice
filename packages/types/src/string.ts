/** Uppercase the first character; leave the rest unchanged. */
export function toNameCase(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
