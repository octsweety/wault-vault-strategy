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
    // testnet
    address internal constant _uniswapRouter = address(0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F);
    address internal constant _wault = address(0x6Ff2d9e5891a7a7c554b80e0D1B791483C78BcE9);
    address internal constant _wbnb = address(0x094616F0BdFB0b526bD735Bf66Eca0Ad254ca81F);

    // Info of each user
    struct UserInfo {
        uint256 shares;
        uint256 rewardDebt;
    }

    // Info of pool for vaults
    struct PoolInfo {
        uint256 totalSupplyCurrent;
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
    mapping(address => mapping(address => UserInfo)) public userInfo;

    // Users in vaults
    mapping(address => EnumerableSet.AddressSet) users;

    mapping(address => PoolInfo) public poolInfo;

    // Path to swap wanted token to Wault
    mapping(address => address[]) swapPaths;

    modifier onlyAdmin {
        require(msg.sender == governance || msg.sender == strategist, "!admin");
        _;
    }

    constructor(address _marketer) {
        strategist = msg.sender;
        rewards = address(this);
        marketer = _marketer;
    }

    function balanceOfMarketer(address _token) external view returns(uint256) {
        return _balanceOfMarketer[_token];
    }

    function balanceOfStrategist(address _token) external view returns(uint256) {
        return _balanceOfStrategist[_token];
    }

    function setMarketer(address _marketer) external onlyAdmin {
        marketer = _marketer;
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
        _amount = safeWidthdraw(_token, _amount);
        IERC20(_token).safeTransfer(vaults[_token], _amount);
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

        _updateRewards(_token);

        currentStrategy = bestStrategy;
        IERC20(_token).safeTransfer(currentStrategy, _amount);
        IStrategy(bestStrategy).deposit();
    }

    function _updateRewards(address _token) internal {
        UserInfo storage user = userInfo[vaults[_token]][tx.origin];
        PoolInfo storage pool = poolInfo[vaults[_token]];

        _distributeRewards(_token);

        user.shares = IERC20(vaults[_token]).balanceOf(tx.origin);
        pool.lastRewardBlock = block.number;
        pool.totalSupplyCurrent = IStrategy(strategies[_token]).balanceOf();
    }

    function _distributeRewards(address _token) internal {
        PoolInfo storage pool = poolInfo[vaults[_token]];
        uint256 totalSupplyCurrent = IStrategy(strategies[_token]).balanceOf();
        uint256 totalRewards = totalSupplyCurrent.sub(pool.totalSupplyCurrent);

        for (uint i = 0; i < users[_token].length(); i++) {
            uint256 marketFee = totalRewards.mul(_marketFee).div(FEE_DENOMINATOR);
            uint256 strategistFee = totalRewards.mul(_strategistFee).div(FEE_DENOMINATOR);
            uint256 userRewards = totalRewards.sub(marketFee).sub(marketFee);

            UserInfo storage user = userInfo[_token][users[_token].at(i)];
            user.rewardDebt = user.rewardDebt.add(userRewards);
            _balanceOfMarketer[_token] = _balanceOfMarketer[_token].add(marketFee);
            _balanceOfStrategist[_token] = _balanceOfStrategist[_token].add(strategistFee);
        }
    }

    function withdrawRewards(address _token, uint256 _amount) external {
        require(msg.sender == vaults[_token], "!vault");
        UserInfo storage user = userInfo[vaults[_token]][tx.origin];
        require(user.rewardDebt > 0, "!rewards");
        require(user.rewardDebt >= _amount, "!available balance");

        sendAsWault(_token, tx.origin, _amount);
    }

    function withdrawStrategistRewards(address _token, uint256 _amount) external {
        require(msg.sender == strategist, "!strategist");
        require(_balanceOfStrategist[_token] > 0, "!balance");
        require(_balanceOfStrategist[_token] >= _amount, "!available balance");

        sendAsWault(_token, msg.sender, _amount);
    }

    function withdrawMarketerRewards(address _token, uint256 _amount) external {
        require(msg.sender == marketer, "!marketer");
        require(_balanceOfMarketer[_token] > 0, "!balance");
        require(_balanceOfMarketer[_token] >= _amount, "!available balance");

        sendAsWault(_token, msg.sender, _amount);
    }

    function sendAsWault(address _token, address _recipient, uint256 _amount) internal {
        if (_sendAsOrigin == true) {
            sendAsOrigin(_token, msg.sender, _amount);
            return;
        }

        address[] memory swapPath = new address[](3);
        swapPath[0] = _token;
        swapPath[1] = _wbnb;
        swapPath[2] =_wault;
        IUniswapRouter(_uniswapRouter).swapExactTokensForTokens(_amount, uint256(0), swapPath, _recipient, block.timestamp.add(1800));
    }

    function sendAsOrigin(address _token, address _recipient, uint256 _amount) internal {
        _amount = safeWidthdraw(_token, _amount);
        IERC20(_token).safeTransfer(_recipient, _amount);
    }
}