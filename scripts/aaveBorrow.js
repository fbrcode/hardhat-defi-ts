const { getNamedAccounts, ethers } = require('hardhat');
const { getWeth, AMOUNT } = require('./getWeth');

async function main() {
  // the protocol treats everything asn and ERC20 token
  await getWeth();
  const { deployer } = await getNamedAccounts();
  // interact with AAVE protocol (need abi + address)
  // create a function to get the address for the lending pool from the lending pool address provider on chain
  // https://docs.aave.com/developers/v/2.0/the-core-protocol/protocol-overview
  // https://docs.aave.com/developers/v/2.0/the-core-protocol/addresses-provider
  // https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
  // Lending pool address provider (mainnet): 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  const lendingPool = await getLendingPoolContract(deployer);

  // Step 1: deposit to the lending pool
  // https://github.com/aave/protocol-v2/blob/ice/mainnet-deployment-03-12-2020/contracts/protocol/lendingpool/LendingPool.sol
  // We'll call the safeTransferFrom inside the deposit function and for that we need to approve the aave contract to take the tokens
  const wethTokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // mainnet address
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  // after approving the aave contract to take the tokens, we can deposit the tokens
  console.log(`\nDepositing...`);
  // reference deposit tokens:
  // https://github.com/aave/protocol-v2/blob/ice/mainnet-deployment-03-12-2020/contracts/protocol/lendingpool/LendingPool.sol
  // https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool#deposit
  await lendingPool.deposit(
    wethTokenAddress, // ERC20 token address
    AMOUNT, // 0.02 WETH amount to deposit
    deployer, // user account
    0 // referral code (0 means no referral)
  );
  console.log(`Deposited ${ethers.utils.formatEther(AMOUNT)} WETH to AAVE lending pool!`);
}

// instead of adding everything as source contracts, we can import some from: https://www.npmjs.com/package/@aave/protocol-v2
async function getLendingPoolContract(account) {
  // https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
  // Lending pool address provider (mainnet): 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  // Get the interface from: https://docs.aave.com/developers/v/2.0/the-core-protocol/addresses-provider/ilendingpooladdressesprovider
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    'ILendingPoolAddressesProvider',
    '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    account
  );
  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool();
  console.log(`\nLending pool address: ${lendingPoolAddress}`);
  // Get the interface from: https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool/ilendingpool
  const lendingPool = await ethers.getContractAt('ILendingPool', lendingPoolAddress, account);
  return lendingPool;
}

// approve the aave contract to take the tokens
// spender is what we are going to give the approval to spend the tokens
async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
  // add IERC20 interface from https://www.npmjs.com/package/@openzeppelin/contracts
  const erc20Token = await ethers.getContractAt('IERC20', erc20Address, account);
  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log(
    `\nApproved ${ethers.utils.formatEther(
      amountToSpend
    )} WETH from ${erc20Address} WETH mainnet address\n...from user account: ${account}\n...to AAVE lending pool mainnet contract: ${spenderAddress}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
