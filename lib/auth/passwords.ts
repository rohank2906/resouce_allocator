export function firstNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.split(".")[0]?.toLowerCase() ?? "";
}

export function defaultPasswordFor(email: string): string {
  return `${firstNameFromEmail(email)}@123`;
}
