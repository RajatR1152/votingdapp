"use client";

import React, {
    useContext,
    useEffect,
    useState,
} from "react";
import { ethers } from "ethers";
import { ABI } from "./Data";
import { AddressContext } from "@/context/AddressContext";

export default function Result() {
    const [candidates, setCandidates] = useState([]);
    const [winner, setWinner] = useState("");
    const [votingEnded, setVotingEnded] =
        useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const { address } =
        useContext(AddressContext);

    const loadResults = async () => {
        try {
            setLoading(true);
            setError("");

            if (!window.ethereum) {
                throw new Error(
                    "Please install MetaMask."
                );
            }

            if (
                !address ||
                !ethers.isAddress(address)
            ) {
                throw new Error(
                    "Contract address is not available."
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
                    "Please switch MetaMask to Sepolia."
                );
            }

            const code =
                await provider.getCode(address);

            if (code === "0x") {
                throw new Error(
                    "No contract found at this address on Sepolia."
                );
            }

            const contract =
                new ethers.Contract(
                    address,
                    ABI,
                    provider
                );

            const ended =
                await contract.votingEnded();

            setVotingEnded(ended);

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
                        `Error loading candidate ${i}:`,
                        err
                    );
                }
            }

            setCandidates(candidateList);

            if (ended) {
                const winnerName =
                    await contract.winnerName();

                setWinner(winnerName);
            } else {
                setWinner("");
            }
        } catch (err) {
            console.error(
                "Result loading error:",
                err
            );

            setCandidates([]);
            setWinner("");

            setError(
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "Failed to load results."
            );
        } finally {
            setLoading(false);
        }
    };

    /*
     * Load results whenever
     * contract address changes
     */
    useEffect(() => {
        if (
            address &&
            ethers.isAddress(address)
        ) {
            loadResults();
        } else {
            setLoading(false);
            setError(
                "Contract address is not available."
            );
        }
    }, [address]);

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-gray-400">
                    Loading results...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
                <p className="break-words text-red-400">
                    {error}
                </p>

                <button
                    onClick={loadResults}
                    className="mt-4 rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-gray-200"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="container w-full p-5">
            <div className="w-full space-y-8">

                <div>
                    <h1 className="text-3xl font-bold text-white">
                        Election Results
                    </h1>

                    <p className="mt-2 text-gray-400">
                        View the votes received by each candidate.
                    </p>
                </div>

                {!votingEnded && (
                    <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">
                        <p className="font-semibold text-yellow-400">
                            Voting is still active
                        </p>

                        <p className="mt-1 text-sm text-yellow-400/70">
                            The final winner will be displayed after voting ends.
                        </p>
                    </div>
                )}

                {votingEnded && winner && (
                    <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-8 text-center">
                        <p className="text-sm font-medium uppercase tracking-widest text-green-400">
                            Winner
                        </p>

                        <h2 className="mt-3 text-4xl font-bold text-white">
                            {winner}
                        </h2>

                        <p className="mt-2 text-gray-400">
                            Congratulations to the winning candidate!
                        </p>
                    </div>
                )}

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {candidates.map(
                        (candidate) => (
                            <div
                                key={
                                    candidate.id
                                }
                                className="rounded-2xl border border-white/10 bg-[#202020] p-6 transition hover:-translate-y-1 hover:border-white/20"
                            >
                                <div className="flex items-start justify-between gap-4">

                                    <div>
                                        <p className="text-sm text-gray-500">
                                            Candidate #
                                            {candidate.id +
                                                1}
                                        </p>

                                        <h2 className="mt-2 text-xl font-semibold text-white">
                                            {
                                                candidate.name
                                            }
                                        </h2>
                                    </div>

                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
                                        {candidate.name
                                            ?.charAt(
                                                0
                                            )
                                            ?.toUpperCase()}
                                    </div>
                                </div>

                                <div className="mt-6 rounded-xl bg-white/5 p-4">
                                    <p className="text-sm text-gray-500">
                                        Total Votes
                                    </p>

                                    <p className="mt-1 text-3xl font-bold text-white">
                                        {
                                            candidate.voteCount
                                        }
                                    </p>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {candidates.length ===
                    0 && (
                        <div className="rounded-2xl border border-white/10 bg-[#202020] p-8 text-center text-gray-400">
                            No candidates found.
                        </div>
                    )}

                <h1>address:{address}</h1>

                <button
                    onClick={loadResults}
                    className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-gray-200"
                >
                    Refresh Results

                </button>
            </div>
        </div>
    );
}