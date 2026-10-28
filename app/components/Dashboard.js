"use client";

import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import { ethers } from "ethers";
import CandidateCard from "./CandidateCard";
import { ABI, CONTRACT_ADDRESS } from "./Data";
import { toast } from "react-toastify";
import { AddressContext } from "@/context/AddressContext";

export default function Dashboard() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [account, setAccount] = useState("");
    const [chairPerson, setChairPerson] = useState("");

    const [votingStarted, setVotingStarted] = useState(false);
    const [votingEnded, setVotingEnded] = useState(false);

    const [adminLoading, setAdminLoading] = useState(false);
    const [adminStatus, setAdminStatus] = useState("");

    const [candidateName, setCandidateName] = useState("");
    const [voterAddress, setVoterAddress] = useState("");
    const [newContractAddress, setNewContractAddress] =
        useState("");

    const { address, setAddress } =
        useContext(AddressContext);

    /*
     * Load saved contract address
     */
    useEffect(() => {
        const savedAddress =
            localStorage.getItem("address");

        if (
            savedAddress &&
            ethers.isAddress(savedAddress)
        ) {
            setAddress(savedAddress);
            return;
        }

        if (
            CONTRACT_ADDRESS &&
            ethers.isAddress(CONTRACT_ADDRESS)
        ) {
            setAddress(CONTRACT_ADDRESS);

            localStorage.setItem(
                "address",
                CONTRACT_ADDRESS
            );
        }
    }, [setAddress]);

    /*
     * Provider
     */
    const getProvider = () => {
        if (!window.ethereum) {
            throw new Error(
                "Please install MetaMask."
            );
        }

        return new ethers.BrowserProvider(
            window.ethereum
        );
    };

    /*
     * Contract
     */
    const getContract = async (
        withSigner = false
    ) => {
        if (
            !address ||
            !ethers.isAddress(address)
        ) {
            throw new Error(
                "Invalid contract address."
            );
        }

        const provider = getProvider();

        if (!withSigner) {
            return new ethers.Contract(
                address,
                ABI,
                provider
            );
        }

        await provider.send(
            "eth_requestAccounts",
            []
        );

        const signer =
            await provider.getSigner();

        return new ethers.Contract(
            address,
            ABI,
            signer
        );
    };

    /*
     * Load voting data
     */
    const getVotes = async (
        contractAddress = address
    ) => {
        try {
            setLoading(true);
            setError("");

            if (!window.ethereum) {
                throw new Error(
                    "Please install MetaMask to continue."
                );
            }

            if (
                !contractAddress ||
                !ethers.isAddress(contractAddress)
            ) {
                throw new Error(
                    "Contract address is not available."
                );
            }

            const provider = getProvider();

            const network =
                await provider.getNetwork();

            if (network.chainId !== 11155111n) {
                throw new Error(
                    "Please switch MetaMask to the Sepolia network."
                );
            }

            const code =
                await provider.getCode(
                    contractAddress
                );

            if (code === "0x") {
                throw new Error(
                    "No contract found at this address on Sepolia."
                );
            }

            const contract =
                new ethers.Contract(
                    contractAddress,
                    ABI,
                    provider
                );

            const started =
                await contract.votingStarted();

            const ended =
                await contract.votingEnded();

            const chair =
                await contract.chairPerson();

            setVotingStarted(started);
            setVotingEnded(ended);
            setChairPerson(chair);

            const accounts =
                await window.ethereum.request({
                    method: "eth_accounts",
                });

            if (accounts.length > 0) {
                setAccount(accounts[0]);
            } else {
                setAccount("");
            }

            const count =
                await contract.getProposalCount();

            const candidateList = [];

            for (
                let i = 0;
                i < Number(count);
                i++
            ) {
                try {
                    const proposal =
                        await contract.proposals(i);

                    candidateList.push({
                        id: i,
                        name: proposal.name,
                        voteCount:
                            proposal.voteCount.toString(),
                    });
                } catch (err) {
                    console.error(
                        `Error loading proposal ${i}:`,
                        err
                    );
                }
            }

            setCandidates(candidateList);
        } catch (err) {
            console.error(
                "Error loading candidates:",
                err
            );

            setCandidates([]);

            setError(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to load candidates."
            );
        } finally {
            setLoading(false);
        }
    };

    /*
     * Connect wallet
     */
    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                throw new Error(
                    "Please install MetaMask."
                );
            }

            const provider = getProvider();

            await provider.send(
                "eth_requestAccounts",
                []
            );

            const signer =
                await provider.getSigner();

            const walletAddress =
                await signer.getAddress();

            setAccount(walletAddress);

            await getVotes();
        } catch (err) {
            console.error(
                "Wallet connection error:",
                err
            );

            setError(
                err?.shortMessage ||
                err?.message ||
                "Failed to connect wallet."
            );
        }
    };

    /*
     * Change contract address
     */
    const changeContractAddress = async () => {
        try {
            const newAddress =
                newContractAddress.trim();

            if (!ethers.isAddress(newAddress)) {
                toast.error(
                    "Enter a valid contract address."
                );
                return;
            }

            setAdminLoading(true);
            setAdminStatus("");
            setError("");

            const provider = getProvider();

            const network =
                await provider.getNetwork();

            if (network.chainId !== 11155111n) {
                throw new Error(
                    "Please switch MetaMask to the Sepolia network."
                );
            }

            await provider.send(
                "eth_requestAccounts",
                []
            );

            const signer =
                await provider.getSigner();

            const accountAddress =
                await signer.getAddress();

            /*
             * Check contract exists
             */
            const code =
                await provider.getCode(
                    newAddress
                );

            if (code === "0x") {
                throw new Error(
                    "No contract found at this address on Sepolia."
                );
            }

            /*
             * Connect to new contract
             */
            const newContract =
                new ethers.Contract(
                    newAddress,
                    ABI,
                    provider
                );

            /*
             * Check chairperson
             */
            const newChairPerson =
                await newContract.chairPerson();

            if (
                accountAddress.toLowerCase() !==
                newChairPerson.toLowerCase()
            ) {
                throw new Error(
                    "Connected wallet is not the chairperson of this contract."
                );
            }

            /*
             * Save address
             */
            localStorage.setItem(
                "address",
                newAddress
            );

            setAddress(newAddress);

            setNewContractAddress("");

            setCandidates([]);
            setVotingStarted(false);
            setVotingEnded(false);
            setChairPerson(newChairPerson);

            setAdminStatus(
                "Contract address updated successfully."
            );

            /*
             * Load the NEW contract directly.
             * This avoids stale state.
             */
            await getVotes(newAddress);
        } catch (err) {
            console.error(
                "Contract address error:",
                err
            );

            setAdminStatus(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to update contract address."
            );
        } finally {
            setAdminLoading(false);
        }
    };

    /*
     * Start voting
     */
    const startVoting = async () => {
        try {
            setAdminLoading(true);
            setAdminStatus("");

            const contract =
                await getContract(true);

            const signerAddress =
                await contract.runner.getAddress();

            if (
                signerAddress.toLowerCase() !==
                chairPerson.toLowerCase()
            ) {
                throw new Error(
                    "Only the chairperson can start voting."
                );
            }

            const tx =
                await contract.startVoting();

            setAdminStatus(
                "Starting voting..."
            );

            await tx.wait();

            setAdminStatus(
                "Voting started successfully."
            );

            await getVotes();
        } catch (err) {
            console.error(
                "Start voting error:",
                err
            );

            setAdminStatus(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to start voting."
            );
        } finally {
            setAdminLoading(false);
        }
    };

    /*
     * Stop voting
     */
    const stopVoting = async () => {
        try {
            setAdminLoading(true);
            setAdminStatus("");

            const contract =
                await getContract(true);

            const tx =
                await contract.stopVoting();

            setAdminStatus(
                "Stopping voting..."
            );

            await tx.wait();

            setAdminStatus(
                "Voting stopped successfully."
            );

            await getVotes();
        } catch (err) {
            console.error(
                "Stop voting error:",
                err
            );

            setAdminStatus(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to stop voting."
            );
        } finally {
            setAdminLoading(false);
        }
    };

    /*
     * Add candidate
     */
    const addCandidate = async () => {
        try {
            if (!candidateName.trim()) {
                setAdminStatus(
                    "Enter a candidate name."
                );
                return;
            }

            setAdminLoading(true);
            setAdminStatus("");

            const contract =
                await getContract(true);

            const tx =
                await contract.addCandidate(
                    candidateName.trim()
                );

            setAdminStatus(
                "Adding candidate..."
            );

            await tx.wait();

            setCandidateName("");

            setAdminStatus(
                "Candidate added successfully."
            );

            await getVotes();
        } catch (err) {
            console.error(
                "Add candidate error:",
                err
            );

            setAdminStatus(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to add candidate."
            );
        } finally {
            setAdminLoading(false);
        }
    };

    /*
     * Give voting right
     */
    const giveRightToVote = async () => {
        try {
            if (
                !ethers.isAddress(
                    voterAddress
                )
            ) {
                throw new Error(
                    "Enter a valid wallet address."
                );
            }

            setAdminLoading(true);
            setAdminStatus("");

            const contract =
                await getContract(true);

            const tx =
                await contract.giveRightToVote(
                    voterAddress
                );

            setAdminStatus(
                "Giving voting rights..."
            );

            await tx.wait();

            setVoterAddress("");

            setAdminStatus(
                "Voting right granted successfully."
            );
        } catch (err) {
            console.error(
                "Give right error:",
                err
            );

            setAdminStatus(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to give voting rights."
            );
        } finally {
            setAdminLoading(false);
        }
    };

    /*
     * Load whenever address changes
     */
    useEffect(() => {
        if (
            address &&
            ethers.isAddress(address)
        ) {
            getVotes(address);
        }
    }, [address]);

    /*
     * MetaMask account listener
     */
    useEffect(() => {
        if (!window.ethereum) {
            return;
        }

        const handleAccountsChanged = (
            accounts
        ) => {
            if (accounts.length > 0) {
                setAccount(accounts[0]);
            } else {
                setAccount("");
            }

            if (
                address &&
                ethers.isAddress(address)
            ) {
                getVotes(address);
            }
        };

        window.ethereum.on(
            "accountsChanged",
            handleAccountsChanged
        );

        return () => {
            window.ethereum.removeListener(
                "accountsChanged",
                handleAccountsChanged
            );
        };
    }, [address]);

    const isChairperson =
        account &&
        chairPerson &&
        account.toLowerCase() ===
            chairPerson.toLowerCase();

    return (
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
            <div className="w-full rounded-2xl border border-white/10 bg-[#181818] p-5 shadow-xl sm:p-6">

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Candidates
                        </h1>

                        <p className="mt-1 text-sm text-gray-400">
                            Choose your preferred candidate
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                            <span className="text-sm text-gray-400">
                                Candidates
                            </span>

                            <span className="ml-2 font-semibold text-white">
                                {candidates.length}
                            </span>
                        </div>

                        {!account && (
                            <button
                                onClick={
                                    connectWallet
                                }
                                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
                            >
                                Connect Wallet
                            </button>
                        )}
                    </div>
                </div>

                <div className="my-5 h-px bg-white/10" />

                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <div
                        className={`rounded-lg px-3 py-2 text-sm ${
                            votingEnded
                                ? "bg-red-500/10 text-red-400"
                                : votingStarted
                                ? "bg-green-500/10 text-green-400"
                                : "bg-yellow-500/10 text-yellow-400"
                        }`}
                    >
                        {votingEnded
                            ? "Voting Ended"
                            : votingStarted
                            ? "Voting Active"
                            : "Voting Not Started"}
                    </div>

                    {account && (
                        <div className="max-w-full break-all rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-400">
                            {account}
                        </div>
                    )}
                </div>

                {isChairperson && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-[#202020] p-4 sm:p-5">

                        <h2 className="text-lg font-semibold text-white">
                            Admin Panel
                        </h2>

                        <p className="mt-1 text-sm text-gray-400">
                            Chairperson controls
                        </p>

                        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">

                            {/* Candidate */}
                            <div className="min-w-0">
                                <label className="mb-2 block text-sm text-gray-400">
                                    Candidate Name
                                </label>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={
                                            candidateName
                                        }
                                        onChange={(e) =>
                                            setCandidateName(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            votingStarted ||
                                            votingEnded ||
                                            adminLoading
                                        }
                                        placeholder="Candidate name"
                                        className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/30"
                                    />

                                    <button
                                        onClick={
                                            addCandidate
                                        }
                                        disabled={
                                            votingStarted ||
                                            votingEnded ||
                                            adminLoading
                                        }
                                        className="w-full shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Start / Stop */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <button
                                    onClick={
                                        startVoting
                                    }
                                    disabled={
                                        votingStarted ||
                                        votingEnded ||
                                        adminLoading ||
                                        candidates.length ===
                                            0
                                    }
                                    className="w-full flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Start Voting
                                </button>

                                <button
                                    onClick={
                                        stopVoting
                                    }
                                    disabled={
                                        !votingStarted ||
                                        votingEnded ||
                                        adminLoading
                                    }
                                    className="w-full flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Stop Voting
                                </button>
                            </div>

                            {/* Voting Right */}
                            <div className="min-w-0">
                                <label className="mb-2 block text-sm text-gray-400">
                                    Give Voting Right
                                </label>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={
                                            voterAddress
                                        }
                                        onChange={(e) =>
                                            setVoterAddress(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            votingEnded ||
                                            adminLoading
                                        }
                                        placeholder="0x..."
                                        className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/30"
                                    />

                                    <button
                                        onClick={
                                            giveRightToVote
                                        }
                                        disabled={
                                            votingEnded ||
                                            adminLoading
                                        }
                                        className="w-full shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                    >
                                        Grant
                                    </button>
                                </div>
                            </div>

                            {/* Contract Address */}
                            <div className="min-w-0">
                                <label className="mb-2 block text-sm text-gray-400">
                                    Contract Address
                                </label>

                                <div className="flex flex-col gap-2">
                                    <input
                                        value={
                                            newContractAddress
                                        }
                                        onChange={(e) =>
                                            setNewContractAddress(
                                                e.target.value
                                            )
                                        }
                                        disabled={
                                            adminLoading
                                        }
                                        placeholder="0x..."
                                        className="min-w-0 w-full rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/30"
                                    />

                                    <button
                                        onClick={
                                            changeContractAddress
                                        }
                                        disabled={
                                            adminLoading ||
                                            !newContractAddress.trim()
                                        }
                                        className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Update Contract
                                    </button>
                                </div>

                                <div className="mt-2 rounded-lg bg-white/5 p-2">
                                    <p className="break-all text-xs text-gray-500">
                                        Current:
                                    </p>

                                    <p className="mt-1 break-all text-xs text-gray-300">
                                        {address ||
                                            "No contract address"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {adminStatus && (
                            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
                                <p className="break-words text-center text-sm text-gray-300">
                                    {adminStatus}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="flex min-h-60 items-center justify-center">
                        <div className="text-sm text-gray-400">
                            Loading candidates...
                        </div>
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5">
                        <p className="break-words text-sm text-red-400">
                            {error}
                        </p>

                        <button
                            onClick={() =>
                                getVotes()
                            }
                            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!loading &&
                    !error &&
                    candidates.length > 0 && (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {candidates.map(
                                (candidate) => (
                                    <CandidateCard
                                        key={
                                            candidate.id
                                        }
                                        candidate={
                                            candidate
                                        }
                                        votingStarted={
                                            votingStarted
                                        }
                                        votingEnded={
                                            votingEnded
                                        }
                                        onVoteSuccess={
                                            getVotes
                                        }
                                    />
                                )
                            )}
                        </div>
                    )}

                {!loading &&
                    !error &&
                    candidates.length === 0 && (
                        <div className="flex min-h-60 items-center justify-center">
                            <p className="text-sm text-gray-400">
                                No candidates found.
                            </p>
                        </div>
                    )}
            </div>
        </div>
    );
}