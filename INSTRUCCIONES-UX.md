# RentalEscrow — actualización del frontend para la tesis

Esta actualización modifica exclusivamente el frontend (React/Vite). No cambia `RentalEscrow.sol`, el despliegue de Sepolia ni los IDs de reserva existentes.

## Instalación en Mac

1. **Cierra el servidor Vite** con `Ctrl+C` en la terminal donde está abierto.
2. En tu Mac, coloca el archivo `rental-escrow-frontend-ux-v2.zip` en `Descargas`.
3. Desde la terminal del proyecto, realiza una copia de seguridad y extrae el ZIP:

```bash
cd ~/tesis-smart-contracts
cp -R frontend frontend-backup-ux
unzip -o ~/Downloads/rental-escrow-frontend-ux-v2.zip -d ~/tesis-smart-contracts
cd frontend
npm install
npm run build
npm run dev
```

4. Abre la dirección que muestre Vite, normalmente `http://localhost:5173`.
5. En MetaMask, mantén **Sepolia** activada. Conecta **Diego**, consulta ID de reserva `0` y verifica que el estado sea **Created**. La acción de depósito debe mostrar automáticamente **0.0015 SepoliaETH** como importe inicial (0.001 de alquiler + 0.0005 de garantía).
6. Confirma únicamente si MetaMask muestra el monto esperado y la red **Sepolia**.

## Cambios incluidos

- Consulta de la reserva existente, separada de la creación de una reserva nueva.
- Detección de red Sepolia y cuenta conectada.
- Acciones por rol y por estado.
- Importes de fondeo leídos directamente del contrato.
- Confirmación antes de cancelación o liberación final.
- Enlaces a Sepolia Etherscan con hash, bloque y gas de cada transacción completada.
- Corrección del contrato de frontend por la dirección pública `0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350`.
- Adición de `ethers` al `package.json` y su entrada al archivo de bloqueo.

## Importante

- La reserva pública `0` **ya existe**. No pulses «Crear nueva reserva» para financiarla.
- Si MetaMask está conectada a la red equivocada, la interfaz bloquea las transacciones y ofrece cambiar a Sepolia.
- El contrato existente no valida temporalmente las fechas en `startBooking` y `completeBooking`; el frontend lo informa, pero **no corrige** esa limitación en blockchain.
- Al completar la reserva, el contrato transfiere alquiler, garantía y refuerzo al arrendador sin aprobación bilateral. La interfaz muestra una advertencia.
- Para ejecutar el flujo real se necesitan dos cuentas y hay que ir alternando entre **Diego** y **Marina** en MetaMask.
- Esta versión se ha validado a nivel de sintaxis JSX, pero no se pudo completar `npm run build` en este entorno porque no fue posible descargar dependencias. Ejecuta `npm install` y `npm run build` en tu Mac antes de usarla.

## Git

Cuando hayas comprobado que la interfaz funciona:

```bash
cd ~/tesis-smart-contracts
git status
git add frontend/src/App.jsx frontend/src/App.css frontend/src/index.css frontend/src/contract.js frontend/package.json frontend/package-lock.json
git commit -m "Mejorar experiencia de usuario de RentalEscrow para Sepolia"
git push origin refuerzo-reserva
```

No subas tu carpeta `frontend-backup-ux` al repositorio; está fuera de Git por el momento y puedes eliminarla cuando hayas verificado la actualización.
