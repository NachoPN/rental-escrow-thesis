/**
 * RentalEscrow — primera operación pública verificable para la tesis.
 * Ejecutar: npx hardhat run scripts/crear-reserva-sepolia.ts --network sepolia
 * Crea UNA reserva nueva cada vez que se ejecuta. No volver a correr si ya se confirmó.
 */
import { network } from "hardhat";

const CONTRACT_ADDRESS = "0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350";
const TENANT_ADDRESS = "0x3a38f015cD284723D9Ce3c46F1fdf81DcA33248f";
const { ethers } = await network.create({ network: "sepolia", chainType: "l1" });

const provider = ethers.provider;
const chain = await provider.getNetwork();
if (chain.chainId !== 11155111n) {
  throw new Error(`Red incorrecta: chainId=${chain.chainId}. Se esperaba Sepolia (11155111).`);
}

const [landlord] = await ethers.getSigners();
if (!landlord) throw new Error("Hardhat no encontró la cuenta de despliegue.");
const landlordAddress = await landlord.getAddress();
const code = await provider.getCode(CONTRACT_ADDRESS);
if (code === "0x") throw new Error("No hay código de contrato en la dirección indicada en Sepolia.");

const rental = ethers.parseEther("0.001");
const deposit = ethers.parseEther("0.0005");
const now = Math.floor(Date.now() / 1000);
const startDate = BigInt(now + 24 * 60 * 60); // fecha ilustrativa: 24 h desde la ejecución
const endDate = BigInt(now + 3 * 24 * 60 * 60); // fecha ilustrativa: 72 h desde la ejecución

const contract = await ethers.getContractAt("RentalEscrow", CONTRACT_ADDRESS, landlord);
const nextBookingIdBefore = await contract.nextBookingId();

console.log("Red: Ethereum Sepolia (11155111)");
console.log("Contrato:", CONTRACT_ADDRESS);
console.log("Marina (arrendadora):", landlordAddress);
console.log("Diego (arrendatario):", TENANT_ADDRESS);
console.log("Alquiler: 0.001 ETH de prueba");
console.log("Garantía: 0.0005 ETH de prueba");
console.log("Inicio (UTC):", new Date(Number(startDate) * 1000).toISOString());
console.log("Fin (UTC):", new Date(Number(endDate) * 1000).toISOString());
console.log("Enviando createBooking (una sola transacción)...");

const tx = await contract.createBooking(TENANT_ADDRESS, rental, deposit, startDate, endDate);
console.log("Hash de transacción:", tx.hash);
console.log("Etherscan:", `https://sepolia.etherscan.io/tx/${tx.hash}`);

const receipt = await tx.wait(1);
if (!receipt || receipt.status !== 1) throw new Error("La transacción no confirmó correctamente.");

let createdBookingId: bigint | undefined;
for (const log of receipt.logs) {
  try {
    const event = contract.interface.parseLog(log);
    if (event?.name === "BookingCreated") {
      createdBookingId = BigInt(event.args.bookingId.toString());
      break;
    }
  } catch { /* Ignorar logs que no correspondan a la interfaz de RentalEscrow. */ }
}

if (createdBookingId === undefined) {
  throw new Error("La transacción confirmó, pero no se pudo identificar el evento BookingCreated. Conserva el hash anterior.");
}

const nextBookingIdAfter = await contract.nextBookingId();
console.log("\n=== EVIDENCIA PARA LA TESIS ===");
console.log("Booking ID:", createdBookingId.toString());
console.log("Estado esperado: Created (0)");
console.log("Gas efectivamente consumido:", receipt.gasUsed.toString());
console.log("Bloque:", receipt.blockNumber);
console.log("Total de reservas antes/después:", `${nextBookingIdBefore} -> ${nextBookingIdAfter}`);
console.log("Enlace verificable:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
console.log("IMPORTANTE: no vuelvas a ejecutar este script; crearía otra reserva.");
