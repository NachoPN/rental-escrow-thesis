import { network } from "hardhat";

// Solo lectura: comprueba si la desactivación de MetaMask revocó
// la delegación EIP-7702 de Marina en Ethereum Sepolia.
const HASH = "0x8558a5c91ea60787bb1fc1a6fdd5e5482159d70534f6e181ace22e0f53f2199e";
const MARINA = "0xDa7d58493eFe4702b77BBB1C4486b0fdAe9A1392";

function describirCodigo(code: string) {
  if (code === "0x") return "Sin código (EOA sin delegación activa)";
  if (code.toLowerCase().startsWith("0xef0100")) {
    return `Delegación EIP-7702 a 0x${code.slice(8)}`;
  }
  return `Otro código (inicio: ${code.slice(0, 26)}…)`;
}

async function main() {
  const { ethers } = await network.connect();
  const provider = ethers.provider;
  const net = await provider.getNetwork();
  if (net.chainId !== 11155111n) {
    throw new Error(`Red equivocada: ${net.chainId}. Se esperaba Sepolia (11155111).`);
  }
  const tx = await provider.getTransaction(HASH);
  const receipt = await provider.getTransactionReceipt(HASH);
  if (!tx || !receipt) throw new Error("No se encontró la transacción o su recibo en Sepolia.");

  const prev = await provider.getCode(MARINA, receipt.blockNumber - 1);
  const after = await provider.getCode(MARINA, receipt.blockNumber);
  const now = await provider.getCode(MARINA);
  const raw: any = await provider.send("eth_getTransactionByHash", [HASH]);

  console.log("=== REVISIÓN DE DESACTIVACIÓN SMART ACCOUNT — SOLO LECTURA ===");
  console.log("Red:", net.chainId.toString());
  console.log("Hash:", HASH);
  console.log("Bloque:", receipt.blockNumber);
  console.log("Estado:", receipt.status === 1 ? "ÉXITO" : "REVERTIDA");
  console.log("Tipo de transacción:", tx.type);
  console.log("Desde:", tx.from);
  console.log("¿Enviada por Marina?:", tx.from.toLowerCase() === MARINA.toLowerCase());
  console.log("Hacia:", tx.to ?? "Creación de contrato");
  console.log("Autorizaciones EIP-7702:", Array.isArray(raw?.authorizationList) ? raw.authorizationList.length : "No expuestas por RPC");
  if (Array.isArray(raw?.authorizationList)) {
    raw.authorizationList.forEach((a: any, i: number) => {
      console.log(`  Autorización ${i + 1}: destino=${a.address ?? "desconocido"}, chainId=${a.chainId ?? "desconocido"}`);
    });
  }
  console.log("Código ANTES del bloque:", describirCodigo(prev));
  console.log("Código DESPUÉS del bloque:", describirCodigo(after));
  console.log("Código ACTUAL:", describirCodigo(now));
  console.log("Cambio en ese bloque:", prev.toLowerCase() === after.toLowerCase() ? "NO se observa cambio" : "SÍ se observa cambio");
  console.log("No se enviaron transacciones ni se gastó ETH.");
}

main().catch((error) => { console.error("Error de diagnóstico:", error.message ?? error); process.exitCode = 1; });
