// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract VipPresale is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Token being sold in Presale
    IERC20 public presaleToken;

    // Token sold in exchage to purchase `presaleToken`
    IERC20 public exchangeToken;

    // Minimum number of tickets that can be purchased at a time
    uint public MINIMUM_TICKET_PURCHASE;

    // Number of tickets a purchaser gets per `exchangeToken`
    uint public exchangeRate;

    // Address that receives funds deposited in exchange for tickets
    address public treasury;

    /*
     * Phase determines ticket purchases and sales by whitelisted users 
     * Phase 0: is the default on contract creation
     *          purchases are prohibited
     *          sales are prohibited
     * Phase 1: manually set by the owner, starts phase sequence
     *          purchases are limited by a user's `maxTicket` 
     *          sales are prohibited
     * Phase 2: is automatically set 24 hours after the start of Phase 1
     *          purchases are unlimited
     *          sales are limited by subPhase 
     */
    uint public MAX_PHASE;              // Highest phase attainable
    uint public START_PHASE;            // Phase which starts automatic sequence
    uint public phase;                  // Current phase
    uint public phaseEndTimestamp;      // End timestamp after which the current phase has ended
    uint public PHASE_DURATION;         // Length of time for a phase
    
    /* 
     * SubPhase determines ticket sales by whitelisted users during Phase 2
     * SubPhase 0: default on contract creation, nothing happens
     * SubPhase 1: started manually by the owner, starts subPhase sequence
     * SubPhase 2: users may sell up to 25% of their purchased tickets
     * SubPhase 3: users may sell up to 50% of their purchased tickets
     * SubPhase 4: users may sell up to 75% of their purchased tickets
     * SubPhase 5: users may sell up to 100% of their purchased tickets
     * 
     * After subPhase 1, subsequent subPhases automatically begin `SUB_PHASE_DURATION` 
     * after the start of the previous subPhase
     */
    uint public MAX_SUB_PHASE;          // Highest subPhase attainable
    uint public START_SUB_PHASE;        // SubPhase which starts automatic sequence
    uint public subPhase;               // Current subPhase
    uint public subPhaseEndTimestamp;   // End timestamp after which the current subPhase has ended
    uint public SUB_PHASE_DURATION;     // Lenght of time for a subPhase
  
    // Maximum number of tickets available for purchase at the start of the sale
    uint public MAX_TICKET;

    // Unsold tickets available for purchase
    // ticketsAvailable = MAX_TICKET - (sum(user.purchased) for user in whitelist)
    // where user.purchased is in range [0, user.maxTicket] for user in whitelist
    uint public ticketsAvailable;

    // Unsold tickets out of the maximum that have been reserved to users
    // Used to prevent promising more tickets to users than are available
    // ticketsReserved = (sum(user.maxTicket) for user in whitelist)
    // and ticketsReserved <= ticketsAvailable <= MAX_TICKET
    uint public ticketsReserved;

    struct User {
        uint maxTicket;         // sets phase 1 upper limit on ticket purchases
        uint purchased;         // tickets purchased <= maxTicket
        uint balance;           // tickets purchased but not withdrawn
    }
    mapping(address => User) public users;
    
    // true if user can purchase tickets and false otherwise
    mapping(address => bool) public whitelist;

    // Owners who can whitelist
    address[] private owners;
    mapping(address => bool) public isOwner;

    event SetPhase(uint phase, uint startTimestamp, uint endTimestamp);
    event SetSubPhase(uint subPhase, uint startTimestamp, uint endTimestamp);

    modifier isValidPhase(uint _phase) {
        require(_phase <= MAX_PHASE, "VipPresale: PHASE CAN'T BE GREATER THAN MAX_PHASE");
        _;
    }

    modifier isValidSubPhase(uint _subPhase) {
        require(_subPhase <= MAX_SUB_PHASE, "VipPresale: SUB PHASE CAN'T BE GREATER THAN MAX_SUB_PHASE");
        _;
    }

    modifier isValidAddress(address _address) {
        require(_address != address(0), "VipPresale: INVALID ADDRESS");
        _;
    }

    modifier isValidMaxTicket(uint maxTicket) {
        require(maxTicket <= ticketsAvailable, "VipPresale: MAX TICKET CAN'T BE GREATER THAN TICKETS AVAILABLE");
        _;
    }

    modifier onlyOwner() {
        require(isOwner[msg.sender], "VipPresale: CALLER IS NOT OWNER");
        _;
    }

    /* 
     * @param _presaleToken address of the token being sold
     * @param _exchangeToken address of the token being exchanged for `presaleToken`
     * @param _treasury address that receives funds deposited in exchange for tickets
     * @param _exchangeRate number of tickets a purchaser receives in exchange for 1 `exchangeToken`
     * @param _maxTickets number of tickets available at the start of the sale
     */
    constructor(
        address _presaleToken, 
        address _exchangeToken,
        address _treasury, 
        uint _exchangeRate, 
        uint _maxTicket
    ) 
        isValidAddress(_presaleToken)
        isValidAddress(_exchangeToken)
        isValidAddress(_treasury)
    {
        presaleToken = IERC20(_presaleToken);
        exchangeToken = IERC20(_exchangeToken);
        exchangeRate = _exchangeRate;
        treasury = _treasury;

        isOwner[msg.sender] = true;
        owners.push(msg.sender);

        MAX_PHASE = 2;
        START_PHASE = 1;
        PHASE_DURATION = 1 days;

        MAX_SUB_PHASE = 5;
        START_SUB_PHASE = 1;
        SUB_PHASE_DURATION = 91 days;   // (91 days ~= 3 months) and (91 days * 4 ~= 1 year)

        MAX_TICKET = _maxTicket;
        ticketsAvailable = _maxTicket;

        MINIMUM_TICKET_PURCHASE = 1;
    }

    // purchase `amount` of tickets
    function purchase(uint amount) external nonReentrant payable {
        // update to the latest phase, if necessary
        updatePhase();
   
        // validate the purchase 
        _preValidatePurchase(msg.sender, amount);

        // get the cost in `exchangeToken` to purchase `amount` of tickets
        uint cost = getCost(amount); 

        // the caller must approve spending `cost` of `otherToken`
        // in exchange for `amount` of tickets
        exchangeToken.safeApprove(address(this), cost);
        exchangeToken.safeTransferFrom(msg.sender, treasury, cost);

        users[msg.sender].purchased += amount;
        users[msg.sender].balance += amount;

        ticketsAvailable -= amount;
    }

    // validate that `purchaser` is eligible to purchase `amount` of tickets
    function _preValidatePurchase(address purchaser, uint amount) private view isValidAddress(purchaser) {
        require(phase >= START_PHASE, "VipPresale: SALE HAS NOT STARTED");
        require(whitelist[purchaser], "VipPresale: PURCHASER IS NOT WHITELISTED");
        require(amount >= MINIMUM_TICKET_PURCHASE, "VipPresale: AMOUNT IS LESS THAN MINIMUM TICKET PURCHASE");
        require(amount <= ticketsAvailable, "VipPresale: TICKETS ARE SOLD OUT");
        require(
            users[purchaser].purchased + amount <= users[purchaser].maxTicket, 
            "VipPresale: AMOUNT EXCEEDS MAX TICKET LIMIT"
        );
        if (phase == MAX_PHASE) {
            require(block.timestamp < phaseEndTimestamp, "VipPresale: SALE HAS ENDED");
        }
    }

    // get the `cost` in `exchangeToken` for `amount` of tickets
    function getCost(uint amount) public pure returns(uint cost) {
        // TODO replace with actual formula
        cost = amount;
    }

    // add a new owner to the contract, only callable by an existing owner
    function addOwner(address owner) external isValidAddress(owner) onlyOwner {
        require(!isOwner[owner], "VipPresale: ALREADY AN OWNER");
        isOwner[owner] = true;
        owners.push(owner);
    }

    // called periodically and, if sufficient time has elapsed, update the phase
    function updatePhase() private {
        if (phase >= START_PHASE) {
            if (phase < MAX_PHASE && block.timestamp >= phaseEndTimestamp) {
                _setPhase(phase + 1);
            }
        }
    }

    // used externally to update from phase 0 to phase 1
    // should only ever be called to set phase == 1
    function setPhase(uint _phase) external onlyOwner isValidPhase(_phase) {
        _setPhase(_phase);
    }

    // used internally to update phases
    function _setPhase(uint _phase) private {
        phase = _phase;
        phaseEndTimestamp = block.timestamp + PHASE_DURATION;
        emit SetPhase(_phase, block.timestamp, phaseEndTimestamp);
    }

    // called periodically and, if sufficient time has elapsed, update the subPhase
    function updateSubPhase() private {
        if (subPhase >= START_SUB_PHASE) {
            if (subPhase < MAX_SUB_PHASE && block.timestamp >= subPhaseEndTimestamp) {
                _setSubPhase(subPhase + 1);
            }
        }
    }

    // used externally to update from subPhase 0 to subPhase 1
    // should only ever be called to set subPhase == 1
    function setSubPhase(uint _subPhase) external onlyOwner isValidSubPhase(_subPhase) {
        _setSubPhase(_subPhase);
    }

    // used internally to update subPhases
    function _setSubPhase(uint _subPhase) private {
        subPhase = _subPhase;
        subPhaseEndTimestamp = block.timestamp + SUB_PHASE_DURATION;
        emit SetSubPhase(_subPhase, block.timestamp, subPhaseEndTimestamp);
    }
   
    // used externally to grant users permission to purchase maxTickets
    // such that user[i] can purchase maxTickets[i] many tickets for i in range users.length
    function whitelistAdd(address[] calldata _users, uint[] calldata maxTickets) external onlyOwner {
        require(_users.length == maxTickets.length, "VipPresale: USERS AND MAX TICKETS MUST HAVE SAME LENGTH");
        for (uint i = 0; i < _users.length; i++) {
            address user = _users[i];
            uint maxTicket = maxTickets[i];
            _whitelistAdd(user, maxTicket);
        }
    }

    // used internally to grant `user` permission to purchase up to `maxTicket`, phase dependent
    function _whitelistAdd(address user, uint maxTicket)
        private
        isValidAddress(user)
        isValidMaxTicket(maxTicket) 
    {
        require(!whitelist[user], "VipPresale: USER IS ALREADY WHITELISTED");
        whitelist[user] = true;
        users[user].maxTicket = maxTicket;

        require(ticketsReserved + maxTicket <= ticketsAvailable, "VipPresale: INADEQUATE TICKETS FOR ALL USERS");
        ticketsReserved += maxTicket;
    }

    // revoke `user` permission to purchase tickets
    function whitelistRemove(address user) external onlyOwner {
        // prohibit a whitelisted user from buying tickets
        // but not from withdrawing those they've already purchased
        whitelist[user] = false;
    }
} 
