pragma solidity >=0.7.0 <0.9.0;

contract Ballot {
    struct Voter {
        uint weight;
        bool voted;
        address delegate;
        uint vote;
    }

    struct Proposal {
        string name;
        uint voteCount;
    }

    address public chairPerson;

    bool public votingStarted = false;
    bool public votingEnded = false;

    mapping(address => Voter) public voters;

    Proposal[] public proposals;

    constructor() {
        chairPerson = msg.sender;

        voters[chairPerson].weight = 1;
    }

    function addCandidate(string memory _name) public {
        require(
            msg.sender == chairPerson,
            "Only chairperson can add candidates"
        );

        require(!votingStarted, "Voting has already started");

        require(!votingEnded, "Voting has ended");

        require(bytes(_name).length > 0, "Candidate name cannot be empty");

        proposals.push(Proposal({name: _name, voteCount: 0}));
    }

    function startVoting() public {
        require(msg.sender == chairPerson, "Only chairperson can start voting");

        require(!votingStarted, "Voting already started");

        require(!votingEnded, "Voting has already ended");

        require(proposals.length > 0, "No candidates available");

        votingStarted = true;
    }

    function stopVoting() public {
        require(msg.sender == chairPerson, "Only chairperson can stop voting");

        require(votingStarted, "Voting has not started yet");

        require(!votingEnded, "Voting already stopped");

        votingEnded = true;
        votingStarted = false;
    }

    function giveRightToVote(address voter) public {
        require(
            msg.sender == chairPerson,
            "Only chairperson can give voting rights"
        );

        // require(!votingStarted, "Cannot give rights after voting starts");

        require(!votingEnded, "Voting has ended");

        require(voter != address(0), "Invalid voter address");

        require(!voters[voter].voted, "Voter has already voted");

        require(voters[voter].weight == 0, "Voter already has voting rights");

        voters[voter].weight = 1;
    }

    function vote(uint proposal) public {
        require(votingStarted, "Voting has not started");

        require(!votingEnded, "Voting has ended");

        require(proposal < proposals.length, "Invalid candidate");

        Voter storage sender = voters[msg.sender];

        require(sender.weight > 0, "No voting rights");

        require(!sender.voted, "Already voted");

        sender.voted = true;
        sender.vote = proposal;

        proposals[proposal].voteCount += sender.weight;
    }

    function delegate(address to) public {
        require(votingStarted, "Voting has not started");

        require(!votingEnded, "Voting has ended");

        require(to != address(0), "Invalid delegate address");

        Voter storage sender = voters[msg.sender];

        require(sender.weight > 0, "No voting rights");

        require(!sender.voted, "Already voted");

        require(to != msg.sender, "Self delegation not allowed");

        while (voters[to].delegate != address(0)) {
            to = voters[to].delegate;

            require(to != msg.sender, "Delegation loop found");
        }

        sender.voted = true;
        sender.delegate = to;

        Voter storage delegate_ = voters[to];

        if (delegate_.voted) {
            proposals[delegate_.vote].voteCount += sender.weight;
        } else {
            delegate_.weight += sender.weight;
        }
    }

    function winningProposal() public view returns (uint winningProposal_) {
        uint winningVoteCount = 0;

        for (uint i = 0; i < proposals.length; i++) {
            if (proposals[i].voteCount > winningVoteCount) {
                winningVoteCount = proposals[i].voteCount;

                winningProposal_ = i;
            }
        }
    }

    function winnerName() public view returns (string memory winnername_) {
        require(votingEnded, "Voting has not ended");

        require(proposals.length > 0, "No candidates available");

        winnername_ = proposals[winningProposal()].name;
    }

    function getProposalCount() public view returns (uint) {
        return proposals.length;
    }
}
