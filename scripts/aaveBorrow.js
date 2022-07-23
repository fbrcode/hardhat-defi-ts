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

  // Step 2: borrow from the lending pool

  // how much we have borrowed, how much we have in collateral, how much we can borrow
  const { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer);

  // availableBorrowsETH ?? What is the conversion rate to DAI to borrow?
  // https://docs.aave.com/developers/v/2.0/the-core-protocol/price-oracle
  // using chainlink price feeds
  const daiEthPrice = await getDaiPrice();
  // const allowedBorrowRatePct95 = availableBorrowsETH.toString() * 0.95;
  // const ethDaiUnit = 1 / daiEthPrice.toNumber();
  // console.log(`\nEth -> Dai unit price: ${ethDaiUnit}`);
  // console.log(`\nAllowed borrow: ${availableBorrowsETH.toString()}`);
  // console.log(`\Allowed 95 ptc: ${allowedBorrowRatePct95}`);
  const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiEthPrice.toNumber());
  const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString());
  console.log(`\nBorrowing ${amountDaiToBorrow.toFixed(4)} DAI [${amountDaiToBorrowWei} in Wei]...`);
  // execute the borrow function/transaction
  const daiTokenAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI mainnet address
  await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer);

  // check the user account data again
  await getBorrowUserData(lendingPool, deployer);

  // Step 3: repay the borrowed asset
  // https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool#repay
  console.log(`\nRepaying...`);
  await repay(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer);

  // check the user account data once more
  await getBorrowUserData(lendingPool, deployer);
}

async function repay(daiTokenAddress, lendingPool, amountDaiToRepayWei, account) {
  // we first need to approve to send the DAI back to the contract
  await approveErc20(daiTokenAddress, lendingPool.address, amountDaiToRepayWei, account);
  const rateMode = 1; // 1 = stable rate
  const repayTx = await lendingPool.repay(daiTokenAddress, amountDaiToRepayWei, rateMode, account);
  await repayTx.wait(1);
  let amountDaiToRepay = ethers.utils.formatEther(amountDaiToRepayWei.toString());
  amountDaiToRepay = (+amountDaiToRepay).toFixed(4);
  console.log(`\nRepaid ${amountDaiToRepay} DAI [${amountDaiToRepayWei} in Wei] to AAVE lending pool!`);
}

async function borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, account) {
  // https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool#borrow
  const interestRate = 1; // 1 = stable rate
  const referralCode = 0; // 0 means no referral
  const borrowTx = await lendingPool.borrow(daiTokenAddress, amountDaiToBorrowWei, interestRate, referralCode, account);
  await borrowTx.wait(1);
  // let amountDaiToBorrow = ethers.utils.formatEther(amountDaiToBorrowWei.toString());
  // amountDaiToBorrow = (+amountDaiToBorrow).toFixed(4);
  console.log(`Borrowed from AAVE lending pool!`);
}

// get the DAI price from given amount
// import interface from npm reference
// https://docs.chain.link/docs/get-the-latest-price/
// https://docs.chain.link/docs/ethereum-addresses/
// DAI / ETH on mainnet: 0x773616E4d11A78F511299002da57A0a94577F1f4
async function getDaiPrice() {
  // since we are not sending transactions (just reading), link to an account is not necessary
  const daiEthPriceFeed = await ethers.getContractAt(
    'AggregatorV3Interface',
    '0x773616E4d11A78F511299002da57A0a94577F1f4'
  );
  // https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol
  // we only need the answer value from latestRoundData, which is the second item in the array [1]
  const priceArray = await daiEthPriceFeed.latestRoundData();
  const price = priceArray[1];
  // const daiPerEth = ethers.utils.formatEther(price);
  // const ethPerDai = 1 / daiPerEth;
  console.log(`\nDAI/ETH price: ${price} in Wei`);
  console.log(`1 DAI = ${price / 1e18} ETH`);
  console.log(`1 ETH = ${(1 / price) * 1e18} DAI`);
  return price;
}

// get more information about the user in aave platform
// https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool#getuseraccountdata
async function getBorrowUserData(lendingPoolContract, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPoolContract.getUserAccountData(
    account
  );
  console.log(
    `\nUser account data:\n\t- Address: ${account}\n\t- Total collateral ETH deposited: ${ethers.utils.formatEther(
      totalCollateralETH
    )} [${totalCollateralETH} in Wei]\n\t- Total debt of ETH borrowed: ${ethers.utils.formatEther(
      totalDebtETH
    )} [${totalDebtETH} in Wei]\n\t- Available ETH to borrow: ${ethers.utils.formatEther(
      availableBorrowsETH
    )} [${availableBorrowsETH} in Wei]`
  );
  return { availableBorrowsETH, totalDebtETH };
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
