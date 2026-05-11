import os
import sys
import uuid
from datetime import datetime
from typing import Optional

from fastapi import Body, FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Allow imports from the backend directory regardless of working directory
sys.path.insert(0, os.path.dirname(__file__))

import state
from loaders import parse_csv_bytes, apply_filters, apply_mapping_and_validate
from engine import calculate
from exporter import export_to_csv

app = FastAPI(title="Calculador de Capacidades", version="1.0.0")


# ── Request / Response models ────────────────────────────────────────────────

class FilterItem(BaseModel):
    column: str
    op: str
    value: str = ""
    value2: str = ""


class ValidateRequest(BaseModel):
    upload_id: str
    mapping: dict[str, str]
    filters: list[FilterItem] = []


class ImportRequest(BaseModel):
    upload_id: str
    mapping: dict[str, str]
    filters: list[FilterItem] = []


# ── API routes ───────────────────────────────────────────────────────────────

@app.post("/api/masters/{master_name}/upload")
async def upload_csv(master_name: str, file: UploadFile = File(...)):
    master_name = master_name.upper()
    if master_name not in state.MASTER_SCHEMAS:
        raise HTTPException(400, f"Maestro desconocido: {master_name}")

    content = await file.read()
    try:
        columns, rows = parse_csv_bytes(content)
    except Exception as e:
        raise HTTPException(400, f"Error al parsear CSV: {e}")

    upload_id = str(uuid.uuid4())
    state.uploads[upload_id] = {"columns": columns, "rows": rows}

    preview = rows[:5]
    return {
        "upload_id": upload_id,
        "columns": columns,
        "row_count": len(rows),
        "preview": preview,
    }


@app.post("/api/masters/{master_name}/validate")
async def validate_master(master_name: str, body: ValidateRequest):
    master_name = master_name.upper()
    if master_name not in state.MASTER_SCHEMAS:
        raise HTTPException(400, f"Maestro desconocido: {master_name}")

    upload = state.uploads.get(body.upload_id)
    if not upload:
        raise HTTPException(404, "upload_id no encontrado. Suba el archivo de nuevo.")

    schema = state.MASTER_SCHEMAS[master_name]
    filters = [f.model_dump() for f in body.filters]

    filtered_rows = apply_filters(upload["rows"], filters)
    result = apply_mapping_and_validate(filtered_rows, body.mapping, schema)

    total = len(filtered_rows)
    valid_count = len(result["valid"])
    error_count = len(result["errors"])

    return {
        "total": total,
        "valid_count": valid_count,
        "error_count": error_count,
        "success_pct": round(valid_count / total * 100, 1) if total else 0,
        "errors": result["errors"][:100],  # cap at 100 for display
        "preview": result["valid"][:5],
    }


@app.post("/api/masters/{master_name}/import")
async def import_master(master_name: str, body: ImportRequest):
    master_name = master_name.upper()
    if master_name not in state.MASTER_SCHEMAS:
        raise HTTPException(400, f"Maestro desconocido: {master_name}")

    upload = state.uploads.get(body.upload_id)
    if not upload:
        raise HTTPException(404, "upload_id no encontrado. Suba el archivo de nuevo.")

    schema = state.MASTER_SCHEMAS[master_name]
    filters = [f.model_dump() for f in body.filters]

    filtered_rows = apply_filters(upload["rows"], filters)
    result = apply_mapping_and_validate(filtered_rows, body.mapping, schema)

    state.masters[master_name]["records"] = result["valid"]
    state.masters[master_name]["count"] = len(result["valid"])
    state.masters[master_name]["loaded_at"] = datetime.now().isoformat()

    # Invalidate cached results when masters change
    state.results["records"] = []
    state.results["calculated_at"] = None

    return {
        "imported_count": len(result["valid"]),
        "error_count": len(result["errors"]),
    }


@app.get("/api/masters/status")
async def get_masters_status():
    return {
        name: {
            "loaded": data["count"] > 0,
            "count": data["count"],
            "loaded_at": data["loaded_at"],
        }
        for name, data in state.masters.items()
    }


@app.post("/api/calculate")
async def run_calculation():
    missing = [
        name for name, data in state.masters.items()
        if data["count"] == 0
    ]
    if missing:
        raise HTTPException(
            400,
            f"Maestros sin datos: {', '.join(missing)}. Carga todos los maestros antes de calcular.",
        )

    try:
        records = calculate(
            state.masters["DEMANDA"]["records"],
            state.masters["PRODUCTO"]["records"],
            state.masters["ENRUTAMIENTO"]["records"],
            state.masters["CALENDARIO"]["records"],
        )
    except Exception as e:
        raise HTTPException(500, f"Error en el motor de cálculo: {e}")

    state.results["records"] = records
    state.results["calculated_at"] = datetime.now().isoformat()

    return {
        "record_count": len(records),
        "calculated_at": state.results["calculated_at"],
    }


@app.get("/api/results")
async def get_results():
    records = state.results.get("records", [])
    if not records:
        return {"columns": [], "rows": [], "calculated_at": None}

    columns = list(records[0].keys()) if records else []
    return {
        "columns": columns,
        "rows": records,
        "calculated_at": state.results.get("calculated_at"),
        "total": len(records),
    }


@app.get("/api/export")
async def export_results():
    records = state.results.get("records", [])
    if not records:
        raise HTTPException(400, "No hay resultados calculados. Ejecute el motor primero.")

    csv_content = export_to_csv(records)
    filename = f"capacidad_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Filter presets ───────────────────────────────────────────────────────────

@app.get("/api/filters")
async def list_filters():
    return state.saved_filters


@app.post("/api/filters/{name}")
async def save_filter(name: str, filters: list = Body(...)):
    if not name.strip():
        raise HTTPException(400, "El nombre del preset no puede estar vacío")
    state.saved_filters[name] = filters
    return {"saved": name, "count": len(filters)}


@app.delete("/api/filters/{name}")
async def delete_filter(name: str):
    if name not in state.saved_filters:
        raise HTTPException(404, f"Preset '{name}' no encontrado")
    del state.saved_filters[name]
    return {"deleted": name}


# ── SPA static file serving ──────────────────────────────────────────────────

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path == "":
        full_path = "index.html"

    candidate = os.path.join(STATIC_DIR, full_path)
    if os.path.isfile(candidate):
        # Assets have content-hash filenames → cacheable; index.html → never cache
        headers = NO_CACHE if full_path == "index.html" else {}
        return FileResponse(candidate, headers=headers)

    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path, headers=NO_CACHE)

    return JSONResponse(
        status_code=503,
        content={
            "detail": "Frontend no compilado. Ejecute: cd frontend && npm install && npm run build"
        },
    )
