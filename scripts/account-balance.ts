import * as hre from 'hardhat';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
const { ethers } = hre;

require("dotenv").config();

const toEther = (val) => {
    return ethers.utils.formatEther(val);
}

async function deploy() {
    const [deployer] = await ethers.getSigners();
    
    const mainnet = process.env.NETWORK == "mainnet" ? true : false;
    const busdAddress = mainnet ? process.env.BUSD_MAIN : process.env.BUSD_TEST;
    const waultAddress = mainnet ? process.env.WAULT_MAIN : process.env.WAULT_TEST;
    
    console.log("Account: ", deployer.address);
    const balance = await deployer.getBalance();
    console.log("Account balance(wei): ", balance.toString());
    console.log("Account balance(ether): ", toEther(balance));

    const erc20Factory = new ERC20__factory(deployer);
    const busd = erc20Factory.attach(busdAddress).connect(deployer);
    const busdBalance = await busd.balanceOf(deployer.address);
    console.log("BUSD balance(wei): ", busdBalance.toString());
    console.log("BUSD balance(ether): ", toEther(busdBalance));
    // await busd.transfer('0x6e3adB8F0E5CeB42F416e1815A03d5FCB7Fbf3C5', ethers.utils.parseEther('20'));

    if (mainnet) {
        const wault = erc20Factory.attach(waultAddress).connect(deployer);
        const waultBalance = await wault.balanceOf(deployer.address);
        console.log("Wault balance(wei): ", waultBalance.toString());
        console.log("Wault balance(ether): ", toEther(waultBalance));
    }
}

deploy()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })