import React, { useState } from "react";
import type { DeviceAuthResponse } from "../../../shared/types";

export const MobileAuth: React.FC = () => {
  const [step, setStep] = useState<"register" | "verify" | "complete">("register");
  const [deviceName, setDeviceName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const detectDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/ipad|tablet/i.test(userAgent)) return "tablet";
    if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
    return "desktop";
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName,
          deviceType: detectDeviceType(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) throw new Error("Failed to register device");

      const data: DeviceAuthResponse = await response.json();
      setDeviceId(data.deviceId);
      setStep("verify");
    } catch (err) {
      setError("Failed to register device. Please try again.");
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
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          verificationCode,
        }),
      });

      if (!response.ok) throw new Error("Failed to verify device");

      const data: DeviceAuthResponse = await response.json();
      
      if (data.status === "approved") {
        setAuthToken(data.authToken);
        setStep("complete");
        
        // Save token to local storage
        localStorage.setItem("claude-webui-auth-token", data.authToken);
        localStorage.setItem("claude-webui-device-id", deviceId);
      } else if (data.status === "rejected") {
        setError("Device authorization was rejected");
        setStep("register");
      }
    } catch (err) {
      setError("Verification failed. Please check the code and try again.");
      console.error(err);
    } finally {
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
                    Verification Code (if required)
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter code"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying..." : "Check Authorization Status"}
                </button>
              </form>

              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
                Waiting for approval from the main interface...
              </p>
            </div>
          )}

          {step === "complete" && (
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                This token has been saved to your device and will be used for API access.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};