import { network } from "hardhat";

const { ethers } = await network.connect();
const [cuenta] = await ethers.getSigners();
const red = await ethers.provider.getNetwork();
const saldo = await ethers.provider.getBalance(cuenta.address);

console.log("Red (Chain ID):", red.chainId.toString());
console.log("Cuenta:", cuenta.address);
console.log("Saldo en SepoliaETH:", ethers.formatEther(saldo));

if (red.chainId !== 11155111n) {
  throw new Error("La red conectada no es Ethereum Sepolia. No desplegar.");
}
