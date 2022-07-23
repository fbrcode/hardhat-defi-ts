const { getWeth } = require('./getWeth');

async function main() {
  // the protocol treats everything asn and ERC20 token
  await getWeth();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
