"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import CandidateCard from "./CandidateCard";
import { ABI, CONTRACT_ADDRESS } from "./Data";
import { toast } from "react-toastify";
import { AddressContext } from "@/context/AddressContext";
import axios from "axios";

const AUTHORIZED_CHAIRPERSONS = [
    "0x3a74dfB6b76CF7159B3cf1Ba10B6d86Ed9d963Ed",
    "0x2b16bEaAF8fC347F8738e1dC5EF190403c91Cf73",
];

const isAuthorizedChairpersonWallet = (walletAddress) =>
    Boolean(walletAddress) &&
    AUTHORIZED_CHAIRPERSONS.some(
        (authorizedAddress) =>
            authorizedAddress.toLowerCase() === walletAddress.toLowerCase()
    );
const API_BASE_URL = "https://votingdappserver-3qcu.onrender.com";
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export default function Dashboard() {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [account, setAccount] = useState("");
    const [walletConnecting, setWalletConnecting] = useState(false);
    const [chairPerson, setChairPerson] = useState("");
    const [votingStarted, setVotingStarted] = useState(false);
    const [votingEnded, setVotingEnded] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminStatus, setAdminStatus] = useState("");
    const [candidateName, setCandidateName] = useState("");
    const [voterAddress, setVoterAddress] = useState("");
    const [newContractAddress, setNewContractAddress] = useState("");

    const { address, setAddress } = useContext(AddressContext);
    const walletProviderRef = useRef(null);

    const getInjectedWalletProvider = () => {
        if (typeof window === "undefined") return null;

        const phantomEthereum = window.phantom?.ethereum;
        if (phantomEthereum) return phantomEthereum;

        const ethereum = window.ethereum;
        if (ethereum?.providers?.length) {
            return ethereum.providers.find((provider) => provider.isMetaMask) ||
                ethereum.providers.find((provider) => provider.isPhantom) ||
                ethereum.providers[0];
        }

        return ethereum || null;
    };

    useEffect(() => {
        let cancelled = false;

        const loadSharedContractAddress = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/address`);
                const sharedAddress = response.data?.address;

                if (sharedAddress && ethers.isAddress(sharedAddress)) {
                    if (!cancelled) {
                        setAddress(sharedAddress);
                        localStorage.setItem("address", sharedAddress);
                    }
                    return;
                }

                throw new Error("The server did not return a valid contract address.");
            } catch (err) {
                console.error("Could not fetch shared contract address:", err);

                // Fallback only if the backend is unavailable.
                const savedAddress = localStorage.getItem("address");
                const fallbackAddress =
                    savedAddress && ethers.isAddress(savedAddress)
                        ? savedAddress
                        : CONTRACT_ADDRESS;

                if (!cancelled && fallbackAddress && ethers.isAddress(fallbackAddress)) {
                    setAddress(fallbackAddress);
                    localStorage.setItem("address", fallbackAddress);
                } else if (!cancelled) {
                    setError("Could not load the shared contract address from the server.");
                    setLoading(false);
                }
            }
        };

        loadSharedContractAddress();

        return () => {
            cancelled = true;
        };
    }, [setAddress]);

    // Used for reading blockchain data. It works even if the visitor has no wallet installed.
    const getReadProvider = () => {
        return new ethers.JsonRpcProvider(SEPOLIA_RPC_URL, 11155111);
    };

    // Used only for wallet connections and transactions. The provider may be
    // injected by a wallet browser or supplied by WalletConnect from mobile Chrome.
    const getProvider = () => {
        const rawProvider = walletProviderRef.current || getInjectedWalletProvider();

        if (!rawProvider) {
            throw new Error("Connect a wallet first. On mobile Chrome, use the WalletConnect wallet chooser.");
        }

        return new ethers.BrowserProvider(rawProvider);
    };

    const attachWalletListeners = (rawProvider) => {
        if (!rawProvider?.on) return;

        rawProvider.on("accountsChanged", (accounts) => {
            setAccount(accounts?.length ? accounts[0] : "");
            if (accounts?.length && address && ethers.isAddress(address)) {
                void getVotes(address);
            }
        });

        rawProvider.on("chainChanged", () => {
            if (address && ethers.isAddress(address)) void getVotes(address);
        });

        rawProvider.on("disconnect", () => setAccount(""));
    };

    const getContract = async (withSigner = false, contractAddress = address) => {
        if (!contractAddress || !ethers.isAddress(contractAddress)) {
            throw new Error("Invalid contract address.");
        }

        const provider = getProvider();

        if (!withSigner) {
            return new ethers.Contract(contractAddress, ABI, provider);
        }

        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();

        return new ethers.Contract(contractAddress, ABI, signer);
    };

    const getVotes = async (contractAddress = address) => {
        try {
            setLoading(true);
            setError("");

            if (!contractAddress || !ethers.isAddress(contractAddress)) {
                throw new Error("Contract address is not available.");
            }

            // Read from Sepolia directly, not from the visitor's wallet.
            // This allows candidates to load on phones and other devices without MetaMask.
            const provider = getReadProvider();
            const network = await provider.getNetwork();

            if (network.chainId !== 11155111n) {
                throw new Error("The read provider is not connected to Sepolia.");
            }

            const code = await provider.getCode(contractAddress);

            if (code === "0x") {
                throw new Error("No contract found at this address on Sepolia.");
            }

            const contract = new ethers.Contract(contractAddress, ABI, provider);
            const started = await contract.votingStarted();
            const ended = await contract.votingEnded();
            const chair = await contract.chairPerson();

            setVotingStarted(started);
            setVotingEnded(ended);
            setChairPerson(chair);

            const walletProvider = walletProviderRef.current || getInjectedWalletProvider();
            if (walletProvider) {
                const accounts = await walletProvider.request({ method: "eth_accounts" });
                setAccount(accounts.length > 0 ? accounts[0] : "");
            } else {
                setAccount("");
            }

            const count = await contract.getProposalCount();
            const candidateList = [];

            for (let i = 0; i < Number(count); i++) {
                try {
                    const proposal = await contract.proposals(i);

                    candidateList.push({
                        id: i,
                        name: proposal.name,
                        voteCount: proposal.voteCount.toString(),
                    });
                } catch (err) {
                    console.error(`Error loading proposal ${i}:`, err);
                }
            }

            setCandidates(candidateList);
        } catch (err) {
            console.error("Error loading candidates:", err);
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

    const connectWallet = async () => {
        try {
            setWalletConnecting(true);
            setError("");
            let rawProvider = getInjectedWalletProvider();

            // In normal mobile Chrome, wallet apps do not usually inject a provider.
            // WalletConnect presents compatible wallets and can deep-link to their apps.
            if (!rawProvider) {
                const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
                if (!projectId) {
                    throw new Error(
                        "Mobile wallet connection is not configured yet. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to your .env.local file, then restart Next.js."
                    );
                }

                const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");
                const walletConnectProvider = await EthereumProvider.init({
                    projectId,
                    chains: [11155111],
                    showQrModal: true,
                    methods: [
                        "eth_sendTransaction",
                        "personal_sign",
                        "eth_sign",
                        "eth_signTypedData",
                        "eth_signTypedData_v4",
                        "eth_accounts",
                        "eth_requestAccounts",
                        "eth_chainId",
                        "wallet_switchEthereumChain",
                        "wallet_addEthereumChain"
                    ],
                    events: ["accountsChanged", "chainChanged", "disconnect"],
                    metadata: {
                        name: "Decentralized Voting",
                        description: "Secure and transparent blockchain-based voting",
                        url: window.location.origin,
                        icons: []
                    }
                });

                await walletConnectProvider.connect();
                rawProvider = walletConnectProvider;
            } else {
                // Directly ask injected wallet browsers/extensions for account access.
                await rawProvider.request({ method: "eth_requestAccounts" });
            }

            walletProviderRef.current = rawProvider;
            const provider = new ethers.BrowserProvider(rawProvider);
            const network = await provider.getNetwork();

            if (network.chainId !== 11155111n) {
                throw new Error("Please switch your wallet to the Sepolia test network.");
            }

            const signer = await provider.getSigner();
            const walletAddress = await signer.getAddress();
            setAccount(walletAddress);
            attachWalletListeners(rawProvider);
            await getVotes();
        } catch (err) {
            console.error("Wallet connection error:", err);
            setError(
                err?.code === 4001
                    ? "Wallet connection was rejected."
                    : err?.shortMessage || err?.reason || err?.message || "Failed to connect wallet."
            );
        } finally {
            setWalletConnecting(false);
        }
    };

    const changeContractAddress = async () => {
        try {
            const newAddress = newContractAddress.trim();

            if (!ethers.isAddress(newAddress)) {
                toast.error("Enter a valid contract address.");
                return;
            }

            setAdminLoading(true);
            setAdminStatus("");
            setError("");

            const provider = getProvider();
            const network = await provider.getNetwork();

            if (network.chainId !== 11155111n) {
                throw new Error("Please switch MetaMask to the Sepolia network.");
            }

            await provider.send("eth_requestAccounts", []);

            const signer = await provider.getSigner();
            const accountAddress = await signer.getAddress();

            const isAuthorizedWallet =
                isAuthorizedChairpersonWallet(accountAddress);

            const code = await provider.getCode(newAddress);

            if (code === "0x") {
                throw new Error("No contract found at this address on Sepolia.");
            }

            const newContract = new ethers.Contract(newAddress, ABI, provider);
            const newChairPerson = await newContract.chairPerson();

            if (
                accountAddress.toLowerCase() !== newChairPerson.toLowerCase() &&
                !isAuthorizedWallet
            ) {
                throw new Error(
                    "Connected wallet is not authorized to change the contract address."
                );
            }

            const updateResponse = await axios.post(`${API_BASE_URL}/update`, {
                newaddress: newAddress
            });

            console.log("Updated shared contract address:", updateResponse.data);

            localStorage.setItem("address", newAddress);
            setAddress(newAddress);

            setNewContractAddress("");
            setCandidates([]);
            setVotingStarted(false);
            setVotingEnded(false);
            setChairPerson(newChairPerson);
            setAdminStatus("Contract address updated successfully.");

            await getVotes(newAddress);
        } catch (err) {
            console.error("Contract address error:", err);

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

    const startVoting = async () => {
        try {
            setAdminLoading(true);
            setAdminStatus("");

            const contract = await getContract(true);
            const signerAddress = await contract.runner.getAddress();

            if (
                signerAddress.toLowerCase() !== chairPerson.toLowerCase() &&
                !isAuthorizedChairpersonWallet(signerAddress)
            ) {
                throw new Error(
                    "Only the chairperson or authorized wallet can start voting."
                );
            }

            const tx = await contract.startVoting();
            setAdminStatus("Starting voting...");
            await tx.wait();

            setAdminStatus("Voting started successfully.");
            await getVotes();
        } catch (err) {
            console.error("Start voting error:", err);

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

    const stopVoting = async () => {
        try {
            setAdminLoading(true);
            setAdminStatus("");

            const contract = await getContract(true);
            const signerAddress = await contract.runner.getAddress();

            if (
                signerAddress.toLowerCase() !== chairPerson.toLowerCase() &&
                !isAuthorizedChairpersonWallet(signerAddress)
            ) {
                throw new Error(
                    "Only the chairperson or authorized wallet can stop voting."
                );
            }

            const tx = await contract.stopVoting();
            setAdminStatus("Stopping voting...");
            await tx.wait();

            setAdminStatus("Voting stopped successfully.");
            await getVotes();
        } catch (err) {
            console.error("Stop voting error:", err);

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

    const addCandidate = async () => {
        try {
            if (!candidateName.trim()) {
                setAdminStatus("Enter a candidate name.");
                return;
            }

            setAdminLoading(true);
            setAdminStatus("");

            const contract = await getContract(true);
            const signerAddress = await contract.runner.getAddress();

            if (
                signerAddress.toLowerCase() !== chairPerson.toLowerCase() &&
                !isAuthorizedChairpersonWallet(signerAddress)
            ) {
                throw new Error(
                    "Only the chairperson or authorized wallet can add candidates."
                );
            }

            const tx = await contract.addCandidate(candidateName.trim());
            setAdminStatus("Adding candidate...");
            await tx.wait();

            setCandidateName("");
            setAdminStatus("Candidate added successfully.");

            await getVotes();
        } catch (err) {
            console.error("Add candidate error:", err);

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

    const giveRightToVote = async () => {
        try {
            if (!ethers.isAddress(voterAddress)) {
                throw new Error("Enter a valid wallet address.");
            }

            setAdminLoading(true);
            setAdminStatus("");

            const contract = await getContract(true);
            const signerAddress = await contract.runner.getAddress();

            if (
                signerAddress.toLowerCase() !== chairPerson.toLowerCase() &&
                !isAuthorizedChairpersonWallet(signerAddress)
            ) {
                throw new Error(
                    "Only the chairperson or authorized wallet can grant voting rights."
                );
            }

            const tx = await contract.giveRightToVote(voterAddress);
            setAdminStatus("Giving voting rights...");
            await tx.wait();

            setVoterAddress("");
            setAdminStatus("Voting right granted successfully.");
        } catch (err) {
            console.error("Give right error:", err);

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

    useEffect(() => {
        if (address && ethers.isAddress(address)) {
            getVotes(address);
        }
    }, [address]);

    useEffect(() => {
        const injectedProvider = getInjectedWalletProvider();
        if (!injectedProvider) return;

        walletProviderRef.current = injectedProvider;
        const handleAccountsChanged = (accounts) => {
            setAccount(accounts.length > 0 ? accounts[0] : "");
            if (address && ethers.isAddress(address)) void getVotes(address);
        };
        const handleChainChanged = () => {
            if (address && ethers.isAddress(address)) void getVotes(address);
        };

        injectedProvider.on?.("accountsChanged", handleAccountsChanged);
        injectedProvider.on?.("chainChanged", handleChainChanged);

        return () => {
            injectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
            injectedProvider.removeListener?.("chainChanged", handleChainChanged);
        };
    }, [address]);

    const isChairperson =
        Boolean(account) &&
        (
            account.toLowerCase() === chairPerson.toLowerCase() ||
            isAuthorizedChairpersonWallet(account)
        );

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
                                onClick={connectWallet}
                                disabled={walletConnecting}
                                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {walletConnecting ? "Connecting..." : "Connect Wallet"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="my-5 h-px bg-white/10" />

                <div className="mb-5 flex flex-wrap items-center gap-3">
                    <div
                        className={`rounded-lg px-3 py-2 text-sm ${votingEnded
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
                            <div className="min-w-0">
                                <label className="mb-2 block text-sm text-gray-400">
                                    Candidate Name
                                </label>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={candidateName}
                                        onChange={(e) => setCandidateName(e.target.value)}
                                        disabled={votingStarted || votingEnded || adminLoading}
                                        placeholder="Candidate name"
                                        className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/30"
                                    />

                                    <button
                                        onClick={addCandidate}
                                        disabled={votingStarted || votingEnded || adminLoading}
                                        className="w-full shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <button
                                    onClick={startVoting}
                                    disabled={votingStarted || votingEnded || adminLoading || candidates.length === 0}
                                    className="w-full flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Start Voting
                                </button>

                                <button
                                    onClick={stopVoting}
                                    disabled={!votingStarted || votingEnded || adminLoading}
                                    className="w-full flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Stop Voting
                                </button>
                            </div>

                            <div className="min-w-0">
                                <label className="mb-2 block text-sm text-gray-400">
                                    Give Voting Right
                                </label>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={voterAddress}
                                        onChange={(e) => setVoterAddress(e.target.value)}
                                        disabled={votingEnded || adminLoading}
                                        placeholder="0x..."
                                        className="min-w-0 w-full flex-1 rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/30"
                                    />

                                    <button
                                        onClick={giveRightToVote}
                                        disabled={votingEnded || adminLoading}
                                        className="w-full shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                                    >
                                        Grant
                                    </button>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <label className="mb-2 block text-sm text-gray-400">
                                    Contract Address
                                </label>

                                <div className="flex flex-col gap-2">
                                    <input
                                        value={newContractAddress}
                                        onChange={(e) => setNewContractAddress(e.target.value)}
                                        disabled={adminLoading}
                                        placeholder="0x..."
                                        className="min-w-0 w-full rounded-lg border border-white/10 bg-[#151515] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white/30"
                                    />

                                    <button
                                        onClick={changeContractAddress}
                                        disabled={adminLoading || !newContractAddress.trim()}
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
                                        {address || "No contract address"}
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
                            onClick={() => getVotes()}
                            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && candidates.length > 0 && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {candidates.map((candidate) => (
                            <CandidateCard
                                key={candidate.id}
                                candidate={candidate}
                                votingStarted={votingStarted}
                                votingEnded={votingEnded}
                                onVoteSuccess={getVotes}
                            />
                        ))}
                    </div>
                )}

                {!loading && !error && candidates.length === 0 && (
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
