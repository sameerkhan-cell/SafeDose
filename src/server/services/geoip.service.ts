export class GeoIPService {
  static async resolveLocation(ip: string | undefined | null): Promise<string> {
    if (!ip || ip === "Unknown") return "Unknown Location";

    // Skip lookup for local/private IPs (common during development)
    const isLocal = 
      ip === "127.0.0.1" || ip === "::1" || ip.startsWith("::ffff:127.") ||
      ip.startsWith("10.") || ip.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
    if (isLocal) return "Local Network";

    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country`, {
        signal: AbortSignal.timeout(3000) // don't let a slow geoIP call block login
      });
      const data = await res.json();
      if (data.status === "success") {
        return [data.city, data.country].filter(Boolean).join(", ") || "Unknown Location";
      }
      return "Unknown Location";
    } catch {
      return "Unknown Location"; // never let geoIP failure break login
    }
  }
}
