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

async function deploy() {
    const [deployer] = await ethers.getSigners();
    
    console.log(
        "Deploying contracts with the account:",
        deployer.address
    );

    const marketerAddress = '0xC627D743B1BfF30f853AE218396e6d47a4f34ceA';
    const beforeBalance = await deployer.getBalance();
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const controllerFactory: Controller__factory = new Controller__factory(deployer);
    const controller: Controller = await controllerFactory.deploy();

    console.log("Controller address:", controller.address);

    const vbusdAddress = '0x08e0A5575De71037aE36AbfAfb516595fE68e5e4';
    const busdAddress = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47';
    const erc20Factory = new ERC20__factory(deployer);
    const busd = erc20Factory.attach(busdAddress).connect(deployer);
    const vbusd = erc20Factory.attach(vbusdAddress).connect(deployer);

    // const busdFactory = new ERC20__factory(deployer);
    // const busd = await busdFactory.deploy("Binance USD", "BUSD");
    // busd.mint(deployer.address, ethers.BigNumber.from('1000000000000000000'));

    const WaultBusdVaultFactory: WaultBusdVault__factory = new WaultBusdVault__factory(deployer);
    const wBUSD: WaultBusdVault = await WaultBusdVaultFactory.deploy(busd.address, controller.address);

    const strategyVenusFactory: StrategyVenusBusd__factory = new StrategyVenusBusd__factory(deployer);
    const strategyVenus: StrategyVenusBusd = await strategyVenusFactory.deploy(controller.address);

    console.log("StrategyVenus address:", strategyVenus.address);

    // initialize
    await controller.setVault(busd.address, wBUSD.address);
    await controller.setStrategy(busd.address, strategyVenus.address);

    const strategist = deployer.address;
    const governance = deployer.address;
    if ("TEST STRATEGY" && false) {
        console.log("------ TEST STRATEGY ------");
        const _harvesterReward = (await strategyVenus._withdrawalFee()).toString();
        const _performanceFee = (await strategyVenus._performanceFee()).toString();
        const _strategistReward = (await strategyVenus._strategistReward()).toString();
        const targetBorrowLimit = (await strategyVenus.targetBorrowLimit()).toString();
        const targetBorrowUnit = (await strategyVenus.targetBorrowUnit()).toString();
        console.log("Harvest Rewards: ", _harvesterReward);
        console.log("Performance Fee: ", _performanceFee);
        console.log("Strategist Fee: ", _strategistReward);
        console.log("Target Borrow Limit: ", targetBorrowLimit);
        console.log("Target Borrow Unit: ", targetBorrowUnit);
        const wantAddress = (await strategyVenus.getWant()).toString();
        console.log("Want Token Address: ", wantAddress);
        if (wantAddress != busdAddress) {
            console.log("!BUSD address");
        }

        const supplyRatePerBlock = (await strategyVenus.supplyRatePerBlock()).toString();
        console.log("Supply Rate per Block: ", supplyRatePerBlock);
        const borrowRatePerBlock = (await strategyVenus.borrowRatePerBlock()).toString();
        console.log("Borrow Rate per Block: ", borrowRatePerBlock);
        console.log("Blocks per Min: ", (await strategyVenus.blocksPerMin()).toString());
        //const _supplyApy = (await strategyVenus._supplyApy()).toString();
        //console.log("Supply APY: ", _supplyApy);
        // const _borrowApy = (await strategyVenus._borrowApy()).toString();
        // console.log("Borrow APY: ", _borrowApy);
        const venusSpeed = (await strategyVenus.venusSpeeds()).toString();
        console.log("Venus Speed:", venusSpeed);
        let totalVTokenSupply = (await strategyVenus.totalVTokenSupply()).toString();
        console.log("Total Supply:", totalVTokenSupply);
        const totalVTokenBorrows = (await strategyVenus.totalVTokenBorrows()).toString();
        console.log("Total Borrows:", totalVTokenBorrows);

        let balanceOfUnderlying = (await strategyVenus.balanceOfUnderlying()).toString();
        console.log("balanceOfUnderlying: ", balanceOfUnderlying);
        let balanceOfStakedUnderlying = (await strategyVenus.balanceOfStakedUnderlying()).toString();
        console.log("balanceOfStakedUnderlying: ", balanceOfStakedUnderlying);
        let balanceOf = (await strategyVenus.balanceOf()).toString();
        console.log("balanceOfStrategy: ", balanceOf);
        console.log("busdBalanceOfDeployer: ", (await busd.balanceOf(deployer.address)).toString())
        await busd.transfer(strategyVenus.address, ethers.BigNumber.from("50000000000000000000"));
        sleep(2000, "transfer 50 BUSD");
        balanceOf = (await strategyVenus.balanceOfUnderlying()).toString();
        console.log("busdBalanceOfDeployer after transfer: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("balanceOfStrategy after transfer: ", (await busd.balanceOf(strategyVenus.address)).toString());
        console.log("balanceOfUnderlying after transfer: ", (await strategyVenus.balanceOfUnderlying()).toString());
        
        const collateralFactor = (await strategyVenus.collateralFactor()).toString();
        console.log("collateralFactor:", collateralFactor);
        await strategyVenus.deposit();
        sleep(2000, 'deposit');
        //balanceOfUnderlying = (await strategyVenus.balanceOfUnderlying()).toString();
        console.log("balanceOfUnderlying after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        //balanceOfStakedUnderlying = (await strategyVenus.balanceOfStakedUnderlying()).toString();
        console.log("balanceOfStakedUnderlying after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        totalVTokenSupply = (await strategyVenus.totalVTokenSupply()).toString();
        console.log("Total Supply after deposit:", totalVTokenSupply);

        await busd.transfer(strategyVenus.address, ethers.BigNumber.from("50000000000000000000"));
        sleep(2000, 'second transfer 50 BUSD');
        console.log("Total balance after second deposit: ", (await strategyVenus.balanceOf()).toString());
        console.log("balanceOfUnderlying after second deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying after second deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        await strategyVenus.deposit();
        sleep(2000, 'second deposit');
        console.log("Total balance after second transfer: ", (await strategyVenus.balanceOf()).toString());
        console.log("balanceOfUnderlying after second transfer: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying after second transfer: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        console.log("Balance of Vault before withdrawAll: ", (await busd.balanceOf(wBUSD.address)).toString());
        await strategyVenus.withdrawAll();
        sleep(2000, 'withdrawAll');
        console.log("Total balance after withdrawAll: ", (await strategyVenus.balanceOf()).toString());
        console.log("balanceOfUnderlying after withdrawAll: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying after withdrawAll: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        console.log("Balance of Vault after withdrawAll: ", (await busd.balanceOf(wBUSD.address)).toString());
    }

    if ("TEST VAULT" && true) {
        console.log("------ TEST VAULT ------");
        console.log("waultBUSD address:", wBUSD.address);
        console.log("waultBUSD name: ", (await wBUSD.name()));
        console.log("waultBUSD symbol: ", (await wBUSD.symbol()));
        
        console.log("Available BUSD Balance of Vault: ", (await wBUSD.available()).toString());
        console.log("Balance of BUSD: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("Balance of waultBUSD: ", (await wBUSD.balanceOf(deployer.address)).toString());

        await busd.approve(wBUSD.address, ethers.BigNumber.from('50000000000000000000'));
        await wBUSD.deposit(ethers.BigNumber.from("50000000000000000000"), {gasLimit: 9500000});
        sleep(2000, "deposit 50 BUSD");

        // console.log("Balance of BUSD after deposit: ", (await busd.balanceOf(deployer.address)).toString());
        // console.log("Balance of waultBUSD after deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
        // console.log("Total balance of strategy after deposit: ", (await strategyVenus.balanceOf()).toString());
        // console.log("balanceOfUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        // console.log("balanceOfStakedUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        
        // console.log("Available BUSD Balance of Vault: ", (await wBUSD.available()).toString());
        
        // await wBUSD.withdraw(ethers.BigNumber.from("30000000000000000000"), {gasLimit: 9500000});
        // sleep(2000, "withdraw 30 BUSD");
        
        // console.log("Balance of BUSD after withdraw 30 BUSD: ", (await busd.balanceOf(deployer.address)).toString());
        // console.log("Balance of waultBUSD after withdraw 30 BUSD: ", (await wBUSD.balanceOf(deployer.address)).toString());
        // console.log("Total balance of strategy after withdraw: ", (await strategyVenus.balanceOf()).toString());
        // console.log("balanceOfUnderlying of strategy after withdraw: ", (await strategyVenus.balanceOfUnderlying()).toString());
        // console.log("balanceOfStakedUnderlying of strategy after withdraw: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());

        // await busd.approve(wBUSD.address, ethers.BigNumber.from('50000000000000000000'));
        // await wBUSD.deposit(ethers.BigNumber.from("50000000000000000000"), {gasLimit: 9500000});
        // sleep(2000, "deposit 50 BUSD");

        // console.log("Balance of BUSD after second deposit: ", (await busd.balanceOf(deployer.address)).toString());
        // console.log("Balance of waultBUSD after second deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
        // console.log("Total balance of strategy after second deposit: ", (await strategyVenus.balanceOf()).toString());
        // console.log("balanceOfUnderlying of strategy after second deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        // console.log("balanceOfStakedUnderlying of strategy after second deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());

        // await wBUSD.withdrawAll({gasLimit: 9500000});
        // sleep(2000, "withdrawAll 80 BUSD");

        // console.log("Balance of BUSD after withdrawAll: ", (await busd.balanceOf(deployer.address)).toString());
        // console.log("Balance of waultBUSD after withdrawAll: ", (await wBUSD.balanceOf(deployer.address)).toString());
        // console.log("Total balance of strategy after withdrawAll: ", (await strategyVenus.balanceOf()).toString());
        // console.log("balanceOfUnderlying of strategy after withdrawAll: ", (await strategyVenus.balanceOfUnderlying()).toString());
        // console.log("balanceOfStakedUnderlying of strategy after withdrawAll: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
    }

    // await busd.approve(pBUSD.address, ethers.BigNumber.from('1000000000000000000'));

    // console.log("------ BEFORE DEPOSIT ------");
    // console.log("BUSD: ", (await busd.balanceOf(deployer.address)).toString());
    // console.log("pBUSD: ", (await pBUSD.balanceOf(deployer.address)).toString());

    // await pBUSD.deposit(
    //     ethers.BigNumber.from('1000000000000000000'),
    //     {
    //         gasLimit: 9500000
    //     }
    // );

    // console.log("------ BEFORE WITHDRAW ------")
    // console.log("BUSD: ", (await busd.balanceOf(deployer.address)).toString());
    // console.log("pUSD: ", (await pBUSD.balanceOf(deployer.address)).toString());

    // await pBUSD.withdrawAll(
    //     {
    //         gasLimit: 9500000
    //     }
    // );

    // console.log("------ AFTER WITHDRAW ------")
    // console.log("BUSD: ", (await busd.balanceOf(deployer.address)).toString());
    // console.log("pUSD: ", (await pBUSD.balanceOf(deployer.address)).toString());

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