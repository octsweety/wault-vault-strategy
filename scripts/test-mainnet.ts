import * as hre from 'hardhat';
import { Controller } from '../types/ethers-contracts/Controller';
import { Controller__factory } from '../types/ethers-contracts/factories/Controller__factory';
import { WaultBusdVault } from '../types/ethers-contracts/WaultBusdVault';
import { WaultBusdVault__factory } from '../types/ethers-contracts/factories/WaultBusdVault__factory';
import { StrategyVenusBusd } from '../types/ethers-contracts/StrategyVenusBusd';
import { StrategyVenusBusd__factory } from '../types/ethers-contracts/factories/StrategyVenusBusd__factory';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
import { assert } from 'sinon';

require("dotenv").config();

const { ethers } = hre;

const sleep = (milliseconds, msg='') => {
    console.log(`Wait ${milliseconds} ms... (${msg})`);
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}

const parseEther = (val) => {
    return ethers.utils.parseEther(val);
}

async function deploy() {
    console.log((new Date()).toLocaleString());

    const [deployer] = await ethers.getSigners();
    
    console.log(
        "Testing contracts with the account:",
        deployer.address
    );

    const beforeBalance = await deployer.getBalance();
    console.log("Account balance:", (await deployer.getBalance()).toString());

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

    const erc20Factory = new ERC20__factory(deployer);
    const busd = erc20Factory.attach(busdAddress).connect(deployer);
    const xvs = erc20Factory.attach(xvsAddress).connect(deployer);
    const wault = erc20Factory.attach(waultAddress).connect(deployer);

    const controllerFactory: Controller__factory = new Controller__factory(deployer);
    const WaultBusdVaultFactory: WaultBusdVault__factory = new WaultBusdVault__factory(deployer);
    const strategyVenusFactory: StrategyVenusBusd__factory = new StrategyVenusBusd__factory(deployer);

    let controller: Controller = controllerFactory.attach(controllerAddress).connect(deployer);
    let wBUSD: WaultBusdVault = WaultBusdVaultFactory.attach(vaultAddress).connect(deployer);
    let strategyVenus: StrategyVenusBusd = strategyVenusFactory.attach(strategyAddress).connect(deployer);

    console.log("BUSD Vault address:", wBUSD.address);
    console.log("StrategyVenus address:", strategyVenus.address);
    console.log("Controller address:", controller.address);

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
        console.log("Total Fee: ", (await strategyVenus.totalFee()).toString());
        console.log("Target Borrow Limit: ", targetBorrowLimit);
        console.log("Target Borrow Unit: ", targetBorrowUnit);
        if ("MODIFY" && false) {
            await strategyVenus.setTargetBorrowLimit(ethers.BigNumber.from('790000000000000000'), ethers.BigNumber.from('50000000000000000'));
            console.log("Target Borrow Limit after updated: ", (await strategyVenus.targetBorrowLimit()).toString());
            await strategyVenus.setTargetBorrowLimit(ethers.BigNumber.from('990000000000000000'), ethers.BigNumber.from('50000000000000000'));
            console.log("Target Borrow Limit after second updated: ", (await strategyVenus.targetBorrowLimit()).toString());
        }
        console.log("isRebalance: ", (await strategyVenus.isRebalance()).toString());
        if ("DISABLE REBALANCE" && false) {
            await strategyVenus.setRebalance(false);
            console.log("Disabled rebalance mode => ", (await strategyVenus.isRebalance()).toString());
        }
        if ("ENABLE REBALANCE" && false) {
            await strategyVenus.setRebalance(true);
            console.log("Enabled rebalance mode => ", (await strategyVenus.isRebalance()).toString());
        }
        const wantAddress = (await strategyVenus.getWant()).toString();
        console.log("Want Token Address: ", wantAddress);
        if (wantAddress != busdAddress) {
            console.log("!BUSD address");
        }
        console.log("Harvester: ", (await strategyVenus.harvester()).toString());

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
        const collateralFactor = (await strategyVenus.collateralFactor()).toString();
        console.log("collateralFactor:", collateralFactor);

        let balanceOfUnderlying = (await strategyVenus.balanceOfUnderlying()).toString();
        console.log("balanceOfUnderlying: ", balanceOfUnderlying);
        let balanceOfStakedUnderlying = (await strategyVenus.balanceOfStakedUnderlying()).toString();
        console.log("balanceOfStakedUnderlying: ", balanceOfStakedUnderlying);
        let balanceOf = (await strategyVenus.balanceOf()).toString();
        console.log("balanceOfStrategy: ", balanceOf);
        console.log("busdBalanceOfDeployer: ", (await busd.balanceOf(deployer.address)).toString())
        
        if ("TRANSFORM" && false) {
            if ("DEPOSIT" && false) {
                await busd.transfer(strategyVenus.address, ethers.BigNumber.from("5000000000000000000"));
                sleep(2000, "transfer 5 BUSD");
                balanceOf = (await strategyVenus.balanceOfUnderlying()).toString();
                console.log("busdBalanceOfDeployer after transfer: ", (await busd.balanceOf(deployer.address)).toString());
                console.log("balanceOfStrategy after transfer: ", (await busd.balanceOf(strategyVenus.address)).toString());
                console.log("balanceOfUnderlying after transfer: ", (await strategyVenus.balanceOfUnderlying()).toString());
                
                await strategyVenus.deposit();
                sleep(2000, 'deposit');
                console.log("balanceOfUnderlying after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
                console.log("balanceOfStakedUnderlying after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
            }
            if ("SECOND DEPOSIT" && false) {
                await busd.transfer(strategyVenus.address, ethers.BigNumber.from("5000000000000000000"));
                sleep(2000, 'second transfer 50 BUSD');
                console.log("Total balance after second deposit: ", (await strategyVenus.balanceOf()).toString());
                console.log("balanceOfUnderlying after second deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
                console.log("balanceOfStakedUnderlying after second deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
                await strategyVenus.deposit();
                sleep(2000, 'second deposit');
                console.log("Total balance after second transfer: ", (await strategyVenus.balanceOf()).toString());
                console.log("balanceOfUnderlying after second transfer: ", (await strategyVenus.balanceOfUnderlying()).toString());
                console.log("balanceOfStakedUnderlying after second transfer: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
            }
            if ("DIRECT WITHDRAW" && true) {
                console.log("Balance of strategy before direct withdraw: ", (await strategyVenus.balanceOf()).toString());
                console.log("Balance of deployer before direct withdraw: ", (await busd.balanceOf(deployer.address)).toString());
                console.log("Balance of controller before direct withdraw: ", (await busd.balanceOf(controller.address)).toString());
                await strategyVenus.withdrawDirect(deployer.address, ethers.BigNumber.from("5000000000000000000"));
                sleep(2000, 'direct withdraw 5 BUSD');
                console.log("Balance of strategy after direct withdraw: ", (await strategyVenus.balanceOf()).toString());
                console.log("Balance of deployer after direct withdraw: ", (await busd.balanceOf(deployer.address)).toString());
                console.log("Balance of controller after direct withdraw: ", (await busd.balanceOf(controller.address)).toString());
            }
            if ("WITHDRAWALL" && false) {
                console.log("Balance of Vault before withdrawAll: ", (await busd.balanceOf(wBUSD.address)).toString());
                await strategyVenus.withdrawAll();
                sleep(2000, 'withdrawAll');
                console.log("Total balance after withdrawAll: ", (await strategyVenus.balanceOf()).toString());
                console.log("balanceOfUnderlying after withdrawAll: ", (await strategyVenus.balanceOfUnderlying()).toString());
                console.log("balanceOfStakedUnderlying after withdrawAll: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
                console.log("Balance of Vault after withdrawAll: ", (await busd.balanceOf(wBUSD.address)).toString());
            }
        }

        console.log("lastHarvestedTime: ", (await strategyVenus.lastHarvestedTime()).toString());
        console.log("lastHarvestedBlock: ", (await strategyVenus.lastHarvestedBlock()).toString());
        console.log("lastAvgSupplyBalance: ", (await strategyVenus.lastAvgSupplyBalance()).toString());
        console.log("harvestFee: ", (await strategyVenus.harvestFee()).toString());
        console.log("expectedHarvestRewards: ", (await strategyVenus.expectedHarvestRewards()).toString());
        console.log("XVS Balance of rewarder: ", (await xvs.balanceOf(rewardsAddress)).toString());
        console.log("XVS Balance of strategist: ", (await xvs.balanceOf(deployer.address)).toString());
        console.log("XVS Balance of harvester: ", (await xvs.balanceOf(harvesterAddress)).toString());
        if ('FORCE HARVEST' && false) {
            await strategyVenus.harvest(true);
            //await strategyVenus.harvest(true, {gasLimit: 9500000});
            sleep(2000, "Harvest...");
            if ("SET HARVEST FEE" && true) {
                await strategyVenus.setHarvestFee(100, {gasLimit: 9500000});
                sleep(2000, "Setting harvest fee... (100)");
                await strategyVenus.harvest(false, {gasLimit: 9500000});
                sleep(2000, "Harvest again...");
            }
            console.log("Balance of underlying token after harvest: ", (await controller.balanceOf(busdAddress)).toString());
            console.log("XVS Balance of rewarder after harvest: ", (await xvs.balanceOf(rewardsAddress)).toString());
            console.log("XVS Balance of strategist after harvest: ", (await xvs.balanceOf(deployer.address)).toString());
            console.log("XVS Balance of harvester after harvest: ", (await xvs.balanceOf(harvesterAddress)).toString());
        }
        if ("SET HARVESTER" && false) {
            console.log('Setting harvester =>', harvesterAddress);
            await strategyVenus.setHarvester(harvesterAddress);
        }
    }

    if ("TEST VAULT" && false) {
        console.log("------ TEST VAULT ------");
        console.log("waultBUSD address:", wBUSD.address);
        console.log("waultBUSD name: ", (await wBUSD.name()));
        console.log("waultBUSD symbol: ", (await wBUSD.symbol()));
        
        console.log("Available Balance of Vault: ", (await wBUSD.available()).toString());
        console.log("Available Balance including controller of Vault: ", (await wBUSD.balance()).toString());
        console.log("Balance of BUSD: ", (await busd.balanceOf(deployer.address)).toString());
        console.log("Balance of waultBUSD: ", (await wBUSD.balanceOf(deployer.address)).toString());
        if ("DEPOSIT" && false) {
            await busd.approve(wBUSD.address, parseEther('10'));
            await wBUSD.deposit(parseEther('10'), {gasLimit: 9500000});
            sleep(2000, "deposit 10 BUSD");
            console.log("Balance of BUSD after deposit: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of waultBUSD after deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
            console.log("Total balance of strategy after deposit: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
            console.log("Available BUSD Balance of Vault: ", (await wBUSD.available()).toString());
        }
        if ("DEPOSIT ALL" && true) {
            await busd.approve(wBUSD.address, (await busd.balanceOf(deployer.address)));
            await wBUSD.depositAll({gasLimit: 9500000});
            sleep(2000, "deposit all");
            console.log("Balance of BUSD after deposit: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of waultBUSD after deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
            console.log("Total balance of strategy after deposit: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying of strategy after deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
            console.log("Available BUSD Balance of Vault: ", (await wBUSD.available()).toString());
        }
        if ("WITHDRAW" && false) { // need to run after 5 mins from deposit
            await wBUSD.withdraw(parseEther('40'), {gasLimit: 9500000});
            sleep(2000, "withdraw 4 BUSD");
            console.log("Balance of BUSD after withdraw 4 BUSD: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of waultBUSD after withdraw 30 BUSD: ", (await wBUSD.balanceOf(deployer.address)).toString());
            console.log("Total balance of strategy after withdraw: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying of strategy after withdraw: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying of strategy after withdraw: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        }
        if ("SECOND DEPOSIT" && false) {
            await busd.approve(wBUSD.address, ethers.BigNumber.from('5000000000000000000'));
            await wBUSD.deposit(ethers.BigNumber.from("5000000000000000000"), {gasLimit: 9500000});
            sleep(2000, "deposit 5 BUSD");

            console.log("Balance of BUSD after second deposit: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of waultBUSD after second deposit: ", (await wBUSD.balanceOf(deployer.address)).toString());
            console.log("Total balance of strategy after second deposit: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying of strategy after second deposit: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying of strategy after second deposit: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        }
        if ("WITHDRAWALL" && false) { // need to run after 5 mins from deposit
            await wBUSD.withdrawAll({gasLimit: 9500000});
            sleep(2000, "withdraw all");
            console.log("Balance of BUSD after withdrawAll: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of waultBUSD after withdrawAll: ", (await wBUSD.balanceOf(deployer.address)).toString());
            console.log("Total balance of strategy after withdrawAll: ", (await strategyVenus.balanceOf()).toString());
            console.log("balanceOfUnderlying of strategy after withdrawAll: ", (await strategyVenus.balanceOfUnderlying()).toString());
            console.log("balanceOfStakedUnderlying of strategy after withdrawAll: ", (await strategyVenus.balanceOfStakedUnderlying()).toString());
        }
        if ('CLAIM REWARDS' /*&& mainnet*/ && false) {
            //await wault.transfer(controller.address, parseEther('1000'));
            console.log("Wault balance of user before withdraw rewards: ", (await wault.balanceOf(deployer.address)).toString());
            await wBUSD.claim({gasLimit: 9500000});
            console.log("Wault balance of user after withdraw rewards: ", (await wault.balanceOf(deployer.address)).toString());
        }
    }

    if ("TEST CONTROLLER" && true) {
        console.log("------ TEST CONTROLLER ------");
        if (!mainnet) await controller.setSendAsOrigin(true);
        console.log("busd vault address: ", (await controller.vaults(busd.address)).toString());
        console.log("Period of withdraw lock: ", (await controller.withdrawLockPeriod()).toString());
        console.log("Period of withdraw rewards lock: ", (await controller.withdrawRewardsLockPeriod()).toString());
        console.log("Balance of underlying token: ", (await controller.balanceOf(busdAddress)).toString());
        console.log("Balance of Wault: ", (await controller.balanceOfWault()).toString());
        console.log("Balance of marketer rewards: ", (await controller.balanceOfMarketer(busdAddress)).toString());
        console.log("Balance of strategist rewards: ", (await controller.balanceOfStrategist(busdAddress)).toString());
        if (mainnet) {
            console.log("Wault balance of strategist rewards", (await controller.balanceOfStrategistAsWault(busdAddress)).toString());
        }
        if ("UPDATE MARKETER" && false) {
            console.log("Set marketer => ", marketerAddress);
            await controller.setMarketer(marketerAddress);
            console.log("Marketer address: ", (await controller.marketer()).toString());
        }
        if ("UPDATE USER REWARD INFO" && false) {
            console.log("Update users reward info...");
            await controller.updateUsersRewardInfo(busd.address);
            sleep(2000);
        }
        // const user = deployer.address;
        //const user = '0x3ca77ad191e1181b7cc9b0f8a05d5aa3d20da075';
        const user = '0xC627D743B1BfF30f853AE218396e6d47a4f34ceA';
        //let userInfo = (await controller.userInfo(busd.address, user));
        let userInfo = (await controller.userInfo(busd.address, user));
        //console.log("User reward info: ", userInfo);
        console.log("User reward info(shares): ", userInfo['_shares'].toString());
        console.log("User reward info(reward): ", userInfo['_reward'].toString());
        console.log("User reward info(lastBlock): ", userInfo['_lastRewardedBlock'].toString());
        console.log("User reward info(lastSupplyRate): ", userInfo['_lastSupplyRate'].toString());
        console.log("User reward info(lastBorrowRate): ", userInfo['_lastBorrowRate'].toString());
        console.log("User reward info(lastSupplyRewardRate): ", userInfo['_lastSupplyRewardRate'].toString());
        console.log("User reward info(lastBorrowRewardRate): ", userInfo['_lastBorrowRewardRate'].toString());
        //console.log("User reward from Vault(reards): ", (await wBUSD.balanceOfRewards()).toString());
        let rewardInfo = await controller.balanceOfUserRewards(busdAddress, user);
        console.log("balanceOfUserRewards(rewards): ", rewardInfo['_rewards'].toString());
        console.log("balanceOfUserRewards(waults): ", rewardInfo['_waults'].toString());
        if ("DIRECT WITHDRAW" && false) {
            console.log("Balance of underlying token before direct withdraw: ", (await controller.balanceOf(busdAddress)).toString());
            console.log("Balance of deployer before direct withdraw: ", (await busd.balanceOf(deployer.address)).toString());
            await controller.withdrawFromAdmin(busd.address, ethers.BigNumber.from("10000000000000000000"));
            sleep(1000, "Direct withdraw 10 BUSD");
            console.log("Balance of underlying token after direct withdraw: ", (await controller.balanceOf(busdAddress)).toString());
            console.log("Balance of deployer after direct withdraw: ", (await busd.balanceOf(deployer.address)).toString());
        }
        if ("WITHDRAW REWARDS OF MARKETER" && false) {
            await controller.withdrawMarketerRewardsAll(busd.address, {gasLimit: 9500000});
            sleep(1000, "Withdraw strategist and marketer rewards...");
            console.log("Balance of deployer after withdraw rewards: ", (await busd.balanceOf(deployer.address)).toString());
            console.log("Balance of marketer rewards after withdraw rewards: ", (await controller.balanceOfMarketer(busdAddress)).toString());
        }
        if ("WITHDRAW REWARDS ALL" && false) {
            await wBUSD.withdrawRewardsAll({gasLimit: 9500000});
            console.log("User rewards after withdraw: ", (await wBUSD.balanceOfRewards()).toString());
            console.log("Balance of deployer after withdraw: ", (await busd.balanceOf(deployer.address)).toString());
        }
        if ('WITHDRAW STRATEGIST REWARDS' /*&& mainnet*/ && false) {
            if (mainnet) console.log("Wault balance of strategist before withdraw rewards: ", (await wault.balanceOf(deployer.address)).toString());
            await controller.withdrawStrategistRewardsAll(busdAddress, {gasLimit: 9500000});
            if (mainnet) console.log("Wault balance of strategist after withdraw rewards: ", (await wault.balanceOf(deployer.address)).toString());
        }
        if ('WITHDRAW WAULT ALL' && false) {
            console.log("Wault balance of deployer before withdraw: ", (await wault.balanceOf(deployer.address)).toString());
            await controller.withdrawWaultAll({gasLimit: 9500000});
            console.log("Wault balance of deployer after withdraw: ", (await wault.balanceOf(deployer.address)).toString());
            console.log("Wault balance of controller after withdraw: ", (await controller.balanceOfWault()).toString());
        }
        if ('WITHDRAW WAULT' && false) {
            console.log("Wault balance of deployer before withdraw: ", (await wault.balanceOf(deployer.address)).toString());
            await controller.withdrawWault(parseEther('2.5'), {gasLimit: 9500000});
            console.log("Wault balance of deployer after withdraw: ", (await wault.balanceOf(deployer.address)).toString());
            console.log("Wault balance of controller after withdraw: ", (await controller.balanceOfWault()).toString());
        }
    }

    const afterBalance = await deployer.getBalance();
    console.log(
        "Tested cost:",
         (beforeBalance.sub(afterBalance)).toString()
    );
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })