export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CONTRACT_ABI = [
  "function createBooking(address tenant, uint256 rentalAmount, uint256 depositAmount, uint256 startDate, uint256 endDate) external returns (uint256)",
  "function fundBooking(uint256 bookingId) external payable",
  "function startBooking(uint256 bookingId) external",
  "function completeBooking(uint256 bookingId) external",
  "function cancelBooking(uint256 bookingId) external",
  "function getBooking(uint256 bookingId) external view returns (address landlord, address tenant, uint256 rentalAmount, uint256 depositAmount, uint256 startDate, uint256 endDate, uint8 status)",
  "event BookingCreated(uint256 indexed bookingId, address indexed landlord, address indexed tenant, uint256 rentalAmount, uint256 depositAmount, uint256 startDate, uint256 endDate)",
  "event BookingFunded(uint256 indexed bookingId, address indexed tenant, uint256 amount)",
  "event BookingStarted(uint256 indexed bookingId)",
  "event BookingCompleted(uint256 indexed bookingId, uint256 amountReleased)",
  "event BookingCancelled(uint256 indexed bookingId, uint256 amountRefunded)"
];

export const BOOKING_STATUS = {
  0: "Created",
  1: "Funded",
  2: "Started",
  3: "Completed",
  4: "Cancelled",
};