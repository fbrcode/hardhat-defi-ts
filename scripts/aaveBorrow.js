const { getNamedAccounts, ethers } = require('hardhat');
const { getWeth } = require('./getWeth');

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
  const lendingPool = await getLendingPoolAddress(deployer);
  // deposit to the lending pool
}

// instead of adding everything as source contracts, we can import some from: https://www.npmjs.com/package/@aave/protocol-v2
async function getLendingPoolAddress(deployer) {
  // https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts
  // Lending pool address provider (mainnet): 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  // Get the interface from: https://docs.aave.com/developers/v/2.0/the-core-protocol/addresses-provider/ilendingpooladdressesprovider
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    'ILendingPoolAddressesProvider',
    '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    deployer
  );
  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool();
  console.log(`Lending pool address: ${lendingPoolAddress}`);
  // Get the interface from: https://docs.aave.com/developers/v/2.0/the-core-protocol/lendingpool/ilendingpool
  const lendingPool = await ethers.getContractAt('ILendingPool', lendingPoolAddress, deployer);
  return lendingPool;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
