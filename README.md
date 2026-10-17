# RentalEscrow

**Prototipo de contratos inteligentes para transacciones de arrendamiento temporal**

Código desarrollado como parte de la tesis de maestría *Plataforma de Transacciones Descentralizadas con Contratos Inteligentes*, Universidad de Palermo (2026), de Juan Ignacio Pereyra.

El trabajo estudia la implementación de un depósito en garantía (*escrow*) mediante un contrato inteligente en Ethereum. La evaluación combina pruebas automatizadas en un entorno local, una medición exploratoria del gas y una demostración funcional en la red pública de pruebas Sepolia. **Se trata de un prototipo académico: no ha sido auditado y no debe utilizarse con fondos reales.**

## Implementación

El contrato `contracts/RentalEscrow.sol` está escrito en Solidity 0.8.28. Hardhat 3 se utiliza para compilarlo, ejecutarlo y probarlo. La interfaz de usuario se desarrolló con React, Vite, ethers.js y MetaMask.

El arrendador crea una reserva con un arrendatario, un importe de alquiler, un depósito y fechas de inicio y finalización. El arrendatario financia la reserva mediante un depósito exacto de ETH. Antes del inicio, el arrendador puede solicitar **una única vez** un refuerzo de reserva; el arrendatario debe depositar exactamente el importe solicitado para habilitar el inicio. Las operaciones de inicio, finalización y cancelación están sujetas a los estados y permisos definidos en el contrato.

Estados principales: `Created`, `Funded`, `AdditionalFundingRequired`, `Started`, `Completed` y `Cancelled`.

## Organización del repositorio

| Ruta | Contenido |
| --- | --- |
| `contracts/RentalEscrow.sol` | Contrato inteligente y reglas de negocio. |
| `test/RentalEscrow.ts` | Suite de 20 pruebas automatizadas. |
| `frontend/` | Interfaz React/Vite para operar mediante MetaMask. |
| `ignition/modules/RentalEscrow.ts` | Módulo de despliegue con Hardhat Ignition. |
| `scripts/medir-gas-rental-escrow.ts` | Medición de consumo de gas en entorno local. |
| `scripts/crear-reserva-sepolia.ts` | Script de apoyo para crear una reserva en Sepolia. |
| `docs/refuerzo-reserva.md` | Documentación de la ampliación funcional. |
| `hardhat.config.ts` | Configuración de compilación y redes. |

## Instalación y pruebas

Se requiere Node.js y npm. Para reproducir la instalación se recomienda utilizar las versiones de dependencias fijadas en los archivos `package-lock.json`.

```bash
git clone https://github.com/NachoPN/rental-escrow-thesis.git
cd rental-escrow-thesis
npm ci
npx hardhat compile
npx hardhat test
```

En la ejecución utilizada para la tesis, la suite devolvió **20 pruebas aprobadas**. La suite cubre escenarios positivos y negativos de creación, financiación, autorización, solicitud y pago del refuerzo, inicio, finalización y cancelación. Este resultado no sustituye una auditoría de seguridad ni acredita el tratamiento exhaustivo de todos los escenarios posibles.

Para reproducir la medición exploratoria de gas en Hardhat local:

```bash
npx hardhat run scripts/medir-gas-rental-escrow.ts
```

Los resultados registrados fueron **324.197 unidades de gas** para el recorrido original, **419.495** para el recorrido ampliado con refuerzo y **277.210** para el escenario de cancelación evaluado. La diferencia entre los recorridos es de **95.298 unidades (+29,4 %)**. Son resultados del entorno de prueba y **no demuestran un ahorro económico frente a intermediarios tradicionales**; el costo monetario depende, además, del precio del gas y del entorno de ejecución.

## Demostración pública en Sepolia

Se realizó un recorrido funcional con dos cuentas de prueba y MetaMask sobre **Ethereum Sepolia (chain ID `11155111`)**.

**Contrato:** [`0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350`](https://sepolia.etherscan.io/address/0x6A13f62Cdb5B8a20D752002Fd9d715d643fE6350)
**Reserva:** `0`

| Operación | Transacción pública |
| --- | --- |
| Crear reserva (`createBooking`) | [`0x6a0928b5…169e1fb`](https://sepolia.etherscan.io/tx/0x6a0928b564cee99c92a65f510d11989d171c16d8e0ff09e331971dfbd169e1fb) |
| Financiar reserva (`fundBooking`) | [`0x391060c8…25fdb`](https://sepolia.etherscan.io/tx/0x391060c886d6e538cce99fee88d699125819bc46ba1a2b735038367667225fdb) |
| Solicitar refuerzo (`requestAdditionalFunding`) | [`0x84057fd9…be485`](https://sepolia.etherscan.io/tx/0x84057fd9ee3c1344147b177d1e0e26310a4eba4e676bc278c20cdf413cbbe485) |
| Pagar refuerzo (`fundAdditionalAmount`) | [`0x6f6f6864…db8bf`](https://sepolia.etherscan.io/tx/0x6f6f68641843a94ccd8b28edc4465a2beb24460121be262749f6ed4176fdb8bf) |
| Iniciar reserva (`startBooking`) | [`0x14bdcf31…55ff2`](https://sepolia.etherscan.io/tx/0x14bdcf3116fb1c5a99ee5a6a8e5edd7677f6c60aea8f244b63bc14eab7755ff2) |
| Finalizar reserva (`completeBooking`) | [`0xcd1cab5d…557f18`](https://sepolia.etherscan.io/tx/0xcd1cab5da59f131792f883dcb2efd910dc09f3a7d50c1c15d4cdf1f301557f18) |

La secuencia de estados observada fue `Created → Funded → AdditionalFundingRequired → Funded → Started → Completed`. Las transacciones pueden consultarse individualmente en el explorador; las pruebas locales y la ejecución pública son evidencias de naturaleza diferente.

### Interfaz de usuario

```bash
cd frontend
npm ci
npm run dev
```

La dirección utilizada por el frontend se define en `frontend/src/contract.js` y, en esta versión, apunta al contrato de **Sepolia** indicado arriba. Para operar, MetaMask debe estar conectado a Sepolia y la cuenta debe disponer de ETH **de prueba**. La interfaz no despliega automáticamente el contrato; tampoco debe conectarse a una red local sin configurar previamente la dirección correspondiente.

### Despliegue opcional de una instancia nueva

La configuración de Hardhat define las variables `SEPOLIA_RPC_URL` y `SEPOLIA_PRIVATE_KEY`. Deben proporcionarse mediante mecanismos seguros, por ejemplo el *keystore* de Hardhat; **nunca deben escribirse en archivos versionados ni incluirse en commits**.

```bash
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat ignition deploy ignition/modules/RentalEscrow.ts --network sepolia
```

Una instancia nueva tendrá otra dirección; será necesario actualizar `frontend/src/contract.js`. No se requiere desplegar una instancia nueva para consultar las evidencias anteriores.

## Alcance y limitaciones

- Las fechas se almacenan y se comprueba su orden al crear una reserva, **pero `startBooking` y `completeBooking` no verifican los límites temporales mediante `block.timestamp`**. La demostración de Sepolia verifica transiciones de estado, no la aplicación automática de los plazos contractuales.
- `completeBooking` la ejecuta unilateralmente el arrendador y libera el alquiler, el depósito y el refuerzo íntegros a su dirección. El prototipo no implementa devolución parcial del depósito, arbitraje ni resolución de controversias.
- Las transferencias salientes emplean `transfer()`, lo que puede impedir la finalización cuando la cuenta receptora es un contrato con determinadas características.
- Los casos probados no equivalen a una demostración de menores costos de intermediación en operaciones reales, ni a una auditoría del contrato.
- El repositorio conserva la evolución del prototipo en su historial de Git; la versión publicada para la tesis debe identificarse mediante la etiqueta correspondiente una vez cerrado el proceso de publicación.

Las decisiones de alcance, los escenarios de prueba, el modelo de amenazas y la matriz de trazabilidad entre escenarios, pruebas y evidencia se desarrollan en la tesis.

## Uso responsable

Proyecto exclusivamente educativo y experimental. No utilizar en producción ni depositar fondos reales. No subir secretos, claves privadas, frases semilla o URL de RPC que contengan credenciales a GitHub.
