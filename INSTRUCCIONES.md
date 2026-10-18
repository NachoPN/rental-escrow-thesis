# Corrección del envío desde MetaMask — RentalEscrow

**Causa probable:** el diagnóstico por `window.ethereum.request` se ejecutó correctamente, pero las transacciones mediante `ethers.Contract` y `BrowserProvider` fallaban con `could not coalesce error` antes de generar un hash.

Esta revisión cambia las operaciones de escritura a `eth_sendTransaction` directamente en el proveedor EIP-1193 de MetaMask. La estimación previa y el envío utilizan el mismo payload; `value` y `gas` son cantidades hexadecimales canónicas, sin ceros iniciales.

## Instalación

1. Mantener el frontend anterior y el contrato. Este ZIP sustituye **solamente** `frontend/src/App.jsx`.
2. Desde la carpeta del proyecto ejecutar `unzip -o ~/Downloads/rental-escrow-envio-directo.zip`.
3. Reiniciar `npm run dev` si no se actualiza automáticamente.
4. En MetaMask, usar **Diego** en **Sepolia**; consultar la reserva **0**.
5. Pulsar «Depositar fondos» **una sola vez**. Confirmar solamente si la ventana de MetaMask muestra la cuenta y red esperadas y el valor es **0,0015 SepoliaETH** más gas.
6. Si MetaMask no abre, o aparece un error, copiar el mensaje exacto. **No volver a pulsar el botón si aparece un hash**: comprobar su estado en Sepolia Etherscan.

**Seguridad:** Nunca poner una clave privada en frontend, ni en Git. Se usa la extensión para firmar, sin exportar la clave. La actualización no modifica Solidity, el contrato desplegado, la ABI, ni la reserva 0.

**Límite:** El cambio está revisado estáticamente pero debe confirmarse en el navegador del usuario; la estimación previa existosa no garantiza el envío.
