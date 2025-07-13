import React, { useEffect, useState } from "react";
import type { Device } from "../../../shared/types";
import { API_BASE_URL } from "../config/api";

export const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // Fetch devices
  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/devices`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      
      const data = await response.json();
      setDevices(data.devices);
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch network info
  const fetchNetworkInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/info`);
      if (!response.ok) throw new Error("Failed to fetch network info");
      
      const data = await response.json();
      setNetworkInfo(data);
    } catch (error) {
      console.error("Error fetching network info:", error);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchNetworkInfo();
  }, []);

  const handleRevoke = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke access for this device?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/devices/${deviceId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke device");
      
      // Update the local state
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch (error) {
      console.error("Error revoking device:", error);
    }
  };

  const getStatusColor = (status: Device["status"]) => {
    switch (status) {
      case "approved":
        return "text-green-600 dark:text-green-400";
      case "pending":
        return "text-yellow-600 dark:text-yellow-400";
      case "rejected":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Device Management</h2>

      {/* Connection Info Section */}
      {networkInfo && (
        <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="font-semibold mb-3 dark:text-white">Connection URLs</h3>
          <div className="space-y-2">
            {networkInfo.urls.map((url: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium dark:text-gray-300">
                    {url.type.toUpperCase()}:
                  </span>
                  <code className="ml-2 text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {url.url}
                  </code>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(url.url)}
                  className="text-blue-500 hover:text-blue-600 text-sm"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Share these URLs with your mobile device to connect
          </p>
        </div>
      )}

      {/* Devices List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold dark:text-white">Connected Devices</h3>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            Loading devices...
          </div>
        ) : devices.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No devices connected yet
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {devices.map((device) => (
              <div key={device.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      {device.type === "mobile" && "📱"}
                      {device.type === "tablet" && "📋"}
                      {device.type === "desktop" && "💻"}
                    </div>
                    <div>
                      <h4 className="font-medium dark:text-white">{device.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className={getStatusColor(device.status)}>
                          {device.status}
                        </span>
                        <span>•</span>
                        <span>Last active: {new Date(device.lastActiveAt).toLocaleString()}</span>
                        {device.ipAddress && (
                          <>
                            <span>•</span>
                            <span>IP: {device.ipAddress}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {device.status === "approved" && (
                  <button
                    onClick={() => handleRevoke(device.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md"
                  >
                    Revoke Access
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <h4 className="font-semibold mb-2 dark:text-white">How to connect a mobile device:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>Open your mobile browser and navigate to one of the connection URLs above</li>
          <li>Enter the device name when prompted</li>
          <li>You'll see an authorization request appear here</li>
          <li>Click "Approve" to grant access to the device</li>
          <li>The mobile device will receive an authentication token for API access</li>
        </ol>
      </div>
    </div>
  );
};