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

    const vbusdAddress = '0x08e0A5575De71037aE36AbfAfb516595fE68e5e4';
    const busdAddress = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47';
    const erc20Factory = new ERC20__factory(deployer);
    const busd = erc20Factory.attach(busdAddress).connect(deployer);
    const vbusd = erc20Factory.attach(vbusdAddress).connect(deployer);

    // const busdFactory = new ERC20__factory(deployer);
    // const busd = await busdFactory.deploy("Binance USD", "BUSD");
    // busd.mint(deployer.address, ethers.BigNumber.from('1000000000000000000'));

    const vaultAddress = '0xe07028156F161A66698F2a3AE94b6660f70F26d9';
    const strategistAddress = '0x8aACd9EB9B13df0D1eF99B684Fcbe75925055AC5';
    const controllerAddress = '0x9B9eb07882aF0a826DcEbe60e147E9607084A612';

    const controllerFactory: Controller__factory = new Controller__factory(deployer);
    const WaultBusdVaultFactory: WaultBusdVault__factory = new WaultBusdVault__factory(deployer);
    const strategyVenusFactory: StrategyVenusBusd__factory = new StrategyVenusBusd__factory(deployer);

    let controller: Controller = controllerFactory.attach(controllerAddress).connect(deployer);
    let wBUSD: WaultBusdVault = WaultBusdVaultFactory.attach(vaultAddress).connect(deployer);
    let strategyVenus: StrategyVenusBusd = strategyVenusFactory.attach(strategistAddress).connect(deployer);

    if ("REDEPLOY" && false) {
        console.log("Redeploy contracts...");
        controller = await controllerFactory.deploy();
        console.log("Deployed Controller...");
        wBUSD = await WaultBusdVaultFactory.deploy(busd.address, controller.address);
        console.log("Deployed Vault...");
        strategyVenus = await strategyVenusFactory.deploy(controller.address);
        console.log("Deployed Strategy...");
        // initialize
        await controller.setVault(busd.address, wBUSD.address);
        await controller.setStrategy(busd.address, strategyVenus.address);
        await controller.setWithdrawLockPeriod(300); // 5 mins
        await controller.setWithdrawRewardsLockPeriod(300); // 5 mins
        console.log("Initialized Controller...");
    }
    
    console.log("BUSD Vault address:", wBUSD.address);
    console.log("StrategyVenus address:", strategyVenus.address);
    console.log("Controller address:", controller.address);

    const strategist = deployer.address;
    const governance = deployer.address;
    if ("TEST STRATEGY" && true) {
        console.log("------ TEST STRATEGY ------");
        const _harvesterReward = (await strategyVenus._withdrawalFee()).toString();
        const _performanceFee = (await strategyVenus._performanceFee()).toString();
        const _strategistReward = (await strategyVenus._strategistReward()).toString();
        const targetBorrowLimit = (await strategyVenus.targetBorrowLimit()).toString();
        const targetBorrowUnit = (await strategyVenus.targetBorrowUnit()).toString();
        console.log("Harvest Rewards: ", _harvesterReward);
        console.log("Performance Fee: ", _performanceFee);
        console.log("Strategist Fee: ", _strategistReward);
        console.log("Total Fee: ", (await strategyVenus.totalFee()).toString());
        console.log("Target Borrow Limit: ", targetBorrowLimit);
        console.log("Target Borrow Unit: ", targetBorrowUnit);
        await strategyVenus.setTargetBorrowLimit(ethers.BigNumber.from('790000000000000000'), ethers.BigNumber.from('50000000000000000'));
        console.log("Target Borrow Limit after updated: ", (await strategyVenus.targetBorrowLimit()).toString());
        await strategyVenus.setTargetBorrowLimit(ethers.BigNumber.from('990000000000000000'), ethers.BigNumber.from('50000000000000000'));
        console.log("Target Borrow Limit after second updated: ", (await strategyVenus.targetBorrowLimit()).toString());
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
        const venusSpeed = (await strategyVenus.venusSpeeds()).toString();
        console.log("Venus Speed:", venusSpeed); // not working router in testnet
        console.log("Price of Venus:", (await strategyVenus.priceOfVenus()).toString());
        console.log("Supply Venus Rate per Block:", (await strategyVenus.supplyRewardRatePerBlock()).toString());
        console.log("Borrow Venus Rate per Block:", (await strategyVenus.borrowRewardRatePerBlock()).toString());
        console.log("test value:", (await strategyVenus.temp()).toString());

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
        console.log("balanceOfUnderlying after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());

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
        //await strategyVenus.withdrawDirect("0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47", ethers.BigNumber.from("20000000000000000000"));
        //console.log("Total balance after withdraw from fake: ", (await strategyVenus.balanceOf()).toString());
        //console.log("Balance of deployer after withdraw from fake: ", (await busd.balanceOf(deployer.address)).toString());
        await strategyVenus.withdrawDirect(deployer.address, ethers.BigNumber.from("20000000000000000000"));
        console.log("Total balance after withdraw from strategist: ", (await strategyVenus.balanceOf()).toString());
        console.log("Balance of deployer after withdraw from strategist: ", (await busd.balanceOf(deployer.address)).toString());
        if ("WITHDRAWALL" && false) {
            await strategyVenus.withdrawAll();
            sleep(2000, 'withdrawAll');
            console.log("Total balance after withdrawAll: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying after withdrawAll: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying after withdrawAll: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
            console.log("Balance of Vault after withdrawAll: ", (await busd.balanceOf(wBUSD.address)).toString());
        }
    }

    if ("TEST VAULT" && false) {
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

        console.log("Balance of BUSD after deposit: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("Balance of waultBUSD after deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
        console.log("Total balance of strategy after deposit: ", (await strategyVenus.balanceOf()).toString());
        console.log("balanceOfUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        
        console.log("Available BUSD Balance of Vault: ", (await wBUSD.available()).toString());
        
        await wBUSD.withdraw(ethers.BigNumber.from("30000000000000000000"), {gasLimit: 9500000});
        sleep(2000, "withdraw 30 BUSD");
        
        console.log("Balance of BUSD after withdraw 30 BUSD: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("Balance of waultBUSD after withdraw 30 BUSD: ", (await wBUSD.balanceOf(deployer.address)).toString());
        console.log("Total balance of strategy after withdraw: ", (await strategyVenus.balanceOf()).toString());
        console.log("balanceOfUnderlying of strategy after withdraw: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying of strategy after withdraw: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());

        await busd.approve(wBUSD.address, ethers.BigNumber.from('50000000000000000000'));
        await wBUSD.deposit(ethers.BigNumber.from("50000000000000000000"), {gasLimit: 9500000});
        sleep(2000, "deposit 50 BUSD");

        console.log("Balance of BUSD after second deposit: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("Balance of waultBUSD after second deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
        console.log("Total balance of strategy after second deposit: ", (await strategyVenus.balanceOf()).toString());
        console.log("balanceOfUnderlying of strategy after second deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
        console.log("balanceOfStakedUnderlying of strategy after second deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());

        if ("WITHDRAWALL" && false) {
            `await wBUSD.withdrawAll({gasLimit: 9500000});
            sleep(2000, "withdrawAll 80 BUSD");

            console.log("Balance of BUSD after withdrawAll: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of waultBUSD after withdrawAll: ", (await wBUSD.balanceOf(deployer.address)).toString());
            console.log("Total balance of strategy after withdrawAll: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying of strategy after withdrawAll: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying of strategy after withdrawAll: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());`
        }
    }

    if ("TEST CONTROLLER" && false) {
        console.log("------ TEST CONTROLLER ------");
        await controller.setSendAsOrigin(true);
        console.log("busd vault address: ", (await controller.vaults(busd.address)).toString());
        console.log("Period of withdraw lock: ", (await controller.withdrawLockPeriod()).toString());
        console.log("Period of withdraw rewards lock: ", (await controller.withdrawRewardsLockPeriod()).toString());
        console.log("Balance of underlying token: ", (await controller.balanceOf(busdAddress)).toString());
        console.log("Balance of marketer rewards: ", (await controller.balanceOfMarketer(busdAddress)).toString());
        console.log("Balance of strategist rewards: ", (await controller.balanceOfStrategist(busdAddress)).toString());
        //console.log("Wault balance of strategist rewards", (await controller.balanceOfStrategistAsWault(busdAddress)).toString());
        console.log("Set marketer => ", marketerAddress);
        await controller.setMarketer(marketerAddress);
        console.log("Marketer address: ", (await controller.marketer()).toString());
        console.log("Update users reward info...");
        await controller.updateUsersRewardInfo(busd.address);
        let userInfo = (await controller.userInfo(busd.address, deployer.address));
        //console.log("User reward info: ", userInfo);
        console.log("User reward info(shares): ", userInfo['_shares'].toString());
        console.log("User reward info(reward): ", userInfo['_reward'].toString());
        let vaultRewards = (await wBUSD.balanceOfRewards());
        console.log("User reward from Vault(reards): ", vaultRewards['_rewards'].toString());
        console.log("User reward from Vault(time): ", vaultRewards['_lastRewardedTime'].toString());
        strategyVenus.harvest();
        sleep(2000, "Harvest...");
        console.log("Balance of underlying token after harvest: ", (await controller.balanceOf(busdAddress)).toString());
        console.log("Balance of marketer rewards after harvest: ", (await controller.balanceOfMarketer(busdAddress)).toString());
        console.log("Balance of strategist rewards after harvest: ", (await controller.balanceOfStrategist(busdAddress)).toString());
        console.log("Balance of underlying token before direct withdraw: ", (await controller.balanceOf(busdAddress)).toString());
        console.log("Balance of deployer before direct withdraw: ", (await busd.balanceOf(deployer.address)).toString());
        await controller.withdrawFromAdmin(busd.address, ethers.BigNumber.from("10000000000000000000"));
        sleep(1000, "Direct withdraw 10 BUSD");
        console.log("Balance of underlying token after direct withdraw: ", (await controller.balanceOf(busdAddress)).toString());
        console.log("Balance of deployer after direct withdraw: ", (await busd.balanceOf(deployer.address)).toString());
        await controller.withdrawStrategistRewardsAll(busd.address, {gasLimit: 9500000});
        await controller.withdrawMarketerRewardsAll(busd.address, {gasLimit: 9500000});
        sleep(1000, "Withdraw strategist and marketer rewards...");
        console.log("Balance of deployer after withdraw rewards: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("Balance of marketer rewards after withdraw rewards: ", (await controller.balanceOfMarketer(busdAddress)).toString());
        console.log("Balance of strategist rewards after withdraw rewards: ", (await controller.balanceOfStrategist(busdAddress)).toString());
        await wBUSD.withdrawRewardsAll({gasLimit: 9500000});
        vaultRewards = (await wBUSD.balanceOfRewards());
        console.log("User rewards after withdraw: ", vaultRewards['_rewards'].toString());
        console.log("Balance of deployer after withdraw: ", (await busd.balanceOf(deployer.address)).toString());
    }

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