from datetime import datetime

DATE_FORMATS = [
    ("%d/%m/%Y", True),
    ("%Y-%m-%d", True),
    ("%d-%m-%Y", True),
    ("%Y/%m/%d", True),
    ("%m/%Y", False),
    ("%Y-%m", False),
    ("%m-%Y", False),
    ("%d/%m/%y", True),
]


def parse_fecha(value: str) -> str:
    v = str(value).strip()
    for fmt, _ in DATE_FORMATS:
        try:
            dt = datetime.strptime(v, fmt)
            return dt.strftime("%Y-%m-01")
        except ValueError:
            continue
    raise ValueError(f"No se pudo parsear '{v}' como fecha. Formatos aceptados: DD/MM/YYYY, YYYY-MM-DD, MM/YYYY, etc.")


def parse_string(value: str) -> str:
    return str(value).strip()


def parse_decimal(value: str) -> float:
    v = str(value).strip()
    if not v:
        raise ValueError("Valor vacío")

    if "," in v and "." in v:
        comma_pos = v.rfind(",")
        dot_pos = v.rfind(".")
        if comma_pos > dot_pos:
            # EU: "1.234,56"
            v = v.replace(".", "").replace(",", ".")
        else:
            # US: "1,234.56"
            v = v.replace(",", "")
    elif "," in v:
        parts = v.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            v = v.replace(",", ".")
        else:
            v = v.replace(",", "")

    try:
        return float(v)
    except ValueError:
        raise ValueError(f"No se pudo parsear '{value}' como número decimal")


def validate_value(value, field_type: str) -> tuple:
    raw = str(value).strip() if value is not None else ""
    if raw == "" or raw.lower() in ("nan", "none", "null", "<na>"):
        return None, "Valor vacío o nulo"
    try:
        if field_type == "fecha":
            return parse_fecha(raw), None
        elif field_type == "string":
            return parse_string(raw), None
        elif field_type == "decimal":
            return parse_decimal(raw), None
        else:
            return raw, None
    except ValueError as e:
        return None, str(e)
