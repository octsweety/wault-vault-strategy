//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IVenusComptroller.sol";
import "../libraries/SafeMath.sol";
import "./StrategyVenus.sol";

contract StrategyVenusBusd is StrategyVenus {
    using SafeMath for uint256;

    constructor(address _controller) {
        // testnet
        // _want = address(0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47);
        // _vToken = address(0x08e0A5575De71037aE36AbfAfb516595fE68e5e4);
        // mainnet
        _want = address(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);
        _vToken = address(0x95c78222B3D6e262426483D42CfA53685A67Ab9D);

        controller = _controller;
        strategist = msg.sender;
        governance = msg.sender;
        harvester = msg.sender;

        xvsToWantPath = [_xvs, _wbnb, _want];

        targetBorrowLimit = uint256(5900).mul(1e14);
        targetBorrowUnit = uint256(10).mul(1e14);

        (,uint256 _collateralFactor,) = IVenusComptroller(venusComptroller).markets(_vToken);
        if (targetBorrowLimit > _collateralFactor) targetBorrowLimit = _collateralFactor.sub(1e16);

        address[] memory _markets = new address[](1);
        _markets[0] = _vToken;
        IVenusComptroller(venusComptroller).enterMarkets(_markets);

        //_disabledRouter = true; // only available on testnet
    }
}