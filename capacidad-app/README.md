# Calculador de Capacidades

SPA 100% client-side de planificación de capacidad productiva. No requiere servidor, Python ni Node en runtime.

## Uso

Abre `dist/index.html` en cualquier navegador moderno. No requiere instalación.

## Desarrollo

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Build (generar dist/)

```bash
cd frontend
npm install
npm run build
# El resultado queda en dist/index.html
```

## Flujo de uso

1. **Maestros** → carga los 4 maestros en orden: Producto, Enrutamiento, Calendario, Demanda.
2. **Cargador CSV** → selecciona el maestro, sube tu CSV, mapea columnas, añade filtros opcionales, valida e importa.
3. **Resultados** → pulsa "Ejecutar cálculo" y revisa la carga por CM/CT/MES. Exporta el resultado a CSV.

## Notas

- El estado vive en RAM del navegador. Al recargar la página, los maestros se vacían.
- El CSV exportado incluye `VERSION` y `TIMESTAMP_EXPORT` para futuras comparaciones.
- Acepta CSVs con separador `,` `;` `\t` o `|`, y codificaciones UTF-8 y Latin-1.
