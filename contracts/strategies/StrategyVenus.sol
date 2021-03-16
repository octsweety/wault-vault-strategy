//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./StrategyStorage.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IVToken.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IVenusComptroller.sol";
import "../interfaces/IUniswapRouter.sol";
import "../libraries/SafeMath.sol";
import "../libraries/Address.sol";
import "../libraries/SafeERC20.sol";

import "hardhat/console.sol";

contract StrategyVenus is StrategyStorage, IStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address internal _want;
    address internal _vToken;
    // testnet
    address internal constant _xvs = address(0xB9e0E753630434d7863528cc73CB7AC638a7c8ff);
    address internal constant _wbnb = address(0x094616F0BdFB0b526bD735Bf66Eca0Ad254ca81F);
    address internal constant _wault = address(0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9);
    address internal constant venusComptroller = address(0x94d1820b2D1c7c7452A163983Dc888CEC546b77D);
    address internal constant uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    // mainnet
    // address internal constant _xvs = address(0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63);
    // address internal constant _wbnb = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    // address internal constant _wault = address(0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9);
    // address internal constant venusComptroller = address(0xfD36E2c2a6789Db23113685031d7F16329158384);
    // address internal constant uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);

    bool public _disabledClaim = false;
    bool public _disabledRouter = false;

    address[] internal xvsToWantPath;

    function deposit() external override {
        uint256 balanceOfWant = IERC20(_want).balanceOf(address(this));
        if (balanceOfWant > 0) {
            _supplyWant();
            _rebalance(0);
        }
    }

    function _supplyWant() internal {
      if(paused) return;
      uint256 want = IERC20(_want).balanceOf(address(this));
      if (want > 0) {
        IERC20(_want).safeApprove(_vToken, 0);
        IERC20(_want).safeApprove(_vToken, want);
        VBep20Interface(_vToken).mint(want);
      }
    }

    function _claimXvs() internal {
      address[] memory _markets = new address[](1);
      _markets[0] = _vToken;
      IVenusComptroller(venusComptroller).claimVenus(address(this), _markets);
    }

    function _convertRewardsToWant() internal {
        if (_disabledClaim == true || _disabledRouter == true) return;
        uint256 xvs = IERC20(_xvs).balanceOf(address(this));
        if(xvs > 0 ) {
            IERC20(_xvs).safeApprove(uniswapRouter, 0);
            IERC20(_xvs).safeApprove(uniswapRouter, xvs);

            IUniswapRouter(uniswapRouter).swapExactTokensForTokens(xvs, uint256(0), xvsToWantPath, address(this), block.timestamp.add(1800));
        }
    }

    function _rebalance(uint withdrawAmount) internal {
      uint256 _ox = VBep20Interface(_vToken).balanceOfUnderlying(address(this));
      if(_ox == 0) return;
      if(withdrawAmount >= _ox) withdrawAmount = _ox.sub(1);
      uint256 _x = _ox.sub(withdrawAmount);
      uint256 _y = VBep20Interface(_vToken).borrowBalanceCurrent(address(this));
      uint256 _c = collateralFactor();
      uint256 _L = _c.mul(targetBorrowLimit).div(1e18);
      uint256 _currentL = _y.mul(1e18).div(_x);
      uint256 _liquidityAvailable = VBep20Interface(_vToken).getCash();

      if(_currentL < _L && _L.sub(_currentL) > targetBorrowUnit) {
        uint256 _dy = _L.mul(_x).div(1e18).sub(_y).mul(1e18).div(uint256(1e18).sub(_L));
        uint256 _max_dy = _ox.mul(_c).div(1e18).sub(_y);
        if(_dy > _max_dy) _dy = _max_dy;
        if(_dy > _liquidityAvailable) _dy = _liquidityAvailable;
        VBep20Interface(_vToken).borrow(_dy);
        _supplyWant();
      } else {
        while(_currentL > _L && _currentL.sub(_L) > targetBorrowUnit) {
          uint256 _dy = _y.sub(_L.mul(_x).div(1e18)).mul(1e18).div(uint256(1e18).sub(_L));
          uint256 _max_dy = _ox.sub(_y.mul(1e18).div(_c));
          if(_dy > _max_dy) _dy = _max_dy;
          if(_dy > _liquidityAvailable) _dy = _liquidityAvailable;
          require(VBep20Interface(_vToken).redeemUnderlying(_dy) == 0, "_rebalance: redeem failed");

          _ox = _ox.sub(_dy);
          if(withdrawAmount >= _ox) withdrawAmount = _ox.sub(1);
          _x = _ox.sub(withdrawAmount);

          if(_dy > _y) _dy = _y;
          IERC20(_want).safeApprove(_vToken, 0);
          IERC20(_want).safeApprove(_vToken, _dy);
          VBep20Interface(_vToken).repayBorrow(_dy);
          _y = _y.sub(_dy);

          _currentL = _y.mul(1e18).div(_x);
          _liquidityAvailable = VBep20Interface(_vToken).getCash();
        }
      }
    }

    function harvest() external override returns (uint256) {
        // require(msg.sender == strategist || msg.sender == governance, "!authorized");
        // It would be a cron daemon in backend
        require(msg.sender == harvester, "!harvester");

        _claimXvs();

        uint xvs = IERC20(_xvs).balanceOf(address(this)); 
        uint256 harvesterReward;
        if (xvs > 0) {
            uint256 _fee = xvs.mul(_performanceFee).div(FEE_DENOMINATOR);
            uint256 _reward = xvs.mul(_strategistReward).div(FEE_DENOMINATOR);
            harvesterReward = xvs.mul(_harvesterReward).div(FEE_DENOMINATOR);
            IERC20(_xvs).safeTransfer(IController(controller).rewards(), _fee);
            IERC20(_xvs).safeTransfer(strategist, _reward);
            IERC20(_xvs).safeTransfer(msg.sender, harvesterReward);
        }

        _convertRewardsToWant();
        _supplyWant();
        _rebalance(0);

        return harvesterReward;
    }

    function withdraw(uint256 amount) external override {
        require(msg.sender == controller, "!controller");

        uint256 _balance = IERC20(_want).balanceOf(address(this));
        if (_balance < amount) {
            amount = _withdrawSome(amount.sub(_balance));
            amount = amount.add(_balance);
        }
        _sendToVaultWithFee(_want, amount);
    }

    function withdrawDirect(address recipient, uint256 amount) external override {
        require(msg.sender == controller || msg.sender == governance || msg.sender == strategist, "!permission");
        require(recipient != address(0), "!valid address");
        require(recipient == governance || recipient == strategist, "!valid recipient");

        uint256 _balance = IERC20(_want).balanceOf(address(this));
        if (_balance < amount) {
            amount = _withdrawSome(amount.sub(_balance));
            amount = amount.add(_balance);
        }
        _sendToWalletWithFee(_want, recipient, amount);
    }

    function withdrawAsWault(address recipient, uint256 amount) external override returns (uint256 _out) {
        require(msg.sender == controller, "!controller");
        require(recipient != address(0), "!valid address");
        require(_disabledRouter == false, "!enabled router");

        uint256 _balance = IERC20(_want).balanceOf(address(this));
        if (_balance < amount) {
            amount = _withdrawSome(amount.sub(_balance));
            amount = amount.add(_balance);
        }

        uint256 _fee = amount.mul(_withdrawalFee).div(FEE_DENOMINATOR);
        address[] memory swapPath = new address[](3);
        swapPath[0] = _want;
        swapPath[1] = _wbnb;
        swapPath[2] =_wault;
        _out = IUniswapRouter(uniswapRouter).swapExactTokensForTokens(amount.sub(_fee), uint256(0), swapPath, recipient, block.timestamp.add(1800))[2];
        IERC20(_want).safeTransfer(IController(controller).rewards(), _fee);
    }

    function _withdrawSome(uint256 _amount) internal returns (uint256) {
      _rebalance(_amount);
      uint _balance = VBep20Interface(_vToken).balanceOfUnderlying(address(this));
      if(_amount > _balance) _amount = _balance;
      require(VBep20Interface(_vToken).redeemUnderlying(_amount) == 0, "_withdrawSome: redeem failed");
      return _amount;
    }

    function withdrawAll() external override returns (uint256) {
        require(msg.sender == controller || msg.sender == strategist || msg.sender == governance, "!authorized");
        _withdrawAll();

        uint256 _balanceOfUnderlying = IERC20(_want).balanceOf(address(this));
        _sendToVault(_want, _balanceOfUnderlying);
        return _balanceOfUnderlying;
    }

    function _withdrawAll() internal {
       targetBorrowLimit = 0;
       targetBorrowUnit = 0;
       _rebalance(0);
       require(VBep20Interface(_vToken).redeem(VBep20Interface(_vToken).balanceOf(address(this))) == 0, "_withdrawAll: redeem failed");      
    }

    function withdrawalFee() external override view returns (uint256) {
        return _withdrawalFee;
    }
    
    function balanceOf() external override view returns (uint256) {
        return balanceOfUnderlying().add(balanceOfStakedUnderlying());
    }

    function balanceOfUnderlying() public view returns (uint256) {
        return IERC20(_want).balanceOf(address(this));
    }

    function _balanceOfVToken() internal view returns (uint256) {
        return VBep20Interface(_vToken).balanceOf(address(this));
    }

    function balanceOfStakedUnderlying() public view returns (uint256) {
        return VBep20Interface(_vToken).balanceOf(address(this)).mul(VTokenInterface(_vToken).exchangeRateStored()).div(1e18)
        .sub(VTokenInterface(_vToken).borrowBalanceStored(address(this)));
    }

    function collateralFactor() public view returns (uint256) {
      (,uint256 _collateralFactor,) = IVenusComptroller(venusComptroller).markets(_vToken);
      return _collateralFactor;
    }

    function getWant() external override view returns (address) {
        return _want;
    }

    function disableClaimMode() external {
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        _disabledClaim = true;
    }

    function disableRouter() external {
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        _disabledRouter = true;
    }

    function pause() external override {
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        _withdrawAll();
        paused = true;
    }

    function unpause() external override {
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        paused = false;
    }

    function supplyRatePerBlock() external override view returns (uint256) {
        return VTokenInterface(_vToken).supplyRatePerBlock();
    }

    function borrowRatePerBlock() external override view returns (uint256) {
        return VTokenInterface(_vToken).borrowRatePerBlock();
    }

    function venusSpeeds() external override view returns (uint256 _speed) {
        _speed = IVenusComptroller(venusComptroller).venusSpeeds(_vToken);
    }

    function supplyRewardRatePerBlock() external override view returns (uint256 rate) {
        uint256 venusSpeed = IVenusComptroller(venusComptroller).venusSpeeds(_vToken);
        uint256 totalSupply = VTokenInterface(_vToken).totalSupply();
        uint256 exchangeRate = VTokenInterface(_vToken).exchangeRateStored();
        uint256 venusPrice = priceOfVenus();

        // (venusPrice * venusPerDay / totalSupply * exchangeRate)
        rate = venusPrice.mul(venusSpeed).mul(1e18).div(totalSupply).div(exchangeRate);
    }

    function borrowRewardRatePerBlock() external override view returns (uint256 rate) {
        uint256 venusSpeed = IVenusComptroller(venusComptroller).venusSpeeds(_vToken);
        uint256 totalBorrows = VTokenInterface(_vToken).totalBorrows();
        uint256 venusPrice = priceOfVenus();

        // (venusPrice * venusSpeed / totalBorrows)
        rate = venusPrice.mul(venusSpeed).div(totalBorrows);
    }

    function priceOfVenus() public view returns (uint256) {
        if (_disabledRouter == true) return uint256(50).mul(1e18);

        address[] memory swapPath = new address[](3);
        swapPath[0] = _xvs;
        swapPath[1] = _wbnb;
        swapPath[2] = _want; // BUSD
        uint256 xvsPrice100x = IUniswapRouter(uniswapRouter).getAmountsOut(100, swapPath)[2];

        return xvsPrice100x.div(100);
    }

    function borrowLimit() external override view returns (uint256) {
        return targetBorrowLimit;
    }

    function totalVTokenSupply() external override view returns (uint256) {
        return VTokenInterface(_vToken).totalSupply();
    }

    function totalVTokenBorrows() external override view returns (uint256) {
        return VTokenInterface(_vToken).totalBorrows();
    }

    function setTargetBorrowLimit(uint256 _targetBorrowLimit, uint256 _targetBorrowUnit) external {
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        targetBorrowLimit = _targetBorrowLimit;
        targetBorrowUnit = _targetBorrowUnit;

        (,uint256 _collateralFactor,) = IVenusComptroller(venusComptroller).markets(_vToken);
        if (targetBorrowLimit > _collateralFactor) targetBorrowLimit = _collateralFactor.sub(1e16);
    }

    function totalFee() external override view returns (uint256) {
        return _performanceFee.add(_strategistReward).add(_harvesterReward);
    }

    function temp() external view returns (uint256) {
        // uint rate = 1614344197;
        // uint supply = 50000000000000000000;
        // uint after365 = rate.mul(supply).mul(10512000).div(1e18).mul(10000).div(supply);
        // return after365;

        //uint supply = 50000000000000000000;
        uint supply_rate = 5873641280;
        //uint borrow_rate = 8887851003;
        uint supply_xvs_rate = 1602106731;
        //uint borrow_xvs_rate = 2181841962;
        uint blocks = 10512000;

        //uint rate = 7937591393;
        uint rate = uint256(769738970).mul(targetBorrowLimit).div(1e18).add(supply_rate).add(supply_xvs_rate);
        uint after365 = blocks.mul(50000000000000000000).mul(rate).div(1e18).mul(10000).div(50000000000000000000);
        return after365;
    }
}
