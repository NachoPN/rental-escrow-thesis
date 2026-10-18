/** Verificación SOLO LECTURA: delegación EIP-7702 en la cuenta de Marina, Sepolia. */
import { network } from "hardhat";

const MARINA = "0xDa7d58493eFe4702b77BBB1C4486b0fdAe9A1392";
const ESCROW = "0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350";
const HASHES = [
  "0x7a35cc6455e55b6fc7885b84e1272ce5926fe1ca0f2f928784d3fd42f9f134b6",
  "0x29fc4c056ec71d4f534369b213e584ebbeaae2cbbbe6b1f1d29797c3056d6fdf",
];

const { ethers } = await network.connect();
const provider = ethers.provider;
const net = await provider.getNetwork();
if (net.chainId !== 11155111n) throw new Error("Este diagnóstico debe ejecutarse en Sepolia.");

console.log("DIAGNÓSTICO DE CUENTA MARINA — SOLO LECTURA");
console.log("Red:", net.chainId.toString());
console.log("Cuenta:", MARINA);
const code = await provider.getCode(MARINA);
console.log("Código actual de Marina:", code === "0x" ? "0x (sin delegación activa observable)" : code);
console.log("Delegación EIP-7702 activa:", code.toLowerCase().startsWith("0xef0100") ? "SÍ (el código comienza por 0xef0100)" : code === "0x" ? "NO (código vacío)" : "Código distinto de vacío; requiere revisión");
for (const hash of HASHES) {
  const tx = await provider.getTransaction(hash);
  const receipt = await provider.getTransactionReceipt(hash);
  console.log("\nTransacción:", hash);
  console.log("Desde:", tx?.from ?? "no encontrada");
  console.log("Destino:", tx?.to ?? "no encontrado");
  console.log("¿Directo a RentalEscrow?:", tx?.to?.toLowerCase() === ESCROW.toLowerCase());
  console.log("Tipo de transacción:", tx?.type ?? "sin dato");
  console.log("Resultado:", receipt?.status === 1 ? "ÉXITO" : receipt?.status === 0 ? "REVERTIDA" : "sin recibo");
}
console.log("\nNo se enviaron transacciones ni se gastó ETH.");
