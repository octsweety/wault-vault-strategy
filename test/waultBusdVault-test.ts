import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { Controller } from '../types/ethers-contracts/Controller';
import { Controller__factory } from '../types/ethers-contracts/factories/Controller__factory';
import { WaultBusdVault } from '../types/ethers-contracts/WaultBusdVault';
import { WaultBusdVault__factory } from '../types/ethers-contracts/factories/WaultBusdVault__factory';
import { StrategyVenusBusd } from '../types/ethers-contracts/StrategyVenusBusd';
import { StrategyVenusBusd__factory } from '../types/ethers-contracts/factories/StrategyVenusBusd__factory';
import { Wault } from '../types/ethers-contracts/Wault';
import { Wault__factory } from '../types/ethers-contracts/factories/Wault__factory';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
import { Signer } from 'ethers';
import { assert } from 'node:console';
require("dotenv").config();

const { ethers } = hre;

use(solidity);

const parseEther = (val) => {
    return ethers.utils.parseEther(val);
}

const toEther = (val) => {
    return ethers.utils.formatEther(val);
}

const sleep = (milliseconds, msg='') => {
    console.log(`Wait ${milliseconds} ms... (${msg})`);
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

const mainnet = process.env.NETWORK == "mainnet" ? true : false;
const marketerAddress = process.env.MARKETER_ADDR;
const rewardsAddress = process.env.REWARDS_ADDR;
const harvesterAddress = process.env.HARVESTER_ADDR;
const waultAddress = mainnet ? process.env.WAULT_MAIN : process.env.WAULT_TEST;
const xvsAddress = mainnet ? process.env.XVS_MAIN : process.env.XVS_TEST;
const busdAddress = mainnet ? process.env.BUSD_MAIN : process.env.BUSD_TEST;
const controllerAddress = mainnet ? process.env.CONTROLLER_MAIN : process.env.CONTROLLER_TEST;
const vaultAddress = mainnet ? process.env.VAULT_MAIN : process.env.VAULT_TEST;
const strategyAddress = mainnet ? process.env.STRATEGY_MAIN : process.env.STRATEGY_TEST;
const redeploy = false;

console.log("Test network =>", process.env.NETWORK);

describe('Testing Wault Vault/Strategy...', () => {
    let deployer;
    let waultFactory: Wault__factory;
    let wault: Wault;
    let vaultFactory: WaultBusdVault__factory;
    let vault: WaultBusdVault;
    let strategyFactory: StrategyVenusBusd__factory;
    let strategy: StrategyVenusBusd;
    let controllerFactory: Controller__factory;
    let controller: Controller;
    let beforeBalance;
    let busd;

    before(async () => {
        
        let accounts  = await ethers.getSigners();

        deployer = accounts[0];
        console.log(`Deployer => ${deployer.address}`);
        beforeBalance = await deployer.getBalance();
        console.log("Deployer before balance => ", ethers.utils.formatEther(beforeBalance));

        waultFactory = new Wault__factory(deployer);
        wault = waultFactory.attach(waultAddress).connect(deployer);

        controllerFactory = new Controller__factory(deployer);
        controller = controllerFactory.attach(controllerAddress).connect(deployer);

        vaultFactory = new WaultBusdVault__factory(deployer);
        vault = vaultFactory.attach(vaultAddress).connect(deployer);

        strategyFactory = new StrategyVenusBusd__factory(deployer);
        strategy = strategyFactory.attach(strategyAddress).connect(deployer);

        if (redeploy) {
            controller = await controllerFactory.deploy();
            vault = await vaultFactory.deploy(busdAddress, controller.address);
            strategy = await strategyFactory.deploy(controller.address);
            await controller.setVault(busdAddress, vault.address);
            await controller.setStrategy(busdAddress, strategy.address);
        }

        console.log("Wault address: ", wault.address);
        console.log("Controller address: ", controller.address);
        console.log("Vault address: ", vault.address);
        console.log("Strategy address: ", strategy.address);

        const erc20Factory = new ERC20__factory(deployer);
        busd = erc20Factory.attach(busdAddress).connect(deployer);
        const busdBalance = await busd.balanceOf(deployer.address);
        console.log("BUSD balance(wei): ", busdBalance.toString());
        console.log("BUSD balance(ether): ", toEther(busdBalance));

        const waultBalance = await wault.balanceOf(deployer.address);
        console.log("Wault balance(wei): ", waultBalance.toString());
        console.log("Wault balance(ether): ", toEther(waultBalance));

        console.log('');
    });

    after(async () => {
        [ deployer ] = await ethers.getSigners();
        const afterBalance = await deployer.getBalance();
        console.log('');
        console.log("Deployer after balance => ", ethers.utils.formatEther(afterBalance));
        const cost = beforeBalance.sub(afterBalance);
        console.log("Test Cost: ", ethers.utils.formatEther(cost));
    });

    // it('Deposit', async () => {
    //     if ("skip" && false) return;

    //     const beforeBalance = await busd.balanceOf(deployer.address);
    //     const beforeDepositedAmount = await vault.balanceOf(deployer.address);
    //     const depositAmount = parseEther('100');
    //     await busd.approve(vault.address, parseEther('10000'));
    //     await vault.deposit(depositAmount, {gasLimit: 9500000});
    //     const afterBalance = await busd.balanceOf(deployer.address);
    //     const afterDepositedAmount = await vault.balanceOf(deployer.address);
    //     // expect(afterBalance).to.equal(beforeBalance.sub(depositAmount));
    //     // expect(afterDepositedAmount).to.equal(beforeDepositedAmount.add(depositAmount));
    // });

    // it('Withdraw All', async () => {
    //     if ("skip" && false) return;

    //     const beforeDepositedAmount = await vault.balanceOf(deployer.address);
    //     await vault.withdrawAll({gasLimit: 9500000});
    //     sleep(2000, `withdrawAll ${toEther(beforeDepositedAmount)} BUSD`);
    // });

    // it('Withdraw', async () => {
    //     if ("skip" && false) return;

    //     const withdrawAmount = ethers.BigNumber.from('1999999999803458208');
    //     await vault.withdraw(withdrawAmount, {gasLimit: 9500000});
    //     sleep(2000, `withdraw ${toEther(withdrawAmount)} BUSD`);
    // });

    it('Withdraw Direct', async () => {
        if ("skip" && false) return;

        const withdrawAmount = parseEther('100');
        await strategy.withdrawDirect(deployer.address, withdrawAmount, {gasLimit: 9500000});
        sleep(2000, `withdraw ${toEther(withdrawAmount)} BUSD`);
    });
});