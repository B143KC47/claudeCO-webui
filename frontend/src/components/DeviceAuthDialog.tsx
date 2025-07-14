import React, { useEffect, useState } from "react";
import type { Device } from "../../../shared/types";

interface DeviceAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceAuthDialog: React.FC<DeviceAuthDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [pendingDevices, setPendingDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch pending devices
  const fetchPendingDevices = async () => {
    try {
      const response = await fetch("/api/auth/devices");
      if (!response.ok) throw new Error("Failed to fetch devices");
      
      const data = await response.json();
      const pending = data.devices.filter((d: Device) => d.status === "pending");
      setPendingDevices(pending);
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendingDevices();
      // Poll for new devices every 2 seconds
      const interval = setInterval(fetchPendingDevices, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleAuthorize = async (deviceId: string, action: "approve" | "reject") => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, action }),
      });

      if (!response.ok) throw new Error("Failed to authorize device");
      
      // Remove the device from pending list
      setPendingDevices(prev => prev.filter(d => d.id !== deviceId));
      
      // Show success message
      const message = action === "approve" ? "Device approved" : "Device rejected";
      console.log(message);
    } catch (error) {
      console.error("Error authorizing device:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-white">
              Device Authorization Requests
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {pendingDevices.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No pending device authorization requests
            </p>
          ) : (
            <div className="space-y-4">
              {pendingDevices.map((device) => (
                <div
                  key={device.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="mb-3">
                    <h3 className="font-semibold dark:text-white">
                      Is this your device?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {device.name} ({device.type})
                    </p>
                    {device.ipAddress && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        IP: {device.ipAddress}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Requested: {new Date(device.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAuthorize(device.id, "approve")}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAuthorize(device.id, "reject")}
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};