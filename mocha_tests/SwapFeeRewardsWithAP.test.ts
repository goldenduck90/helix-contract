import chai, { expect, use } from 'chai';
import { Contract, constants } from 'ethers';
import { solidity, loadFixture, MockProvider, deployMockContract } from 'ethereum-waffle';

import { 
    factoryFixture,
    routerFixture,
    oracleFixture,
    auraNFTFixture,
    swapFeeRewardsWithAPFixture,
    auraLibraryFixture
} from './shared/swapFixtures';
import SwapFeeRewardsWithAP from '../build/contracts/SwapFeeRewardsWithAP.json';

use(solidity);

describe('SwapFeeRewardsWithAP', () => {
    let factory: Contract;
    let router: Contract;
    let targetToken: Contract;
    let targetAPToken: Contract;
    let mockOracle: Contract;
    let auraNFT: Contract;
    let auraToken: Contract;
    let swapFeeRewardsWithAP: Contract;

    let token1 = '0xbd95eC83bd5D4f574f540506E55EE1545adb01eD';
    let token2 = '0xA2eC19555C2d625D4BD6147609033e2b71128f37';
    let token3 = '0xffDD40B01c56Ab043038e4b4F18677193C5321E0';
    let token4 = '0x436b98aEd76BeD7B927f7718D1143f98adaC2033';

    const [wallet, otherWallet] = new MockProvider().getWallets();

    beforeEach(async () => {
        // Load all the contracts used in creating swapFeeRewardsWithAP contract.
        const fixture = await loadFixture(swapFeeRewardsWithAPFixture);
        factory = fixture.factory;
        router = fixture.router;
        targetToken = fixture.targetToken;
        targetAPToken = fixture.targetAPToken;
        mockOracle = fixture.mockOracle;
        auraNFT = fixture.auraNFT;
        auraToken = fixture.auraToken;
        swapFeeRewardsWithAP = fixture.swapFeeRewardsWithAP;
    });

    beforeEach(async () => {
        // Add 3 tokens to contract.
        await swapFeeRewardsWithAP.whitelistAdd(token1);
        await swapFeeRewardsWithAP.whitelistAdd(token2);
        await swapFeeRewardsWithAP.whitelistAdd(token3);
    });

    /*
     * WHITELIST
     */

    it('adds tokens to whitelist', async () => {
        // Confirm that each token was added.
        expect(await swapFeeRewardsWithAP.whitelistGet(0)).to.eq(token1);
        expect(await swapFeeRewardsWithAP.whitelistGet(1)).to.eq(token2);
        expect(await swapFeeRewardsWithAP.whitelistGet(2)).to.eq(token3);

        // And that the the length is correct.
        expect(await swapFeeRewardsWithAP.whitelistLength()).to.eq(3);
    });

    it('whitelist contains only the added tokens', async () => {
        // These tokens have been added. 
        expect(await swapFeeRewardsWithAP.whitelistContains(token1)).to.be.true;
        expect(await swapFeeRewardsWithAP.whitelistContains(token2)).to.be.true;
        expect(await swapFeeRewardsWithAP.whitelistContains(token3)).to.be.true;

        // This token has not been added.
        expect(await swapFeeRewardsWithAP.whitelistContains(token4)).to.be.false;
    });

    it('removes tokens from whitelist', async () => {
        // Remove each token.
        await swapFeeRewardsWithAP.whitelistRemove(token1);
        await swapFeeRewardsWithAP.whitelistRemove(token2);
        await swapFeeRewardsWithAP.whitelistRemove(token3);

        // And confirm that the length is correct.
        expect(await swapFeeRewardsWithAP.whitelistLength()).to.eq(0);
    });

    /*
     * ONLY OWNER SETTERS
     */

    it('sets factory as owner', async () => {
        const newFactory = await loadFixture(factoryFixture);
        await swapFeeRewardsWithAP.setFactory(newFactory.address);
        expect(await swapFeeRewardsWithAP.factory()).to.eq(newFactory.address);
    });

    it('sets router as owner', async () => {
        const newRouter = await loadFixture(routerFixture);
        await swapFeeRewardsWithAP.setRouter(newRouter.address);
        expect(await swapFeeRewardsWithAP.router()).to.eq(newRouter.address);
    });

    it('sets market as owner', async () => {
        const newMarket = { address: '0x946f52d986428284484d2007624ad0E88dfe6184' };
        await swapFeeRewardsWithAP.setMarket(newMarket.address);
        expect(await swapFeeRewardsWithAP.market()).to.eq(newMarket.address);
    });

    it('sets auction as owner', async () => {
        const newAuction = { address: '0x626Ef7da2f1365ed411630eDaa4D589F5BeD176e' };
        await swapFeeRewardsWithAP.setAuction(newAuction.address);
        expect(await swapFeeRewardsWithAP.auction()).to.eq(newAuction.address);
    });

    it('sets phase as owner', async () => {
        const newPhase = 2;
        await swapFeeRewardsWithAP.setPhase(newPhase);
        expect(await swapFeeRewardsWithAP.phase()).to.eq(2);
    });

    it('sets phaseAP as owner', async () => {
        const newPhaseAP = 3;
        await swapFeeRewardsWithAP.setPhaseAP(newPhaseAP);
        expect(await swapFeeRewardsWithAP.phaseAP()).to.eq(3);
    });

    it('sets oracle as owner', async () => {
        const newOracle = await loadFixture(oracleFixture);
        await swapFeeRewardsWithAP.setOracle(newOracle.address);
        expect(await swapFeeRewardsWithAP.oracle()).to.eq(newOracle.address);
    });

    it('sets AuraNFT as owner', async () => {
        const newAuraNFT = await loadFixture(auraNFTFixture);
        await swapFeeRewardsWithAP.setAuraNFT(newAuraNFT.address);
        expect(await swapFeeRewardsWithAP.auraNFT()).to.eq(newAuraNFT.address);
    });

    it('adds pair as owner', async () => {
        const newPair = {
            percentReward: 10,
            pair: '0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD'
        };

        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        const addedPair = await swapFeeRewardsWithAP.pairsList(0);
        expect(await swapFeeRewardsWithAP.getPairsListLength()).to.eq(1);
        expect(addedPair.pair).to.eq('0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD');
        expect(addedPair.percentReward.toNumber()).to.eq(10);
        expect(addedPair.isEnabled).to.be.true;
    });

    it('sets pair percent reward as owner', async () => {
        // Add pair and confirm addition.
        const newPair = {
            percentReward: 10,
            pair: '0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD'
        };

        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        const addedPair = await swapFeeRewardsWithAP.pairsList(0);
        expect(await swapFeeRewardsWithAP.getPairsListLength()).to.eq(1);
        expect(addedPair.pair).to.eq('0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD');
        expect(addedPair.percentReward.toNumber()).to.eq(10);
        expect(addedPair.isEnabled).to.be.true;

        // Set pair percent reward.
        const pairId = 0;
        const newPairReward = 11;

        await swapFeeRewardsWithAP.setPairPercentReward(pairId, newPairReward);

        const updatedPair = await swapFeeRewardsWithAP.pairsList(0);
        expect(await swapFeeRewardsWithAP.getPairsListLength()).to.eq(1);
        expect(updatedPair.pair).to.eq('0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD');
        expect(updatedPair.percentReward.toNumber()).to.eq(11);
        expect(updatedPair.isEnabled).to.be.true;
    });

    it('sets pair is enabled as owner', async () => {
        // Add pair and confirm addition.
        const newPair = {
            percentReward: 10,
            pair: '0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD'
        };

        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        const addedPair = await swapFeeRewardsWithAP.pairsList(0);
        expect(addedPair.pair).to.eq('0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD');
        expect(addedPair.percentReward.toNumber()).to.eq(10);
        expect(addedPair.isEnabled).to.be.true;

        // Set pair isEnabled.
        const pairId = 0;
        const newIsEnabled = false;

        await swapFeeRewardsWithAP.setPairIsEnabled(pairId, newIsEnabled);

        const updatedPair = await swapFeeRewardsWithAP.pairsList(0);
        expect(await swapFeeRewardsWithAP.getPairsListLength()).to.eq(1);
        expect(updatedPair.pair).to.eq('0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD');
        expect(updatedPair.percentReward.toNumber()).to.eq(10);
        expect(updatedPair.isEnabled).to.be.false;
    });

    it('sets AP reward as owner', async () => {
        const newAPWagerOnSwap = 10;
        const newAPPercentMarket = 11;
        const newAPPercentAuction = 12;

        await swapFeeRewardsWithAP.setAPReward(newAPWagerOnSwap, newAPPercentMarket, newAPPercentAuction);

        expect(await swapFeeRewardsWithAP.apWagerOnSwap()).to.eq(10);
        expect(await swapFeeRewardsWithAP.apPercentMarket()).to.eq(11);
        expect(await swapFeeRewardsWithAP.apPercentAuction()).to.eq(12);
    });

    /*
     * EXTERNAL GETTERS
     */

    it('gets pairs list length', async () => {
        // The list is empty to start.
        expect(await swapFeeRewardsWithAP.getPairsListLength()).to.eq(0);

        // Add pair and confirm addition.
        const newPair = {
            percentReward: 10,
            pair: '0x3cf0843c147d1c9dac9b467667634cdb6e9d7dAD'
        };
        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        // The list now has one entry.
        expect(await swapFeeRewardsWithAP.getPairsListLength()).to.eq(1);
    });

    it('gets account balance', async () => {
        const account = '0x3c1b46A41C1B32983bDFB62d77a7DEc856a836A0';
        // The balance should be empty.
        expect(await swapFeeRewardsWithAP.getBalance(account)).to.eq(0);
    });

    // TODO - test getPotentialRewardQuantities 
    /*
    it('gets potential reward quantities', async () => {
        // mock swap fee rewards

        // set getQuantityOut for diff arguments

        // confirm results
    });
    */

    /*
     * EXTERNAL SETTERS
     */

    // TODO - test accrueAPFromMarket
    /*
    it('accrues AP from market', async () => {
        // mock swap fee rewards

        // set market == wallet.address

        // mock.getQuantityOut()

        // confirm auraNFT.accrueAP updated.
    });
    */

    // TODO - test accrueAPFromAuction
    /*
    it('accrues AP from auction', async () => {
        // mock swap fee rewards

        // set auction== wallet.address

        // mock.getQuantityOut()

        // confirm auraNFT.accrueAP updated.
    });
    */


    it('sets the reward distribution', async () => {
        const newDistribution = 50;
        await swapFeeRewardsWithAP.setRewardDistribution(newDistribution);
        expect(await swapFeeRewardsWithAP.rewardDistribution(wallet.address)).to.eq(50);
    });

    /* 
     * PUBLIC UTILS
     */

    it('gets a pair that doesnt exist when no pairs have been added', async () => {
        let tokenA = '0xC244aa367ED76c5b986Ebe6E7A1e98CE59100Ed8';
        let tokenB = '0xEbe1a7B5ba930e9c1A36ff9Cd836Ac50833D4c2c';
        expect(await swapFeeRewardsWithAP.pairExists(tokenA, tokenB)).to.be.false;
    });

    it('gets a pair that doesnt exist when pairs have been added', async () => {
        // Add a pair.
        let tokenA = '0xC244aa367ED76c5b986Ebe6E7A1e98CE59100Ed8';
        let tokenB = '0xEbe1a7B5ba930e9c1A36ff9Cd836Ac50833D4c2c';
        const newPair = {
            percentReward: 10,
            pair: await swapFeeRewardsWithAP.pairFor(tokenA, tokenB)
        };
        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        let tokenC = '0x48844feE1FD833C0e41BB719Eb1c8Ae4C348f05C';
        expect(await swapFeeRewardsWithAP.pairExists(tokenA, tokenC)).to.be.false;
    });

    it('gets a pair that exists', async () => {
        let tokenA = '0xC244aa367ED76c5b986Ebe6E7A1e98CE59100Ed8';
        let tokenB = '0xEbe1a7B5ba930e9c1A36ff9Cd836Ac50833D4c2c';
        const newPair = {
            percentReward: 10,
            pair: await swapFeeRewardsWithAP.pairFor(tokenA, tokenB)
        };
        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        expect(await swapFeeRewardsWithAP.pairExists(tokenA, tokenB)).to.be.true;
    });

    it('gets quantity out when token in is same as token out', async () => {
        const tokenA = '0xC244aa367ED76c5b986Ebe6E7A1e98CE59100Ed8';
        const quantityIn = 10;
        expect(await swapFeeRewardsWithAP.getQuantityOut(tokenA, quantityIn, tokenA)).to.eq(10);
    });

    it('gets quantity out when token in is not token out but intermediate isnt needed', async () => {
        // Create a pair. 
        let tokenA = '0xC244aa367ED76c5b986Ebe6E7A1e98CE59100Ed8';
        let tokenB = '0xEbe1a7B5ba930e9c1A36ff9Cd836Ac50833D4c2c';
        let quantityIn = 10;
        const newPair = {
            percentReward: quantityIn,
            pair: await swapFeeRewardsWithAP.pairFor(tokenA, tokenB)
        };

        // Add pair to swapFeeRewardsWithAP.
        await swapFeeRewardsWithAP.addPair(newPair.percentReward, newPair.pair);

        // Create the pair in the factory.
        await factory.createPair(tokenA, tokenB);
        
        // Confirm that `else if` condition in getQuantityOut is entered.
        expect(await swapFeeRewardsWithAP.getPair(tokenA, tokenB)).to.not.eq(constants.AddressZero);
        expect(await swapFeeRewardsWithAP.pairExists(tokenA, tokenB)).to.be.true;
        
        // Set mock oracle parameters
        await mockOracle.mock.consult.withArgs(tokenA, quantityIn, tokenB).returns(20);

        // Confirm that the correnct value is returned by getQuantityOut.
        expect(await swapFeeRewardsWithAP.getQuantityOut(tokenA, quantityIn, tokenB)).to.eq(20);
    });

    /*
    it('gets quantity out in doesnt equal out and needs intermediate', async () => {
        // add pair 1 - (a, b)
        // add pair 2 - (b, c)
        // where wants (a -> c)

        // mock oracle

        // set mock oracle parameters
    });
    */

    /*
     * CORE
     */

    // TODO test swap - requires setting caller/msg.sender
    //                - requires getQuantityOutA
    /*
    it('performs a successful swap', async () => {
        // Get the router's address and call as the router.
        // Or, set the router's address to == `wallet`.

        // Create a mock of SwapFeeRewards

        // Add tokens `a` and `b` to whitelist.

        // pairFor(a, b) 

        // set mock.getSplitRewards
        // set mock.getQuantityOut

        // confirm balances ++
        // confirm event emission
        // confirm AP accrual
        // confirm returns true
    });
    */

    // TODO test withdraw - requires setting caller/msg.sender
    /*
    it('withdraws funds to callers account', async () => {
        // Create a mock swapFeeRewardsWithAP contract.
        const mockSwapFeeRewardsWithAP = await deployMockContract(wallet, SwapFeeRewardsWithAP.abi);
        //console.log("MOCK", mockSwapFeeRewardsWithAP);

        // Set the balances of caller to > 0.
        await mockSwapFeeRewardsWithAP.mock._balances.returns(1000);
        //console.log("MOCK BALANCE", (await mockSwapFeeRewardsWithAP._balances(wallet.address)).toNumber());

        // Call the contract to withdraw funds.
        // TODO - needs to send appropriate v, r, and s.
        //      - see ethers.transaction.{v, r, or s}

        // Test that the account's balance has changed.
    });
    */
});
