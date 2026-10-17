import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS, BOOKING_STATUS } from "./contract";
import "./App.css";

const SEPOLIA_CHAIN_ID = 11155111n;
const CONTRACT_IFACE = new ethers.Interface(CONTRACT_ABI);
const SEPOLIA_HEX = "0xaa36a7";
const EXPLORER = "https://sepolia.etherscan.io";
const SHORT = (address) => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
const txLink = (hash) => `${EXPLORER}/tx/${hash}`;
const addressLink = (address) => `${EXPLORER}/address/${address}`;

function prettyError(error) {
  if (error?.code === 4001 || error?.code === "ACTION_REJECTED") return "Operación cancelada desde MetaMask.";
  if (error?.code === "INSUFFICIENT_FUNDS") return "La cuenta no tiene suficiente SepoliaETH para el monto más el gas.";
  const reason = error?.revert?.args?.[0] || error?.reason || error?.shortMessage || error?.message;
  if (!reason) return "No se pudo completar la operación. Revisa tu conexión y vuelve a intentarlo.";
  if (String(reason).includes("user rejected")) return "Operación cancelada desde MetaMask.";
  return String(reason).slice(0, 240);
}

function Field({ label, children, hint }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

function Detail({ label, children }) {
  return <div className="detail"><dt>{label}</dt><dd>{children}</dd></div>;
}

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [bookingId, setBookingId] = useState("0");
  const [booking, setBooking] = useState(null);
  const [loadedId, setLoadedId] = useState(null);
  const [newTenant, setNewTenant] = useState("");
  const [newRent, setNewRent] = useState("0.001");
  const [newDeposit, setNewDeposit] = useState("0.0005");
  const [additionalAmount, setAdditionalAmount] = useState("0.0002");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastTransaction, setLastTransaction] = useState(null);

  const networkOk = chainId === SEPOLIA_CHAIN_ID;
  const normalizedAccount = account.toLowerCase();
  const isLandlord = Boolean(booking && normalizedAccount && normalizedAccount === booking.landlord.toLowerCase());
  const isTenant = Boolean(booking && normalizedAccount && normalizedAccount === booking.tenant.toLowerCase());
  const canAct = Boolean(account && networkOk && booking && loadedId === bookingId.trim());
  const role = !booking ? "Sin reserva cargada" : isLandlord ? "Marina · arrendadora" : isTenant ? "Diego · arrendatario" : "Cuenta sin permisos para esta reserva";

  useEffect(() => {
    if (!window.ethereum) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const [accounts, hexChain] = await Promise.all([
          window.ethereum.request({ method: "eth_accounts" }),
          window.ethereum.request({ method: "eth_chainId" }),
        ]);
        if (cancelled) return;
        setAccount(accounts?.[0] || "");
        setChainId(BigInt(hexChain));
      } catch (error) {
        if (!cancelled) setNotice(prettyError(error));
      }
    };
    const accountsChanged = (accounts) => {
      setAccount(accounts?.[0] || "");
      setBooking(null);
      setLoadedId(null);
      setNotice("Cambiaste de cuenta. Consulta la reserva nuevamente para ver las acciones disponibles.");
    };
    const chainChanged = (chain) => {
      setChainId(BigInt(chain));
      setBooking(null);
      setLoadedId(null);
      setNotice("Cambió la red. Consulta nuevamente la reserva.");
    };
    sync();
    window.ethereum.on("accountsChanged", accountsChanged);
    window.ethereum.on("chainChanged", chainChanged);
    return () => {
      cancelled = true;
      window.ethereum.removeListener("accountsChanged", accountsChanged);
      window.ethereum.removeListener("chainChanged", chainChanged);
    };
  }, []);

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask no está instalado en este navegador.");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chain = await window.ethereum.request({ method: "eth_chainId" });
      setAccount(accounts[0] || "");
      setChainId(BigInt(chain));
      setNotice("Cuenta conectada. Consulta el ID 0 para continuar la prueba.");
    } catch (error) { setNotice(prettyError(error)); }
  }

  async function switchToSepolia() {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
      setNotice("Sepolia seleccionada. Ya puedes consultar la reserva.");
    } catch (error) { setNotice(`No se pudo activar Sepolia: ${prettyError(error)}`); }
  }

  function getContract(withSigner = false) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return withSigner ? provider.getSigner().then((signer) => new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer))
      : new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }

  async function fetchBooking(id) {
    const readContract = getContract();
    const [data, extra] = await Promise.all([
      readContract.getBooking(id),
      readContract.getAdditionalFunding(id),
    ]);
    const stateNumber = Number(data.status);
    const result = {
      landlord: data.landlord,
      tenant: data.tenant,
      rentalAmount: ethers.formatEther(data.rentalAmount),
      depositAmount: ethers.formatEther(data.depositAmount),
      pendingAdditionalAmount: ethers.formatEther(extra.pendingAdditionalAmount),
      fundedAdditionalAmount: ethers.formatEther(extra.fundedAdditionalAmount),
      additionalFundingRequested: extra.additionalFundingRequested,
      startDate: new Date(Number(data.startDate) * 1000).toLocaleString("es-UY"),
      endDate: new Date(Number(data.endDate) * 1000).toLocaleString("es-UY"),
      status: BOOKING_STATUS[stateNumber] || "Desconocido",
      statusNumber: stateNumber,
    };
    setBooking(result);
    setLoadedId(String(id));
    return result;
  }

  async function consultBooking() {
    if (!account) { setNotice("Primero conecta MetaMask."); return; }
    if (!networkOk) { setNotice("Selecciona Sepolia antes de consultar esta reserva."); return; }
    if (!/^\d+$/.test(bookingId.trim())) { setNotice("Introduce un ID de reserva válido (por ejemplo, 0)."); return; }
    setBusy(true);
    setBooking(null);
    setLoadedId(null);
    setNotice("");
    try {
      const result = await fetchBooking(bookingId.trim());
      setNotice(`Reserva #${bookingId.trim()} encontrada. Estado: ${result.status}.`);
    } catch (error) { setNotice(`No se pudo consultar la reserva: ${prettyError(error)}`); }
    finally { setBusy(false); }
  }

  // Usa la API EIP-1193 de MetaMask tanto para simular como para ENVIAR.
  // Evita la ruta de ethers.Contract con BrowserProvider que en este navegador
  // produce «could not coalesce error» antes de abrir la firma.
  async function sendAction(label, method, args = [], valueWei = 0n, id = bookingId.trim()) {
    if (!networkOk || !account) { setNotice("Conecta MetaMask en Sepolia antes de operar."); return; }
    setBusy(true);
    setNotice(`Preparando «${label}»…`);
    let submittedHash = null;
    try {
      const [activeChain, activeAccounts] = await Promise.all([
        window.ethereum.request({ method: "eth_chainId" }),
        window.ethereum.request({ method: "eth_accounts" }),
      ]);
      if (BigInt(activeChain) !== SEPOLIA_CHAIN_ID) throw new Error("MetaMask ya no está en Sepolia. Cambia de red y consulta de nuevo.");
      const actual = activeAccounts?.[0];
      if (!actual || actual.toLowerCase() !== account.toLowerCase()) throw new Error("Cambió la cuenta activa de MetaMask. Conecta y consulta nuevamente.");

      const request = {
        from: actual,
        to: CONTRACT_ADDRESS,
        data: CONTRACT_IFACE.encodeFunctionData(method, args),
        ...(valueWei > 0n ? { value: ethers.toQuantity(valueWei) } : {}),
      };
      // Ambos campos numéricos enviados al RPC son cantidades hex canónicas,
      // sin ceros a la izquierda; eth_estimateGas ya se verificó con Diego.
      const estimatedHex = await window.ethereum.request({ method: "eth_estimateGas", params: [request] });
      const gasLimit = (BigInt(estimatedHex) * 120n) / 100n + 10000n;
      const txRequest = { ...request, gas: ethers.toQuantity(gasLimit) };

      setNotice(`MetaMask debería abrir la confirmación de «${label}». Revisa el importe y la cuenta.`);
      submittedHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [txRequest] });
      setLastTransaction({ label, hash: submittedHash, pending: true, block: null, gas: null });
      setNotice(`Transacción enviada. Hash: ${submittedHash}. Esperando confirmación en Sepolia; no vuelvas a pulsar el botón.`);

      // Polling de la transacción ya enviada, sin crear ni firmar otra.
      let receipt = null;
      for (let attempts = 0; attempts < 48; attempts += 1) {
        receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [submittedHash] });
        if (receipt) break;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      if (!receipt) {
        setNotice(`La transacción se envió, pero aún no vemos la confirmación. Consulta el hash ${submittedHash} en Etherscan. NO repitas la operación.`);
        return;
      }
      if (BigInt(receipt.status) !== 1n) {
        setNotice(`La transacción ${submittedHash} se incluyó pero fue revertida. Consulta el comprobante en Etherscan.`);
        return;
      }
      setLastTransaction({
        label, hash: submittedHash, pending: false,
        block: Number(BigInt(receipt.blockNumber)),
        gas: BigInt(receipt.gasUsed).toString(),
      });
      if (label === "Crear reserva") {
        const created = receipt.logs.map((log) => {
          try { return CONTRACT_IFACE.parseLog(log); } catch { return null; }
        }).find((event) => event?.name === "BookingCreated");
        if (created) {
          const nextId = created.args.bookingId.toString();
          setBookingId(nextId);
          await fetchBooking(nextId);
        }
        setShowCreate(false);
      } else {
        await fetchBooking(id);
      }
      setNotice(`«${label}» confirmada en Sepolia. Puedes abrir su comprobante en Etherscan.`);
    } catch (error) {
      console.error("RentalEscrow operación EIP-1193:", error);
      if (submittedHash) {
        setNotice(`La transacción YA fue enviada (${submittedHash}), pero hubo un error al consultar su resultado: ${prettyError(error)}. No repitas la operación; revisa Etherscan.`);
      } else {
        setNotice(`No se envió «${label}»: ${prettyError(error)}`);
      }
    } finally { setBusy(false); }
  }

  // Comprueba la simulación usando el proveedor de MetaMask, sin firmar ni enviar fondos.
  async function diagnoseFunding() {
    if (!window.ethereum || !booking || !isTenant || !networkOk) {
      setNotice("Conecta Diego en Sepolia y consulta la reserva antes de diagnosticar.");
      return;
    }
    setBusy(true);
    setNotice("Consultando eth_estimateGas desde MetaMask (sin enviar transacción)…");
    try {
      const amount = ethers.parseEther(booking.rentalAmount) + ethers.parseEther(booking.depositAmount);
      const iface = new ethers.Interface(CONTRACT_ABI);
      const request = {
        from: account,
        to: CONTRACT_ADDRESS,
        data: iface.encodeFunctionData("fundBooking", [BigInt(bookingId.trim())]),
        value: ethers.toQuantity(amount),
      };
      const [chain, activeAccounts] = await Promise.all([
        window.ethereum.request({ method: "eth_chainId" }),
        window.ethereum.request({ method: "eth_accounts" }),
      ]);
      const estimateHex = await window.ethereum.request({ method: "eth_estimateGas", params: [request] });
      const estimate = BigInt(estimateHex).toString();
      const matched = activeAccounts?.[0]?.toLowerCase() === account.toLowerCase();
      setNotice(`Diagnóstico exitoso: MetaMask estima ${estimate} gas; red ${parseInt(chain, 16)}; cuenta ${matched ? "correcta" : "distinta a la mostrada"}. No se enviaron fondos.`);
    } catch (error) {
      // No mostrar payloads arbitrarios en pantalla (pueden incluir información del proveedor).
      const inner = error?.data?.originalError || error?.data || error?.error || error;
      const code = inner?.code ?? error?.code ?? "sin código";
      const message = inner?.message || error?.shortMessage || error?.message || "Error desconocido";
      console.error("RentalEscrow MetaMask estimateGas error", error);
      setNotice(`Diagnóstico MetaMask falló: código ${String(code)}; ${String(message).slice(0, 350)}. No se enviaron fondos.`);
    } finally {
      setBusy(false);
    }
  }

  function fundBooking() {
    // El monto procede SIEMPRE de la reserva leída on-chain, nunca del formulario de creación.
    const expected = ethers.parseEther(booking.rentalAmount) + ethers.parseEther(booking.depositAmount);
    return sendAction("Depositar alquiler y garantía", "fundBooking", [BigInt(bookingId.trim())], expected);
  }

  function createBooking() {
    if (!ethers.isAddress(newTenant)) { setNotice("Introduce una dirección válida para Diego."); return; }
    let rentWei; let depositWei;
    try {
      rentWei = ethers.parseEther(newRent); depositWei = ethers.parseEther(newDeposit);
      if (rentWei <= 0n || depositWei <= 0n) throw new Error("Los importes deben ser mayores que cero.");
    } catch { setNotice("Revisa los importes de alquiler y garantía."); return; }
    const now = Math.floor(Date.now() / 1000);
    return sendAction("Crear reserva", "createBooking", [newTenant, rentWei, depositWei, now + 86400, now + 3 * 86400]);
  }

  const statusSteps = ["Created", "Funded", "AdditionalFundingRequired", "Started", "Completed"];
  const activeStep = booking ? statusSteps.indexOf(booking.status) : -1;
  const bookedTotal = booking ? ethers.formatEther(ethers.parseEther(booking.rentalAmount) + ethers.parseEther(booking.depositAmount)) : "0";

  return (
    <main className="app">
      <header className="hero">
        <div><p className="eyebrow">TESIS · PROTOTIPO EXPERIMENTAL</p><h1>RentalEscrow</h1><p>Una reserva, dos participantes y reglas verificables en Ethereum Sepolia.</p></div>
        <a className="explorer-button" href={addressLink(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Ver contrato en Etherscan ↗</a>
      </header>

      <section className="panel wallet-panel">
        <div className="panel-title"><div><h2>Conexión y red</h2><p>MetaMask firma cada acción; no se usan fondos reales.</p></div><span className={`pill ${networkOk ? "ok" : "attention"}`}>{networkOk ? "Sepolia conectada" : "Red sin verificar"}</span></div>
        <div className="wallet-line"><div><span className="micro">Cuenta activa</span><strong>{account ? SHORT(account) : "Sin conectar"}</strong>{account && <span className="hint">{role}</span>}</div><div className="wallet-buttons"><button className="button secondary" onClick={connectWallet} disabled={busy}>{account ? "Actualizar cuenta" : "Conectar MetaMask"}</button>{account && !networkOk && <button className="button" onClick={switchToSepolia} disabled={busy}>Cambiar a Sepolia</button>}</div></div>
        {!window.ethereum && <p className="warn">Necesitas MetaMask para interactuar con el contrato.</p>}
        {account && !networkOk && <p className="warn">Esta aplicación está configurada únicamente para Sepolia. No operes en Ethereum Mainnet.</p>}
      </section>

      <section className="panel">
        <div className="panel-title"><div><span className="step-number">01</span><h2>Buscar una reserva</h2><p>La reserva de la demostración pública ya está creada. Su ID es 0.</p></div></div>
        <div className="lookup"><Field label="ID de reserva"><input type="number" min="0" step="1" value={bookingId} onChange={(e) => { setBookingId(e.target.value); setBooking(null); setLoadedId(null); }} placeholder="0" /></Field><button className="button" disabled={busy || !account || !networkOk} onClick={consultBooking}>{busy ? "Procesando…" : "Consultar reserva"}</button></div>
      </section>

      {booking && <>
        <section className="panel">
          <div className="panel-title"><div><span className="step-number">02</span><h2>Reserva #{loadedId}</h2><p>Información tomada directamente del contrato en Sepolia.</p></div><span className="pill status">{booking.status}</span></div>
          <div className="progress">{statusSteps.map((item, index) => <div key={item} className={`progress-step ${index <= activeStep ? "active" : ""}`}><span>{index + 1}</span><small>{item}</small></div>)}</div>
          {booking.status === "Cancelled" && <p className="warn">Esta reserva fue cancelada. No admite nuevas operaciones.</p>}
          <dl className="details">
            <Detail label="Arrendador · Marina"><a href={addressLink(booking.landlord)} target="_blank" rel="noreferrer">{SHORT(booking.landlord)} ↗</a></Detail>
            <Detail label="Arrendatario · Diego"><a href={addressLink(booking.tenant)} target="_blank" rel="noreferrer">{SHORT(booking.tenant)} ↗</a></Detail>
            <Detail label="Alquiler">{booking.rentalAmount} ETH</Detail>
            <Detail label="Garantía">{booking.depositAmount} ETH</Detail>
            <Detail label="Depósito inicial requerido"><strong>{bookedTotal} ETH</strong></Detail>
            <Detail label="Refuerzo pendiente">{booking.pendingAdditionalAmount} ETH</Detail>
            <Detail label="Refuerzo financiado">{booking.fundedAdditionalAmount} ETH</Detail>
            <Detail label="Inicio pactado">{booking.startDate}</Detail>
            <Detail label="Finalización pactada">{booking.endDate}</Detail>
          </dl>
        </section>

        <section className="panel action-panel">
          <div className="panel-title"><div><span className="step-number">03</span><h2>Siguiente acción</h2><p>Las acciones se muestran según la cuenta conectada y el estado de la reserva.</p></div></div>
          {!isLandlord && !isTenant && <p className="warn">La cuenta conectada no es Marina ni Diego. Cambia de cuenta en MetaMask para operar.</p>}
          {canAct && booking.statusNumber === 0 && isTenant && <div className="next-action"><h3>Diego · Depositar alquiler y garantía</h3><p>El importe se calcula automáticamente desde la reserva, sin copiarlo de otros campos.</p><div className="amount-highlight">{bookedTotal} <small>SepoliaETH + gas</small></div><button className="button secondary" disabled={busy} onClick={diagnoseFunding}>Diagnosticar depósito (sin enviar)</button><button className="button" disabled={busy} onClick={fundBooking}>Depositar fondos</button></div>}
          {canAct && booking.statusNumber === 0 && isLandlord && <p className="info">Reserva creada. Cambia a la cuenta de <strong>Diego</strong> en MetaMask para depositar {bookedTotal} ETH.</p>}
          {canAct && booking.statusNumber === 1 && isLandlord && !booking.additionalFundingRequested && <div className="next-action"><h3>Marina · Solicitar refuerzo</h3><p>La reserva está financiada. Puedes solicitar una única ampliación de fondos antes de iniciarla.</p><Field label="Refuerzo solicitado (SepoliaETH)"><input type="text" inputMode="decimal" value={additionalAmount} onChange={(e) => setAdditionalAmount(e.target.value)} /></Field><button className="button" disabled={busy} onClick={() => { try { const amount = ethers.parseEther(additionalAmount); if (amount <= 0n) throw Error(); sendAction("Solicitar refuerzo", "requestAdditionalFunding", [BigInt(bookingId.trim()), amount]); } catch { setNotice("El refuerzo debe ser un número de ETH mayor que cero."); } }}>Solicitar refuerzo</button><button className="button secondary" disabled={busy} onClick={() => sendAction("Iniciar reserva", "startBooking", [BigInt(bookingId.trim())])}>Iniciar sin refuerzo</button></div>}
          {canAct && booking.statusNumber === 1 && isLandlord && booking.additionalFundingRequested && <div className="next-action"><h3>Marina · Iniciar reserva</h3><p>El refuerzo ya fue pagado. Puedes avanzar hacia el inicio.</p><button className="button" disabled={busy} onClick={() => sendAction("Iniciar reserva", "startBooking", [BigInt(bookingId.trim())])}>Iniciar reserva</button></div>}
          {canAct && booking.statusNumber === 1 && isTenant && <p className="info">Fondos depositados. Ahora corresponde a <strong>Marina</strong> solicitar el refuerzo o iniciar la reserva. Diego también puede cancelarla antes del inicio.</p>}
          {canAct && booking.statusNumber === 5 && isLandlord && <p className="info">Refuerzo solicitado por {booking.pendingAdditionalAmount} ETH. Cambia a la cuenta de <strong>Diego</strong> para financiarlo.</p>}
          {canAct && booking.statusNumber === 5 && isTenant && <div className="next-action"><h3>Diego · Depositar refuerzo</h3><p>El contrato exige exactamente el monto pendiente.</p><div className="amount-highlight">{booking.pendingAdditionalAmount} <small>SepoliaETH + gas</small></div><button className="button" disabled={busy} onClick={() => sendAction("Depositar refuerzo", "fundAdditionalAmount", [BigInt(bookingId.trim())], ethers.parseEther(booking.pendingAdditionalAmount))}>Depositar refuerzo</button></div>}
          {canAct && booking.statusNumber === 2 && isLandlord && <div className="next-action"><h3>Marina · Completar reserva</h3><p>Esta operación transfiere al arrendador alquiler, garantía y refuerzo financiado. <strong>No hay confirmación bilateral ni devolución parcial</strong> en este prototipo.</p><button className="button danger" disabled={busy} onClick={() => { if (window.confirm("¿Completar y liberar todos los fondos depositados a Marina? Esta acción es irreversible.")) sendAction("Completar reserva", "completeBooking", [BigInt(bookingId.trim())]); }}>Completar y liberar fondos</button></div>}
          {canAct && booking.statusNumber === 2 && isTenant && <p className="info">La reserva está iniciada. Solo Marina puede completarla. Ya no es posible cancelarla.</p>}
          {canAct && [3,4].includes(booking.statusNumber) && <p className="info">La reserva está finalizada. Puedes consultar sus datos, pero no hay más transacciones habilitadas.</p>}
          {canAct && isTenant && [0,1,5].includes(booking.statusNumber) && <div className="cancel-row"><p>Antes del inicio, Diego puede cancelar la operación. Los fondos ya depositados se devuelven a su cuenta.</p><button className="button secondary-danger" disabled={busy} onClick={() => { if (window.confirm("¿Cancelar la reserva? Esta acción no se puede deshacer.")) sendAction("Cancelar reserva", "cancelBooking", [BigInt(bookingId.trim())]); }}>Cancelar reserva</button></div>}
          <p className="technical-note">Limitación del contrato: las fechas se registran, pero las funciones de inicio y finalización no comprueban automáticamente el calendario. Este frontend no sustituye esas validaciones.</p>
        </section>
      </>}

      {notice && <section className="notice" role="status" aria-live="polite">{notice}</section>}
      {lastTransaction && <section className="panel tx-panel"><div className="panel-title"><div><h2>Última transacción</h2><p>{lastTransaction.label}</p></div><span className={`pill ${lastTransaction.pending ? "attention" : "ok"}`}>{lastTransaction.pending ? "Pendiente" : "Confirmada"}</span></div><dl className="details"><Detail label="Bloque">{lastTransaction.block ?? "Pendiente"}</Detail><Detail label="Gas utilizado">{lastTransaction.gas ?? "Pendiente"}</Detail><Detail label="Hash"><code>{SHORT(lastTransaction.hash)}</code></Detail></dl><a className="button external" href={txLink(lastTransaction.hash)} target="_blank" rel="noreferrer">Ver comprobante en Etherscan ↗</a></section>}

      <section className="panel secondary-panel"><div className="panel-title"><div><h2>¿Necesitas crear otra reserva?</h2><p>Para esta demostración ya existe la reserva #0. Solo utiliza esta sección para una reserva nueva.</p></div><button className="button secondary" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Ocultar" : "Crear nueva reserva"}</button></div>{showCreate && <div className="create-form"><Field label="Dirección del arrendatario"><input value={newTenant} onChange={(e) => setNewTenant(e.target.value)} placeholder="0x…" /></Field><div className="form-two"><Field label="Alquiler en ETH"><input value={newRent} onChange={(e) => setNewRent(e.target.value)} /></Field><Field label="Garantía en ETH"><input value={newDeposit} onChange={(e) => setNewDeposit(e.target.value)} /></Field></div><p className="hint">Fechas del nuevo ejemplo: inicio en 24 horas y fin en 72 horas. No uses esta opción para depositar en la reserva #0.</p><button className="button" disabled={busy || !account || !networkOk} onClick={createBooking}>Confirmar nueva reserva</button></div>}</section>
      <footer>Contrato de demostración en Sepolia · Sin fondos reales · No apto para operaciones productivas.</footer>
    </main>
  );
}

export default App;
