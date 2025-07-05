const chalk = require("chalk").default || require("chalk");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const service = require("./service");

// ---- MENU OPTIONS (Clean, No Emojis) ----
const menuOptions = [
  { label: "Account Login", value: "accountLogin" },
  { label: "Account Check-in", value: "accountCheckIn" },
  { label: "Account Check", value: "accountCheck" },
  { label: "Claim Faucet PHRS", value: "accountClaimFaucet" },
  { label: "Claim Faucet USDC", value: "claimFaucetUSDC" },
  { label: "Swap PHRS to USDC", value: "performSwapUSDC" },
  { label: "Swap PHRS to USDT", value: "performSwapUSDT" },
  { label: "Add Liquidity PHRS-USDC", value: "addLpUSDC" },
  { label: "Add Liquidity PHRS-USDT", value: "addLpUSDT" },
  { label: "Random Transfer", value: "randomTransfer" },
  { label: "Social Task", value: "socialTask" },
  { label: "Mint Gotchipus", value: "mintGotchipus" },
  { label: "OpenFi", value: "openFi" },
  { label: "Deploy Pharos", value: "deployPharos" }, // Added Deploy Pharos option
  { label: "Auto All", value: "autoAll" },
  { label: "Set Transaction Count", value: "setTransactionCount" },
  { label: "Exit", value: "exit" },
];

// ---- BANNER ----
const asciiBannerLines = [
  "██████╗     ██╗  ██╗     █████╗     ██████╗      ██████╗     ███████╗",
  "██╔══██╗    ██║  ██║    ██╔══██╗    ██╔══██╗    ██╔═══██╗    ██╔════╝",
  "██████╔╝    ███████║    ███████║    ██████╔╝    ██║   ██║    ███████╗",
  "██╔═══╝     ██╔══██║    ██╔══██║    ██╔══██╗    ██║   ██║    ╚════██║",
  "██║         ██║  ██║    ██║  ██║    ██║  ██║    ╚██████╔╝    ███████║",
  "╚═╝         ╚═╝  ╚═╝    ╚═╝  ╚═╝    ╚═╝  ╚═╝     ╚═════╝     ╚══════╝",
  "",
];

// ---- GLOBAL VARIABLES ----
global.selectedWallets = [];
global.maxTransaction = 5;

// ---- UTILITY FUNCTIONS ----
// Load wallets
function loadWallets() {
  try {
    const walletPath = path.join(__dirname, "wallet.json");
    const data = fs.readFileSync(walletPath, "utf8");
    const json = JSON.parse(data);
    global.selectedWallets = json.wallets || [];
    return global.selectedWallets;
  } catch {
    return [];
  }
}

// Format log messages with vibrant colors
function formatLogMessage(msg) {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  msg = (msg || "").toString().trim();
  if (!msg) return chalk.hex("#CCCCCC")(`[${timestamp}] Empty log`);

  const parts = msg.split("|").map((s) => s?.trim() || "");
  const walletName = parts[0] || "System";

  // Transaction Confirmation or Success (Green)
  if (parts.length >= 3 && (parts[2]?.includes("Confirmed") || parts[2]?.includes("claimed successfully") || parts[2]?.includes("NFT minted successfully") || parts[2]?.includes("Transaction confirmed"))) {
    const logParts = parts[2].split(/Confirmed:|claimed successfully:|NFT minted successfully:|Transaction confirmed:/);
    const message = logParts[0]?.trim() || "";
    const hashPart = logParts[1]?.trim() || "";
    return chalk.green.bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${message}${hashPart ? "Confirmed: " : hashPart.includes("PHRS") ? "claimed successfully: " : hashPart.includes("Tx Hash") ? "Transaction confirmed: " : "NFT minted successfully: "}${chalk.greenBright.bold(hashPart || "0.2 PHRS")}`
    );
  }

  // Transaction Initiation (Purple)
  if (
    parts.length >= 2 &&
    (parts[1]?.includes("Initiating") || parts[1]?.includes("Claiming") || parts[1]?.includes("Checking") || parts[1]?.includes("Generating") || parts[1]?.includes("Minting") || parts[1]?.includes("Processing"))
  ) {
    return chalk.hex("#C71585").bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${parts[1]}`
    );
  }

  // Warnings (Yellow)
  if (parts.length >= 2 && parts[1]?.includes("Warning")) {
    return chalk.yellow.bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${parts.slice(1).join(" | ")}`
    );
  }

  // Errors (Red)
  if (msg.includes("Error") || msg.includes("Failed")) {
    const errorMsg = parts.length > 2 ? parts.slice(2).join(" | ").replace(/\d{2}:\d{2}:\d{2}\s*\|\s*\d{2}-\d{2}-\d{4}/, "").trim() : msg;
    return chalk.red.bold(
      `[${timestamp}] ${walletName.padEnd(25)} | ${errorMsg}`
    );
  }

  // System Messages (Gray)
  return chalk.hex("#CCCCCC")(
    `[${timestamp}] ${walletName.padEnd(25)} | ${parts.slice(parts.length >= 2 ? 1 : 0).join(" | ") || msg}`
  );
}

// Spinner animation
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function createSpinner(text) {
  let frameIndex = 0;
  let stopped = false;

  const interval = setInterval(() => {
    if (stopped) return;
    process.stdout.write(`\r${chalk.green(spinnerFrames[frameIndex])} ${chalk.greenBright(text)}`);
    frameIndex = (frameIndex + 1) % spinnerFrames.length;
  }, 100);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      process.stdout.write("\r\x1b[K"); // Clear line
    },
  };
}

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Input prompt
function requestInput(promptText, type = "text", defaultValue = "") {
  return new Promise((resolve) => {
    rl.question(chalk.greenBright(`${promptText}${defaultValue ? ` [${defaultValue}]` : ""}: `), (value) => {
      if (type === "number") value = Number(value);
      if (value === "" || (type === "number" && isNaN(value))) value = defaultValue;
      resolve(value);
    });
  });
}

// Display banner
function displayBanner() {
  console.clear();
  console.log(chalk.hex("#D8BFD8").bold(asciiBannerLines.join("\n")));
  console.log();
}

// Display menu
function displayMenu() {
  console.log(chalk.blueBright.bold("\n>═══ Pharos Testnet Bot Menu ═══<"));
  menuOptions.forEach((opt, idx) => {
    const optionNumber = `${idx + 1}`.padStart(2, '0'); // Two-digit numbering
    console.log(chalk.blue(`  ${optionNumber} > ${opt.label.padEnd(35)} <`));
  });
  console.log(chalk.blueBright.bold(">═══════════════════════════════<\n"));
}

// ---- MAIN ----
async function main() {
  // Logger
  const logger = (message) => console.log(formatLogMessage(message));

  // Initialize
  displayBanner();
  loadWallets();
  logger(`System | Pharos Bot started. Wallets loaded: ${global.selectedWallets.length}`);

  // Initial transaction count
  const txCount = await requestInput("Enter number of transactions", "number", "5");
  if (isNaN(txCount) || txCount <= 0) {
    global.maxTransaction = 5;
    logger("System | Invalid transaction count. Using default: 5");
  } else {
    global.maxTransaction = txCount;
    logger(`System | Set transaction count to: ${txCount}`);
  }

  // Main loop
  while (true) {
    displayBanner();
    displayMenu();
    const choice = await requestInput("Select an option (1-17)", "number"); // Updated to 1-17
    const idx = choice - 1;

    if (isNaN(idx) || idx < 0 || idx >= menuOptions.length) {
      logger("System | Invalid option. Try again.");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const selected = menuOptions[idx];
    if (selected.value === "exit") {
      logger("System | Exiting...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      rl.close();
      process.exit(0);
    }

    if (selected.value === "setTransactionCount") {
      const newTxCount = await requestInput("Enter number of transactions", "number", global.maxTransaction.toString());
      if (isNaN(newTxCount) || newTxCount <= 0) {
        logger("System | Invalid transaction count. Keeping current: " + global.maxTransaction);
      } else {
        global.maxTransaction = newTxCount;
        logger(`System | Set transaction count to: ${newTxCount}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    try {
      const spinner = createSpinner(`Running ${selected.label}...`);
      logger(`System | Starting ${selected.label}...`);
      const scriptFunc = service[selected.value];
      if (scriptFunc) {
        await scriptFunc(logger);
        logger(`System | ${selected.label} completed.`);
      } else {
        logger(`System | Error: ${selected.label} not implemented.`);
      }
      spinner.stop();
    } catch (e) {
      logger(`System | Error in ${selected.label}: ${chalk.red(e.message)}`);
      spinner.stop();
    }

    await requestInput("Press Enter to continue...");
  }
}

// ---- Run ----
(async () => {
  try {
    await main();
  } catch (error) {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    rl.close();
    process.exit(1);
  }
})();
