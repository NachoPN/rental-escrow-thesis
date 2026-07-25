import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RentalEscrowModule = buildModule("RentalEscrowModule", (m) => {
  const rentalEscrow = m.contract("RentalEscrow");

  return { rentalEscrow };
});

export default RentalEscrowModule;