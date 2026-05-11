require("dotenv").config();

const { ethers } = require("ethers");
const { CpuMiner } = require("./lib/cpu-miner");
const { OpenClMiner } = require("./lib/opencl-miner");
const { ABI, CONTRACT_ADDRESS, readOptions } = require("./lib/config");
const { hashRate, shortHex, formatETA, formatElapsed, formatNumber } = require("./lib/format");
const { getGpuDeviceName } = require("./lib/gpu-info");

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Etherscan base URL (mainnet)
const ETHERSCAN_TX = "https://etherscan.io/tx/";

function requireEnv() {
  if (!RPC_URL || !PRIVATE_KEY) {
    console.error("Isi RPC_URL dan PRIVATE_KEY di file .env dulu.");
    console.error("Contoh: cp .env.example .env lalu edit PRIVATE_KEY.");
    process.exit(1);
  }

  if (!PRIVATE_KEY.startsWith("0x")) {
    console.error("PRIVATE_KEY harus diawali 0x.");
    process.exit(1);
  }
}

async function main() {
  requireEnv();
  const options = readOptions();

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  // ─── Startup Banner ───────────────────────────────────────────
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║           ⛏  HASH256 CLI MINER                         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  💳 Wallet   : ${wallet.address}`);
  console.log(`  📄 Contract : ${CONTRACT_ADDRESS}`);
  console.log(`  🔧 Backend  : ${options.backend}`);

  // ─── GPU Info ─────────────────────────────────────────────────
  if (options.backend === "opencl" || options.backend === "auto") {
    const gpuName = getGpuDeviceName();
    console.log(`  🖥  GPU device: ${gpuName}`);
    console.log(`  📦 GPU batch size: ${formatNumber(options.gpuBatchSize)} nonces/dispatch`);
  } else {
    console.log(`  🧵 CPU workers: ${options.workers}`);
  }
  console.log("");

  let roundNum = 0;
  let sessionMints = 0;
  let lastReward = "100.0";

  while (true) {
    roundNum++;
    const state = await contract.miningState();
    const difficulty = BigInt(state.difficulty.toString());
    const challenge = await contract.getChallenge(wallet.address);
    lastReward = ethers.formatUnits(state.reward, 18);

    // ─── Round Header ─────────────────────────────────────────
    console.log("┌──────────────────────────────────────────────────────────┐");
    console.log(`│  🚩 Round #${roundNum} start`);
    console.log("├──────────────────────────────────────────────────────────┤");
    console.log(`│  Era       : ${state.era.toString().padEnd(10)} Reward : ${lastReward} HASH`);
    console.log(`│  Epoch     : ${state.epoch.toString().padEnd(10)} Minted : ${formatNumber(ethers.formatUnits(state.minted, 18).split(".")[0])} HASH`);
    console.log(`│  Difficulty: ${shortHex(difficulty.toString())}`);
    console.log(`│  Challenge : ${shortHex(challenge)}`);
    console.log("└──────────────────────────────────────────────────────────┘");
    console.log("");

    const searchStart = Date.now();
    const solution = await findSolution({ challenge, difficulty, options, epoch: state.epoch.toString(), searchStart });
    const searchTime = Date.now() - searchStart;

    // ─── Solution Found ───────────────────────────────────────
    console.log("");
    console.log(`  🎉 FOUND VALID NONCE: ${shortHex(solution.nonce)} (epoch ${state.epoch.toString()})`);
    console.log(`  ⏱  Search time: ${formatElapsed(searchTime)}`);
    console.log("");

    const txResult = await submitSolution({
      contract,
      nonce: BigInt(solution.nonce),
      options,
      reward: lastReward
    });

    if (txResult.success) {
      sessionMints++;
      console.log(`  🏆 Mined ~${lastReward} HASH tokens`);
      console.log(`  ⭐ Total successful mints this session: ${sessionMints}`);
    }

    console.log("");

    if (!options.keepMining) break;
  }
}

async function findSolution({ challenge, difficulty, options, epoch, searchStart }) {
  const onProgress = progressPrinter(difficulty, searchStart);

  if (options.backend === "opencl" || options.backend === "auto") {
    const gpu = new OpenClMiner({
      binary: options.gpuBinary,
      batchSize: options.gpuBatchSize,
      onProgress
    });

    if (gpu.available()) {
      try {
        console.log(`  ⛏  Mining epoch ${epoch} on GPU...`);
        return await gpu.search({ challenge, difficulty });
      } catch (err) {
        if (options.backend === "opencl") throw err;
        console.error("  ⚠️  OpenCL gagal, fallback ke CPU:", err.message);
      }
    } else if (options.backend === "opencl") {
      throw new Error(`OpenCL miner belum ada. Jalankan npm run build:opencl atau set OPENCL_MINER_BIN.`);
    }
  }

  const cpu = new CpuMiner({
    workers: options.workers,
    batchSize: options.batchSize,
    onProgress
  });

  console.log(`  ⛏  Mining epoch ${epoch} on CPU (${options.workers} threads)...`);
  return cpu.search({ challenge, difficulty });
}

async function submitSolution({ contract, nonce, options, reward }) {
  try {
    const gas = await estimateGas(contract, nonce);
    const fee = await feeOptions(contract.runner.provider, options.priorityFeeGwei);

    // ─── Gas Info ────────────────────────────────────────────
    const priorityGwei = ethers.formatUnits(fee.maxPriorityFeePerGas, "gwei");
    const maxFeeGwei = ethers.formatUnits(fee.maxFeePerGas, "gwei");
    console.log(`  ⛽ Gas: priority=${priorityGwei} gwei, maxFee=${maxFeeGwei} gwei`);

    const tx = await contract.mine(nonce, { gasLimit: gas, ...fee });
    console.log(`  📤 Transaction submitted: ${shortHex(tx.hash)}`);
    console.log(`  ⏳ Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`  ✅ SUCCESS! Confirmed in block ${receipt.blockNumber}`);
    console.log(`  🔗 ${ETHERSCAN_TX}${tx.hash}`);

    return { success: true, blockNumber: receipt.blockNumber };
  } catch (err) {
    console.error(`  ❌ TX failed: ${err.shortMessage || err.message}`);
    return { success: false };
  }
}

async function estimateGas(contract, nonce) {
  try {
    const estimate = await contract.mine.estimateGas(nonce);
    const padded = (estimate * 3n) / 2n;
    if (padded < 200000n) return 200000n;
    if (padded > 450000n) return 450000n;
    return padded;
  } catch {
    return 300000n;
  }
}

async function feeOptions(provider, priorityFeeGwei) {
  const priority = ethers.parseUnits(priorityFeeGwei, "gwei");
  try {
    const block = await provider.getBlock("latest");
    if (block?.baseFeePerGas) {
      return {
        maxPriorityFeePerGas: priority,
        maxFeePerGas: block.baseFeePerGas * 3n + priority
      };
    }
  } catch {
    // Legacy fallback below.
  }

  return {
    maxPriorityFeePerGas: priority,
    maxFeePerGas: ethers.parseUnits("10", "gwei") + priority
  };
}

function progressPrinter(difficulty, searchStart) {
  let last = 0;
  return ({ backend, hashes, hashrate }) => {
    const now = Date.now();
    if (now - last < 2000) return;
    last = now;

    const elapsed = formatElapsed(now - searchStart);
    const eta = formatETA(difficulty, hashrate);
    const attempts = formatNumber(hashes.toString());

    process.stdout.write(
      `\r  ⚡ ${hashRate(hashrate)} | round ${elapsed} | attempts ${attempts} | ETA ${eta}    `
    );
  };
}

main().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
