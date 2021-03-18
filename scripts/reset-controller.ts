import * as hre from 'hardhat';
import { Controller } from '../types/ethers-contracts/Controller';
import { Controller__factory } from '../types/ethers-contracts/factories/Controller__factory';
import { WaultBusdVault } from '../types/ethers-contracts/WaultBusdVault';
import { WaultBusdVault__factory } from '../types/ethers-contracts/factories/WaultBusdVault__factory';
import { StrategyVenusBusd } from '../types/ethers-contracts/StrategyVenusBusd';
import { StrategyVenusBusd__factory } from '../types/ethers-contracts/factories/StrategyVenusBusd__factory';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
import { assert } from 'sinon';
import { ConsoleLogger } from 'ts-generator/dist/logger';

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
    
    const controllerAddress = mainnet ?
                        '0xb1aA6AB0eA881Ff1cc01bc0B289761d0DDe46f64' : // mainnet
                        '0x9e5b4Aa6f04a6aB9bC396Bc859102c9AbEc57081'; // testnet

    const vaultAddress = mainnet ?
                        '0xFBc149FeEd7C7982c825197b3eA8e367ac0aD265' : // mainnet
                        '0x6c471232657777a6b9Fbb46E04521748b7634Cd2'; // testnet

    const strategistAddress = mainnet ?
                        '0x3D78612D12A51c34DF4Fb439d84ccED7F51d10e0' : // mainnet
                        '0x3D4c9549A95A42943303c90529e27797005D032E'; // testnet
    
    const WaultBusdVaultFactory: WaultBusdVault__factory = new WaultBusdVault__factory(deployer);
    const strategyVenusFactory: StrategyVenusBusd__factory = new StrategyVenusBusd__factory(deployer);

    const wBUSD: WaultBusdVault = WaultBusdVaultFactory.attach(vaultAddress).connect(deployer);
    const strategyVenus: StrategyVenusBusd = strategyVenusFactory.attach(strategistAddress).connect(deployer);

    await wBUSD.setController(controllerAddress, {gasLimit: 9500000});
    console.log(`Updated controller of Valut (${controllerAddress})`);
    await strategyVenus.setController(controllerAddress, {gasLimit: 9500000});
    console.log(`Updated controller of Strategy (${controllerAddress})`);

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