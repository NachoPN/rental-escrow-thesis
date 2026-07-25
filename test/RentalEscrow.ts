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

  it("deberia permitir que el arrendador solicite un refuerzo de reserva", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });

    await expect(
      rentalEscrow
        .connect(landlord)
        .requestAdditionalFunding(0, additionalAmount)
    )
      .to.emit(rentalEscrow, "AdditionalFundingRequested")
      .withArgs(0, landlord.address, additionalAmount);

    const booking = await rentalEscrow.getBooking(0);
    const additionalFunding = await rentalEscrow.getAdditionalFunding(0);

    expect(booking.status).to.equal(5); // AdditionalFundingRequired
    expect(additionalFunding.pendingAdditionalAmount).to.equal(additionalAmount);
    expect(additionalFunding.fundedAdditionalAmount).to.equal(0n);
    expect(additionalFunding.additionalFundingRequested).to.equal(true);
  });

  it("deberia impedir iniciar una reserva mientras el refuerzo este pendiente", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);

    await expect(
      rentalEscrow.connect(landlord).startBooking(0)
    ).to.be.revertedWith("Booking must be funded before starting");
  });

  it("deberia permitir que el arrendatario deposite exactamente el refuerzo solicitado", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");
    const contractAddress = await rentalEscrow.getAddress();

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);

    await expect(
      rentalEscrow.connect(tenant).fundAdditionalAmount(0, {
        value: additionalAmount,
      })
    )
      .to.emit(rentalEscrow, "AdditionalFundingPaid")
      .withArgs(0, tenant.address, additionalAmount);

    const booking = await rentalEscrow.getBooking(0);
    const additionalFunding = await rentalEscrow.getAdditionalFunding(0);
    const contractBalance = await ethers.provider.getBalance(contractAddress);

    expect(booking.status).to.equal(1); // Funded
    expect(additionalFunding.pendingAdditionalAmount).to.equal(0n);
    expect(additionalFunding.fundedAdditionalAmount).to.equal(additionalAmount);
    expect(additionalFunding.additionalFundingRequested).to.equal(true);
    expect(contractBalance).to.equal(totalAmount + additionalAmount);
  });

  it("deberia permitir iniciar la reserva despues de pagar el refuerzo", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);
    await rentalEscrow.connect(tenant).fundAdditionalAmount(0, {
      value: additionalAmount,
    });

    await expect(rentalEscrow.connect(landlord).startBooking(0)).to.emit(
      rentalEscrow,
      "BookingStarted"
    );

    const booking = await rentalEscrow.getBooking(0);

    expect(booking.status).to.equal(2); // Started
  });

  it("deberia impedir solicitar mas de un refuerzo por reserva", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);
    await rentalEscrow.connect(tenant).fundAdditionalAmount(0, {
      value: additionalAmount,
    });

    await expect(
      rentalEscrow
        .connect(landlord)
        .requestAdditionalFunding(0, additionalAmount)
    ).to.be.revertedWith("Additional funding already requested");
  });

  it("deberia rechazar refuerzos solicitados por usuarios no autorizados", async function () {
    const {
      ethers,
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
    const additionalAmount = ethers.parseEther("0.25");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });

    await expect(
      rentalEscrow
        .connect(otherUser)
        .requestAdditionalFunding(0, additionalAmount)
    ).to.be.revertedWith("Only landlord can execute this action");
  });

  it("deberia rechazar refuerzos de monto cero", async function () {
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

    await expect(
      rentalEscrow.connect(landlord).requestAdditionalFunding(0, 0)
    ).to.be.revertedWith("Additional amount must be greater than zero");
  });

  it("deberia rechazar el pago de refuerzo con monto incorrecto", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");
    const incorrectAmount = ethers.parseEther("0.1");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);

    await expect(
      rentalEscrow.connect(tenant).fundAdditionalAmount(0, {
        value: incorrectAmount,
      })
    ).to.be.revertedWith("Incorrect additional payment amount");
  });

  it("deberia rechazar pagos de refuerzo de usuarios no autorizados", async function () {
    const {
      ethers,
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
    const additionalAmount = ethers.parseEther("0.25");

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);

    await expect(
      rentalEscrow.connect(otherUser).fundAdditionalAmount(0, {
        value: additionalAmount,
      })
    ).to.be.revertedWith("Only tenant can execute this action");
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

  it("deberia completar la reserva y liberar tambien el refuerzo pagado", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");
    const totalWithAdditional = totalAmount + additionalAmount;
    const contractAddress = await rentalEscrow.getAddress();

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);
    await rentalEscrow.connect(tenant).fundAdditionalAmount(0, {
      value: additionalAmount,
    });
    await rentalEscrow.connect(landlord).startBooking(0);

    const balanceBefore = await ethers.provider.getBalance(contractAddress);
    expect(balanceBefore).to.equal(totalWithAdditional);

    await expect(
      rentalEscrow.connect(landlord).completeBooking(0)
    )
      .to.emit(rentalEscrow, "BookingCompleted")
      .withArgs(0, totalWithAdditional);

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
    const additionalFunding = await rentalEscrow.getAdditionalFunding(0);

    expect(balanceAfter).to.equal(0n);
    expect(booking.status).to.equal(4); // Cancelled
    expect(additionalFunding.pendingAdditionalAmount).to.equal(0n);
  });

  it("deberia cancelar una reserva con refuerzo pendiente y devolver solo fondos depositados", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");
    const contractAddress = await rentalEscrow.getAddress();

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);

    const balanceBefore = await ethers.provider.getBalance(contractAddress);
    expect(balanceBefore).to.equal(totalAmount);

    await expect(
      rentalEscrow.connect(tenant).cancelBooking(0)
    )
      .to.emit(rentalEscrow, "BookingCancelled")
      .withArgs(0, totalAmount);

    const balanceAfter = await ethers.provider.getBalance(contractAddress);
    const booking = await rentalEscrow.getBooking(0);
    const additionalFunding = await rentalEscrow.getAdditionalFunding(0);

    expect(balanceAfter).to.equal(0n);
    expect(booking.status).to.equal(4); // Cancelled
    expect(additionalFunding.pendingAdditionalAmount).to.equal(0n);
  });

  it("deberia cancelar una reserva despues de pagar el refuerzo y devolver todos los fondos depositados", async function () {
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
    const additionalAmount = ethers.parseEther("0.25");
    const totalWithAdditional = totalAmount + additionalAmount;
    const contractAddress = await rentalEscrow.getAddress();

    await rentalEscrow.connect(tenant).fundBooking(0, { value: totalAmount });
    await rentalEscrow
      .connect(landlord)
      .requestAdditionalFunding(0, additionalAmount);
    await rentalEscrow.connect(tenant).fundAdditionalAmount(0, {
      value: additionalAmount,
    });

    const balanceBefore = await ethers.provider.getBalance(contractAddress);
    expect(balanceBefore).to.equal(totalWithAdditional);

    await expect(
      rentalEscrow.connect(tenant).cancelBooking(0)
    )
      .to.emit(rentalEscrow, "BookingCancelled")
      .withArgs(0, totalWithAdditional);

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
    ).to.be.revertedWith(
      "Only created, funded or additional funding required bookings can be cancelled"
    );
  });
});
