// Script to deposit our ETH tokens to Weth tokens

// WETH token on Rinkeby
// https://rinkeby.etherscan.io/token/0xc778417e063141139fce010982780140aa0cd5ab

// Transfer 0.05 ETH to WETH
// https://rinkeby.etherscan.io/tx/0x2df5cdd74309189a21da0dcaea9d1ccb6c091b90f31916bc85242cca68fb9b43

const { getNamedAccounts, ethers } = require('hardhat');

const AMOUNT = ethers.utils.parseEther('0.02');

async function getWeth() {
  const { deployer } = await getNamedAccounts();
  // call the "deposit" function of the WETH contract (how? ==> abi ✅, contract address)
  // 0xc778417E063141139Fce010982780140Aa0cD5Ab (rinkeby)
  // 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 (mainnet)
  // abi can be extracted from interfaces
  const iWeth = await ethers.getContractAt('IWeth', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', deployer);
  const tx = await iWeth.deposit({ value: AMOUNT });
  await tx.wait(1);
  const wethBalance = await iWeth.balanceOf(deployer);
  console.log(`WETH balance: ${ethers.utils.formatEther(wethBalance)} WETH`);
}

// Use mainnet fork to test it out
// https://hardhat.org/hardhat-network/docs/guides/forking-other-networks

module.exports = { getWeth };
