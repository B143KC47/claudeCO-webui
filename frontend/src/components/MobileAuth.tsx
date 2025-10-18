import React, { useEffect, useState } from "react";
import type { DeviceAuthResponse } from "../../../shared/types";
import { api } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

export const MobileAuth: React.FC = () => {
  const [step, setStep] = useState<"register" | "verify" | "complete">(
    "register",
  );
  const [deviceName, setDeviceName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Only connect WebSocket after we have a valid deviceId (after registration)
  // This prevents connecting with empty deviceId which causes backend tracking issues
  const shouldConnectWebSocket = deviceId.length > 0 && step === "verify";

  // WebSocket connection for real-time updates
  // Conditionally initialized only when we have a deviceId
  const { isConnected, connectionState } = useWebSocket({
    deviceId: shouldConnectWebSocket ? deviceId : undefined,
    clientType: "device",
    onMessage: (message) => {
      // Handle authorization updates
      if (message.type === "approved" && message.authToken) {
        setAuthToken(message.authToken);
        setStep("complete");
        // Save token to local storage
        localStorage.setItem("authToken", message.authToken);
        localStorage.setItem("deviceId", deviceId);
        setLoading(false);
      } else if (message.type === "rejected") {
        setError("Device authorization was rejected");
        setLoading(false);
      }
    },
    autoReconnect: shouldConnectWebSocket,
  });

  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/ipad|tablet/i.test(userAgent)) return "tablet";
    if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
    return "desktop";
  };

  // Extract session token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    if (session) {
      setSessionToken(session);
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data: DeviceAuthResponse = await api.auth.register({
        deviceName,
        deviceType: detectDeviceType(),
        userAgent: navigator.userAgent,
        sessionToken, // Include session token for validation
      });
      setDeviceId(data.deviceId);
      // Pre-fill verification code if provided by backend
      if (data.verificationCode) {
        setVerificationCode(data.verificationCode);
      }
      setStep("verify");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to register device. Please try again.",
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Send verification code to backend
      const data: DeviceAuthResponse = await api.auth.verify({
        deviceId,
        verificationCode,
      });

      console.log("Verification sent, waiting for approval...");

      // Fallback to polling if WebSocket doesn't connect within 10 seconds
      // This ensures the user isn't stuck if WebSocket fails
      const fallbackTimer = setTimeout(() => {
        if (!isConnected) {
          console.warn("WebSocket not connected, falling back to polling...");
          startPolling();
        }
      }, 10000);

      // Cleanup timer if WebSocket connects
      const checkConnection = setInterval(() => {
        if (isConnected) {
          clearTimeout(fallbackTimer);
          clearInterval(checkConnection);
        }
      }, 1000);

      // Fallback polling function
      const startPolling = async () => {
        let attempts = 0;
        const maxAttempts = 60; // 2 minutes max (2s interval)

        const poll = async () => {
          if (attempts >= maxAttempts) {
            setError("Authorization timeout. Please try again.");
            setLoading(false);
            return;
          }

          try {
            const statusData: DeviceAuthResponse =
              await api.auth.verifyStatus(deviceId);

            if (statusData.status === "approved" && statusData.authToken) {
              // Success!
              setAuthToken(statusData.authToken);
              setStep("complete");
              localStorage.setItem("authToken", statusData.authToken);
              localStorage.setItem("deviceId", deviceId);
              setLoading(false);
            } else if (statusData.status === "rejected") {
              setError("Device authorization was rejected");
              setLoading(false);
            } else {
              // Still pending - continue polling
              attempts++;
              setTimeout(poll, 2000);
            }
          } catch (error) {
            console.error("Polling error:", error);
            attempts++;
            setTimeout(poll, 2000);
          }
        };

        poll();
      };
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Please check the code and try again.",
      );
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-center mb-6 dark:text-white">
            Claude Web UI - Mobile Access
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {step === "register" && (
            <form onSubmit={handleRegister}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 dark:text-gray-200">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g., John's iPhone"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !deviceName}
                className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Registering..." : "Register Device"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <div>
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm dark:text-gray-300">
                  A verification request has been sent to the web interface.
                  Please approve this device in the Claude Web UI to continue.
                </p>
              </div>

              <form onSubmit={handleVerify}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 dark:text-gray-200">
                    Verification Code *
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.toUpperCase())
                    }
                    placeholder="Enter 8-character code"
                    required
                    maxLength={8}
                    pattern="[A-Z0-9]{8}"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-xl font-mono tracking-wider"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter the 8-character alphanumeric code displayed on the
                    desktop
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 8}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying..." : "Verify and Connect"}
                </button>
              </form>

              {loading ? (
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Waiting for approval from desktop...
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      Real-time updates enabled
                    </p>
                  </div>

                  {/* WebSocket Connection Status */}
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConnected
                          ? "bg-green-500"
                          : "bg-yellow-500 animate-pulse"
                      }`}
                    ></div>
                    <span className="text-gray-500 dark:text-gray-400">
                      {connectionState === "connected"
                        ? "Connected - Live updates active"
                        : connectionState === "connecting"
                          ? "Connecting to server..."
                          : "Reconnecting..."}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                  Enter the verification code to continue...
                </p>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2 dark:text-white">
                  Device Authorized!
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Your device has been successfully authorized.
                </p>
              </div>

              <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-sm font-medium mb-2 dark:text-gray-200">
                  Authentication Token:
                </p>
                <code className="text-xs break-all dark:text-gray-300">
                  {authToken.substring(0, 20)}...
                </code>
              </div>

              <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                This token has been saved to your device and will be used for
                API access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
