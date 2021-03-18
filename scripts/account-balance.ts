import * as hre from 'hardhat';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
const { ethers } = hre;

const toEther = (val) => {
    return ethers.utils.formatEther(val);
}

async function deploy() {
    const [deployer] = await ethers.getSigners();
    
    //const busdAddress = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47'; // testnet
    const busdAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'; // mainnet

    const waultAddress = '0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9';
    
    console.log("Account: ", deployer.address);
    const balance = await deployer.getBalance();
    console.log("Account balance(wei): ", balance.toString());
    console.log("Account balance(ether): ", toEther(balance));

    const erc20Factory = new ERC20__factory(deployer);
    const busd = erc20Factory.attach(busdAddress).connect(deployer);
    const busdBalance = await busd.balanceOf(deployer.address);
    console.log("BUSD balance(wei): ", busdBalance.toString());
    console.log("BUSD balance(ether): ", toEther(busdBalance));

    if ('WAULT' && true) {
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