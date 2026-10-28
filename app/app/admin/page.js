'use client'
import { AddressContext } from '@/context/AddressContext';
import React, { useContext, useEffect, useState } from 'react'
import { toast } from "react-toastify";


export default function page() {

    const [candidateName, setCandidateName] = useState("");
    const [voterAddress, setVoterAddress] = useState("");
    const [newContractAddress, setNewContractAddress] =
        useState("");
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminStatus, setAdminStatus] = useState("");
    const { address, setAddress } =
        useContext(AddressContext);
    const [account, setAccount] = useState("");
    const [chairPerson, setChairPerson] = useState(true);


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


            const code =
                await provider.getCode(
                    newAddress
                );

            if (code === "0x") {
                throw new Error(
                    "No contract found at this address on Sepolia."
                );
            }


            const newContract =
                new ethers.Contract(
                    newAddress,
                    ABI,
                    provider
                );


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

    useEffect(() => {
        if (
            address &&
            ethers.isAddress(address)
        ) {
            getVotes(address);
        }
    }, [address]);

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
        <>
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
        </>
    )
}
