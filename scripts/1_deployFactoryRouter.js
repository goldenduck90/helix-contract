/**
 * @dev AuraFactory and Router Deployment
 * 
 * command for deploy on bsc-testnet: 
 *      `npx hardhat run scripts/1_deployFactoryRouter.js --network testnetBSC`
 */

const { ethers } = require("hardhat");
const contracts = require("./constants/contracts")
const addresses = require("./constants/addresses")
const env = require("./constants/env")

async function deployAuraFactory() {
    
    console.log(`------ Start deploying AuraFactory contract ---------`);
    const AuraContractFactory = await ethers.getContractFactory("AuraFactory");
    const contract = await AuraContractFactory.deploy(addresses.setterFeeOnPairSwaps[env.network]);
    await contract.deployTransaction.wait();
    let instance = await contract.deployed();
    await instance.setFeeTo(addresses.poolReceiveTradFee[env.network]);
    let res = await instance.feeTo();
    console.log('fee - ', res);

    let INIT_CODE_HASH = await instance.INIT_CODE_HASH.call();
    console.log('INIT_CODE_HASH - ', INIT_CODE_HASH);
    console.log(`Aura Factory deployed to ${contract.address}`);
}

async function deployAuraRouter() {

    console.log(`------ Start deploying AuraRouter contract ---------`);
    const ContractRouter = await ethers.getContractFactory("AuraRouterV1");
    const contract = await ContractRouter.deploy(contracts.factory[env.network], contracts.WBNB[env.network]);
    await contract.deployTransaction.wait();

    console.log(`AuraRouter deployed to ${contract.address}`);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer address: ${deployer.address}`);

    // await deployAuraFactory();   
    await deployAuraRouter('test') 
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });