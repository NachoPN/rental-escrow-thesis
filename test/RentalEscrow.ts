import { expect } from "chai";
import { network } from "hardhat";

describe("RentalEscrow", function () {
  async function deployRentalEscrowFixture() {
    const { ethers } = await network.connect();

    const [landlord, tenant, otherUser] = await ethers.getSigners();

    const RentalEscrow = await ethers.getContractFactory("RentalEscrow");
    const rentalEscrow = await RentalEscrow.deploy();

    const rentalAmount = ethers.parseEther("1");
    const depositAmount = ethers.parseEther("0.5");
    const startDate = Math.floor(Date.now() / 1000) + 3600;
    const endDate = startDate + 86400;

    return {
      ethers,
      rentalEscrow,
      landlord,
      tenant,
      otherUser,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    };
  }

  it("deberia crear una reserva correctamente", async function () {
    const {
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await expect(
      rentalEscrow
        .connect(landlord)
        .createBooking(
          tenant.address,
          rentalAmount,
          depositAmount,
          startDate,
          endDate
        )
    ).to.emit(rentalEscrow, "BookingCreated");

    const booking = await rentalEscrow.getBooking(0);

    expect(booking.landlord).to.equal(landlord.address);
    expect(booking.tenant).to.equal(tenant.address);
    expect(booking.rentalAmount).to.equal(rentalAmount);
    expect(booking.depositAmount).to.equal(depositAmount);
    expect(booking.status).to.equal(0); // Created
  });

  it("deberia permitir que el arrendatario deposite los fondos de la reserva", async function () {
    const {
      ethers,
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const totalAmount = rentalAmount + depositAmount;

    await expect(
      rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount })
    ).to.emit(rentalEscrow, "BookingFunded");

    const booking = await rentalEscrow.getBooking(0);
    const contractAddress = await rentalEscrow.getAddress();
    const contractBalance = await ethers.provider.getBalance(contractAddress);

    expect(booking.status).to.equal(1); // Funded
    expect(contractBalance).to.equal(totalAmount);
  });

  it("deberia rechazar pagos con monto incorrecto", async function () {
    const {
      ethers,
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const incorrectAmount = ethers.parseEther("0.2");

    await expect(
      rentalEscrow.connect(tenant).fundBooking(0, { value: incorrectAmount })
    ).to.be.revertedWith("Incorrect payment amount");
  });

  it("deberia impedir que un usuario no autorizado deposite fondos", async function () {
    const {
      rentalEscrow,
      landlord,
      tenant,
      otherUser,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const totalAmount = rentalAmount + depositAmount;

    await expect(
      rentalEscrow.connect(otherUser).fundBooking(0, { value: totalAmount })
    ).to.be.revertedWith("Only tenant can execute this action");
  });

  it("deberia iniciar una reserva financiada", async function () {
    const {
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const totalAmount = rentalAmount + depositAmount;

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });

    await expect(rentalEscrow.connect(landlord).startBooking(0)).to.emit(
      rentalEscrow,
      "BookingStarted"
    );

    const booking = await rentalEscrow.getBooking(0);

    expect(booking.status).to.equal(2); // Started
  });

  it("deberia completar la reserva y liberar los fondos bloqueados", async function () {
    const {
      ethers,
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const totalAmount = rentalAmount + depositAmount;
    const contractAddress = await rentalEscrow.getAddress();

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow.connect(landlord).startBooking(0);

    const balanceBefore = await ethers.provider.getBalance(contractAddress);
    expect(balanceBefore).to.equal(totalAmount);

    await expect(
      rentalEscrow.connect(landlord).completeBooking(0)
    )
      .to.emit(rentalEscrow, "BookingCompleted")
      .withArgs(0, totalAmount);

    const balanceAfter = await ethers.provider.getBalance(contractAddress);
    const booking = await rentalEscrow.getBooking(0);

    expect(balanceAfter).to.equal(0n);
    expect(booking.status).to.equal(3); // Completed
  });

  it("deberia cancelar una reserva financiada y devolver los fondos bloqueados", async function () {
    const {
      ethers,
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const totalAmount = rentalAmount + depositAmount;
    const contractAddress = await rentalEscrow.getAddress();

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });

    const balanceBefore = await ethers.provider.getBalance(contractAddress);
    expect(balanceBefore).to.equal(totalAmount);

    await expect(
      rentalEscrow.connect(tenant).cancelBooking(0)
    )
      .to.emit(rentalEscrow, "BookingCancelled")
      .withArgs(0, totalAmount);

    const balanceAfter = await ethers.provider.getBalance(contractAddress);
    const booking = await rentalEscrow.getBooking(0);

    expect(balanceAfter).to.equal(0n);
    expect(booking.status).to.equal(4); // Cancelled
  });

  it("deberia impedir cancelar una reserva ya iniciada", async function () {
    const {
      rentalEscrow,
      landlord,
      tenant,
      rentalAmount,
      depositAmount,
      startDate,
      endDate,
    } = await deployRentalEscrowFixture();

    await rentalEscrow
      .connect(landlord)
      .createBooking(
        tenant.address,
        rentalAmount,
        depositAmount,
        startDate,
        endDate
      );

    const totalAmount = rentalAmount + depositAmount;

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow.connect(landlord).startBooking(0);

    await expect(
      rentalEscrow.connect(tenant).cancelBooking(0)
    ).to.be.revertedWith("Only created or funded bookings can be cancelled");
  });
});