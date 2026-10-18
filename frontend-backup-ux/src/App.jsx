import { useState } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  BOOKING_STATUS,
} from "./contract";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [bookingId, setBookingId] = useState("0");
  const [booking, setBooking] = useState(null);
  const [tenantAddress, setTenantAddress] = useState("");
  const [rentalAmount, setRentalAmount] = useState("1");
  const [depositAmount, setDepositAmount] = useState("0.5");
  const [additionalAmount, setAdditionalAmount] = useState("0.25");
  const [message, setMessage] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");

  const normalizedAccount = account.toLowerCase();
  const isLandlord =
    booking && normalizedAccount === booking.landlord.toLowerCase();
  const isTenant = booking && normalizedAccount === booking.tenant.toLowerCase();
  const canFundBooking = booking && booking.statusNumber === 0 && isTenant;
  const canRequestAdditionalFunding =
    booking &&
    booking.statusNumber === 1 &&
    isLandlord &&
    !booking.additionalFundingRequested;
  const canFundAdditionalAmount =
    booking && booking.statusNumber === 5 && isTenant;
  const canStartBooking = booking && booking.statusNumber === 1 && isLandlord;
  const canCompleteBooking = booking && booking.statusNumber === 2 && isLandlord;
  const canCancelBooking =
    booking &&
    isTenant &&
    [0, 1, 5].includes(booking.statusNumber);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setMessage("MetaMask no está instalado.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const rentalContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      setAccount(accounts[0]);
      setContract(rentalContract);
      setMessage("Wallet conectada correctamente.");
      setRefreshMessage("");
    } catch (error) {
      console.error(error);
      setMessage("Error al conectar MetaMask.");
    }
  }

  function getTransactionHash(tx, receipt) {
    return receipt?.hash || receipt?.transactionHash || tx.hash;
  }

  async function loadBooking() {
    if (!contract) {
      throw new Error("Contract is not connected");
    }

    const data = await contract.getBooking(bookingId);
    const additionalFunding = await contract.getAdditionalFunding(bookingId);
    const statusNumber = Number(data.status);

    setBooking({
      landlord: data.landlord,
      tenant: data.tenant,
      rentalAmount: ethers.formatEther(data.rentalAmount),
      depositAmount: ethers.formatEther(data.depositAmount),
      pendingAdditionalAmount: ethers.formatEther(
        additionalFunding.pendingAdditionalAmount
      ),
      fundedAdditionalAmount: ethers.formatEther(
        additionalFunding.fundedAdditionalAmount
      ),
      additionalFundingRequested:
        additionalFunding.additionalFundingRequested,
      startDate: new Date(Number(data.startDate) * 1000).toLocaleString(),
      endDate: new Date(Number(data.endDate) * 1000).toLocaleString(),
      status: BOOKING_STATUS[statusNumber],
      statusNumber,
    });
  }

  async function refreshBookingAfterTransaction() {
    try {
      await loadBooking();
      setRefreshMessage("");
    } catch (error) {
      console.error(error);
      setRefreshMessage(
        "La transacción fue confirmada, pero no se pudo actualizar la información de la reserva. Usa Consultar para refrescarla."
      );
    }
  }

  async function createBooking() {
    try {
      if (!contract) {
        setMessage("Primero conecta tu wallet.");
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const startDate = now + 3600;
      const endDate = startDate + 86400;

      const rentalWei = ethers.parseEther(rentalAmount);
      const depositWei = ethers.parseEther(depositAmount);

      const tx = await contract.createBooking(
        tenantAddress,
        rentalWei,
        depositWei,
        startDate,
        endDate
      );

      setMessage("Creando reserva. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Reserva creada. Hash: ${txHash}`);
      setRefreshMessage("");
    } catch (error) {
      console.error(error);
      setMessage("Error al crear la reserva. Revisa la consola.");
    }
  }

  async function fundBooking() {
    try {
      if (!contract) {
        setMessage("Primero conecta tu wallet.");
        return;
      }

      const totalAmount = ethers.parseEther(
        (Number(rentalAmount) + Number(depositAmount)).toString()
      );

      const tx = await contract.fundBooking(bookingId, {
        value: totalAmount,
      });

      setMessage("Depositando fondos. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Reserva financiada. Hash: ${txHash}`);
      setRefreshMessage("");
      await refreshBookingAfterTransaction();
    } catch (error) {
      console.error(error);
      setMessage("Error al depositar fondos. Revisa rol, monto o estado.");
    }
  }

  async function requestAdditionalFunding() {
    try {
      if (!contract) {
        setMessage("Primero conecta tu wallet.");
        return;
      }

      const additionalWei = ethers.parseEther(additionalAmount);
      const tx = await contract.requestAdditionalFunding(
        bookingId,
        additionalWei
      );

      setMessage("Solicitando refuerzo. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Refuerzo solicitado. Hash: ${txHash}`);
      setRefreshMessage("");
      await refreshBookingAfterTransaction();
    } catch (error) {
      console.error(error);
      setMessage("Error al solicitar el refuerzo. Revisa rol, monto o estado.");
    }
  }

  async function fundAdditionalAmount() {
    try {
      if (!contract) {
        setMessage("Primero conecta tu wallet.");
        return;
      }

      const amountToPay = booking?.pendingAdditionalAmount || additionalAmount;
      const additionalWei = ethers.parseEther(amountToPay);
      const tx = await contract.fundAdditionalAmount(bookingId, {
        value: additionalWei,
      });

      setMessage("Depositando refuerzo. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Refuerzo depositado. Hash: ${txHash}`);
      setRefreshMessage("");
      await refreshBookingAfterTransaction();
    } catch (error) {
      console.error(error);
      setMessage(
        "Error al depositar el refuerzo. El monto debe coincidir exactamente."
      );
    }
  }

  async function startBooking() {
    try {
      const tx = await contract.startBooking(bookingId);

      setMessage("Iniciando reserva. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Reserva iniciada. Hash: ${txHash}`);
      setRefreshMessage("");
      await refreshBookingAfterTransaction();
    } catch (error) {
      console.error(error);
      setMessage("Error al iniciar la reserva. Solo puede hacerlo el arrendador.");
    }
  }

  async function completeBooking() {
    try {
      const tx = await contract.completeBooking(bookingId);

      setMessage("Completando reserva. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Reserva completada. Hash: ${txHash}`);
      setRefreshMessage("");
      await refreshBookingAfterTransaction();
    } catch (error) {
      console.error(error);
      setMessage("Error al completar la reserva. Revisa estado o permisos.");
    }
  }

  async function cancelBooking() {
    try {
      const tx = await contract.cancelBooking(bookingId);

      setMessage("Cancelando reserva. Esperando confirmación...");
      const receipt = await tx.wait();
      const txHash = getTransactionHash(tx, receipt);

      console.log(receipt);
      setMessage(`Reserva cancelada. Hash: ${txHash}`);
      setRefreshMessage("");
      await refreshBookingAfterTransaction();
    } catch (error) {
      console.error(error);
      setMessage(
        "Operación rechazada: solo pueden cancelarse reservas en estado Created, Funded o AdditionalFundingRequired."
      );
    }
  }

  async function getBooking() {
    try {
      if (!contract) {
        setMessage("Primero conecta tu wallet.");
        return;
      }

      await loadBooking();
      setMessage("Reserva consultada correctamente.");
      setRefreshMessage("");
    } catch (error) {
      console.error(error);
      setMessage("No se pudo consultar la reserva.");
    }
  }

  return (
    <main className="container">
      <section className="card">
        <h1>Rental Escrow</h1>
        <p>
          Prototipo de transacción descentralizada con contrato inteligente para
          arrendamiento temporal con depósito en garantía.
        </p>

        <button onClick={connectWallet}>Conectar MetaMask</button>

        {account && (
          <p className="wallet">
            Wallet conectada: <strong>{account}</strong>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Crear reserva</h2>

        <label>Dirección del arrendatario</label>
        <input
          value={tenantAddress}
          onChange={(e) => setTenantAddress(e.target.value)}
          placeholder="0x..."
        />

        <label>Monto alquiler en ETH</label>
        <input
          value={rentalAmount}
          onChange={(e) => setRentalAmount(e.target.value)}
        />

        <label>Depósito en garantía en ETH</label>
        <input
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
        />

        <button onClick={createBooking}>Crear reserva</button>
      </section>

      <section className="card">
        <h2>Gestionar reserva</h2>

        <label>ID de reserva</label>
        <input
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
        />

        <label>Monto de refuerzo en ETH</label>
        <input
          value={additionalAmount}
          onChange={(e) => setAdditionalAmount(e.target.value)}
        />

        <div className="actions">
          <button onClick={getBooking}>Consultar</button>
          {canFundBooking && (
            <button onClick={fundBooking}>Depositar fondos</button>
          )}
          {canRequestAdditionalFunding && (
            <button onClick={requestAdditionalFunding}>
              Solicitar refuerzo
            </button>
          )}
          {canFundAdditionalAmount && (
            <button onClick={fundAdditionalAmount}>Depositar refuerzo</button>
          )}
          {canStartBooking && (
            <button onClick={startBooking}>Iniciar reserva</button>
          )}
          {canCompleteBooking && (
            <button onClick={completeBooking}>Completar</button>
          )}
          {canCancelBooking && <button onClick={cancelBooking}>Cancelar</button>}
        </div>
      </section>

      {booking && (
        <section className="card">
          <h2>Estado de la reserva</h2>
          <p><strong>Arrendador:</strong> {booking.landlord}</p>
          <p><strong>Arrendatario:</strong> {booking.tenant}</p>
          <p><strong>Alquiler:</strong> {booking.rentalAmount} ETH</p>
          <p><strong>Depósito:</strong> {booking.depositAmount} ETH</p>
          <p><strong>Refuerzo pendiente:</strong> {booking.pendingAdditionalAmount} ETH</p>
          <p><strong>Refuerzo depositado:</strong> {booking.fundedAdditionalAmount} ETH</p>
          <p><strong>Inicio:</strong> {booking.startDate}</p>
          <p><strong>Fin:</strong> {booking.endDate}</p>
          <p><strong>Estado:</strong> {booking.status}</p>
        </section>
      )}

      {message && (
        <section className="card message">
          <p>{message}</p>
        </section>
      )}

      {refreshMessage && (
        <section className="card message">
          <p>{refreshMessage}</p>
        </section>
      )}
    </main>
  );
}

export default App;
