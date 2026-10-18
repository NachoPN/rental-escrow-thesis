/**
 * Diagnostica la transacción revertida de solicitud de refuerzo en Sepolia.
 * SOLO LECTURA: no firma ni envía ninguna transacción.
 * Ejecutar: npx hardhat run scripts/diagnosticar-refuerzo-revertido.ts --network sepolia
 */
import { network } from "hardhat";

const TX_HASH = "0x29fc4c056ec71d4f534369b213e584ebbeaae2cbbbe6b1f1d29797c3056d6fdf";
const CONTRACT = "0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350";
const MARINA = "0xDa7d58493eFe4702b77BBB1C4486b0fdAe9A1392";
const ABI = [
  "function getBooking(uint256) view returns (address landlord,address tenant,uint256 rentalAmount,uint256 depositAmount,uint256 startDate,uint256 endDate,uint8 status)",
  "function getAdditionalFunding(uint256) view returns (uint256 pendingAdditionalAmount,uint256 fundedAdditionalAmount,bool additionalFundingRequested)",
  "function requestAdditionalFunding(uint256 bookingId,uint256 amount)",
  "error Error(string)",
];

const { ethers } = await network.connect();
const provider = ethers.provider;
const currentNetwork = await provider.getNetwork();
if (currentNetwork.chainId !== 11155111n) throw new Error("Red incorrecta: esperado Sepolia (11155111)");
const contract = new ethers.Contract(CONTRACT, ABI, provider);
const iface = new ethers.Interface(ABI);
console.log("=== DIAGNÓSTICO SOLO LECTURA: REFUERZO REVERTIDO ===");
console.log("Red:", currentNetwork.chainId.toString());

const [tx, receipt, booking, extra] = await Promise.all([
  provider.getTransaction(TX_HASH),
  provider.getTransactionReceipt(TX_HASH),
  contract.getBooking(0n),
  contract.getAdditionalFunding(0n),
]);
if (!tx) throw new Error("No se encontró la transacción en Sepolia. Revisa el hash.");
console.log("Hash:", TX_HASH);
console.log("De:", tx.from);
console.log("¿Se envió desde Marina?:", tx.from.toLowerCase() === MARINA.toLowerCase());
console.log("Hacia:", tx.to || "Creación de contrato");
console.log("¿Destino correcto?:", (tx.to || "").toLowerCase() === CONTRACT.toLowerCase());
console.log("ETH adjunto:", ethers.formatEther(tx.value));
console.log("Gas límite:", tx.gasLimit.toString());
console.log("Bloque:", receipt?.blockNumber ?? "pendiente");
console.log("Resultado:", receipt?.status === 1 ? "EXITOSA" : receipt?.status === 0 ? "REVERTIDA" : "Sin recibo");
console.log("Gas consumido:", receipt?.gasUsed.toString() ?? "no disponible");
console.log("Reserva #0 estado actual:", booking.status.toString(), "(Funded=1, AdditionalFundingRequired=5)");
console.log("Arrendador en contrato:", booking.landlord);
console.log("Refuerzo ya solicitado:", extra.additionalFundingRequested);
console.log("Pendiente actual (ETH):", ethers.formatEther(extra.pendingAdditionalAmount));
console.log("Financiado (ETH):", ethers.formatEther(extra.fundedAdditionalAmount));

let parsed: any = null;
try {
  parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
  console.log("Función llamada:", parsed?.name || "desconocida");
  if (parsed?.name === "requestAdditionalFunding") {
    console.log("Booking ID enviado:", parsed.args[0].toString());
    console.log("Monto refuerzo enviado (ETH):", ethers.formatEther(parsed.args[1]));
  }
} catch (error: any) {
  console.log("No se pudo interpretar la función:", error?.shortMessage || error?.message || String(error));
}

const request = { from: tx.from, to: tx.to ?? undefined, data: tx.data, value: tx.value };
for (const [label, blockTag] of [
  ["BLOQUE ANTERIOR (estado previo a la transacción)", receipt ? receipt.blockNumber - 1 : null],
  ["ESTADO ACTUAL", "latest"],
] as const) {
  if (blockTag === null) continue;
  console.log(`\nSimulación ${label}:`);
  try {
    await provider.call(request, blockTag);
    console.log("No revierte al simular (puede depender de un estado/cambio de bloque diferente).");
  } catch (error: any) {
    console.log("Error:", error?.shortMessage || error?.reason || error?.message || String(error));
    const data = error?.data || error?.info?.error?.data;
    if (typeof data === "string" && data.startsWith("0x")) {
      try {
        const decoded = iface.parseError(data);
        if (decoded) console.log("Error decodificado:", decoded.name, decoded.args.map((x: unknown) => String(x)).join(" | "));
      } catch { /* algunos nodos RPC no devuelven motivo codificado */ }
    }
  }
}
console.log("\nDiagnóstico finalizado. NO se enviaron transacciones ni se gastó gas.");
