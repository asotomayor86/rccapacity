def calculate(demanda: list, producto: list, enrutamiento: list, calendario: list) -> list:
    producto_map = {p["REFERENCIA"]: p for p in producto}

    enrutamiento_map: dict[str, list] = {}
    for r in enrutamiento:
        ref = r["REFERENCIA"]
        enrutamiento_map.setdefault(ref, []).append(r)

    calendario_map: dict[tuple, dict] = {}
    for c in calendario:
        key = (c["CM"], c["MES"])
        calendario_map[key] = c

    results = []

    for d in demanda:
        mes = d["MES"]
        ref = d["REFERENCIA"]
        cantidad = d.get("CANTIDAD") or 0.0

        routes = enrutamiento_map.get(ref, [])
        if not routes:
            continue

        principal = [r for r in routes if str(r.get("TIPO", "")).strip() == "Principal"]
        selected = principal if principal else routes

        prod = producto_map.get(ref, {})

        for route in selected:
            cm = route["CM"]
            runtime = route.get("RUNTIME") or 0.0
            carga = cantidad * runtime

            cal = calendario_map.get((cm, mes), {})
            cap_efectiva = cal.get("CAPACIDAD_EFECTIVA")
            ct = cal.get("CT", "")

            if cap_efectiva and cap_efectiva > 0:
                ocupacion = carga / cap_efectiva
                sin_capacidad = False
            else:
                ocupacion = None
                sin_capacidad = True

            results.append({
                "MES": mes,
                "REFERENCIA": ref,
                "DESCRIPCION": prod.get("DESCRIPCION", ""),
                "DESCRIPCION2": prod.get("DESCRIPCION2", ""),
                "MEZCLA": prod.get("MEZCLA", ""),
                "ANCHO": prod.get("ANCHO"),
                "GALGA": prod.get("GALGA"),
                "CM": cm,
                "CT": ct,
                "TIPO_RUTA": str(route.get("TIPO", "")),
                "RUNTIME": runtime,
                "CANTIDAD": cantidad,
                "CARGA": round(carga, 6),
                "CAPACIDAD_TOTAL": cal.get("CAPACIDAD_TOTAL"),
                "EFICIENCIA": cal.get("EFICIENCIA"),
                "CAPACIDAD_EFECTIVA": cap_efectiva,
                "OCUPACION": round(ocupacion, 6) if ocupacion is not None else None,
                "SIN_CAPACIDAD": sin_capacidad,
            })

    return results
