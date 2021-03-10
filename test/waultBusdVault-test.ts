import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';

import * as hre from 'hardhat';
import { Controller } from '../types/ethers-contracts/Controller';
import { Controller__factory } from '../types/ethers-contracts/factories/Controller__factory';
import { ERC20 } from '../types/ethers-contracts/ERC20';
import { ERC20__factory } from '../types/ethers-contracts/factories/ERC20__factory';
import { WaultBusdVault } from '../types/ethers-contracts/WaultBusdVault';
import { WaultBusdVault__factory } from '../types/ethers-contracts/factories/WaultBusdVault__factory';
import { Signer } from 'ethers';

const { ethers } = hre;

use(solidity);

describe('waultBusdVault', () => {
    let deployer: Signer;
    let controllerFactory: Controller__factory;
    let controller: Controller;
    let erc20Factory: ERC20__factory;
    let erc20BUSD: ERC20;
    let waultBusdVaultFactory: WaultBusdVault__factory;
    let waultBusdVault: WaultBusdVault;

    beforeEach(async () => {
        [ deployer ] = await ethers.getSigners();
        controllerFactory = new Controller__factory(deployer);
        erc20Factory = new ERC20__factory(deployer);
        waultBusdVaultFactory = new WaultBusdVault__factory(deployer);

        controller = await controllerFactory.deploy();
        erc20BUSD = await erc20Factory.deploy("Binance USD", "BUSD");
        waultBusdVault = await waultBusdVaultFactory.deploy(erc20BUSD.address, controller.address);
    });

    it('Should have name prefix with Wault', async () => {
        const prefixWithPlanu = /^(Wault)/g;
        const planuTokenName = await waultBusdVault.name();
        console.log(planuTokenName);
        expect(planuTokenName.match(prefixWithPlanu)[0]).to.equal('Wault');
    });

    it('Should have symbol prefix with wault', async () => {
        const prefixWithP = /^(wault)/g;
        const planuTokenSymbol = await waultBusdVault.symbol();
        expect(planuTokenSymbol.match(prefixWithP)[0]).to.equal('wault');
    });
});