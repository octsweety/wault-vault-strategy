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

    uint256 public marketFee = 200;
    uint256 public strategistFee = 800;
    uint256 public calcDiffRate = 9990; // 0.999 difference
    uint256 public constant FEE_DENOMINATOR = 10000;

    bool internal _sendAsOrigin = false;
    uint256 public withdrawLockPeriod = 2592000; // 30 days
    uint256 public withdrawRewardsLockPeriod = 2592000; // 30 days

    uint256 public monthlyWaultTotalSupply = 2000000000000000000000; // 2000 WAULT
    uint256 public lastWaultDistributedBlock;

    mapping (address => uint256) internal _balanceOfMarketer;
    mapping (address => uint256) internal _balanceOfStrategist;

    address public _uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    address public _wault = address(0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9);
    address public _wbnb = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);

    // Info of each user
    struct UserReward {
        uint256 shares;
        uint256 rewardDebt;
        uint256 waultRewards;
        uint256 lastRewardedBlock;   
        uint256 lastRewardedTime;
        uint256 lastWithdrawRewardsTime;
        uint256 lastWithdrawTime;
        uint256 lastSupplyRate;
        uint256 lastBorrowRate;
        uint256 lastSupplyRewardRate;
        uint256 lastBorrowRewardRate;
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

    // Path to swap wanted token to Wault
    mapping(address => address[]) swapPaths;

    modifier onlyAdmin {
        require(msg.sender == governance || msg.sender == strategist, "!admin");
        _;
    }

    constructor() {
        governance = msg.sender;
        strategist = msg.sender;
        marketer = msg.sender;
        rewards = address(this);
    }

    function enableTestnet() external onlyAdmin {
        _uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
        _wault = address(0xC87957427D5b5caC14c7F5bB2CEfE9cb55774709);
        _wbnb = address(0x094616F0BdFB0b526bD735Bf66Eca0Ad254ca81F);

        _sendAsOrigin = true;
    }

    function balanceOfWault() public view returns(uint256) {
        return IERC20(_wault).balanceOf(address(this));
    }

    function withdrawWault(uint256 _amount) public onlyAdmin {
        uint256 _balance = balanceOfWault();
        if (_amount > _balance) _amount = _balance;
        IERC20(_wault).safeTransfer(msg.sender, _amount);
    }

    function withdrawWaultAll() external onlyAdmin {
        withdrawWault(balanceOfWault());
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

    function setStrategist(address _strategist) external onlyAdmin {
        strategist = _strategist;
    }

    function setGovernance(address _governance) external onlyAdmin {
        governance = _governance;
    }

    function setRewards(address _rewards) external onlyAdmin {
        rewards = _rewards;
    }

    function setStrategistFee(uint256 _fee) external onlyAdmin {
        strategistFee = _fee;
    }

    function setMarketFee(uint256 _fee) external onlyAdmin {
        marketFee = _fee;
    }

    function setCalcDiffRate(uint256 _rate) external onlyAdmin {
        calcDiffRate = _rate;
    }

    function userInfo(address _token, address _user) external view onlyAdmin returns(
        uint256 _shares,
        uint256 _reward,
        uint256 _waultReward,
        // uint256 _lastRewardedTime,
        uint256 _lastWithdrawTime,
        uint256 _lastRewardedBlock,
        uint256 _lastSupplyRate,
        uint256 _lastBorrowRate,
        uint256 _lastSupplyRewardRate,
        uint256 _lastBorrowRewardRate) {
        
        UserReward storage user = userRewards[vaults[_token]][_user];
        _shares = user.shares;
        _reward = user.rewardDebt;
        _waultReward = user.waultRewards;
        // _lastRewardedTime = user.lastRewardedTime;
        _lastWithdrawTime = user.lastWithdrawTime;
        _lastRewardedBlock = user.lastRewardedBlock;
        _lastSupplyRate = user.lastSupplyRate;
        _lastBorrowRate = user.lastBorrowRate;
        _lastSupplyRewardRate = user.lastSupplyRewardRate;
        _lastBorrowRewardRate = user.lastBorrowRewardRate;
    }

    function setSendAsOrigin(bool flag) external onlyAdmin {
        _sendAsOrigin = flag;
    }

    function setWithdrawLockPeriod(uint256 _period) external onlyAdmin {
        withdrawLockPeriod = _period;
    }

    function setWithdrawRewardsLockPeriod(uint256 _period) external onlyAdmin {
        withdrawRewardsLockPeriod = _period;
    }

    function setMonthlyWaultTotalSupply(uint256 _amount) external onlyAdmin {
        monthlyWaultTotalSupply = _amount;
    }

    function setVault(address _token, address _vault) public onlyAdmin {
        // require(vaults[_token] == address(0), "vault for this token already deployed");

        vaults[_token] = _vault;
    }
    
    function setStrategy(address _token, address _strategy) public onlyAdmin {
        addStrategy(_token, _strategy);

        address current = strategies[_token];
        if (current != address(0)) {
            IStrategy(current).withdrawAll();
        }

        strategies[_token] = _strategy;
    }

    function addStrategy(address _token, address _strategy) public onlyAdmin {
        require(_strategy.isContract(), "Strategy is not a contract");
        require(!availableStrategies[_token].contains(_strategy), "Strategy already exists");

        availableStrategies[_token].add(_strategy);
    }

    function balanceOf(address _token) external view returns (uint256) {
        return IStrategy(strategies[_token]).balanceOf().add(IERC20(_token).balanceOf(address(this)));
    }

    function withdrawFromAdmin(address _token, uint256 _amount) external onlyAdmin {
        IStrategy(strategies[_token]).withdrawDirect(msg.sender, _amount);
    }

    function withdraw(address _token, uint256 _amount) external {
        require(msg.sender == vaults[_token], "!vault");
        UserReward storage user = userRewards[vaults[_token]][tx.origin];
        require(user.lastWithdrawTime.add(withdrawLockPeriod) < block.timestamp, "!available to withdraw still");

        IStrategy(strategies[_token]).withdraw(_amount);

        _distributeRewards(_token, tx.origin);
        user.lastWithdrawTime = block.timestamp;
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
        // address bestStrategy = getBestStrategy(_token);

        // if (currentStrategy == bestStrategy) {
        //     return;
        // }

        // currentStrategy = bestStrategy;
        IERC20(_token).safeTransfer(currentStrategy, _amount);
        IStrategy(currentStrategy).deposit();

        _distributeRewards(_token, tx.origin);
    }

    function _distributeRewards(address _token, address _user) internal {
        uint256 totalRewards = _calculateRewards(_token, _user);
        if (totalRewards > 0) {
            uint256 _marketFee = totalRewards.mul(marketFee).div(FEE_DENOMINATOR);
            uint256 _strategistFee = totalRewards.mul(strategistFee).div(FEE_DENOMINATOR);
            uint256 userReward = totalRewards.sub(_marketFee).sub(_strategistFee);
            
            UserReward storage user = userRewards[vaults[_token]][_user];
            user.rewardDebt = user.rewardDebt.add(userReward);
            _balanceOfMarketer[_token] = _balanceOfMarketer[_token].add(_marketFee);
            _balanceOfStrategist[_token] = _balanceOfStrategist[_token].add(_strategistFee);
        }
        _updateUserRewardInfo(_token, _user);
    }

    function _calculateRewards(address _token, address _user) internal view returns (uint256) {
        UserReward storage user = userRewards[vaults[_token]][_user];
        uint256 blocks = block.number.sub(user.lastRewardedBlock);
        uint256 totalRate = _calculateTotalRatePerBlock(_token, _user);

        uint256 _rewards = user.shares.mul(blocks).mul(totalRate).div(1e18);
        return _rewards.mul(calcDiffRate).div(FEE_DENOMINATOR);
    }

    function _calculateTotalRatePerBlock(address _token, address _user) internal view returns (uint256) {
        UserReward storage user = userRewards[vaults[_token]][_user];
        uint256 leverageRate = user.lastSupplyRate.add(user.lastSupplyRewardRate).add(user.lastBorrowRewardRate);
        if (IStrategy(strategies[_token]).isRebalance() == false) leverageRate = 0;
        else if (user.lastBorrowRate > leverageRate) leverageRate = 0;
        else leverageRate = leverageRate.sub(user.lastBorrowRate);
        uint256 totalRate = leverageRate
                        .mul(IStrategy(strategies[_token]).borrowLimit()).div(1e18)
                        .add(user.lastSupplyRate)
                        .add(user.lastSupplyRewardRate);

        return totalRate;
    }

    function _updateUserRewardInfo(address _token, address _user) internal {
        UserReward storage user = userRewards[vaults[_token]][_user];

        uint256 available = FEE_DENOMINATOR.sub(IStrategy(strategies[_token]).totalFee());
        user.shares = IERC20(vaults[_token]).balanceOf(_user);
        user.lastRewardedBlock = block.number;
        user.lastRewardedTime = block.timestamp;
        if (user.lastWithdrawTime == 0) user.lastWithdrawTime = block.timestamp;
        if (user.lastWithdrawRewardsTime == 0) user.lastWithdrawRewardsTime = block.timestamp;
        if (lastWaultDistributedBlock == 0) lastWaultDistributedBlock = block.number;
        user.lastSupplyRate = IStrategy(strategies[_token]).supplyRatePerBlock();
        user.lastBorrowRate = IStrategy(strategies[_token]).borrowRatePerBlock();
        user.lastSupplyRewardRate = IStrategy(strategies[_token]).supplyRewardRatePerBlock().mul(available).div(1e4);
        user.lastBorrowRewardRate = IStrategy(strategies[_token]).borrowRewardRatePerBlock().mul(available).div(1e4);

        if (users[_token].contains(_user) == false) {
            users[_token].add(_user);
        }
    }

    function _distributeWaultRewards(address _token, address _user) internal {
        require(lastWaultDistributedBlock < block.number, "will distribute from the next time");
            
        UserReward storage user = userRewards[vaults[_token]][_user];
        uint256 waultRewardsPerBlock = monthlyWaultTotalSupply.div(864000); // blocks per 30 days
        uint256 totalSupply = IERC20(vaults[_token]).totalSupply();
        uint256 waultRewards = block.number.sub(lastWaultDistributedBlock).mul(waultRewardsPerBlock).mul(user.shares).div(totalSupply);
        user.waultRewards = user.waultRewards.add(waultRewards);
    }

    function updateUsersRewardInfo(address _token) external {
        if (lastWaultDistributedBlock == 0) {
            lastWaultDistributedBlock = block.number;
            return;
        }
        for (uint i = 0; i < users[_token].length(); i++) {
            _distributeWaultRewards(_token, users[_token].at(i));
            _distributeRewards(_token, users[_token].at(i));
        }
        lastWaultDistributedBlock = block.number;
    }

    function claim(address _token, uint256 _amount) external returns (uint256 _out) {
        require(msg.sender == vaults[_token], "!vault");
        UserReward storage user = userRewards[vaults[_token]][tx.origin];
        require(user.lastWithdrawRewardsTime.add(withdrawRewardsLockPeriod) < block.timestamp, "!available to withdraw rewards still");
        require(user.rewardDebt > 0 || user.waultRewards > 0, "!rewards");

        uint256 overflow = 0;
        if (_amount > user.waultRewards) {
            overflow = _amount.sub(user.waultRewards);
            _amount = user.waultRewards;
        }
        if (_amount > 0) {
            if (_amount > balanceOfWault()) {
                overflow = overflow.add(_amount.sub(balanceOfWault()));
                _amount = balanceOfWault();
            }
            IERC20(_wault).safeTransfer(tx.origin, _amount);
            user.waultRewards = user.waultRewards.sub(_amount);
            _out = _amount;
        }
        if (overflow > 0 && _sendAsOrigin == false) {
            _amount = _amountFromWault(_token, overflow);
            if (_amount > user.rewardDebt) {
                _amount = user.rewardDebt;
            }
            _out = _out.add(sendAsWault(_token, tx.origin, _amount));
            user.rewardDebt = user.rewardDebt.sub(_amount);
        }
        
        user.lastWithdrawRewardsTime = block.timestamp;
    }

    function balanceOfRewards(address _token) external view returns (uint256 _rewards) {
        require(msg.sender == vaults[_token], "!vault");
        UserReward storage user = userRewards[vaults[_token]][tx.origin];
        _rewards = _balanceOfWault(_token, user.rewardDebt).add(user.waultRewards);
    }

    function balanceOfUserRewards(address _token, address _user) external view returns (uint256 _rewards, uint256 _waults, uint256 _lastRewardedTime) {
        UserReward storage user = userRewards[vaults[_token]][_user];
        _rewards = user.rewardDebt;
        _waults = user.waultRewards;
        _lastRewardedTime = user.lastRewardedTime;
    }

    function withdrawStrategistRewards(address _token, uint256 _amount) public returns (uint256 _out) {
        require(msg.sender == strategist, "!strategist");
        require(_balanceOfStrategist[_token] > 0, "!balance");
        require(_balanceOfStrategist[_token] >= _amount, "!available balance");

        _out = sendAsWault(_token, msg.sender, _amount);
        _balanceOfStrategist[_token] = _balanceOfStrategist[_token].sub(_amount);
    }

    function withdrawStrategistRewardsAll(address _token) external returns (uint256 _out) {
        require(msg.sender == strategist, "!strategist");
        require(_balanceOfStrategist[_token] > 0, "!balance");
        _out = withdrawStrategistRewards(_token, _balanceOfStrategist[_token]);
    }

    function withdrawMarketerRewards(address _token, uint256 _amount) public returns (uint256 _out) {
        require(msg.sender == marketer, "!marketer");
        require(_balanceOfMarketer[_token] > 0, "!balance");
        require(_balanceOfMarketer[_token] >= _amount, "!available balance");

        _out = sendAsWault(_token, msg.sender, _amount);
        _balanceOfMarketer[_token] = _balanceOfMarketer[_token].sub(_amount);
    }

    function withdrawMarketerRewardsAll(address _token) external returns (uint256 _out) {
        require(msg.sender == marketer, "!marketer");
        require(_balanceOfMarketer[_token] > 0, "!balance");
        _out = withdrawMarketerRewards(_token, _balanceOfMarketer[_token]);
    }

    function sendAsWault(address _token, address _recipient, uint256 _amount) internal returns (uint256 _out) {
        if (_sendAsOrigin == true) {
            sendAsOrigin(_token,_recipient, _amount);
            return _amount;
        }

        _out = IStrategy(strategies[_token]).withdrawAsWault(_recipient, _amount);
    }

    function _balanceOfWault(address _token, uint256 _amount) internal view returns (uint256) {
        if (_amount == 0 || _sendAsOrigin == true) return 0;
        address[] memory swapPath = new address[](3);
        swapPath[0] = _token;
        swapPath[1] = _wbnb;
        swapPath[2] =_wault;
        return IUniswapRouter(_uniswapRouter).getAmountsOut(_amount, swapPath)[2];
    }

    function _amountFromWault(address _token, uint256 _amount) internal view returns (uint256) {
        if (_amount == 0 || _sendAsOrigin == true) return 0;
        address[] memory swapPath = new address[](3);
        swapPath[0] = _token;
        swapPath[1] = _wbnb;
        swapPath[2] =_wault;
        return IUniswapRouter(_uniswapRouter).getAmountsIn(_amount, swapPath)[0];
    }

    function sendAsOrigin(address _token, address _recipient, uint256 _amount) internal {
        IStrategy(strategies[_token]).withdrawDirect(_recipient, _amount);
    }
}