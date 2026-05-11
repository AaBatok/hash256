const { execSync } = require("child_process");

/**
 * Detect GPU device name from the system.
 * Tries nvidia-smi first, then clinfo, then wmic (Windows).
 * Returns a friendly string like "NVIDIA GeForce RTX 4090".
 */
function getGpuDeviceName() {
  // 1. Try nvidia-smi (works on Linux & Windows with NVIDIA drivers)
  try {
    const out = execSync("nvidia-smi --query-gpu=name --format=csv,noheader,nounits", {
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const name = out.toString().trim().split(/\r?\n/)[0].trim();
    if (name) return name;
  } catch {
    // nvidia-smi not available
  }

  // 2. Try clinfo (OpenCL info tool)
  try {
    const out = execSync("clinfo", {
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const text = out.toString();
    const match = text.match(/Device Name\s+(.+)/i);
    if (match) return match[1].trim();
  } catch {
    // clinfo not available
  }

  // 3. Windows fallback via wmic
  if (process.platform === "win32") {
    try {
      const out = execSync("wmic path win32_videocontroller get name", {
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"]
      });
      const lines = out.toString().trim().split(/\r?\n/).filter((l) => l.trim() && l.trim() !== "Name");
      if (lines.length > 0) return lines[0].trim();
    } catch {
      // wmic not available
    }
  }

  return "Unknown GPU (OpenCL)";
}

module.exports = { getGpuDeviceName };
