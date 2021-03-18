import * as hre from 'hardhat';
import { Controller } from '../types/ethers-contracts/Controller';
import { Controller__factory } from '../types/ethers-contracts/factories/Controller__factory';
import { WaultBusdVault } from '../types/ethers-contracts/WaultBusdVault';
import { WaultBusdVault__factory } from '../types/ethers-contracts/factories/WaultBusdVault__factory';
import { StrategyVenusBusd } from '../types/ethers-contracts/StrategyVenusBusd';
import { StrategyVenusBusd__factory } from '../types/ethers-contracts/factories/StrategyVenusBusd__factory';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
import { assert } from 'sinon';

const { ethers } = hre;

const sleep = (milliseconds, msg='') => {
    console.log(`Wait ${milliseconds} ms... (${msg})`);
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

const toEther = (val) => {
    return ethers.utils.formatEther(val);
}

async function deploy() {
    const [deployer] = await ethers.getSigners();
    
    console.log(
        "Deploying contracts with the account:",
        deployer.address
    );

    const beforeBalance = await deployer.getBalance();
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const mainnet = false;
    
    const busdAddress = mainnet ?
                        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' : // mainnet
                        '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47'; // testnet
    
    const rewardsAddress = '0xC627D743B1BfF30f853AE218396e6d47a4f34ceA';
    const erc20Factory = new ERC20__factory(deployer);
    const busd = erc20Factory.attach(busdAddress).connect(deployer);

    const controllerFactory: Controller__factory = new Controller__factory(deployer);
    const WaultBusdVaultFactory: WaultBusdVault__factory = new WaultBusdVault__factory(deployer);
    const strategyVenusFactory: StrategyVenusBusd__factory = new StrategyVenusBusd__factory(deployer);

    const controller: Controller = await controllerFactory.deploy();
    console.log("Deployed Controller...");
    const wBUSD: WaultBusdVault = await WaultBusdVaultFactory.deploy(busd.address, controller.address);
    console.log("Deployed Vault...");
    const strategyVenus: StrategyVenusBusd = await strategyVenusFactory.deploy(controller.address);
    console.log("Deployed Strategy...");

    console.log("Setting withdraw lock period...");
    await controller.setWithdrawLockPeriod(300); // 5 mins
    console.log("Setting withdraw rewards lock period...");
    await controller.setWithdrawRewardsLockPeriod(300); // 5 mins
    console.log("Setting address to send rewards from strategy...");
    await controller.setRewards(rewardsAddress);
    console.log("Setting vault address to controller...");
    await controller.setVault(busdAddress, wBUSD.address);
    console.log("Setting strategy address to controller...");
    await controller.setStrategy(busdAddress, strategyVenus.address);
    if (!mainnet) {
        console.log("Disable router of strategy...");
        strategyVenus.disableRouter();
        console.log("Setting rewards to send as original BUSD...");
        await controller.setSendAsOrigin(true);
    }
    console.log("Initialized Contracts...");
    
    console.log("BUSD Vault address:", wBUSD.address);
    console.log("StrategyVenus address:", strategyVenus.address);
    console.log("Controller address:", controller.address);
    
    const afterBalance = await deployer.getBalance();
    console.log(
        "Deployed cost:",
         (beforeBalance.sub(afterBalance)).toString()
    );
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })