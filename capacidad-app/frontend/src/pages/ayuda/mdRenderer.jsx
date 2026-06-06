import React, { useState } from "react";
import { MASTER_SCHEMAS_META } from "../../masterSchemas";

// Subset soportado: # ## ###, **negrita**, *cursiva*, `código`,
// listas - y 1., tablas pipe, citas >, separador ---, párrafos.
// Marcadores dinámicos: {{MAESTRO:NOMBRE}}.
// Bloques expandibles: <!-- detalles --> ... <!-- /detalles -->.

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extraerTitulosH2(source) {
  const lineas = source.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let dentroDetalles = false;
  for (const l of lineas) {
    const t = l.trim();
    if (t === "<!-- detalles -->") { dentroDetalles = true; continue; }
    if (t === "<!-- /detalles -->") { dentroDetalles = false; continue; }
    if (dentroDetalles) continue;
    if (l.startsWith("## ")) {
      const titulo = l.slice(3).trim();
      out.push({ titulo, slug: slugify(titulo) });
    }
  }
  return out;
}

function TOC({ titulos }) {
  if (titulos.length <= 1) return null;
  function irA(slug) {
    const el = document.getElementById(slug);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <nav className="ayuda-md-toc" aria-label="Índice de la sección">
      <div className="ayuda-md-toc-titulo">EN ESTA SECCIÓN</div>
      <div className="ayuda-md-toc-lista">
        {titulos.map((t) => (
          <button
            key={t.slug}
            type="button"
            className="ayuda-md-toc-item"
            onClick={() => irA(t.slug)}
          >
            {t.titulo}
          </button>
        ))}
      </div>
    </nav>
  );
}

function renderInline(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key++} className="ayuda-md-code">{tok.slice(1, -1)}</code>);
    } else {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MaestroBlock({ nombre }) {
  const schema = MASTER_SCHEMAS_META[nombre];
  if (!schema) return <div className="ayuda-md-warn">Maestro desconocido: {nombre}</div>;
  return (
    <div className="ayuda-md-tabla-wrap">
      <table className="ayuda-md-tabla">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Tipo</th>
            <th>Obligatorio</th>
          </tr>
        </thead>
        <tbody>
          {schema.map((f) => (
            <tr key={f.name}>
              <td><code className="ayuda-md-code">{f.label ?? f.name}</code></td>
              <td>{f.type}</td>
              <td>{f.required ? "Sí" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detalles({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ayuda-md-detalles">
      <button
        type="button"
        className="ayuda-md-detalles-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "▾ Ocultar detalles" : "▸ Ver más"}
      </button>
      {open && <div className="ayuda-md-detalles-body">{children}</div>}
    </div>
  );
}

function renderTabla(headerLine, rows, key) {
  const cols = headerLine.split("|").slice(1, -1).map((s) => s.trim());
  return (
    <div key={key} className="ayuda-md-tabla-wrap">
      <table className="ayuda-md-tabla">
        <thead>
          <tr>{cols.map((c, i) => <th key={i}>{renderInline(c)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const cells = r.split("|").slice(1, -1).map((s) => s.trim());
            return <tr key={i}>{cells.map((c, j) => <td key={j}>{renderInline(c)}</td>)}</tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

// Convierte un array de líneas (sin marcadores especiales) en JSX.
// Reconoce: # ## ###, listas - y 1., tablas pipe, citas >, ---, párrafos.
function renderLineas(lineas, keyBase = "") {
  const out = [];
  let i = 0;
  let k = 0;
  while (i < lineas.length) {
    const l = lineas[i];

    if (l.trim() === "") { i++; continue; }

    if (l.startsWith("### ")) {
      out.push(<h3 key={`${keyBase}-${k++}`} className="ayuda-md-h3">{renderInline(l.slice(4))}</h3>);
      i++; continue;
    }
    if (l.startsWith("## ")) {
      const titulo = l.slice(3);
      out.push(
        <h2
          key={`${keyBase}-${k++}`}
          id={slugify(titulo)}
          className="ayuda-md-h2"
        >
          {renderInline(titulo)}
        </h2>
      );
      i++; continue;
    }
    if (l.startsWith("# ")) {
      out.push(<h1 key={`${keyBase}-${k++}`} className="ayuda-md-h1">{renderInline(l.slice(2))}</h1>);
      i++; continue;
    }
    if (l.trim() === "---") {
      out.push(<hr key={`${keyBase}-${k++}`} className="ayuda-md-hr" />);
      i++; continue;
    }

    // Tabla: línea con | y siguiente con --- separadores
    if (l.startsWith("|") && lineas[i + 1]?.startsWith("|") && /^\|[\s:|-]+\|$/.test(lineas[i + 1].trim())) {
      const header = l;
      i += 2;
      const rows = [];
      while (i < lineas.length && lineas[i].startsWith("|")) { rows.push(lineas[i]); i++; }
      out.push(renderTabla(header, rows, `${keyBase}-${k++}`));
      continue;
    }

    // Cita
    if (l.startsWith("> ")) {
      const lines = [];
      while (i < lineas.length && lineas[i].startsWith("> ")) { lines.push(lineas[i].slice(2)); i++; }
      out.push(
        <blockquote key={`${keyBase}-${k++}`} className="ayuda-md-cita">
          {lines.map((x, j) => <div key={j}>{renderInline(x)}</div>)}
        </blockquote>
      );
      continue;
    }

    // Lista no numerada
    if (l.startsWith("- ")) {
      const items = [];
      while (i < lineas.length && lineas[i].startsWith("- ")) { items.push(lineas[i].slice(2)); i++; }
      out.push(
        <ul key={`${keyBase}-${k++}`} className="ayuda-md-ul">
          {items.map((x, j) => <li key={j}>{renderInline(x)}</li>)}
        </ul>
      );
      continue;
    }

    // Lista numerada
    if (/^\d+\.\s/.test(l)) {
      const items = [];
      while (i < lineas.length && /^\d+\.\s/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        <ol key={`${keyBase}-${k++}`} className="ayuda-md-ol">
          {items.map((x, j) => <li key={j}>{renderInline(x)}</li>)}
        </ol>
      );
      continue;
    }

    // Párrafo (acumula hasta línea en blanco o bloque)
    const parr = [l];
    i++;
    while (
      i < lineas.length &&
      lineas[i].trim() !== "" &&
      !lineas[i].startsWith("#") &&
      !lineas[i].startsWith("- ") &&
      !lineas[i].startsWith("> ") &&
      !lineas[i].startsWith("|") &&
      !/^\d+\.\s/.test(lineas[i]) &&
      lineas[i].trim() !== "---"
    ) {
      parr.push(lineas[i]);
      i++;
    }
    out.push(
      <p key={`${keyBase}-${k++}`} className="ayuda-md-p">
        {renderInline(parr.join(" "))}
      </p>
    );
  }
  return out;
}

const MARCADORES = {};

export default function MdRenderer({ source }) {
  const titulos = extraerTitulosH2(source);
  const lineas = source.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let buffer = [];
  let k = 0;

  function flushBuffer() {
    if (buffer.length === 0) return;
    out.push(...renderLineas(buffer, `b${k++}`));
    buffer = [];
  }

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const trim = l.trim();

    // Bloque de detalles
    if (trim === "<!-- detalles -->") {
      flushBuffer();
      const inner = [];
      i++;
      while (i < lineas.length && lineas[i].trim() !== "<!-- /detalles -->") {
        inner.push(lineas[i]);
        i++;
      }
      out.push(
        <Detalles key={`d${k++}`}>
          {renderLineas(inner, `d${k}`)}
        </Detalles>
      );
      continue;
    }

    // Marcadores estáticos
    if (MARCADORES[trim]) {
      flushBuffer();
      out.push(<React.Fragment key={`m${k++}`}>{MARCADORES[trim]()}</React.Fragment>);
      continue;
    }

    // Marcador con parámetro: {{MAESTRO:NOMBRE}}
    const mMaestro = trim.match(/^\{\{MAESTRO:([A-Z_]+)\}\}$/);
    if (mMaestro) {
      flushBuffer();
      out.push(<MaestroBlock key={`mae${k++}`} nombre={mMaestro[1]} />);
      continue;
    }

    buffer.push(l);
  }
  flushBuffer();

  return (
    <div className="ayuda-md">
      <TOC titulos={titulos} />
      {out}
    </div>
  );
}
