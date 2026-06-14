const TOKEN_SPLIT = /[,;\s]+/;

export function parseSearchTokens(raw: string): string[] {
  return raw
    .split(TOKEN_SPLIT)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function matchEmployee(
  emp: { name: string; email: string },
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;
  const name = emp.name.toLowerCase();
  const email = emp.email.toLowerCase();
  return tokens.some((token) => {
    if (token.includes("@")) return email === token;
    return name.includes(token) || email.includes(token);
  });
}

export function flattenPastedList(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}
