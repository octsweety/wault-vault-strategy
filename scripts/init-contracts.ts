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

    const mainnet = true;
    
    const busdAddress = mainnet ?
                        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' : // mainnet
                        '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47'; // testnet
    
    const controllerAddress = mainnet ?
                        '0xb1aA6AB0eA881Ff1cc01bc0B289761d0DDe46f64' : // mainnet
                        '0x9e5b4Aa6f04a6aB9bC396Bc859102c9AbEc57081'; // testnet

    const vaultAddress = mainnet ?
                        '0xFBc149FeEd7C7982c825197b3eA8e367ac0aD265' : // mainnet
                        '0x6c471232657777a6b9Fbb46E04521748b7634Cd2'; // testnet

    const strategyAddress = mainnet ?
                        '0x3D78612D12A51c34DF4Fb439d84ccED7F51d10e0' : // mainnet
                        '0xE582dB523afc20bef03492a11D454758cf363760'; // testnet
    
    const rewardsAddress = '0xC627D743B1BfF30f853AE218396e6d47a4f34ceA';
    
    const controllerFactory: Controller__factory = new Controller__factory(deployer);
    const WaultBusdVaultFactory: WaultBusdVault__factory = new WaultBusdVault__factory(deployer);
    const strategyVenusFactory: StrategyVenusBusd__factory = new StrategyVenusBusd__factory(deployer);

    const controller: Controller = controllerFactory.attach(controllerAddress).connect(deployer);
    const wBUSD: WaultBusdVault = WaultBusdVaultFactory.attach(vaultAddress).connect(deployer);
    const strategyVenus: StrategyVenusBusd = strategyVenusFactory.attach(strategyAddress).connect(deployer);

    console.log("Setting withdraw lock period... (5 mins)");
    await controller.setWithdrawLockPeriod(300); // 5 mins
    console.log("Setting withdraw rewards lock period... (5 mins)");
    await controller.setWithdrawRewardsLockPeriod(300); // 5 mins
    console.log("Setting address to send rewards from strategy...");
    await controller.setRewards(rewardsAddress);
    console.log("Setting vault address to controller...");
    await controller.setVault(busdAddress, wBUSD.address);
    console.log("Setting strategy address to controller...");
    await controller.setStrategy(busdAddress, strategyVenus.address);
    if (!mainnet) {
        console.log("Disable router of strategy...");
        await strategyVenus.disableRouter();
        console.log("Setting rewards to send as original BUSD...");
        await controller.setSendAsOrigin(true);
    }
    console.log("Initialized Controller...");
    
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