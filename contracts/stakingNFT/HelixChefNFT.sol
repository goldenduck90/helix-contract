// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;

import "../interfaces/IHelixNFT.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

/// Enable users to stake NFTs and earn rewards
contract HelixChefNFT is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // Info on each user who has NFTs staked in this contract
    struct UserInfo {
        uint256[] stakedNFTsId;        // Ids of the NFTs this user has staked
        uint256 pendingReward;         // Amount of unwithdrawn rewardToken
    }

    /// Owner approved contracts which can accrue user rewards
    EnumerableSetUpgradeable.AddressSet private _accruers;

    /// Instance of HelixNFT
    IHelixNFT public helixNFT;

    /// Token that reward are earned in (HELIX)
    IERC20 public rewardToken;

    /// Total number of NFTs staked in this contract
    uint256 public totalStakedNfts;

    /// Maps a user's address to their info struct
    mapping(address => UserInfo) public users;

    /// Maps a user's address to the number of NFTs they've staked
    mapping(address => uint256) public usersStakedNfts;

    // Emitted when an NFTs are staked
    event Stake(address indexed user, uint256[] tokenIds);

    // Emitted when an NFTs are unstaked
    event Unstake(address indexed user, uint256[] tokenIds);

    // Emitted when a user's transaction results in accrued reward
    event AccrueReward(address indexed user, uint256 accruedReward);

    // Emitted when an accruer is added
    event AddAccruer(address indexed adder, address indexed added);

    // Emitted when an accruer is removed
    event RemoveAccruer(address indexed remover, address indexed removed);

    // Emitted when reward tokens is withdrawn
    event WithdrawRewardToken(address indexed withdrawer, uint256 amount);

    // 

    modifier onlyAccruer {
        require(isAccruer(msg.sender), "HelixChefNFT: not an accruer");
        _;
    }

    modifier onlyValidAddress(address _address) {
        require(_address != address(0), "HelixChefNFT: zero address");
        _;
    }

    function initialize(IHelixNFT _helixNFT, IERC20 _rewardToken) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        helixNFT = _helixNFT;
        rewardToken = _rewardToken;
    }

    /// Stake the tokens with _tokenIds in the pool
    function stake(uint256[] memory _tokenIds) external whenNotPaused nonReentrant {
        _withdrawRewardToken();
        
        UserInfo storage user = users[msg.sender];

        for(uint256 i = 0; i < _tokenIds.length; i++){
            (address tokenOwner, bool isStaked) = helixNFT.getInfoForStaking(_tokenIds[i]);
            _requireIsTokenOwner(msg.sender, tokenOwner);
            require(!isStaked, "HelixChefNFT: already staked");

            helixNFT.setIsStaked(_tokenIds[i], true);
            user.stakedNFTsId.push(_tokenIds[i]);

            usersStakedNfts[msg.sender]++;
            totalStakedNfts++;
        }

        emit Stake(msg.sender, _tokenIds);
    }

    /// Unstake the tokens with _tokenIds in the pool
    function unstake(uint256[] memory _tokenIds) external whenNotPaused nonReentrant {
        _withdrawRewardToken();

        for(uint256 i = 0; i < _tokenIds.length; i++){
            (address tokenOwner, bool isStaked) = helixNFT.getInfoForStaking(_tokenIds[i]);
            _requireIsTokenOwner(msg.sender, tokenOwner);
            require(isStaked, "HelixChefNFT: already unstaked");

            helixNFT.setIsStaked(_tokenIds[i], false);
            _removeTokenIdFromUser(msg.sender, _tokenIds[i]);

            usersStakedNfts[msg.sender]--;
            totalStakedNfts--;
        }
        
        emit Unstake(msg.sender, _tokenIds);
    }

    /// Accrue reward to the _user's account based on the transaction _fee
    function accrueReward(address _user, uint256 _fee) external onlyAccruer {
        uint256 reward = getAccruedReward(_user, _fee);
        if (reward > 0) {
            users[_user].pendingReward += reward;
            emit AccrueReward(_user, reward);
        }
    }

    /// Withdraw accrued reward token
    function withdrawRewardToken() external nonReentrant {
        _withdrawRewardToken();
    }

    /// Called by the owner to add an accruer
    function addAccruer(address _address) external onlyOwner onlyValidAddress(_address) {
        EnumerableSetUpgradeable.add(_accruers, _address);
        emit AddAccruer(msg.sender, _address);
    }

    /// Called by the owner to remove an accruer
    function removeAccruer(address _address) external onlyOwner {
        require(isAccruer(_address), "HelixChefNFT: not an accruer");
        EnumerableSetUpgradeable.remove(_accruers, _address);
        emit RemoveAccruer(msg.sender, _address);
    }   
    
    /// Called by the owner to pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// Called by the owner to unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    /// Return the accruer at _index
    function getAccruer(uint256 _index) external view returns (address) {
        require(_index <= getNumAccruers() - 1, "HelixChefNFT: index out of bounds");
        return EnumerableSetUpgradeable.at(_accruers, _index);
    }

    /// Return the array of NFT ids that _user has staked
    function getUserStakedTokens(address _user) external view returns(uint256[] memory){
        uint256[] memory tokenIds = new uint256[](usersStakedNfts[_user]);
        tokenIds = users[_user].stakedNFTsId;
        return tokenIds;
    }

    /// Return the number of NFTs the _user has staked
    function getUsersStakedNfts(address _user) external view returns(uint256) {
        return usersStakedNfts[_user];
    }

    /// Return the _user's pending reward
    function pendingReward(address _user) external view returns (uint256) {
        return users[_user].pendingReward;
    }

    /// Return the number of added _accruers
    function getNumAccruers() public view returns (uint256) {
        return EnumerableSetUpgradeable.length(_accruers);
    }

    /// Return the reward accrued to _user based on the transaction _fee
    function getAccruedReward(address _user, uint256 _fee) public view returns (uint256) {
        if (totalStakedNfts == 0) {
            return 0;
        }
        return usersStakedNfts[_user] * _fee / totalStakedNfts ;
    }

    /// Return true if the _address is a registered accruer and false otherwise
    function isAccruer(address _address) public view returns (bool) {
        return EnumerableSetUpgradeable.contains(_accruers, _address);
    }

    // Withdraw accrued reward token
    function _withdrawRewardToken() private {
        uint256 _amount = users[msg.sender].pendingReward;
        users[msg.sender].pendingReward = 0;
        rewardToken.transfer(address(msg.sender), _amount);
        emit WithdrawRewardToken(msg.sender, _amount);
    }

    // Remove _tokenId from _user's account
    function _removeTokenIdFromUser(address _user, uint256 _tokenId) private {
        uint256[] storage tokenIds = users[_user].stakedNFTsId;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_tokenId == tokenIds[i]) {
                tokenIds[i] = tokenIds[tokenIds.length - 1];
                tokenIds.pop();
                return;
            }
        }
    }

    // Require that _caller is _tokenOwner
    function _requireIsTokenOwner(address _caller, address _tokenOwner) private pure {
            require(_caller == _tokenOwner, "HelixChefNFT: not token owner");
    }
}
