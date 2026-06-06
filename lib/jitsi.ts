export function generateRoomName(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const random = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `iwan-${prefix}-${random}`;
}

export const JITSI_DOMAIN = "meet.jit.si";
