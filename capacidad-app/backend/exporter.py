import csv
import io
from datetime import datetime

VERSION = "1.0"

COLUMN_ORDER = [
    "MES", "REFERENCIA", "DESCRIPCION", "DESCRIPCION2", "MEZCLA", "ANCHO", "GALGA",
    "CM", "CT", "TIPO_RUTA", "RUNTIME", "CANTIDAD", "CARGA",
    "CAPACIDAD_TOTAL", "EFICIENCIA", "CAPACIDAD_EFECTIVA", "OCUPACION", "SIN_CAPACIDAD",
    "VERSION", "TIMESTAMP_EXPORT",
]


def export_to_csv(records: list) -> str:
    if not records:
        return ""

    timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    enriched = []

    for r in records:
        row: dict = {}
        for col in COLUMN_ORDER:
            if col == "VERSION":
                row[col] = VERSION
            elif col == "TIMESTAMP_EXPORT":
                row[col] = timestamp
            elif col == "SIN_CAPACIDAD":
                row[col] = "SI" if r.get("SIN_CAPACIDAD") else "NO"
            else:
                val = r.get(col)
                if val is None:
                    row[col] = ""
                elif isinstance(val, float):
                    row[col] = f"{val:.6f}".rstrip("0").rstrip(".")
                else:
                    row[col] = val
        enriched.append(row)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=COLUMN_ORDER, lineterminator="\n")
    writer.writeheader()
    writer.writerows(enriched)
    return output.getvalue()
