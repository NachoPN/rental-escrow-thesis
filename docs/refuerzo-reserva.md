# Refuerzo de reserva

Este prototipo agrega un refuerzo de reserva como fondos adicionales bloqueados en el contrato. El refuerzo puede ser solicitado por el arrendador cuando la reserva ya esta financiada y debe ser pagado exactamente por el arrendatario antes de iniciar el arrendamiento.

## Flujo

```text
Created
  -> fundBooking
Funded
  -> requestAdditionalFunding
AdditionalFundingRequired
  -> fundAdditionalAmount
Funded
  -> startBooking
Started
  -> completeBooking
Completed
```

La cancelacion tambien esta permitida en `AdditionalFundingRequired`. En ese caso se devuelven solamente los fondos efectivamente depositados: `rentalAmount`, `depositAmount` y cualquier refuerzo ya pagado. El monto pendiente solicitado no se incluye porque todavia no forma parte del balance del contrato.

## Limitaciones

- Se conserva la logica economica original del prototipo.
- No se implementa devolucion parcial de la garantia.
- No se implementan evaluacion de danos ni resolucion de disputas.
- El prototipo admite un unico refuerzo por reserva.
