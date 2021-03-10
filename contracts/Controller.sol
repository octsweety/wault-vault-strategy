//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/IStrategy.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IUniswapRouter.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/Address.sol";
import "./libraries/EnumerableSet.sol";
import "./libraries/SafeMath.sol";

contract Controller {
    using SafeERC20 for IERC20;
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;

    uint256 public _marketFee = 200;
    uint256 public _strategistFee = 800;
    uint256 public constant FEE_DENOMINATOR = 10000;

    bool internal _sendAsOrigin = false;

    mapping (address => uint256) internal _balanceOfMarketer;
    mapping (address => uint256) internal _balanceOfStrategist;

    // mainnet
    // address internal constant _uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    // address internal constant _wault = address(0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9);
    // address internal constant _wbnb = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);
    // address internal constant _xvs = address(0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63);
    // testnet
    address internal constant _uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    address internal constant _wault = address(0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9);
    address internal constant _wbnb = address(0x094616F0BdFB0b526bD735Bf66Eca0Ad254ca81F);
    address internal constant _xvs = address(0xB9e0E753630434d7863528cc73CB7AC638a7c8ff);

    // Info of each user
    struct UserReward {
        uint256 shares;
        uint256 rewardDebt;
        uint256 lastUpdatedTime;
        uint256 lastTotalSupply;
        uint256 lastTotalBorrows;
        uint256 lastSupplyRate;
        uint256 lastBorrowRate;
        uint256 lastRewardSpeed;
    }

    // Info of pool for vaults
    struct PoolInfo {
        uint256 lastTotalSupply;
        uint256 lastRewardBlock;
    }

    address public governance;
    address public strategist;
    address public rewards;
    address public marketer;

    // mapping between (token, vault)
    mapping (address => address) public vaults;

    // active strategy on certain token (token, strategy)
    mapping (address => address) public strategies;

    // token -> strategy[]
    mapping (address => EnumerableSet.AddressSet) availableStrategies;

    // Info of each user in vaults
    mapping(address => mapping(address => UserReward)) public userRewards;

    // Users in vaults
    mapping(address => EnumerableSet.AddressSet) users;

    mapping(address => PoolInfo) public poolInfo;

    // Path to swap wanted token to Wault
    mapping(address => address[]) swapPaths;

    modifier onlyAdmin {
        require(msg.sender == governance || msg.sender == strategist, "!admin");
        _;
    }

    constructor() {
        strategist = msg.sender;
        marketer = msg.sender;
        rewards = address(this);
    }

    function balanceOfMarketer(address _token) external view returns(uint256) {
        return _balanceOfMarketer[_token];
    }

    function balanceOfMarketerAsWault(address _token) external view returns(uint256) {
        return _balanceOfWault(_token, _balanceOfMarketer[_token]);
    }

    function balanceOfStrategist(address _token) external view returns(uint256) {
        return _balanceOfStrategist[_token];
    }

    function balanceOfStrategistAsWault(address _token) external view returns(uint256) {
        return _balanceOfWault(_token, _balanceOfStrategist[_token]);
    }

    function setMarketer(address _marketer) external onlyAdmin {
        marketer = _marketer;
    }

    function setRewards(address _rewards) external onlyAdmin {
        rewards = _rewards;
    }

    function userInfo(address _token, address _user) external view onlyAdmin returns(
        uint256 _shares,
        uint256 _lastUpdatedTime,
        uint256 _lastTotalSupply,
        uint256 _lastTotalBorrows,
        uint256 _lastSupplyRate,
        uint256 _lastBorrowRate,
        uint256 _lastRewardSpeed) {
        
        UserReward storage user = userRewards[vaults[_token]][_user];
        _shares = user.shares;
        _lastUpdatedTime = user.lastUpdatedTime;
        _lastTotalSupply = user.lastTotalSupply;
        _lastTotalBorrows = user.lastTotalBorrows;
        _lastSupplyRate = user.lastSupplyRate;
        _lastBorrowRate = user.lastBorrowRate;
        _lastRewardSpeed = user.lastRewardSpeed;
    }

    function setVault(address _token, address _vault) public onlyAdmin {
        require(vaults[_token] == address(0), "vault for this token already deployed");

        vaults[_token] = _vault;
    }

    function setSendAsOrigin(bool flag) external onlyAdmin {
        _sendAsOrigin = flag;
    }

    function setStrategy(address _token, address _strategy) public onlyAdmin {

        address current = strategies[_token];
        if (current != address(0)) {
            IStrategy(current).withdrawAll();
        }

        strategies[_token] = _strategy;
        addStrategy(_token, _strategy);
    }

    function addStrategy(address _token, address _strategy) public onlyAdmin {
        require(_strategy.isContract(), "Strategy is not a contract");
        require(!availableStrategies[_token].contains(_strategy), "Strategy already exists");

        availableStrategies[_token].add(_strategy);
    }

    function balanceOf(address _token) external view returns (uint256) {
        return IStrategy(strategies[_token]).balanceOf().add(IERC20(_token).balanceOf(address(this)));
    }

    function withdraw(address _token, uint256 _amount) external {
        require(msg.sender == vaults[_token], "!vault");
        IStrategy(strategies[_token]).withdraw(_amount);

        //_distributeRewards(_token, tx.origin);
    }

    function safeWidthdraw(address _token, uint256 _amount) internal returns (uint256) {
        // Check balance
        uint256 _before = IERC20(_token).balanceOf(address(this));
        if (_before < _amount) {
            uint256 _withdraw = _amount.sub(_before);
            IStrategy(strategies[_token]).withdraw(_withdraw);
            uint256 _after = IERC20(_token).balanceOf(address(this));
            uint256 _diff = _after.sub(_before);
            if (_diff < _withdraw) {
                _amount = _before.add(_diff);
            }
        }
        return _amount;
    }

    function earn(address _token, uint256 _amount) public {
        address _strategy = strategies[_token];
        address _want = IStrategy(_strategy).getWant();
        require(_want == _token, "!want");
        IERC20(_token).safeTransfer(_strategy, _amount);
        IStrategy(_strategy).deposit();

        _distributeRewards(_token, tx.origin);
    }

    function getBestStrategy(address _token) internal view returns (address bestStrategy) {
        bestStrategy = address(0);
        uint maxApy = 0;
        for (uint i = 0; i < availableStrategies[_token].length(); i++) {
            if (bestStrategy == address(0)) {
                bestStrategy = availableStrategies[_token].at(i);
                maxApy = IStrategy(availableStrategies[_token].at(i)).supplyRatePerBlock();
            }

            uint256 apy = IStrategy(availableStrategies[_token].at(i)).supplyRatePerBlock();
            if (maxApy < apy) {
                bestStrategy = availableStrategies[_token].at(i);
                maxApy = apy;
            }
        }

        return bestStrategy;
    }

    function invest(address _token, uint256 _amount) external {
        address currentStrategy = strategies[_token];
        address bestStrategy = getBestStrategy(_token);

        // if (currentStrategy == bestStrategy) {
        //     return;
        // }

        currentStrategy = bestStrategy;
        IERC20(_token).safeTransfer(currentStrategy, _amount);
        IStrategy(bestStrategy).deposit();

        _distributeRewards(_token, tx.origin);
    }

    function _updateRewards(address _token) internal {
        UserReward storage user = userRewards[vaults[_token]][tx.origin];
        PoolInfo storage pool = poolInfo[vaults[_token]];

        //_distributeRewards(_token);

        user.shares = IERC20(vaults[_token]).balanceOf(tx.origin);
        pool.lastRewardBlock = block.number;
        pool.lastTotalSupply = IStrategy(strategies[_token]).balanceOf();
    }

    function _distributeRewards(address _token, address _user) internal {
        uint256 totalRewards = _calculateRewards(_token, _user);
        uint256 marketFee = totalRewards.mul(_marketFee).div(FEE_DENOMINATOR);
        uint256 strategistFee = totalRewards.mul(_strategistFee).div(FEE_DENOMINATOR);
        uint256 userReward = totalRewards.sub(marketFee).sub(marketFee);
        
        UserReward storage user = userRewards[_token][_user];
        user.rewardDebt = user.rewardDebt.add(userReward);
        _balanceOfMarketer[_token] = _balanceOfMarketer[_token].add(marketFee);
        _balanceOfStrategist[_token] = _balanceOfStrategist[_token].add(strategistFee);

        _updateUserRewardInfo(_token, _user);
    }

    function _calculateRewards(address _token, address _user) internal view returns (uint256) {
        // return _rewards;
        uint256 _rewards = _calculateSupplyRewards(_token, _user);
        _rewards = _rewards.add(_calculateLeverageRewards(_token, _user));
        _rewards = _rewards.sub(_calculateNegotiateRewards(_token, _user));
        return _rewards;
    }

    function _calculateSupplyRewards(address _token, address _user) internal view returns (uint256) {
        UserReward storage user = userRewards[_token][_user];
        uint256 periodHours = block.timestamp.sub(user.lastUpdatedTime).div(3600);
        uint256 supplyApy = _apyFromRate(user.lastSupplyRate, user.lastUpdatedTime);
        uint256 borrowLimit = IStrategy(strategies[_token]).borrowLimit();
        uint supplyRewards = user.shares.mul(user.lastRewardSpeed).mul(240).mul(periodHours).div(user.lastTotalSupply);
        uint borrowRewards = user.shares.mul(borrowLimit).div(100).mul(user.lastRewardSpeed).mul(240).mul(periodHours).div(user.lastTotalBorrows);
        uint256 _rewards = user.shares.add(supplyRewards).add(borrowRewards).mul(supplyApy);

        return _rewards;
    }

    function _calculateLeverageRewards(address _token, address _user) internal view returns (uint256) {
        UserReward storage user = userRewards[_token][_user];
        uint256 supplyApy = _apyFromRate(user.lastSupplyRate, user.lastUpdatedTime);
        uint256 borrowLimit = IStrategy(strategies[_token]).borrowLimit();
        uint256 shares = user.shares;
        uint256 _rewards = shares.mul(borrowLimit).div(100).mul(supplyApy);

        return _rewards;
    }

    function _calculateNegotiateRewards(address _token, address _user) internal view returns (uint256) {
        UserReward storage user = userRewards[_token][_user];
        uint256 borrowApy = _apyFromRate(user.lastBorrowRate, user.lastUpdatedTime);
        uint256 borrowLimit = IStrategy(strategies[_token]).borrowLimit();
        uint256 _rewards = user.shares.mul(borrowLimit).div(100).mul(borrowApy);

        return _rewards;
    }

    function _apyFromRate(uint256 _rate, uint256 _lastTime) internal view returns (uint256) {
        uint256 periodHours = block.timestamp.sub(_lastTime).div(3600);
        uint256 blocksPerHour = 1200; // 20 * 60;
        uint256 rate = _rate;
        
        return ((rate.div(1e8).mul(blocksPerHour).add(1))**periodHours).sub(1).mul(100).sub(100);
    }

    function _updateUserRewardInfo(address _token, address _user) internal {
        UserReward storage user = userRewards[_token][_user];

        user.shares = IERC20(vaults[_token]).balanceOf(_user);
        user.lastUpdatedTime = block.timestamp;
        //user.lastTotalSupply = IStrategy(strategies[_token]).totalVTokenSupply();
        //user.lastTotalBorrows = IStrategy(strategies[_token]).totalVTokenBorrows();
        user.lastSupplyRate = IStrategy(strategies[_token]).supplyRatePerBlock();
        user.lastBorrowRate = IStrategy(strategies[_token]).borrowRatePerBlock();
        user.lastRewardSpeed = IStrategy(strategies[_token]).venusSpeeds();
        user.lastTotalSupply = IStrategy(strategies[_token]).totalVTokenSupply();
        user.lastTotalBorrows = IStrategy(strategies[_token]).totalVTokenBorrows();
    }

    function updateUsersRewardInfo(address _token) external {
        uint256 lastSupplyRate = IStrategy(strategies[_token]).supplyRatePerBlock();
        uint256 lastBorrowRate = IStrategy(strategies[_token]).borrowRatePerBlock();
        //uint256 lastRewardSpeed = IStrategy(strategies[_token]).venusSpeeds();
        uint256 lastTotalSupply = IStrategy(strategies[_token]).totalVTokenSupply();
        uint256 lastTotalBorrows = IStrategy(strategies[_token]).totalVTokenBorrows();

        for (uint i = 0; i < users[_token].length(); i++) {
            UserReward storage user = userRewards[_token][users[_token].at(i)];
            _calculateRewards(_token, users[_token].at(i));

            user.shares = IERC20(vaults[_token]).balanceOf(users[_token].at(i));
            user.lastUpdatedTime = block.timestamp;
            user.lastSupplyRate = lastSupplyRate;
            user.lastBorrowRate = lastBorrowRate;
            user.lastTotalSupply = lastTotalSupply;
            user.lastTotalBorrows = lastTotalBorrows;
        }
    }

    function withdrawRewards(address _token, uint256 _amount) external returns (uint256 _out) {
        require(msg.sender == vaults[_token], "!vault");
        UserReward storage user = userRewards[vaults[_token]][tx.origin];
        require(user.rewardDebt > 0, "!rewards");
        require(user.rewardDebt >= _amount, "!available balance");

        _out = sendAsWault(_token, tx.origin, _amount);
        user.rewardDebt = user.rewardDebt.sub(_amount);
    }

    function balanceOfRewards(address _token) external view returns (uint256) {
        require(msg.sender == vaults[_token], "!vault");
        UserReward storage user = userRewards[vaults[_token]][tx.origin];
        return user.rewardDebt;
    }

    function balanceOfUserRewards(address _token, address _user) external view returns (uint256) {
        UserReward storage user = userRewards[vaults[_token]][_user];
        return user.rewardDebt;
    }

    function withdrawStrategistRewards(address _token, uint256 _amount) external returns (uint256 _out) {
        require(msg.sender == strategist, "!strategist");
        require(_balanceOfStrategist[_token] > 0, "!balance");
        require(_balanceOfStrategist[_token] >= _amount, "!available balance");

        _out = sendAsWault(_token, msg.sender, _amount);
        _balanceOfStrategist[_token] = _balanceOfStrategist[_token].sub(_amount);
    }

    function withdrawMarketerRewards(address _token, uint256 _amount) external returns (uint256 _out) {
        require(msg.sender == marketer, "!marketer");
        require(_balanceOfMarketer[_token] > 0, "!balance");
        require(_balanceOfMarketer[_token] >= _amount, "!available balance");

        _out = sendAsWault(_token, msg.sender, _amount);
        _balanceOfMarketer[_token] = _balanceOfMarketer[_token].sub(_amount);
    }

    function sendAsWault(address _token, address _recipient, uint256 _amount) internal returns (uint256 _out) {
        if (_sendAsOrigin == true) {
            sendAsOrigin(_token, msg.sender, _amount);
            return _amount;
        }

        _out = IStrategy(strategies[_token]).withdrawAsWault(_recipient, _amount);
    }

    function _balanceOfWault(address _token, uint256 _amount) internal view returns (uint256) {
        if (_amount <= 0) return 0;
        address[] memory swapPath = new address[](3);
        swapPath[0] = _token;
        swapPath[1] = _wbnb;
        swapPath[2] =_wault;
        return IUniswapRouter(_uniswapRouter).getAmountsOut(_amount, swapPath)[2];
    }

    function sendAsOrigin(address _token, address _recipient, uint256 _amount) internal {
        IStrategy(strategies[_token]).withdraw(_recipient, _amount);
    }
}