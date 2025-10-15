import { Hono } from "hono";
import type { ConfigContext } from "../middleware/config.ts";

// Function to get all network interfaces
async function getNetworkInterfaces() {
  const interfaces: { [key: string]: string[] } = {};

  try {
    // Get hostname to determine actual network interfaces
    const hostname = await Deno.hostname();

    // Method 1: Try to get local IP by connecting to public DNS
    try {
      const conn = await Deno.connect({ hostname: "1.1.1.1", port: 80 });
      const localAddr = conn.localAddr as Deno.NetAddr;
      const localIp = localAddr.hostname;

      // Only add if it's a private IP address
      if (isPrivateIP(localIp)) {
        interfaces["primary"] = [localIp];
      }
      conn.close();
    } catch (e) {
      console.debug("Could not detect IP via DNS method:", e);
    }

    // Method 2: Try running system commands to get network interfaces
    try {
      let output = "";

      // Try different commands based on OS
      if (Deno.build.os === "windows") {
        const cmd = new Deno.Command("ipconfig", { args: [] });
        const result = await cmd.output();
        output = new TextDecoder().decode(result.stdout);

        // Parse Windows ipconfig output for IPv4 addresses
        const ipv4Regex = /IPv4.*?:\s*(\d+\.\d+\.\d+\.\d+)/g;
        let match;
        while ((match = ipv4Regex.exec(output)) !== null) {
          const ip = match[1];
          if (isPrivateIP(ip) && ip !== "127.0.0.1") {
            if (!interfaces["lan"]) interfaces["lan"] = [];
            if (!interfaces["lan"].includes(ip)) {
              interfaces["lan"].push(ip);
            }
          }
        }
      } else if (Deno.build.os === "darwin") {
        // macOS
        const cmd = new Deno.Command("ifconfig", { args: [] });
        const result = await cmd.output();
        output = new TextDecoder().decode(result.stdout);

        // Parse ifconfig output
        const inetRegex = /inet\s+(\d+\.\d+\.\d+\.\d+)/g;
        let match;
        while ((match = inetRegex.exec(output)) !== null) {
          const ip = match[1];
          if (isPrivateIP(ip) && ip !== "127.0.0.1") {
            if (!interfaces["lan"]) interfaces["lan"] = [];
            if (!interfaces["lan"].includes(ip)) {
              interfaces["lan"].push(ip);
            }
          }
        }
      } else {
        // Linux
        const cmd = new Deno.Command("hostname", { args: ["-I"] });
        const result = await cmd.output();
        output = new TextDecoder().decode(result.stdout);

        // Parse hostname -I output (space-separated IPs)
        const ips = output.trim().split(/\s+/);
        for (const ip of ips) {
          if (isPrivateIP(ip) && ip !== "127.0.0.1") {
            if (!interfaces["lan"]) interfaces["lan"] = [];
            if (!interfaces["lan"].includes(ip)) {
              interfaces["lan"].push(ip);
            }
          }
        }
      }
    } catch (e) {
      console.debug("Could not detect IPs via system commands:", e);
    }

    // Method 3: If no IPs found yet, try common private IP ranges
    if (!interfaces["lan"] || interfaces["lan"].length === 0) {
      // Try to find the actual IP by testing common gateway addresses
      const gateways = ["192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1"];

      for (const gateway of gateways) {
        try {
          const conn = await Deno.connect({
            hostname: gateway,
            port: 80,
            transport: "tcp",
          });
          const localAddr = conn.localAddr as Deno.NetAddr;
          const localIp = localAddr.hostname;

          if (isPrivateIP(localIp) && localIp !== "127.0.0.1") {
            if (!interfaces["lan"]) interfaces["lan"] = [];
            if (!interfaces["lan"].includes(localIp)) {
              interfaces["lan"].push(localIp);
              break; // Found one, that's enough
            }
          }
          conn.close();
        } catch {
          // Gateway not reachable, try next
        }
      }
    }
  } catch (error) {
    console.error("Failed to detect network interfaces:", error);
  }

  // Always include localhost for development
  interfaces["localhost"] = ["127.0.0.1"];

  // Add 0.0.0.0 as a fallback that binds to all interfaces
  if (
    (!interfaces["lan"] || interfaces["lan"].length === 0) &&
    Deno.build.os !== "windows"
  ) {
    interfaces["all"] = ["0.0.0.0"];
  }

  return interfaces;
}

// Helper function to check if an IP is in private range
function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;

  // 10.0.0.0 - 10.255.255.255
  if (parts[0] === 10) return true;

  // 172.16.0.0 - 172.31.255.255
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  // 192.168.0.0 - 192.168.255.255
  if (parts[0] === 192 && parts[1] === 168) return true;

  // 127.0.0.0 - 127.255.255.255 (loopback)
  if (parts[0] === 127) return true;

  return false;
}

export const networkHandler = new Hono<ConfigContext>()
  .get("/info", async (c) => {
    const config = c.get("config");
    const port = config?.port || 8080;

    // Get all network interfaces
    const interfaces = await getNetworkInterfaces();

    // Build connection URLs
    const urls: { type: string; url: string; qrCode?: string }[] = [];

    // Add localhost URL
    urls.push({
      type: "localhost",
      url: `http://localhost:${port}`,
    });

    // Add LAN URLs
    for (const [name, addresses] of Object.entries(interfaces)) {
      for (const address of addresses) {
        if (address !== "127.0.0.1") {
          urls.push({
            type: "lan",
            url: `http://${address}:${port}`,
          });
        }
      }
    }

    // Add WAN URL if available (would need to be configured or detected)
    const wanUrl = Deno.env.get("PUBLIC_URL");
    if (wanUrl) {
      urls.push({
        type: "wan",
        url: wanUrl,
      });
    }

    // Generate a simple connection token for mobile apps
    const connectionToken = crypto.randomUUID();

    return c.json({
      serverInfo: {
        name: "Claude Code Web UI",
        version: "1.0.0",
        port,
      },
      urls,
      connectionToken,
      timestamp: new Date().toISOString(),
    });
  })
  // Endpoint to generate QR code for easy mobile connection
  .get("/qr/:type", async (c) => {
    const type = c.req.param("type");
    const config = c.get("config");
    const port = config?.port || 8080;

    let url = "";

    if (type === "lan") {
      // Get first LAN IP
      const interfaces = await getNetworkInterfaces();
      for (const addresses of Object.values(interfaces)) {
        for (const address of addresses) {
          if (address !== "127.0.0.1") {
            url = `http://${address}:${port}/mobile-auth`;
            break;
          }
        }
        if (url) break;
      }
    } else if (type === "wan") {
      url = Deno.env.get("PUBLIC_URL") || "";
      if (url) {
        url += "/mobile-auth";
      }
    }

    if (!url) {
      return c.json({ error: "No URL available for type: " + type }, 404);
    }

    // For now, return the URL that would be encoded in QR
    // In production, you'd use a QR code library to generate an actual image
    return c.json({
      url,
      message:
        "QR code generation would happen here with a library like qr-image",
    });
  });
