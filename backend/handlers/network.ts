import { Hono } from "hono";
import type { ConfigContext } from "../middleware/config.ts";

// Function to get all network interfaces
async function getNetworkInterfaces() {
  const interfaces: { [key: string]: string[] } = {};
  
  try {
    // Use Deno's network API to determine local IP
    // Connect to a public DNS server to find our local IP
    const conn = await Deno.connect({ hostname: "8.8.8.8", port: 80 });
    const localAddr = conn.localAddr as Deno.NetAddr;
    interfaces["primary"] = [localAddr.hostname];
    conn.close();
    
    // Also check for common local network addresses
    const possibleIPs = [
      "192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1"
    ];
    
    for (const testIP of possibleIPs) {
      try {
        const testConn = await Deno.connect({ hostname: testIP, port: 80 });
        const testAddr = testConn.localAddr as Deno.NetAddr;
        if (!interfaces["local"]) {
          interfaces["local"] = [];
        }
        if (!interfaces["local"].includes(testAddr.hostname)) {
          interfaces["local"].push(testAddr.hostname);
        }
        testConn.close();
      } catch {
        // Ignore connection failures
      }
    }
  } catch (error) {
    console.error("Failed to detect network interfaces:", error);
    // Default to localhost
    interfaces["localhost"] = ["127.0.0.1"];
  }
  
  // Always include localhost
  if (!interfaces["localhost"]) {
    interfaces["localhost"] = ["127.0.0.1"];
  }
  
  return interfaces;
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
      message: "QR code generation would happen here with a library like qr-image",
    });
  });