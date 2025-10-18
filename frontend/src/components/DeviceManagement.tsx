import React, { useEffect, useState } from "react";
import {
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
  ClockIcon,
  SignalIcon,
  DocumentDuplicateIcon,
  CheckBadgeIcon,
  ClockIcon as ClockBadgeIcon,
  XCircleIcon,
  InformationCircleIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { QRCodeSVG } from "qrcode.react";
import type {
  Device,
  NetworkInfo,
  NetworkUrl,
  QRSessionResponse,
} from "../../../shared/types";
import { useToast } from "../contexts/ToastContext";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { DeviceCardSkeleton } from "./common/SkeletonLoader";
import { NoDevicesEmptyState } from "./common/EmptyState";

export const DeviceManagement: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<Device | null>(null);
  const [qrSessions, setQrSessions] = useState<Map<string, QRSessionResponse>>(
    new Map(),
  );
  const [timeRemaining, setTimeRemaining] = useState<Map<string, number>>(
    new Map(),
  );
  const { showSuccess, showError } = useToast();

  // Fetch devices
  const fetchDevices = async () => {
    try {
      const response = await fetch(`/api/auth/devices`);
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
      const response = await fetch(`/api/network/info`);
      if (!response.ok) throw new Error("Failed to fetch network info");

      const data = await response.json();
      setNetworkInfo(data);
    } catch (error) {
      console.error("Error fetching network info:", error);
    }
  };

  // Generate QR session for a specific URL
  const generateQRSession = async (urlKey: string) => {
    try {
      const response = await fetch("/api/auth/create-session", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to create QR session");

      const data: QRSessionResponse = await response.json();
      setQrSessions((prev) => new Map(prev).set(urlKey, data));
      setTimeRemaining((prev) => new Map(prev).set(urlKey, 300)); // 5 minutes
    } catch (error) {
      console.error("Error generating QR session:", error);
      showError("QR Generation Failed", "Failed to generate QR code session");
    }
  };

  // Generate QR sessions for all URLs on mount
  useEffect(() => {
    fetchDevices();
    fetchNetworkInfo();
  }, []);

  // Generate QR sessions when network info is available
  useEffect(() => {
    if (networkInfo) {
      networkInfo.urls.forEach((_, index) => {
        generateQRSession(`url-${index}`);
      });
    }
  }, [networkInfo]);

  // Countdown timer for QR expiration
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newMap = new Map(prev);
        for (const [key, time] of newMap) {
          const remaining = time - 1;
          if (remaining <= 0) {
            // Auto-refresh expired QR codes
            generateQRSession(key);
          } else {
            newMap.set(key, remaining);
          }
        }
        return newMap;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRevokeClick = (device: Device) => {
    setDeviceToRevoke(device);
  };

  const handleRevokeConfirm = async () => {
    if (!deviceToRevoke) return;

    try {
      const response = await fetch(`/api/auth/devices/${deviceToRevoke.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to revoke device");

      // Update the local state
      setDevices((prev) => prev.filter((d) => d.id !== deviceToRevoke.id));
      showSuccess(
        "Device Revoked",
        `Access for "${deviceToRevoke.name}" has been revoked successfully.`,
      );
    } catch (error) {
      console.error("Error revoking device:", error);
      showError(
        "Revoke Failed",
        "Failed to revoke device access. Please try again.",
      );
    } finally {
      setDeviceToRevoke(null);
    }
  };

  const getDeviceIcon = (type: Device["type"]) => {
    switch (type) {
      case "mobile":
        return DevicePhoneMobileIcon;
      case "tablet":
        return DeviceTabletIcon;
      case "desktop":
        return ComputerDesktopIcon;
      default:
        return DevicePhoneMobileIcon;
    }
  };

  const getStatusConfig = (status: Device["status"]) => {
    switch (status) {
      case "approved":
        return {
          icon: CheckBadgeIcon,
          text: "Approved",
          className: "bg-green-500/20 text-green-400 border-green-500/30",
        };
      case "pending":
        return {
          icon: ClockBadgeIcon,
          text: "Pending",
          className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        };
      case "rejected":
        return {
          icon: XCircleIcon,
          text: "Rejected",
          className: "bg-red-500/20 text-red-400 border-red-500/30",
        };
      default:
        return {
          icon: InformationCircleIcon,
          text: "Unknown",
          className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        };
    }
  };

  const formatLastActive = (date: string) => {
    const now = Date.now();
    const lastActive = new Date(date).getTime();
    const diff = now - lastActive;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-primary text-gradient mb-2">
          Device Management
        </h2>
        <p className="text-secondary">
          Manage connected devices and mobile access
        </p>
      </div>

      {/* Connection URLs Section */}
      {networkInfo && (
        <div className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <GlobeAltIcon className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-semibold text-primary">
                Connection URLs
              </h3>
            </div>

            <div className="space-y-3">
              {networkInfo.urls.map((url: NetworkUrl, index: number) => {
                const urlKey = `url-${index}`;
                const session = qrSessions.get(urlKey);
                const time = timeRemaining.get(urlKey) || 0;
                const minutes = Math.floor(time / 60);
                const seconds = time % 60;

                if (!session) return null; // Wait for session to be generated

                const mobileAuthUrl = `${url.url}/mobile-auth?session=${session.sessionToken}`;

                // Detect localhost URLs - these won't work on mobile devices
                const isLocalhostUrl =
                  url.url.includes("localhost") ||
                  url.url.includes("127.0.0.1");

                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-black-quaternary/50 border border-accent/10 hover:border-accent/30 smooth-transition"
                  >
                    <div className="flex flex-col md:flex-row items-start gap-4">
                      {/* QR Code */}
                      <div className="flex-shrink-0 p-3 bg-white rounded-lg border-2 border-accent/30">
                        <QRCodeSVG
                          value={mobileAuthUrl}
                          size={140}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      {/* URL Info and Verification Code */}
                      <div className="flex-1 min-w-0 flex flex-col gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-accent/20 text-accent text-xs font-semibold rounded-full border border-accent/30">
                              {url.type.toUpperCase()}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                                time < 60
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              }`}
                            >
                              {minutes}:{seconds.toString().padStart(2, "0")}
                            </span>
                          </div>
                          <code className="text-sm text-primary font-mono break-all">
                            {url.url}
                          </code>
                        </div>

                        {/* Verification Code Display */}
                        <div className="p-4 bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl border-2 border-accent/30">
                          <p className="text-xs text-secondary mb-2 font-medium">
                            Verification Code:
                          </p>
                          <p className="text-4xl font-bold text-primary text-center tracking-[0.5em] font-mono">
                            {session.verificationCode}
                          </p>
                          <p className="text-xs text-secondary mt-2 text-center">
                            Mobile user must enter this code
                          </p>
                        </div>

                        {/* Copy Button */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(mobileAuthUrl);
                            showSuccess(
                              "URL Copied",
                              "Connection URL copied to clipboard",
                            );
                          }}
                          className="self-start px-4 py-2 bg-gradient-primary/20 hover:bg-gradient-primary/30 rounded-lg border border-accent/30 hover:border-accent/50 smooth-transition group flex items-center gap-2"
                          title="Copy URL"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4 text-accent group-hover:scale-110 smooth-transition" />
                          <span className="text-sm text-accent font-medium">
                            Copy URL
                          </span>
                        </button>

                        {/* Localhost Warning for Mobile Devices */}
                        {isLocalhostUrl && (
                          <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                            <p className="text-xs text-yellow-400 flex items-start gap-2">
                              <span className="text-base">⚠️</span>
                              <span>
                                <strong>Desktop only:</strong> This localhost
                                URL only works on this computer. Mobile devices
                                cannot access localhost. Please use the LAN URL
                                above instead.
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-black-quaternary/50 rounded-lg">
              <p className="text-xs text-secondary">
                <span className="font-medium text-primary">Security:</span> Each
                QR code is unique and expires after 5 minutes. Mobile users must
                enter the verification code shown above for secure
                authentication.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connected Devices */}
      <div className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <SignalIcon className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-primary">
              Connected Devices
              {devices.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-accent/20 text-accent text-xs font-semibold rounded-full">
                  {devices.length}
                </span>
              )}
            </h3>
          </div>

          {loading ? (
            <DeviceCardSkeleton count={3} />
          ) : devices.length === 0 ? (
            <NoDevicesEmptyState />
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.type);
                const statusConfig = getStatusConfig(device.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={device.id}
                    className="p-4 rounded-xl bg-black-quaternary/50 border border-accent/10 hover:border-accent/30 smooth-transition group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Device Info */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Device Icon */}
                        <div className="flex-shrink-0 p-3 bg-gradient-primary/20 rounded-xl border border-accent/30 group-hover:scale-105 smooth-transition">
                          <DeviceIcon className="h-6 w-6 text-accent" />
                        </div>

                        {/* Device Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-primary truncate">
                              {device.name}
                            </h4>
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full border flex items-center gap-1 ${statusConfig.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.text}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-secondary">
                              <ClockIcon className="h-3 w-3 text-accent" />
                              <span>
                                Last active:{" "}
                                {formatLastActive(device.lastActiveAt)}
                              </span>
                            </div>
                            {device.ipAddress && (
                              <div className="flex items-center gap-2 text-xs text-tertiary">
                                <SignalIcon className="h-3 w-3" />
                                <span>IP: {device.ipAddress}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {device.status === "approved" && (
                        <button
                          onClick={() => handleRevokeClick(device)}
                          className="flex-shrink-0 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg border border-red-500/30 hover:border-red-500/50 smooth-transition text-sm font-medium hover:scale-105"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="glass-card p-6 progressive-blur-light border border-accent/20 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <InformationCircleIcon className="h-5 w-5 text-accent" />
            <h3 className="text-lg font-semibold text-primary">
              How to Connect
            </h3>
          </div>

          <ol className="space-y-3 text-sm">
            {[
              "Scan the QR code above with your mobile camera, or manually navigate to a connection URL",
              "Enter a device name when prompted (e.g., 'Sarah's iPhone')",
              "An authorization request will appear on this desktop interface",
              "Click 'Approve' to grant secure access to the device",
              "Your mobile device will receive an authentication token and can start using the application",
            ].map((step, index) => (
              <li key={index} className="flex items-start gap-3 text-secondary">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-accent/20 text-accent rounded-full text-xs font-bold border border-accent/30">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deviceToRevoke}
        onClose={() => setDeviceToRevoke(null)}
        onConfirm={handleRevokeConfirm}
        title="Revoke Device Access"
        message={`Are you sure you want to revoke access for "${deviceToRevoke?.name}"? This device will no longer be able to connect to the application.`}
        confirmText="Revoke Access"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};
