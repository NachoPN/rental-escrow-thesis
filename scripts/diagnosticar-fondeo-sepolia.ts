/**
 * Diagnóstico SIN transacciones: simula fundBooking(0) en Ethereum Sepolia.
 * Ejecutar: npx hardhat run scripts/diagnosticar-fondeo-sepolia.ts --network sepolia
 * No requiere la clave privada de Diego; NO envía fondos.
 */
import { network } from "hardhat";

const CONTRACT_ADDRESS = "0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350";
const BOOKING_ID = 0n;
const DIEGO = "0x3a38f015cD284723D9Ce3c46F1fdf81DcA33248f";

const ABI = [
  "function getBooking(uint256) view returns (address landlord,address tenant,uint256 rentalAmount,uint256 depositAmount,uint256 startDate,uint256 endDate,uint8 status)",
  "function fundBooking(uint256) payable",
];

const { ethers } = await network.connect();
const provider = ethers.provider;
const chain = await provider.getNetwork();
if (chain.chainId !== 11155111n) throw new Error("Red incorrecta: se esperaba Sepolia (11155111)");

const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
const booking = await contract.getBooking(BOOKING_ID);
const amount = booking.rentalAmount + booking.depositAmount;
const balance = await provider.getBalance(DIEGO);
const code = await provider.getCode(CONTRACT_ADDRESS);

console.log("DIAGNÓSTICO DE FONDEO — SOLO LECTURA (NO ENVÍA TRANSACCIONES)");
console.log("Red:", chain.chainId.toString());
console.log("Contrato tiene código:", code !== "0x" ? "sí" : "no");
console.log("Reserva:", BOOKING_ID.toString(), "| Estado:", booking.status.toString(), "(Created=0)");
console.log("Arrendatario coincide con Diego:", booking.tenant.toLowerCase() === DIEGO.toLowerCase());
console.log("Fondeo requerido:", ethers.formatEther(amount), "ETH");
console.log("Saldo de Diego:", ethers.formatEther(balance), "ETH");
console.log("Importe cubierto por saldo:", balance >= amount);

try {
  const tx = {
    from: DIEGO,
    to: CONTRACT_ADDRESS,
    data: contract.interface.encodeFunctionData("fundBooking", [BOOKING_ID]),
    value: amount,
  };
  const gas = await provider.estimateGas(tx);
  console.log("Simulación eth_estimateGas: EXITOSA");
  console.log("Gas estimado:", gas.toString());
  console.log("No se ha enviado ninguna transacción.");
} catch (err: any) {
  console.log("Simulación eth_estimateGas: FALLÓ");
  console.log("Código:", err?.code ?? "desconocido");
  console.log("Mensaje:", err?.shortMessage ?? err?.reason ?? err?.message ?? String(err));
  if (err?.info?.error?.message) console.log("RPC:", err.info.error.message);
  console.log("No se ha enviado ninguna transacción.");
}
