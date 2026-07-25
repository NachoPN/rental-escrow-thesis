// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract RentalEscrow {
    enum BookingStatus {
        Created,
        Funded,
        Started,
        Completed,
        Cancelled,
        AdditionalFundingRequired
    }

    struct Booking {
        address payable landlord;
        address payable tenant;
        uint256 rentalAmount;
        uint256 depositAmount;
        uint256 startDate;
        uint256 endDate;
        uint256 pendingAdditionalAmount;
        uint256 fundedAdditionalAmount;
        bool additionalFundingRequested;
        BookingStatus status;
    }

    uint256 public nextBookingId;
    mapping(uint256 => Booking) public bookings;

    event BookingCreated(
        uint256 indexed bookingId,
        address indexed landlord,
        address indexed tenant,
        uint256 rentalAmount,
        uint256 depositAmount,
        uint256 startDate,
        uint256 endDate
    );

    event BookingFunded(uint256 indexed bookingId, address indexed tenant, uint256 amount);
    event BookingStarted(uint256 indexed bookingId);
    event BookingCompleted(uint256 indexed bookingId, uint256 amountReleased);
    event BookingCancelled(uint256 indexed bookingId, uint256 amountRefunded);
    event AdditionalFundingRequested(uint256 indexed bookingId, address indexed landlord, uint256 amount);
    event AdditionalFundingPaid(uint256 indexed bookingId, address indexed tenant, uint256 amount);

    modifier onlyLandlord(uint256 bookingId) {
        require(msg.sender == bookings[bookingId].landlord, "Only landlord can execute this action");
        _;
    }

    modifier onlyTenant(uint256 bookingId) {
        require(msg.sender == bookings[bookingId].tenant, "Only tenant can execute this action");
        _;
    }

    modifier bookingExists(uint256 bookingId) {
        require(bookingId < nextBookingId, "Booking does not exist");
        _;
    }

    function createBooking(
        address payable tenant,
        uint256 rentalAmount,
        uint256 depositAmount,
        uint256 startDate,
        uint256 endDate
    ) external returns (uint256) {
        require(tenant != address(0), "Invalid tenant address");
        require(rentalAmount > 0, "Rental amount must be greater than zero");
        require(depositAmount > 0, "Deposit amount must be greater than zero");
        require(startDate < endDate, "Start date must be before end date");

        uint256 bookingId = nextBookingId;

        bookings[bookingId] = Booking({
            landlord: payable(msg.sender),
            tenant: tenant,
            rentalAmount: rentalAmount,
            depositAmount: depositAmount,
            startDate: startDate,
            endDate: endDate,
            pendingAdditionalAmount: 0,
            fundedAdditionalAmount: 0,
            additionalFundingRequested: false,
            status: BookingStatus.Created
        });

        nextBookingId++;

        emit BookingCreated(
            bookingId,
            msg.sender,
            tenant,
            rentalAmount,
            depositAmount,
            startDate,
            endDate
        );

        return bookingId;
    }

    function fundBooking(uint256 bookingId)
        external
        payable
        bookingExists(bookingId)
        onlyTenant(bookingId)
    {
        Booking storage booking = bookings[bookingId];

        require(booking.status == BookingStatus.Created, "Booking must be in Created status");

        uint256 totalAmount = booking.rentalAmount + booking.depositAmount;
        require(msg.value == totalAmount, "Incorrect payment amount");

        booking.status = BookingStatus.Funded;

        emit BookingFunded(bookingId, msg.sender, msg.value);
    }

    function requestAdditionalFunding(uint256 bookingId, uint256 amount)
        external
        bookingExists(bookingId)
        onlyLandlord(bookingId)
    {
        Booking storage booking = bookings[bookingId];

        require(booking.status == BookingStatus.Funded, "Booking must be funded");
        require(amount > 0, "Additional amount must be greater than zero");
        require(!booking.additionalFundingRequested, "Additional funding already requested");

        booking.pendingAdditionalAmount = amount;
        booking.additionalFundingRequested = true;
        booking.status = BookingStatus.AdditionalFundingRequired;

        emit AdditionalFundingRequested(bookingId, msg.sender, amount);
    }

    function fundAdditionalAmount(uint256 bookingId)
        external
        payable
        bookingExists(bookingId)
        onlyTenant(bookingId)
    {
        Booking storage booking = bookings[bookingId];

        require(
            booking.status == BookingStatus.AdditionalFundingRequired,
            "Additional funding is not required"
        );
        require(msg.value == booking.pendingAdditionalAmount, "Incorrect additional payment amount");

        uint256 additionalAmount = booking.pendingAdditionalAmount;

        booking.pendingAdditionalAmount = 0;
        booking.fundedAdditionalAmount = additionalAmount;
        booking.status = BookingStatus.Funded;

        emit AdditionalFundingPaid(bookingId, msg.sender, msg.value);
    }

    function startBooking(uint256 bookingId)
        external
        bookingExists(bookingId)
        onlyLandlord(bookingId)
    {
        Booking storage booking = bookings[bookingId];

        require(booking.status == BookingStatus.Funded, "Booking must be funded before starting");

        booking.status = BookingStatus.Started;

        emit BookingStarted(bookingId);
    }

    function completeBooking(uint256 bookingId)
        external
        bookingExists(bookingId)
        onlyLandlord(bookingId)
    {
        Booking storage booking = bookings[bookingId];

        require(booking.status == BookingStatus.Started, "Booking must be started before completion");

        uint256 amountToRelease = booking.rentalAmount + booking.depositAmount + booking.fundedAdditionalAmount;

        booking.status = BookingStatus.Completed;

        booking.landlord.transfer(amountToRelease);

        emit BookingCompleted(bookingId, amountToRelease);
    }

    function cancelBooking(uint256 bookingId)
        external
        bookingExists(bookingId)
        onlyTenant(bookingId)
    {
        Booking storage booking = bookings[bookingId];

        require(
            booking.status == BookingStatus.Created ||
                booking.status == BookingStatus.Funded ||
                booking.status == BookingStatus.AdditionalFundingRequired,
            "Only created, funded or additional funding required bookings can be cancelled"
        );

        uint256 amountToRefund = 0;

        if (
            booking.status == BookingStatus.Funded ||
            booking.status == BookingStatus.AdditionalFundingRequired
        ) {
            amountToRefund = booking.rentalAmount + booking.depositAmount + booking.fundedAdditionalAmount;
        }

        booking.pendingAdditionalAmount = 0;
        booking.status = BookingStatus.Cancelled;

        if (amountToRefund > 0) {
            booking.tenant.transfer(amountToRefund);
        }

        emit BookingCancelled(bookingId, amountToRefund);
    }

    function getBooking(uint256 bookingId)
        external
        view
        bookingExists(bookingId)
        returns (
            address landlord,
            address tenant,
            uint256 rentalAmount,
            uint256 depositAmount,
            uint256 startDate,
            uint256 endDate,
            BookingStatus status
        )
    {
        Booking memory booking = bookings[bookingId];

        return (
            booking.landlord,
            booking.tenant,
            booking.rentalAmount,
            booking.depositAmount,
            booking.startDate,
            booking.endDate,
            booking.status
        );
    }

    function getAdditionalFunding(uint256 bookingId)
        external
        view
        bookingExists(bookingId)
        returns (
            uint256 pendingAdditionalAmount,
            uint256 fundedAdditionalAmount,
            bool additionalFundingRequested
        )
    {
        Booking memory booking = bookings[bookingId];

        return (
            booking.pendingAdditionalAmount,
            booking.fundedAdditionalAmount,
            booking.additionalFundingRequested
        );
    }
}
