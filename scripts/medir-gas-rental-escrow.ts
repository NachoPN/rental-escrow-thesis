import { network } from "hardhat";

// Medición exploratoria en red Hardhat local. No constituye un costo observado en mainnet.
const { ethers } = await network.connect();
const [landlord, tenant] = await ethers.getSigners();
const RentalEscrow = await ethers.getContractFactory("RentalEscrow");
const contract = await RentalEscrow.deploy();
await contract.waitForDeployment();

const rent = ethers.parseEther("1");
const deposit = ethers.parseEther("0.5");
const additional = ethers.parseEther("0.25");
const startDate = Math.floor(Date.now() / 1000) + 3600;
const endDate = startDate + 86400;

type GasRow = { operation: string; gas: bigint };
const rows: GasRow[] = [];

async function measure(operation: string, txPromise: Promise<any>) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transacción fallida: ${operation}`);
  rows.push({ operation, gas: receipt.gasUsed });
}

// Flujo original: una reserva de 1 ETH + 0,5 ETH de depósito.
await measure("Original | Crear reserva", contract.connect(landlord).createBooking(tenant.address, rent, deposit, startDate, endDate));
await measure("Original | Fondear reserva", contract.connect(tenant).fundBooking(0, { value: rent + deposit }));
await measure("Original | Iniciar reserva", contract.connect(landlord).startBooking(0));
await measure("Original | Completar reserva", contract.connect(landlord).completeBooking(0));

// Flujo ampliado: misma reserva más un refuerzo de 0,25 ETH.
await measure("Ampliado | Crear reserva", contract.connect(landlord).createBooking(tenant.address, rent, deposit, startDate, endDate));
await measure("Ampliado | Fondear reserva", contract.connect(tenant).fundBooking(1, { value: rent + deposit }));
await measure("Ampliado | Solicitar refuerzo", contract.connect(landlord).requestAdditionalFunding(1, additional));
await measure("Ampliado | Financiar refuerzo", contract.connect(tenant).fundAdditionalAmount(1, { value: additional }));
await measure("Ampliado | Iniciar reserva", contract.connect(landlord).startBooking(1));
await measure("Ampliado | Completar reserva", contract.connect(landlord).completeBooking(1));

// Cancelación financiada, sin refuerzo.
await measure("Cancelación | Crear reserva", contract.connect(landlord).createBooking(tenant.address, rent, deposit, startDate, endDate));
await measure("Cancelación | Fondear reserva", contract.connect(tenant).fundBooking(2, { value: rent + deposit }));
await measure("Cancelación | Cancelar y devolver", contract.connect(tenant).cancelBooking(2));

const total = (prefix: string) => rows.filter(r => r.operation.startsWith(prefix)).reduce((sum, r) => sum + r.gas, 0n);
const format = (gas: bigint) => gas.toString();
const simulatedGwei = [1n, 5n, 20n];

console.log("\nRESULTADOS DE MEDICIÓN DE GAS - HARDHAT LOCAL\n");
console.log("Operación;Gas usado");
for (const row of rows) console.log(`${row.operation};${format(row.gas)}`);
console.log(`TOTAL FLUJO ORIGINAL;${format(total("Original"))}`);
console.log(`TOTAL FLUJO AMPLIADO;${format(total("Ampliado"))}`);
console.log(`DIFERENCIA AMPLIADO - ORIGINAL;${format(total("Ampliado") - total("Original"))}`);
console.log(`TOTAL CANCELACIÓN;${format(total("Cancelación"))}`);

console.log("\nCOSTO ESTIMADO EN ETH BAJO TARIFAS HIPOTÉTICAS\n");
console.log("Flujo;Gas;1 gwei;5 gwei;20 gwei");
for (const [name, gas] of [["Original", total("Original")], ["Ampliado", total("Ampliado")], ["Cancelación", total("Cancelación")]] as const) {
  console.log(`${name};${gas};${simulatedGwei.map(gwei => ethers.formatEther(gas * gwei * 1_000_000_000n)).join(";")}`);
}
console.log("\nNotas: se usa gas efectivamente consumido en una red Hardhat local; las tarifas de 1, 5 y 20 gwei son escenarios hipotéticos. No se miden costos de intermediación tradicional ni tarifas reales de una red pública.\n");
