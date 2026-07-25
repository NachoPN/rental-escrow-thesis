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
  const [message, setMessage] = useState("");

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
    } catch (error) {
      console.error(error);
      setMessage("Error al conectar MetaMask.");
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

      console.log(receipt);
      setMessage(`Reserva creada. Hash: ${receipt.hash}`);
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

      console.log(receipt);
      setMessage(`Reserva financiada. Hash: ${receipt.hash}`);
      await getBooking();
    } catch (error) {
      console.error(error);
      setMessage("Error al depositar fondos. Revisa rol, monto o estado.");
    }
  }

  async function startBooking() {
    try {
      const tx = await contract.startBooking(bookingId);

      setMessage("Iniciando reserva. Esperando confirmación...");
      const receipt = await tx.wait();

      console.log(receipt);
      setMessage(`Reserva iniciada. Hash: ${receipt.hash}`);
      await getBooking();
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

      console.log(receipt);
      setMessage(`Reserva completada. Hash: ${receipt.hash}`);
      await getBooking();
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

      console.log(receipt);
      setMessage(`Reserva cancelada. Hash: ${receipt.hash}`);
      await getBooking();
    } catch (error) {
      console.error(error);
      setMessage(
        "Operación rechazada: solo pueden cancelarse reservas en estado Created o Funded."
      );
    }
  }

  async function getBooking() {
    try {
      if (!contract) {
        setMessage("Primero conecta tu wallet.");
        return;
      }

      const data = await contract.getBooking(bookingId);

      setBooking({
        landlord: data.landlord,
        tenant: data.tenant,
        rentalAmount: ethers.formatEther(data.rentalAmount),
        depositAmount: ethers.formatEther(data.depositAmount),
        startDate: new Date(Number(data.startDate) * 1000).toLocaleString(),
        endDate: new Date(Number(data.endDate) * 1000).toLocaleString(),
        status: BOOKING_STATUS[Number(data.status)],
      });

      setMessage("Reserva consultada correctamente.");
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

        <div className="actions">
          <button onClick={getBooking}>Consultar</button>
          <button onClick={fundBooking}>Depositar fondos</button>
          <button onClick={startBooking}>Iniciar</button>
          <button onClick={completeBooking}>Completar</button>
          <button onClick={cancelBooking}>Cancelar</button>
        </div>
      </section>

      {booking && (
        <section className="card">
          <h2>Estado de la reserva</h2>
          <p><strong>Arrendador:</strong> {booking.landlord}</p>
          <p><strong>Arrendatario:</strong> {booking.tenant}</p>
          <p><strong>Alquiler:</strong> {booking.rentalAmount} ETH</p>
          <p><strong>Depósito:</strong> {booking.depositAmount} ETH</p>
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
    </main>
  );
}

export default App;