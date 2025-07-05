/**
 * src/utils/wallet.js - Wallet utilities
 */
const { ethers } = require('ethers');
const { loadConfig } = require('../config');

// Load configuration
const config = loadConfig();
const RPC_URL = config.api.zenith.rpc_url;

/**
 * Create a wallet instance from a private key
 */
function createWallet(privateKey) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    return new ethers.Wallet(privateKey, provider);
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
}

/**
 * Get wallet address
 */
function getWalletAddress(wallet) {
  return wallet.address;
}

/**
 * Sign message with wallet
 */
async function signMessage(wallet, message) {
  try {
    return await wallet.signMessage(message);
  } catch (error) {
    throw new Error(`Failed to sign message: ${error.message}`);
  }
}

/**
 * Get wallet balance
 */
async function getBalance(wallet) {
  try {
    const balance = await wallet.getBalance();
    return ethers.utils.formatEther(balance);
  } catch (error) {
    throw new Error(`Failed to get balance: ${error.message}`);
  }
}

/**
 * Validate and convert address to checksum format
 */
function toChecksumAddress(address) {
  try {
    return ethers.utils.getAddress(address);
  } catch (error) {
    throw new Error(`Invalid address format: ${address}`);
  }
}

module.exports = {
  createWallet,
  getWalletAddress,
  signMessage,
  getBalance,
  toChecksumAddress
};
