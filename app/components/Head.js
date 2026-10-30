"use client";

import React, { useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { IoWalletOutline } from "react-icons/io5";
import { FiCopy, FiExternalLink, FiShield } from "react-icons/fi";
import { HiOutlineStatusOnline } from "react-icons/hi";
import { ABI } from "@/components/Data";
import { AddressContext } from "@/context/AddressContext";
import Link from "next/link";
import axios from "axios";

export default function Head() {
    const [account, setAccount] = useState("");
    const [network, setNetwork] = useState("");
    const [balance, setBalance] = useState("0");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { address, setAddress } = useContext(AddressContext);


    useEffect(() => {
        getContractAddress();
    }, [])

    function getContractAddress() {
        
        axios.get(`https://votingdappserver-3qcu.onrender.com/address`).then((res) => {
            setAddress(res.data.address)
        })
    }

    const loadWallet = async () => {
        if (!window.ethereum) return;

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);

            const accounts = await provider.listAccounts();

            if (accounts.length === 0) {
                setAccount("");
                setNetwork("");
                setBalance("0");
                return;
            }

            const walletAddress = await accounts[0].getAddress();

            setAccount(walletAddress);

            const networkData = await provider.getNetwork();

            if (networkData.chainId === 11155111n) {
                setNetwork("Sepolia");
            } else {
                setNetwork(networkData.name || `Chain ${networkData.chainId}`);
            }

            const walletBalance = await provider.getBalance(walletAddress);

            setBalance(
                Number(ethers.formatEther(walletBalance)).toFixed(4)
            );
        } catch (err) {
            console.error("Wallet loading error:", err);

            setError(
                err?.shortMessage ||
                err?.message ||
                "Failed to load wallet"
            );
        }
    };

    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                setError("Please install MetaMask");
                return;
            }

            setLoading(true);
            setError("");

            await window.ethereum.request({
                method: "eth_requestAccounts",
            });

            await loadWallet();
        } catch (err) {
            console.error(err);

            setError(
                err?.shortMessage ||
                err?.message ||
                "Failed to connect wallet"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWallet();
    }, []);

    useEffect(() => {
        if (!window.ethereum) return;

        const handleAccountsChanged = () => {
            loadWallet();
        };

        const handleChainChanged = () => {
            loadWallet();
        };

        window.ethereum.on(
            "accountsChanged",
            handleAccountsChanged
        );

        window.ethereum.on(
            "chainChanged",
            handleChainChanged
        );

        return () => {
            window.ethereum.removeListener(
                "accountsChanged",
                handleAccountsChanged
            );

            window.ethereum.removeListener(
                "chainChanged",
                handleChainChanged
            );
        };
    }, []);

    const copyAddress = async () => {
        if (!account) return;

        try {
            await navigator.clipboard.writeText(account);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const shortAddress = account
        ? `${account.slice(0, 6)}...${account.slice(-4)}`
        : "Not connected";

    const etherscanUrl = account
        ? `https://sepolia.etherscan.io/address/${account}`
        : "#";

    return (
        <div className="w-full p-4 md:p-6">
            <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#181818] shadow-2xl">

                <div className="flex flex-col gap-6 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between md:p-6">

                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#3a45ef] shadow-[0_0_12px_#3a45ef]" />

                            <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
                                Web3 Application
                            </span>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            Decentralized Voting {address}
                        </h1>

                        <p className="mt-1 text-sm text-gray-500">
                            Secure and transparent blockchain-based voting
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">

                        <Link href={'/admin'}
                            className="
                                flex items-center justify-center gap-2
                                rounded-xl border border-white/10
                                bg-white/5 px-5 py-3
                                text-sm font-semibold text-gray-200
                                transition-all duration-200
                                hover:border-white/20
                                hover:bg-white/10
                                hover:text-white
                                active:scale-95
                            "
                        >
                            <FiShield size={17} />
                            Admin
                        </Link>

                        <button
                            onClick={connectWallet}
                            disabled={loading}
                            className="
                                flex items-center justify-center gap-2
                                rounded-xl bg-[#3a45ef]
                                px-5 py-3
                                text-sm font-semibold text-white
                                shadow-lg shadow-[#3a45ef]/20
                                transition-all duration-200
                                hover:bg-[#4a54ff]
                                hover:shadow-[#3a45ef]/40
                                active:scale-95
                                disabled:cursor-not-allowed
                                disabled:opacity-60
                            "
                        >
                            <IoWalletOutline size={19} />

                            {loading
                                ? "Connecting..."
                                : account
                                    ? shortAddress
                                    : "Connect Wallet"}
                        </button>

                    </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 bg-[#121212] p-4 md:grid-cols-3 md:p-5">

                    <div className="
                        group rounded-xl border border-white/5
                        bg-[#1d1d1d] p-4
                        transition-all duration-200
                        hover:border-[#3a45ef]/30
                        hover:bg-[#202020]
                    ">

                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Wallet Address
                            </span>

                            <button
                                onClick={copyAddress}
                                disabled={!account}
                                className="
                                    rounded-lg p-2 text-gray-500
                                    transition hover:bg-white/5
                                    hover:text-white
                                    disabled:cursor-not-allowed
                                    disabled:opacity-30
                                "
                            >
                                <FiCopy size={15} />
                            </button>
                        </div>

                        <div className="flex min-w-0 items-center gap-3">

                            <div className="
                                flex h-9 w-9 shrink-0
                                items-center justify-center
                                rounded-lg
                                bg-gradient-to-br
                                from-[#3a45ef] to-purple-500
                                shadow-lg shadow-purple-500/10
                            ">
                                <IoWalletOutline
                                    size={17}
                                    className="text-white"
                                />
                            </div>

                            <p className="min-w-0 truncate text-sm font-semibold text-gray-200">
                                {shortAddress}
                            </p>
                        </div>

                        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">

                            <span
                                className={`h-1.5 w-1.5 rounded-full ${account
                                    ? "bg-green-400"
                                    : "bg-gray-500"
                                    }`}
                            />

                            {account
                                ? "Wallet connected"
                                : "Wallet not connected"}
                        </div>
                    </div>

                    <div className="
                        rounded-xl border border-white/5
                        bg-[#1d1d1d] p-4
                        transition-all duration-200
                        hover:border-white/10
                        hover:bg-[#202020]
                    ">

                        <div className="mb-4 flex items-center justify-between">

                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Network
                            </span>

                            <HiOutlineStatusOnline
                                size={18}
                                className={
                                    network === "Sepolia"
                                        ? "text-green-400"
                                        : "text-gray-500"
                                }
                            />
                        </div>

                        <div className="flex items-center gap-2">

                            <span
                                className={`
                                    h-2.5 w-2.5 rounded-full
                                    ${network === "Sepolia"
                                        ? "bg-green-400 shadow-[0_0_8px_#4ade80]"
                                        : "bg-gray-500"
                                    }
                                `}
                            />

                            <p className="text-lg font-bold text-white">
                                {network || "Not connected"}
                            </p>
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                            Ethereum Test Network
                        </p>

                        <div
                            className={`
                                mt-3 flex items-center gap-1.5 text-xs
                                ${network === "Sepolia"
                                    ? "text-green-400"
                                    : "text-gray-500"
                                }
                            `}
                        >
                            <span
                                className={`
                                    h-1.5 w-1.5 rounded-full
                                    ${network === "Sepolia"
                                        ? "bg-green-400"
                                        : "bg-gray-500"
                                    }
                                `}
                            />

                            {network === "Sepolia"
                                ? "Connected"
                                : "Not connected"}
                        </div>
                    </div>

                    <div className="
                        rounded-xl border border-white/5
                        bg-[#1d1d1d] p-4
                        transition-all duration-200
                        hover:border-white/10
                        hover:bg-[#202020]
                    ">

                        <div className="mb-4 flex items-center justify-between">

                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                                Balance
                            </span>

                            <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-400">
                                ETH
                            </span>
                        </div>

                        <p className="text-2xl font-bold tracking-tight text-white">
                            {balance}

                            <span className="ml-1 text-sm font-medium text-gray-400">
                                ETH
                            </span>
                        </p>

                        <div className="mt-3 flex items-center justify-between">

                            <span className="text-xs text-gray-500">
                                {network || "Ethereum"} balance
                            </span>

                            <a
                                href={etherscanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-disabled={!account}
                                className={`
                                    text-gray-500 transition hover:text-white
                                    ${!account
                                        ? "pointer-events-none opacity-30"
                                        : ""
                                    }
                                `}
                            >
                                <FiExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>

                {address && (
                    <div className="border-t border-white/5 bg-[#121212] px-5 py-2">
                        <p className="truncate text-[10px] text-gray-600">
                            Contract: {address}
                        </p>
                    </div>
                )}

                {error && (
                    <div className="border-t border-red-500/10 bg-red-500/5 px-5 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

            </div>
        </div>
    );
}