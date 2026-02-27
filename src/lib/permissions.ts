export const ROLE_LEVELS: Record<string, number> = {
  host: 1,
  reception: 2,
  site_admin: 3,
}

export function hasMinRole(role: string, required: string): boolean {
  return (ROLE_LEVELS[role] ?? 0) >= (ROLE_LEVELS[required] ?? 0)
}
