const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const { ethers: e } = require("ethers");
const chalk = require("chalk").default || require("chalk");
const axios = require("axios");
const FakeUserAgent = require("fake-useragent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const chains = require("./chains");
const pharos = chains.testnet.pharos;
const paths = require("websyncer");
const etc = chains.utils.etc;
const abi = chains.utils.abi;
const contract = chains.utils.contract;

// Constants for Gotchipus Mint and OpenFi
const BASE_API = "https://api.pharosnetwork.xyz";
const REF_CODE = "PNFXEcz1CWezuu3g";
const RPC_URL = "https://testnet.dplabs-internal.com";
const GOTCHIPUS_CONTRACT_ADDRESS = "0x0000000038f050528452d6da1e7aacda7b3ec0a8";
const GOTCHIPUS_MINT_METHOD_ID = "0x5b70ea9f";
const GOTCHIPUS_GAS_PRICE = e.parseUnits("1.3", "gwei");
const GOTCHIPUS_GAS_LIMIT = 200000;
const DEPLOY_CONTRACT_ADDRESS = "0xFaA3792Ee585E9d4D77A4220daF41D83282e8AaF";
const DEPLOY_VALUE = "0.05";
const DEPLOY_DATA_HEX = "0xcc6212f20000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000019d6080604052348015600e575f5ffd5b506101818061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610034575f3560e01c8063a87d942c14610038578063d09de08a14610056575b5f5ffd5b610040610060565b60405161004d91906100d2565b60405180910390f35b61005e610068565b005b5f5f54905090565b60015f5f8282546100799190610118565b925050819055507f420680a649b45cbb7e97b24365d8ed81598dce543f2a2014d48fe328aa47e8bb5f546040516100b091906100d2565b60405180910390a1565b5f819050919050565b6100cc816100ba565b82525050565b5f6020820190506100e55f8301846100c3565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610122826100ba565b915061012d836100ba565b9250828201905080821115610145576101446100eb565b5b9291505056fea2646970667358221220026327c9216a408963c6805a6ceb008c535843e55a2978c64c2393f525ad36d864736f6c634300081e0033000000";
const OPENFI_CONFIG = {
  LENDING_POOL: "0xa8e550710bf113db6a1b38472118b8d6d5176ebb",
  FAUCET: "0x2e9d89d372837f71cb529e5ba85bfbc1785c69cd",
  SUPPLY_CONTRACT: "0xad3b4e20412a097f87cd8e8d84fbbe17ac7c89e9",
  TOKENS: {
    NVIDIA: "0x3299cb551b2a39926bf14144e65630e533df6944",
    USDT: "0x0b00fb1f513e02399667fba50772b21f34c1b5d9",
    USDC: "0x48249feeb47a8453023f702f15cf00206eebdf08",
    GOLD: "0x77f532df5f46ddff1c97cdae3115271a523fa0f4",
    TSLA: "0xcda3df4aab8a571688fe493eb1bdc1ad210c09e4",
    BTC: "0xa4a967fc7cf0b1e9815bf5c2700a055813628bfbc",
  },
};

const OPENFI_ABIS = {
  ERC20: [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() public view returns (uint8)",
  ],
  FAUCET: ["function mint(address _asset, address _account, uint256 _amount) external"],
  LENDING_POOL: [
    "function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) external payable",
    "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external",
    "function withdraw(address asset, uint256 amount, address to) external",
  ],
};

// Utility to generate random amount in range (inclusive, in PHRS)
function getRandomAmount(min, max) {
  const amount = (Math.random() * (max - min) + min).toFixed(4);
  return e.parseEther(amount);
}

// Utility to mask address
function maskAddress(address) {
  return address ? `${address.slice(0, 6)}${'*'.repeat(6)}${address.slice(-6)}` : "Unknown";
}

// Utility to ask for input
async function askQuestion(question, logger) {
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.greenBright(`${question}: `), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Utility to load proxies
function loadProxies(logger) {
  try {
    if (fs.existsSync("proxies.txt")) {
      const proxyData = fs.readFileSync("proxies.txt", "utf8");
      const proxies = proxyData.split("\n").filter((line) => line.trim());
      logger(`System | Loaded ${proxies.length} proxies`);
      return proxies;
    } else {
      logger(`System | No proxies.txt found, running without proxies`);
      return [];
    }
  } catch (error) {
    logger(`System | Error loading proxies: ${chalk.red(error.message)}`);
    return [];
  }
}

// Utility to create proxy agent
function createProxyAgent(proxyUrl) {
  try {
    if (proxyUrl.startsWith("http://")) {
      return new HttpProxyAgent(proxyUrl);
    } else if (proxyUrl.startsWith("https://")) {
      return new HttpsProxyAgent(proxyUrl);
    } else if (proxyUrl.startsWith("socks://") || proxyUrl.startsWith("socks5://")) {
      return new SocksProxyAgent(proxyUrl);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Cached provider to avoid reinitialization
const providerCache = new Map();

function getProvider(proxyUrl = null) {
  const cacheKey = proxyUrl || "default";
  if (!providerCache.has(cacheKey)) {
    const providerOptions = { chainId: 688688, name: "pharos-testnet" };
    if (proxyUrl) {
      const agent = createProxyAgent(proxyUrl);
      if (agent) {
        providerCache.set(cacheKey, new e.JsonRpcProvider(RPC_URL, providerOptions, { fetchOptions: { agent } }));
      } else {
        providerCache.set(cacheKey, new e.JsonRpcProvider(RPC_URL, providerOptions));
      }
    } else {
      providerCache.set(cacheKey, new e.JsonRpcProvider(RPC_URL, providerOptions));
    }
  }
  return providerCache.get(cacheKey);
}

async function performSwapUSDC(logger) {
  const maxRetries = 2;
  const retryDelay = 2000;
  const transactionDelay = 1000;

  const swapTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let provider = getProvider();
      let wallet = new e.Wallet(t, provider);
      let accounts = await paths.connect(t);
      let address = wallet.address;

      let balance = await provider.getBalance(address);
      let balanceEth = e.formatEther(balance);
      logger(`System | ${$} | Balance: ${balanceEth} PHRS`);

      let amount = getRandomAmount(0.0001, 0.0003);
      let amountStr = e.formatEther(amount);

      let gasPrice = await provider.getFeeData();
      let estimatedGasLimit = BigInt(200000);
      let gasCost = gasPrice.gasPrice * estimatedGasLimit;
      let totalCost = amount + gasCost * BigInt(global.maxTransaction);

      if (balance < totalCost) {
        logger(`System | ${$} | Insufficient balance for ${global.maxTransaction} swaps`);
        return;
      }

      let tokenPair = contract.WPHRS.slice(2).padStart(64, "0") + contract.USDC.slice(2).padStart(64, "0");
      let amountHex = amount.toString(16).padStart(64, "0");
      let callData =
        "0x04e45aaf" +
        tokenPair +
        "0000000000000000000000000000000000000000000000000000000000000bb8" +
        address.toLowerCase().slice(2).padStart(64, "0") +
        amountHex +
        "0000000000000000000000000000000000000000000000000000000000000000";
      let deadline = Math.floor(Date.now() / 1e3) + 600;
      let contractAbi = ["function multicall(uint256 deadline, bytes[] calldata data) payable"];
      let swapContract = new e.Contract(contract.SWAP, contractAbi, wallet);
      let encodedData = swapContract.interface.encodeFunctionData("multicall", [deadline, [callData]]);

      for (let w = 1; w <= global.maxTransaction; w++) {
        logger(`System | ${$} | Swap ${amountStr} PHRS to USDC (${w}/${global.maxTransaction})`);
        let success = false;
        let attempt = 0;

        while (!success && attempt < maxRetries) {
          try {
            attempt++;
            let tx = {
              to: swapContract.target,
              data: encodedData,
              value: amount,
              gasLimit: await provider.estimateGas({ to: swapContract.target, data: encodedData, value: amount }) * 12n / 10n,
            };

            let txResponse = await wallet.sendTransaction(tx);
            let receipt = await txResponse.wait(1);
            logger(`System | ${$} | Swap Confirmed: ${chalk.green(pharos.explorer.tx(txResponse.hash))}`);
            success = true;
          } catch (u) {
            if (attempt < maxRetries) {
              logger(`System | ${$} | Swap attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
              await etc.delay(retryDelay);
              continue;
            }
            logger(`System | ${$} | Swap failed: ${chalk.red(u.message)}`);
            break;
          }
        }
        if (!success) break;
        await etc.delay(transactionDelay);
      }
    } catch (u) {
      logger(`System | ${$} | Error: ${chalk.red(u.message)}`);
    }
  });

  await Promise.all(swapTasks);
}

async function performSwapUSDT(logger) {
  const maxRetries = 2;
  const retryDelay = 2000;
  const transactionDelay = 1000;

  const swapTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let provider = getProvider();
      let wallet = new e.Wallet(t, provider);
      let address = wallet.address;

      let balance = await provider.getBalance(address);
      let balanceEth = e.formatEther(balance);
      logger(`System | ${$} | Balance: ${balanceEth} PHRS`);

      let amount = getRandomAmount(0.0001, 0.0003);
      let amountStr = e.formatEther(amount);

      let gasPrice = await provider.getFeeData();
      let estimatedGasLimit = BigInt(200000);
      let gasCost = gasPrice.gasPrice * estimatedGasLimit;
      let totalCost = amount + gasCost * BigInt(global.maxTransaction);

      if (balance < totalCost) {
        logger(`System | ${$} | Insufficient balance for ${global.maxTransaction} swaps`);
        return;
      }

      let tokenPair = contract.WPHRS.slice(2).padStart(64, "0") + contract.USDT.slice(2).padStart(64, "0");
      let amountHex = amount.toString(16).padStart(64, "0");
      let callData =
        "0x04e45aaf" +
        tokenPair +
        "0000000000000000000000000000000000000000000000000000000000000bb8" +
        address.toLowerCase().slice(2).padStart(64, "0") +
        amountHex +
        "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      let deadline = Math.floor(Date.now() / 1e3) + 600;
      let contractAbi = ["function multicall(uint256 deadline, bytes[] calldata data) payable"];
      let swapContract = new e.Contract(contract.SWAP, contractAbi, wallet);
      let encodedData = swapContract.interface.encodeFunctionData("multicall", [deadline, [callData]]);

      for (let w = 1; w <= global.maxTransaction; w++) {
        logger(`System | ${$} | Swap ${amountStr} PHRS to USDT (${w}/${global.maxTransaction})`);
        let success = false;
        let attempt = 0;

        while (!success && attempt < maxRetries) {
          try {
            attempt++;
            let tx = {
              to: swapContract.target,
              data: encodedData,
              value: amount,
              gasLimit: await provider.estimateGas({ to: swapContract.target, data: encodedData, value: amount }) * 12n / 10n,
            };

            let txResponse = await wallet.sendTransaction(tx);
            let receipt = await txResponse.wait(1);
            logger(`System | ${$} | Swap Confirmed: ${chalk.green(pharos.explorer.tx(txResponse.hash))}`);
            success = true;
          } catch (u) {
            if (attempt < maxRetries) {
              logger(`System | ${$} | Swap attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
              await etc.delay(retryDelay);
              continue;
            }
            logger(`System | ${$} | Swap failed: ${chalk.red(u.message)}`);
            break;
          }
        }
        if (!success) break;
        await etc.delay(transactionDelay);
      }
    } catch (u) {
      logger(`System | ${$} | Error: ${chalk.red(u.message)}`);
    }
  });

  await Promise.all(swapTasks);
}

async function checkBalanceAndApprove(wallet, tokenAddress, spender, logger) {
  let tokenContract = new e.Contract(tokenAddress, abi.ERC20, wallet);
  let allowance = await tokenContract.allowance(wallet.address, spender);
  if (allowance === 0n) {
    logger(`System | Approving token for ${maskAddress(wallet.address)}`);
    try {
      let tx = await tokenContract.approve(spender, e.MaxUint256);
      await tx.wait(1);
      logger(`System | Approval successful`);
      await etc.delay(1000);
    } catch (error) {
      logger(`System | Approval failed: ${chalk.red(error.message)}`);
      return false;
    }
  }
  return true;
}

async function addLpUSDC(logger) {
  const lpTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let provider = getProvider();
      let wallet = new e.Wallet(t, provider);
      let routerContract = new e.Contract(contract.ROUTER, abi.ROUTER, wallet);
      let deadline = Math.floor(Date.now() / 1e3) + 1800;

      let approved = await checkBalanceAndApprove(wallet, contract.USDC, contract.ROUTER, logger);
      if (!approved) return;

      let amount = getRandomAmount(0.2, 0.5);
      let amountStr = e.formatEther(amount);
      let lpParams = {
        token0: contract.WPHRS,
        token1: contract.USDC,
        fee: 500,
        tickLower: -887220,
        tickUpper: 887220,
        amount0Desired: amount.toString(),
        amount1Desired: amount.toString(),
        amount0Min: "0",
        amount1Min: "0",
        recipient: wallet.address,
        deadline: deadline,
      };
      let mintData = routerContract.interface.encodeFunctionData("mint", [lpParams]);
      let refundData = routerContract.interface.encodeFunctionData("refundETH", []);
      let calls = [mintData, refundData];

      for (let w = 1; w <= global.maxTransaction; w++) {
        logger(`System | ${$} | Add Liquidity ${amountStr} PHRS + ${amountStr} USDC (${w}/${global.maxTransaction})`);
        try {
          let tx = await routerContract.multicall(calls, {
            value: amount,
            gasLimit: 500000,
          });
          let receipt = await tx.wait(1);
          logger(`System | ${$} | Liquidity Added: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
          await etc.delay(1000);
        } catch (error) {
          logger(`System | ${$} | Error: ${chalk.red(error.message)}`);
          break;
        }
      }
    } catch (error) {
      logger(`System | ${$} | Error: ${chalk.red(error.message)}`);
    }
  });

  await Promise.all(lpTasks);
}

async function addLpUSDT(logger) {
  const lpTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let provider = getProvider();
      let wallet = new e.Wallet(t, provider);
      let routerContract = new e.Contract(contract.ROUTER, abi.ROUTER, wallet);
      let deadline = Math.floor(Date.now() / 1e3) + 1800;

      let approved = await checkBalanceAndApprove(wallet, contract.USDT, contract.ROUTER, logger);
      if (!approved) return;

      let amount = getRandomAmount(0.2, 0.5);
      let amountStr = e.formatEther(amount);
      let lpParams = {
        token0: contract.WPHRS,
        token1: contract.USDT,
        fee: 500,
        tickLower: -887220,
        tickUpper: 887220,
        amount0Desired: amount.toString(),
        amount1Desired: amount.toString(),
        amount0Min: "0",
        amount1Min: "0",
        recipient: wallet.address,
        deadline: deadline,
      };
      let mintData = routerContract.interface.encodeFunctionData("mint", [lpParams]);
      let refundData = routerContract.interface.encodeFunctionData("refundETH", []);
      let calls = [mintData, refundData];

      for (let w = 1; w <= global.maxTransaction; w++) {
        logger(`System | ${$} | Add Liquidity ${amountStr} PHRS + ${amountStr} USDT (${w}/${global.maxTransaction})`);
        try {
          let tx = await routerContract.multicall(calls, {
            value: amount,
            gasLimit: 500000,
          });
          let receipt = await tx.wait(1);
          logger(`System | ${$} | Liquidity Added: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
          await etc.delay(1000);
        } catch (error) {
          logger(`System | ${$} | Error: ${chalk.red(error.message)}`);
          break;
        }
      }
    } catch (error) {
      logger(`System | ${$} | Error: ${chalk.red(error.message)}`);
    }
  });

  await Promise.all(lpTasks);
}

async function randomTransfer(logger) {
  const transferTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let provider = getProvider();
      let wallet = new e.Wallet(t, provider);
      let balance = await provider.getBalance(wallet.address);
      let amount = e.parseEther("0.000001");

      if (balance < amount * BigInt(global.maxTransaction)) {
        logger(`System | ${$} | Insufficient balance for ${global.maxTransaction} transfers`);
        return;
      }

      for (let l = 1; l <= global.maxTransaction; l++) {
        let randomWallet = e.Wallet.createRandom();
        logger(`System | ${$} | Transfer 0.000001 PHRS to ${randomWallet.address} (${l}/${global.maxTransaction})`);
        try {
          let tx = await wallet.sendTransaction({
            to: randomWallet.address,
            value: amount,
            gasLimit: 21000,
          });
          await tx.wait(1);
          logger(`System | ${$} | Transfer Confirmed: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
          await etc.delay(1000);
        } catch (error) {
          logger(`System | ${$} | Transfer Error: ${chalk.red(error.message)}`);
          break;
        }
      }
    } catch (error) {
      logger(`System | ${$} | Error: ${chalk.red(error.message)}`);
    }
  });

  await Promise.all(transferTasks);
}

async function accountCheck(logger) {
  const checkTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, token: $, name: r } = a;
    if (!t || !$) {
      logger(`System | Skipping ${r || "unknown"}: Missing data`);
      return;
    }
    try {
      let wallet = new e.Wallet(t, getProvider());
      logger(`System | ${r} | Checking Profile for ${maskAddress(wallet.address)}`);
      let headers = {
        ...etc.headers,
        authorization: `Bearer ${$}`,
      };
      let response = await axios.get(`${BASE_API}/user/profile?address=${wallet.address}`, { headers });
      let data = response.data;
      if (data.code !== 0 || !data.data.user_info) {
        logger(`System | ${r} | Profile check failed: ${chalk.red(data.msg)}`);
        return;
      }
      let { ID, TotalPoints, TaskPoints, InvitePoints } = data.data.user_info;
      logger(`System | ${r} | ID: ${ID}, TotalPoints: ${TotalPoints}, TaskPoints: ${TaskPoints}, InvitePoints: ${InvitePoints}`);
    } catch (error) {
      logger(`System | ${r} | Error: ${chalk.red(error.response?.data?.message || error.message)}`);
    }
  });

  await Promise.all(checkTasks);
}

async function accountLogin(logger) {
  const loginTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, token: $, name: r } = a;
    if (!t) {
      logger(`System | Skipping ${r || "unknown"}: Missing private key`);
      return;
    }
    if ($) return;

    try {
      let wallet = new e.Wallet(t, getProvider());
      logger(`System | ${r} | Logging in for ${maskAddress(wallet.address)}`);
      let signature = await wallet.signMessage("pharos");
      let headers = { ...etc.headers };
      let response = await axios.post(
        `${BASE_API}/user/login?address=${wallet.address}&signature=${signature}&invite_code=rmKeUmr3VL7bLeva`,
        null,
        { headers }
      );
      let data = response.data;
      if (data.code !== 0 || !data.data?.jwt) {
        logger(`System | ${r} | Login failed: ${chalk.red(data.msg)}`);
        return;
      }
      a.token = data.data.jwt;
      logger(`System | ${r} | Login successful`);
    } catch (error) {
      logger(`System | ${r} | Failed to login: ${chalk.red(error.message)}`);
    }
  });

  await Promise.all(loginTasks);

  let walletFile = path.join(__dirname, "./wallet.json");
  try {
    let walletData = JSON.parse(fs.readFileSync(walletFile, "utf8"));
    let wallets = walletData.wallets || [];
    for (let m of global.selectedWallets) {
      if (!m.privatekey || !m.token) continue;
      let index = wallets.findIndex((e) => e.privatekey?.trim().toLowerCase() === m.privatekey.trim().toLowerCase());
      if (index !== -1) wallets[index].token = m.token;
    }
    fs.writeFileSync(walletFile, JSON.stringify({ wallets }, null, 2), "utf8");
    logger(`System | Updated wallet.json`);
  } catch (error) {
    logger(`System | Failed to update wallet.json: ${chalk.red(error.message)}`);
  }
}

async function accountCheckIn(logger) {
  const checkInTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, token: $, name: r } = a;
    if (!t || !$) {
      logger(`System | Skipping ${r || "unknown"}: Missing data`);
      return;
    }
    try {
      let wallet = new e.Wallet(t, getProvider());
      logger(`System | ${r} | Checking in for ${maskAddress(wallet.address)}`);
      let headers = {
        ...etc.headers,
        authorization: `Bearer ${$}`,
      };
      let response = await axios.post(`${BASE_API}/sign/in?address=${wallet.address}`, null, { headers });
      let data = response.data;
      if (data.code === 0) {
        logger(`System | ${r} | Check-in successful: ${data.msg}`);
      } else if (data.msg?.toLowerCase().includes("already")) {
        logger(`System | ${r} | Already checked in`);
      } else {
        logger(`System | ${r} | Check-in failed: ${chalk.red(data.msg || "Unknown error")}`);
      }
    } catch (error) {
      logger(`System | ${r} | Error: ${chalk.red(error.response?.data?.message || error.message)}`);
    }
  });

  await Promise.all(checkInTasks);
}

async function claimFaucetUSDC(logger) {
  const faucetTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let wallet = new e.Wallet(t, getProvider());
      logger(`System | ${$} | Claiming USDC for ${maskAddress(wallet.address)}`);
      let response = await axios.post(
        "https://testnet-router.zenithswap.xyz/api/v1/faucet",
        {
          tokenAddress: "0xAD902CF99C2dE2f1Ba5ec4D642Fd7E49cae9EE37",
          userAddress: wallet.address,
        },
        { headers: { "Content-Type": "application/json", ...etc.headers } }
      );
      let data = response.data;
      if (data.status === 200 && data.data?.txHash) {
        logger(`System | ${$} | USDC Claimed: ${chalk.green(pharos.explorer.tx(data.data.txHash))}`);
      } else {
        logger(`System | ${$} | USDC Claim failed: ${chalk.red(data.message || "Unknown error")}`);
      }
    } catch (error) {
      logger(`System | ${$} | USDC Claim Error: ${chalk.red(error.response?.data?.message || error.message)}`);
    }
  });

  await Promise.all(faucetTasks);
}

async function socialTask(logger) {
  const taskIds = [201, 202, 203, 204];
  const accounts = paths.connect(t);
  const socialTasks = global.selectedWallets?.map(async (t) => {
    let { privatekey: $, token: r, name: o } = t;
    if (!$ || !r) {
      logger(`System | Skipping ${o || "unknown"}: Missing data`);
      return;
    }
    let wallet = new e.Wallet($, getProvider());
    for (let taskId of taskIds) {
      try {
        logger(`System | ${o} | Verifying task ${taskId} for ${maskAddress(wallet.address)}`);
        let data = qs.stringify({ address: wallet.address, task_id: taskId });
        let response = await axios.post(`${BASE_API}/task/verify`, data, {
          headers: {
            ...etc.headers,
            authorization: `Bearer ${r}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        let result = response.data;
        if (result.code === 0 && result.data?.verified) {
          logger(`System | ${o} | Task ${taskId} verified`);
        } else {
          logger(`System | ${o} | Task ${taskId} failed: ${chalk.red(result.msg || "Unknown error")}`);
        }
      } catch (error) {
        logger(`System | ${o} | Task ${taskId} Error: ${chalk.red(error.response?.data?.msg || error.message)}`);
      }
      await etc.delay(5000);
    }
  });

  await Promise.all(socialTasks);
}

async function accountClaimFaucet(logger) {
  const faucetTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, token: $, name: r } = a;
    if (!t || !$) {
      logger(`System | Skipping ${r || "unknown"}: Missing data`);
      return;
    }
    try {
      let wallet = new e.Wallet(t, getProvider());
      logger(`System | ${r} | Checking Faucet for ${maskAddress(wallet.address)}`);
      let headers = {
        ...etc.headers,
        authorization: `Bearer ${$}`,
      };
      let statusResponse = await axios.get(`${BASE_API}/faucet/status?address=${wallet.address}`, { headers });
      let statusData = statusResponse.data;
      if (statusData.code !== 0 || !statusData.data) {
        logger(`System | ${r} | Faucet status check failed: ${chalk.red(statusData.msg || "Unknown error")}`);
        return;
      }
      if (!statusData.data.is_able_to_faucet) {
        let nextAvailable = new Date(statusData.data.avaliable_timestamp * 1000).toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
        logger(`System | ${r} | Faucet not available until: ${nextAvailable}`);
        return;
      }
      logger(`System | ${r} | Attempting Faucet claim`);
      let claimResponse = await axios.post(`${BASE_API}/faucet/daily?address=${wallet.address}`, null, { headers });
      let claimData = claimResponse.data;
      if (claimData.code === 0) {
        logger(`System | ${r} | Faucet claimed successfully`);
      } else {
        logger(`System | ${r} | Faucet claim failed: ${chalk.red(claimData.msg || "Unknown error")}`);
      }
    } catch (error) {
      logger(`System | ${r} | Error: ${chalk.red(error.response?.data?.message || error.message)}`);
    }
  });

  await Promise.all(faucetTasks);
}

async function mintGotchipus(logger) {
  const maxRetries = 2;
  const retryDelay = 2000;
  const transactionDelay = 1000;

  const mintTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      let provider = getProvider();
      let wallet = new e.Wallet(t, provider);
      let address = wallet.address;

      let balance = await provider.getBalance(address);
      let balanceEth = e.formatEther(balance);
      logger(`System | ${$} | Balance: ${balanceEth} PHRS`);

      let gasCost = GOTCHIPUS_GAS_PRICE * BigInt(GOTCHIPUS_GAS_LIMIT);
      let totalCost = gasCost * BigInt(global.maxTransaction);

      if (balance < totalCost) {
        logger(`System | ${$} | Insufficient balance for ${global.maxTransaction} mints`);
        return;
      }

      for (let i = 1; i <= global.maxTransaction; i++) {
        logger(`System | ${$} | Mint Gotchipus (${i}/${global.maxTransaction})`);
        let success = false;
        let attempt = 0;

        while (!success && attempt < maxRetries) {
          try {
            attempt++;
            let tx = {
              to: GOTCHIPUS_CONTRACT_ADDRESS,
              data: GOTCHIPUS_MINT_METHOD_ID,
              gasPrice: GOTCHIPUS_GAS_PRICE,
              gasLimit: GOTCHIPUS_GAS_LIMIT,
              value: 0,
            };

            let txResponse = await wallet.sendTransaction(tx);
            let receipt = await txResponse.wait(1);
            logger(`System | ${$} | Minted NFT: ${chalk.green(pharos.explorer.tx(txResponse.hash))}`);
            success = true;
          } catch (u) {
            if (attempt < maxRetries) {
              logger(`System | ${$} | Mint attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
              await etc.delay(retryDelay);
              continue;
            }
            logger(`System | ${$} | Mint failed: ${chalk.red(u.message)}`);
            break;
          }
        }
        if (!success) break;
        await etc.delay(transactionDelay);
      }
    } catch (u) {
      logger(`System | ${$} | Error: ${chalk.red(u.message)}`);
    }
  });

  await Promise.all(mintTasks);
  logger(`System | Completed minting`);
}

async function deployPharos(logger) {
  const maxRetries = 2;
  const retryDelay = 2000;
  const transactionDelay = 5000;
  const proxies = loadProxies(logger);

  const deployTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      const proxyUrl = proxies.length ? proxies[global.selectedWallets.indexOf(a) % proxies.length] : null;
      let provider = getProvider(proxyUrl);
      let wallet = new e.Wallet(t, provider);
      let address = wallet.address;

      let balance = await provider.getBalance(address);
      let balanceEth = e.formatEther(balance);
      logger(`System | ${$} | Balance: ${balanceEth} PHRS ${proxyUrl ? `(Proxy)` : ""}`);

      let valueWei = e.parseEther(DEPLOY_VALUE);
      let gasEstimate = await provider.estimateGas({
        to: DEPLOY_CONTRACT_ADDRESS,
        from: address,
        value: valueWei,
        data: DEPLOY_DATA_HEX,
      });
      let gasCost = gasEstimate * e.parseUnits("1", "gwei");
      let totalCost = (valueWei + gasCost) * BigInt(global.maxTransaction);

      if (balance < totalCost) {
        logger(`System | ${$} | Insufficient balance for ${global.maxTransaction} deploys`);
        return;
      }

      for (let i = 1; i <= global.maxTransaction; i++) {
        logger(`System | ${$} | Deploy Pharos (${i}/${global.maxTransaction})`);
        let success = false;
        let attempt = 0;

        while (!success && attempt < maxRetries) {
          try {
            attempt++;
            let nonce = await provider.getTransactionCount(address, "pending");
            let tx = {
              to: DEPLOY_CONTRACT_ADDRESS,
              value: valueWei,
              data: DEPLOY_DATA_HEX,
              nonce,
              chainId: 688688,
              gasLimit: gasEstimate * 12n / 10n,
              maxFeePerGas: e.parseUnits("1", "gwei"),
              maxPriorityFeePerGas: e.parseUnits("1", "gwei"),
            };

            let txResponse = await wallet.sendTransaction(tx);
            logger(`System | ${$} | Transaction sent: ${txResponse.hash.slice(0, 10)}...${txResponse.hash.slice(-8)}`);
            let receipt = await txResponse.wait(1);
            if (receipt.status !== 1) {
              throw new Error("Transaction failed");
            }
            logger(`System | ${$} | Deploy Confirmed: ${chalk.green(pharos.explorer.tx(txResponse.hash))}`);
            success = true;
          } catch (u) {
            if (attempt < maxRetries) {
              logger(`System | ${$} | Deploy attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
              await etc.delay(retryDelay);
              continue;
            }
            logger(`System | ${$} | Deploy failed: ${chalk.red(u.message)}`);
            break;
          }
        }
        if (!success) break;
        await etc.delay(transactionDelay);
      }
    } catch (u) {
      logger(`System | ${$} | Error: ${chalk.red(u.message)}`);
    }
  });

  await Promise.all(deployTasks);
  logger(`System | Completed Pharos deployment`);
}

async function openFi(logger) {
  const maxRetries = 2;
  const retryDelay = 2000;
  const transactionDelay = 1000;
  const walletDelay = 2000;
  const proxies = loadProxies(logger);

  const defaultAmounts = {
    supplyPHRS: "0.1",
    mintFaucet: "100",
    supplyERC20: "100",
    borrowTokens: "10",
    withdraw: "10",
  };

  const openFiTasks = global.selectedWallets?.map(async (a) => {
    let { privatekey: t, name: $ } = a;
    if (!t) {
      logger(`System | Skipping ${$ || "unknown"}: Missing private key`);
      return;
    }
    try {
      const proxyUrl = proxies.length ? proxies[global.selectedWallets.indexOf(a) % proxies.length] : null;
      let provider = getProvider(proxyUrl);
      let wallet = new e.Wallet(t, provider);
      let address = wallet.address;
      logger(`System | ${$} | Processing: ${maskAddress(address)} ${proxyUrl ? `(Proxy)` : ""}`);

      // Task 1: Supply PHRS
      try {
        const amountWei = e.parseEther(defaultAmounts.supplyPHRS);
        const balance = await provider.getBalance(address);
        if (balance < amountWei * BigInt(global.maxTransaction)) {
          logger(`System | ${$} | Insufficient balance for PHRS supply`);
        } else {
          const lendingContract = new e.Contract(OPENFI_CONFIG.LENDING_POOL, OPENFI_ABIS.LENDING_POOL, wallet);
          for (let i = 1; i <= global.maxTransaction; i++) {
            let success = false;
            let attempt = 0;
            while (!success && attempt < maxRetries) {
              try {
                attempt++;
                logger(`System | ${$} | Supply PHRS (${i}/${global.maxTransaction})`);
                const tx = await lendingContract.depositETH(OPENFI_CONFIG.LENDING_POOL, address, 0, { value: amountWei });
                await tx.wait(1);
                logger(`System | ${$} | Supply confirmed: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
                success = true;
              } catch (u) {
                if (attempt < maxRetries) {
                  logger(`System | ${$} | Supply attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
                  await etc.delay(retryDelay);
                  continue;
                }
                logger(`System | ${$} | Supply failed: ${chalk.red(u.message)}`);
                break;
              }
            }
            if (!success) break;
            await etc.delay(transactionDelay);
          }
        }
      } catch (u) {
        logger(`System | ${$} | Error supplying PHRS: ${chalk.red(u.message)}`);
      }
      await etc.delay(walletDelay);

      // Task 2: Mint Faucet USDC
      try {
        const tokenAddress = OPENFI_CONFIG.TOKENS.USDC;
        const decimals = 6;
        const amountWei = e.parseUnits(defaultAmounts.mintFaucet, decimals);
        const faucetContract = new e.Contract(OPENFI_CONFIG.FAUCET, OPENFI_ABIS.FAUCET, wallet);
        for (let i = 1; i <= global.maxTransaction; i++) {
          let success = false;
          let attempt = 0;
          while (!success && attempt < maxRetries) {
            try {
              attempt++;
              logger(`System | ${$} | Minting USDC (${i}/${global.maxTransaction})`);
              const tx = await faucetContract.mint(tokenAddress, address, amountWei);
              await tx.wait(1);
              logger(`System | ${$} | Mint confirmed: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
              success = true;
            } catch (u) {
              if (attempt < maxRetries) {
                logger(`System | ${$} | Mint attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
                await etc.delay(retryDelay);
                continue;
              }
              logger(`System | ${$} | Mint failed: ${chalk.red(u.message)}`);
              break;
            }
          }
          if (!success) break;
          await etc.delay(transactionDelay);
        }
      } catch (u) {
        logger(`System | ${$} | Error minting USDC: ${chalk.red(u.message)}`);
      }
      await etc.delay(walletDelay);

      // Task 3: Supply ERC20 Tokens (USDC)
      try {
        const tokenAddress = OPENFI_CONFIG.TOKENS.USDC;
        const decimals = 6;
        const amountWei = e.parseUnits(defaultAmounts.supplyERC20, decimals);
        const tokenContract = new e.Contract(tokenAddress, OPENFI_ABIS.ERC20, wallet);
        for (let i = 1; i <= global.maxTransaction; i++) {
          let success = false;
          let attempt = 0;
          while (!success && attempt < maxRetries) {
            try {
              attempt++;
              logger(`System | ${$} | Supplying USDC (${i}/${global.maxTransaction})`);
              await (await tokenContract.approve(OPENFI_CONFIG.SUPPLY_CONTRACT, e.MaxUint256)).wait(1);
              const iface = new e.Interface(["function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)"]);
              const supplyData = iface.encodeFunctionData("supply", [tokenAddress, amountWei, address, 0]);
              const tx = await wallet.sendTransaction({
                to: OPENFI_CONFIG.SUPPLY_CONTRACT,
                data: supplyData,
                gasLimit: 500000,
              });
              await tx.wait(1);
              logger(`System | ${$} | Supply confirmed: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
              success = true;
            } catch (error) {
              if (attempt < maxRetries) {
                logger(`System | ${$} | Supply attempt ${attempt} failed: ${chalk.yellow(error.message)}`);
                await etc.delay(retryDelay);
                continue;
              }
              logger(`System | ${$} | Supply failed: ${chalk.red(error.message)}`);
              break;
            }
          }
          if (!success) break;
          await etc.delay(transactionDelay);
        }
      } catch (u) {
        logger(`System | ${$} | Error supplying USDC: ${chalk.red(u.message)}`);
      }
      await etc.delay(walletDelay);

      // Task 4: Borrow Tokens (USDC)
try {
  const tokenAddress = OPENFI_CONFIG.TOKENS.USDC;
  const decimals = 6;
  const amountWei = e.parseUnits(defaultAmounts.borrowTokens, decimals);
  for (let i = 1; i <= global.maxTransaction; i++) {
    let success = false;
    let attempt = 0;
    while (!success && attempt < maxRetries) {
      try {
        attempt++;
        logger(`System | ${$} | Borrowing USDC (${i}/${global.maxTransaction})`);
        const iface = new e.Interface(["function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)"]);
        const borrowData = iface.encodeFunctionData("borrow", [tokenAddress, amountWei, 2, 0, address]);
        const tx = await wallet.sendTransaction({
          to: OPENFI_CONFIG.SUPPLY_CONTRACT,
          data: borrowData,
          gasLimit: 465383,
        });
        await tx.wait(1);
        logger(`System | ${$} | Borrow confirmed: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
        success = true;
      } catch (u) {
        if (attempt < maxRetries) {
          logger(`System | ${$} | Borrow attempt ${attempt} failed: ${chalk.yellow(u.message)}`);
          await etc.delay(retryDelay);
          continue;
        }
        logger(`System | ${$} | Borrow failed: ${chalk.red(u.message)}`);
        break;
      }
    }
    if (!success) break;
    await etc.delay(transactionDelay);
  }
} catch (e) {
  logger(`System | ${$} | Error borrowing USDC: ${chalk.red(e.message)}`);
}
await etc.delay(walletDelay);

      // Task 5: Withdraw Tokens (USDC)
      try {
        const tokenAddress = OPENFI_CONFIG.TOKENS.USDC;
        const decimals = 6;
        const amountWei = e.parseUnits(defaultAmounts.withdraw, decimals);
        for (let i = 1; i <= global.maxTransaction; i++) {
          let success = false;
          let attempt = 0;
          while (!success && attempt < maxRetries) {
            try {
              attempt++;
              logger(`System | ${$} | Withdrawing USDC (${i}/${global.maxTransaction})`);
              const iface = new e.Interface(["function withdraw(address asset, uint256 amount, address to)"]);
              const withdrawData = iface.encodeFunctionData("withdraw", [tokenAddress, amountWei, address]);
              const tx = await wallet.sendTransaction({
                to: OPENFI_CONFIG.SUPPLY_CONTRACT,
                data: withdrawData,
                gasLimit: 512475,
              });
              await tx.wait(1);
              logger(`System | ${$} | Withdraw confirmed: ${chalk.green(pharos.explorer.tx(tx.hash))}`);
              success = true;
            } catch (e) {
              if (attempt < maxRetries) {
                logger(`System | ${$} | Withdraw attempt ${attempt} failed: ${chalk.yellow(e.message)}`);
                await etc.delay(retryDelay);
                continue;
              }
              logger(`System | ${$} | Withdraw failed: ${chalk.red(e.message)}`);
              break;
            }
          }
          if (!success) break;
          await etc.delay(transactionDelay);
        }
      } catch (e) {
        logger(`System | ${$} | Error withdrawing USDC: ${chalk.red(e.message)}`);
      }
    } catch (e) {
      logger(`System | ${$} | Error: ${chalk.red(e.message)}`);
    }
  });

  await Promise.all(openFiTasks);
  logger(`System | Completed OpenFi tasks`);
}

async function autoAll(logger) {
  const tasks = [
    { name: "Account Login", func: accountLogin },
    { name: "Check In", func: accountCheckIn },
    { name: "Check Profile", func: accountCheck },
    { name: "Claim Faucet", func: accountClaimFaucet },
    { name: "Claim USDC Faucet", func: claimFaucetUSDC },
    { name: "Swap to USDC", func: performSwapUSDC },
    { name: "Swap to USDT", func: performSwapUSDT },
    { name: "Add PHRS-USDC Liquidity", func: addLpUSDC },
    { name: "Add PHRS-USDT Liquidity", func: addLpUSDT },
    { name: "Random Transfer", func: randomTransfer },
    { name: "Social Tasks", func: socialTask },
    { name: "Mint Gotchipus", func: mintGotchipus },
    { name: "OpenFi", func: openFi },
    { name: "Deploy Pharos", func: deployPharos },
  ];

  for (const task of tasks) {
    logger(`System | Starting ${task.name}`);
    await task.func(logger);
    logger(`System | Completed ${task.name}`);
    await etc.delay(500);
  }

  logger(`System | All tasks completed`);
}

module.exports = {
  accountLogin,
  accountCheckIn,
  accountCheck,
  accountClaimFaucet,
  claimFaucetUSDC,
  performSwapUSDC,
  performSwapUSDT,
  addLpUSDC,
  addLpUSDT,
  randomTransfer,
  socialTask,
  mintGotchipus,
  openFi,
  deployPharos,
  autoAll,
};
