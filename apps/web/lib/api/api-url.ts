export function getAPIUrl() {
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
}
