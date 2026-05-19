// Verificación 1: Referencias en Demanda que no existen en Producto
export function verificarRefsDemandaNoEnProducto(demandaRecords, productoRecords) {
  const enProducto = new Set(
    productoRecords.map((r) => String(r.REFERENCIA ?? "").trim())
  );
  const refsDemanda = [
    ...new Set(
      demandaRecords.map((r) => String(r.REFERENCIA ?? "").trim()).filter(Boolean)
    ),
  ];
  return refsDemanda
    .filter((ref) => !enProducto.has(ref))
    .map((ref) => ({ REFERENCIA: ref }));
}

// Verificación 2: Referencias en Demanda que existen en Producto pero sin mezcla asignada
export function verificarRefsSinMezcla(demandaRecords, productoRecords) {
  const refsDemanda = new Set(
    demandaRecords.map((r) => String(r.REFERENCIA ?? "").trim()).filter(Boolean)
  );
  const productoMap = new Map(
    productoRecords.map((r) => [String(r.REFERENCIA ?? "").trim(), r])
  );
  const result = [];
  for (const ref of refsDemanda) {
    const prod = productoMap.get(ref);
    if (!prod) continue; // capturado por V1
    if (!prod.MEZCLA || String(prod.MEZCLA).trim() === "") {
      result.push({ REFERENCIA: ref });
    }
  }
  return result;
}

// Verificación 3: Referencias en Demanda cuya mezcla (vía Producto) no aparece en Enrutamiento Mezclas
export function verificarMezclaSinEnrutamiento(demandaRecords, productoRecords, enrutamientoRecords) {
  const refsDemanda = new Set(
    demandaRecords.map((r) => String(r.REFERENCIA ?? "").trim()).filter(Boolean)
  );
  const productoMap = new Map(
    productoRecords.map((r) => [String(r.REFERENCIA ?? "").trim(), r])
  );
  const mezclasEnrutamiento = new Set(
    enrutamientoRecords.map((r) => String(r.MEZCLA ?? "").trim()).filter(Boolean)
  );
  const result = [];
  for (const ref of refsDemanda) {
    const prod = productoMap.get(ref);
    if (!prod) continue; // capturado por V1
    const mezcla = String(prod.MEZCLA ?? "").trim();
    if (!mezcla) continue; // capturado por V2
    if (!mezclasEnrutamiento.has(mezcla)) {
      result.push({ REFERENCIA: ref, MEZCLA: mezcla });
    }
  }
  return result;
}
