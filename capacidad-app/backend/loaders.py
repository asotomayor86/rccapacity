import io
import pandas as pd
from validators import validate_value, parse_decimal, parse_fecha


def parse_csv_bytes(content: bytes) -> tuple[list, list]:
    text = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("No se pudo decodificar el archivo. Use UTF-8 o Latin-1.")

    df = None
    for sep in (";", ",", "\t", "|"):
        try:
            candidate = pd.read_csv(io.StringIO(text), sep=sep, dtype=str, keep_default_na=False)
            if len(candidate.columns) > 1:
                df = candidate
                break
        except Exception:
            continue

    if df is None:
        df = pd.read_csv(io.StringIO(text), dtype=str, keep_default_na=False)

    df.columns = [str(c).strip() for c in df.columns]
    columns = list(df.columns)
    rows = df.fillna("").to_dict(orient="records")
    return columns, rows


def _apply_filter(row: dict, f: dict) -> bool:
    col = f.get("column", "")
    op = f.get("op", "")
    val = str(f.get("value", "")).strip()
    val2 = str(f.get("value2", "")).strip()
    cell = str(row.get(col, "")).strip()

    if not cell and op not in ("igual_a", "no_igual_a"):
        return False
    if op == "igual_a":
        return cell.lower() == val.lower()
    elif op == "no_igual_a":
        return cell.lower() != val.lower()
    elif op == "contiene":
        return val.lower() in cell.lower()
    elif op == "starts_with":
        return cell.lower().startswith(val.lower())
    elif op in ("mayor_que", "mayor_igual", "menor_que", "menor_igual", "entre"):
        try:
            cell_n = parse_decimal(cell)
            val_n = parse_decimal(val)
            if op == "mayor_que":
                return cell_n > val_n
            if op == "mayor_igual":
                return cell_n >= val_n
            if op == "menor_que":
                return cell_n < val_n
            if op == "menor_igual":
                return cell_n <= val_n
            if op == "entre":
                val2_n = parse_decimal(val2)
                return val_n <= cell_n <= val2_n
        except Exception:
            return False
    elif op in ("desde", "hasta", "igual_mes"):
        try:
            cell_d = parse_fecha(cell)
            val_d = parse_fecha(val)
            if op == "desde":
                return cell_d >= val_d
            if op == "hasta":
                return cell_d <= val_d
            if op == "igual_mes":
                return cell_d == val_d
        except Exception:
            return False
    return True


def apply_filters(rows: list, filters: list) -> list:
    if not filters:
        return rows
    return [r for r in rows if all(_apply_filter(r, f) for f in filters)]


def apply_mapping_and_validate(rows: list, mapping: dict, schema: list) -> dict:
    valid_rows = []
    errors = []

    for i, row in enumerate(rows):
        mapped = {}
        row_errors = []

        for field_def in schema:
            fname = field_def["name"]
            ftype = field_def["type"]
            required = field_def["required"]
            raw_col = mapping.get(fname)

            if not raw_col:
                if required:
                    row_errors.append({
                        "field": fname,
                        "value": "",
                        "reason": "Campo requerido sin columna mapeada",
                    })
                else:
                    mapped[fname] = None
                continue

            raw_value = row.get(raw_col, "")
            parsed, error = validate_value(raw_value, ftype)

            if error:
                if required:
                    row_errors.append({"field": fname, "value": raw_value, "reason": error})
                else:
                    mapped[fname] = None
            else:
                mapped[fname] = parsed

        if row_errors:
            errors.append({"row": i + 1, "errors": row_errors})
        else:
            valid_rows.append(mapped)

    return {"valid": valid_rows, "errors": errors}
