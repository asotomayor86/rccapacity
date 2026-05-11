from datetime import datetime

MASTER_SCHEMAS = {
    "DEMANDA": [
        {"name": "MES", "type": "fecha", "required": True},
        {"name": "REFERENCIA", "type": "string", "required": True},
        {"name": "CANTIDAD", "type": "decimal", "required": True},
    ],
    "PRODUCTO": [
        {"name": "REFERENCIA", "type": "string", "required": True},
        {"name": "DESCRIPCION", "type": "string", "required": True},
        {"name": "DESCRIPCION2", "type": "string", "required": False},
        {"name": "MEZCLA", "type": "string", "required": False},
        {"name": "ANCHO", "type": "decimal", "required": False},
        {"name": "GALGA", "type": "decimal", "required": False},
    ],
    "ENRUTAMIENTO": [
        {"name": "REFERENCIA", "type": "string", "required": True},
        {"name": "TIPO", "type": "string", "required": True},
        {"name": "CM", "type": "string", "required": True},
        {"name": "RUNTIME", "type": "decimal", "required": True},
    ],
    "CALENDARIO": [
        {"name": "CM", "type": "string", "required": True},
        {"name": "CT", "type": "string", "required": True},
        {"name": "MES", "type": "fecha", "required": True},
        {"name": "CAPACIDAD_TOTAL", "type": "decimal", "required": True},
        {"name": "EFICIENCIA", "type": "decimal", "required": True},
        {"name": "CAPACIDAD_EFECTIVA", "type": "decimal", "required": True},
    ],
}

masters = {
    name: {"records": [], "loaded_at": None, "count": 0}
    for name in MASTER_SCHEMAS
}

# Temporary CSV uploads: upload_id -> {"columns": [...], "rows": [...]}
uploads: dict = {}

# Calculation results
results: dict = {"records": [], "calculated_at": None}

# Saved filter presets: preset_name -> list of filter dicts
saved_filters: dict = {}
