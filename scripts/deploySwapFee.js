const factoryAddress = '0xe1cf8d44bb47b8915a70ea494254164f19b7080d';
const routerAddress = '0x38433227c7a606ebb9ccb0acfcd7504224659b74';
const auraTokenAddress = '0xdf2b1082ee98b48b5933378c8f58ce2f5aaff135';
const targetAPTokenAddress = '0x9903Ee9e2a67D82A2Ba37D087CC8663F9592716E';
const oracleAddress = '0xd099dF8fD5eEdBe00d88a41503FDcD89FD10E1f4';
const auraNFTAddress = '0xBa464cb9f2ff62f41288aF179F6C6F3290D4db43';

const { ethers } = require(`hardhat`);

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer address: ${deployer.address}`);

    console.log(`Deploy SwapFeeRewardsWithAP`);
    const SwapFeeRewardsWithAP = await ethers.getContractFactory('SwapFeeRewardsWithAP');
    const swapFeeRewardsWithAP = await SwapFeeRewardsWithAP.deploy(
        factoryAddress,
        routerAddress,
        auraTokenAddress,
        targetAPTokenAddress,
        oracleAddress,
        auraNFTAddress,
        auraTokenAddress
    );
    console.log(`SwapFeeRewardsWithAP deployed to ${swapFeeRewardsWithAP.address}`);
    // Deployed address = 0xBDAC56d43C7Cf9f0d64425c773cD7dAbeEED0Ca5
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
