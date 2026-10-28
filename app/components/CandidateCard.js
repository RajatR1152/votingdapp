"use client";
import React, { useContext, useState } from "react";
import { ethers } from "ethers";
import { ABI, CONTRACT_ADDRESS } from "./Data";
import { toast } from "react-toastify";
import { AddressContext } from "@/context/AddressContext";

export default function CandidateCard({
    candidate,
    votingStarted,
    votingEnded,
    onVoteSuccess,
}) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const { address, setAddress } = useContext(AddressContext);


    try {
        const voteForCandidate = async () => {
            try {
                setLoading(true);
                setStatus("");

                if (!window.ethereum) {
                    throw new Error(
                        "Please install MetaMask."
                    );
                }

                if (votingEnded) {
                    throw new Error(
                        "Voting has ended."
                    );
                }

                if (!votingStarted) {
                    throw new Error(
                        "Voting has not started yet."
                    );
                }

                const provider =
                    new ethers.BrowserProvider(
                        window.ethereum
                    );

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

                const walletAddress =
                    await signer.getAddress();

                console.log(
                    "Connected wallet:",
                    walletAddress
                );

                const contract =
                    new ethers.Contract(
                        address,
                        ABI,
                        signer
                    );

                const started =
                    await contract.votingStarted();

                const ended =
                    await contract.votingEnded();

                if (!started) {
                    try {
                        toast.error(
                            "Voting has not started."
                        );
                    }
                    catch {

                    }
                }

                if (ended) {
                    try {
                        toast.warning(
                            "Voting has ended."
                        );
                    }
                    catch {

                    }
                }

                const proposal =
                    await contract.proposals(
                        candidate.id
                    );

                console.log(
                    "Proposal:",
                    proposal.name
                );

                console.log(
                    "Proposal votes:",
                    proposal.voteCount.toString()
                );

                const voter =
                    await contract.voters(
                        walletAddress
                    );

                console.log(
                    "Wallet:",
                    walletAddress
                );

                console.log(
                    "Weight:",
                    voter.weight.toString()
                );

                console.log(
                    "Already voted:",
                    voter.voted
                );

                console.log(
                    "Delegate:",
                    voter.delegate
                );

                console.log(
                    "Vote:",
                    voter.vote.toString()
                );

                if (voter.weight === 0n) {
                    try {
                        toast.error(
                            "This wallet does not have voting rights."
                        );
                    }
                    catch {

                    }
                }

                if (voter.voted) {
                    try {
                        toast.error(
                            "This wallet has already voted."
                        );
                    }
                    catch {

                    }
                }

                setStatus(
                    "Confirm the transaction in MetaMask..."
                );

                const tx =
                    await contract.vote(
                        candidate.id
                    );

                console.log(
                    "Transaction:",
                    tx.hash
                );

                setStatus(
                    "Transaction submitted. Waiting for confirmation..."
                );

                await tx.wait();

                console.log(
                    "Transaction confirmed:",
                    tx.hash
                );

                setStatus(
                    "Vote successful!"
                );

                if (onVoteSuccess) {
                    await onVoteSuccess();
                }
            } catch (err) {
                console.error(
                    "Voting error:",
                    err
                );

                if (
                    err?.code === 4001 ||
                    err?.code === "ACTION_REJECTED"
                ) {
                    setStatus(
                        "Transaction was rejected."
                    );
                } else {
                    setStatus(
                        err?.shortMessage ||
                        err?.reason ||
                        err?.message ||
                        "Vote failed."
                    );
                }
            } finally {
                setLoading(false);
            }
        };

        return (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#202020] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-xl">
                <div className="flex h-40 items-center justify-center bg-[#151515]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl font-bold text-white">
                        {candidate?.name
                            ?.charAt(0)
                            ?.toUpperCase()}
                    </div>
                </div>

                <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-white">
                                {candidate?.name}
                            </h2>

                            <p className="mt-1 text-sm text-gray-400">
                                Candidate #
                                {candidate?.id + 1}
                            </p>
                        </div>

                        <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                            <p className="text-xs text-gray-500">
                                Votes
                            </p>

                            <p className="font-semibold text-white">
                                {candidate?.voteCount}
                            </p>
                        </div>
                    </div>

                    {status && (
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
                            <p
                                className={`text-center text-xs ${status.includes(
                                    "successful"
                                )
                                    ? "text-green-400"
                                    : status.includes(
                                        "rejected"
                                    )
                                        ? "text-yellow-400"
                                        : "text-gray-400"
                                    }`}
                            >
                                {status}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={voteForCandidate}
                        disabled={
                            loading ||
                            !votingStarted ||
                            votingEnded
                        }
                        className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${loading ||
                            !votingStarted ||
                            votingEnded
                            ? "cursor-not-allowed bg-gray-600 text-gray-300"
                            : "bg-white text-black hover:bg-gray-200"
                            }`}
                    >
                        {loading
                            ? "Processing..."
                            : votingEnded
                                ? "Voting Ended"
                                : !votingStarted
                                    ? "Voting Not Started"
                                    : "Vote"}
                    </button>
                </div>
            </div>
        );
    }
    catch { }
}