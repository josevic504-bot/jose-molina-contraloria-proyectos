/**
 * Almacén compartido con reja de acceso
 * Evaluación de Cumplimiento — Proyectos Tiempo y Material (H0 IF 00 15 11)
 * Contraloría GSQ Honduras S.A. · José V. Molina
 *
 * Pensado para desplegarse desde una cuenta personal de Google.
 * El HTML se publica aparte (GitHub Pages) y no contiene datos ni claves:
 * sin un código válido, este script no entrega nada.
 *
 * ── DESPLIEGUE ────────────────────────────────────────────────────────
 *  1. Hoja de cálculo nueva ▸ Extensiones ▸ Apps Script.
 *  2. Pegue este archivo completo. Cambie los códigos de CODIGOS.
 *  3. Implementar ▸ Nueva implementación ▸ Aplicación web:
 *       Ejecutar como:      Yo
 *       Quién tiene acceso: Cualquier persona
 *  4. Copie la URL /exec y péguela en REMOTO.url del index.html.
 *
 *  "Cualquier persona" deja que el script RESPONDA a cualquiera; no que
 *  cualquiera VEA los datos. La validación del código ocurre aquí dentro,
 *  del lado del servidor, y el código nunca viaja en el HTML.
 * ─────────────────────────────────────────────────────────────────────
 */

// ══════════════ CONFIGURACIÓN ══════════════

/** Cambie estos códigos antes de usar. Reparta uno según el rol. */
var CODIGOS = {
  'SUR-CONTRALORIA-2026': 'editor',   // captura y guarda
  'SUR-CONSULTA-2026':    'lector'    // solo mira
};

var HOJA_DATOS = 'ESTADO';
var HOJA_BITAC = 'BITACORA';
var VIDA_TOKEN = 8 * 60 * 60;        // segundos que dura una sesión
var TROZO      = 40000;              // caracteres por celda
var MAX_FALLOS = 8;                  // intentos fallidos por hora, por rastro

// ══════════════ UTILIDADES ══════════════

function _libro() { return SpreadsheetApp.getActiveSpreadsheet(); }

function _hoja(nombre, encabezado) {
  var h = _libro().getSheetByName(nombre);
  if (!h) {
    h = _libro().insertSheet(nombre);
    h.getRange(1, 1, 1, encabezado.length).setValues([encabezado]);
    h.setFrozenRows(1);
  }
  return h;
}

function _hojaDatos() {
  return _hoja(HOJA_DATOS, ['doc', 'version', 'actualizado', 'trozos', 'estado...']);
}

function _hojaBitacora() {
  return _hoja(HOJA_BITAC, ['fecha', 'evento', 'rol', 'doc', 'detalle']);
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function _apuntar(evento, rol, doc, detalle) {
  try {
    var h = _hojaBitacora();
    h.appendRow([new Date(), evento, rol || '', doc || '', detalle || '']);
    if (h.getLastRow() > 2000) h.deleteRows(2, 500);   // poda
  } catch (err) { /* la bitácora nunca debe tumbar la operación */ }
}

// ══════════════ SESIONES ══════════════

function _nuevoToken(rol) {
  var t = Utilities.getUuid().replace(/-/g, '') +
          Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  CacheService.getScriptCache().put('tk_' + t, rol, VIDA_TOKEN);
  return t;
}

function _rolDe(token) {
  if (!token) return null;
  return CacheService.getScriptCache().get('tk_' + token);
}

/** Freno simple a la fuerza bruta, por hora y por rastro del cliente. */
function _bloqueado(rastro) {
  var n = Number(CacheService.getScriptCache().get('f_' + rastro) || 0);
  return n >= MAX_FALLOS;
}

function _sumarFallo(rastro) {
  var c = CacheService.getScriptCache();
  var n = Number(c.get('f_' + rastro) || 0) + 1;
  c.put('f_' + rastro, String(n), 3600);
  return n;
}

// ══════════════ LECTURA Y ESCRITURA POR TROZOS ══════════════

function _fila(doc) {
  var h = _hojaDatos();
  var n = h.getLastRow();
  if (n < 2) return 0;
  var col = h.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (col[i][0] === doc) return i + 2;
  }
  return 0;
}

function _leer(doc) {
  var f = _fila(doc);
  if (!f) return { version: 0, estado: null, actualizado: null };
  var h = _hojaDatos();
  var trozos = Number(h.getRange(f, 4).getValue()) || 1;
  var celdas = h.getRange(f, 5, 1, trozos).getValues()[0];
  var estado = null;
  try { estado = JSON.parse(celdas.join('')); } catch (err) { estado = null; }
  return {
    version: Number(h.getRange(f, 2).getValue()) || 0,
    actualizado: h.getRange(f, 3).getValue(),
    estado: estado
  };
}

function _escribir(doc, estado, versionNueva) {
  var h = _hojaDatos();
  var texto = JSON.stringify(estado);
  var partes = [];
  for (var i = 0; i < texto.length; i += TROZO) partes.push(texto.slice(i, i + TROZO));
  if (!partes.length) partes = [''];

  var f = _fila(doc);
  if (!f) f = h.getLastRow() + 1;

  // Limpia trozos sobrantes de un guardado anterior más largo
  var antes = Number(h.getRange(f, 4).getValue()) || 0;
  if (antes > partes.length) {
    h.getRange(f, 5 + partes.length, 1, antes - partes.length).clearContent();
  }
  h.getRange(f, 1, 1, 4).setValues([[doc, versionNueva, new Date(), partes.length]]);
  h.getRange(f, 5, 1, partes.length).setValues([partes]);
  return partes.length;
}

// ══════════════ PUNTOS DE ENTRADA ══════════════

function doGet(e) {
  var p = e.parameter || {};

  if (p.accion === 'leer') {
    var rol = _rolDe(p.token);
    if (!rol) return _json({ error: 'sesion', mensaje: 'Sesión vencida o código inválido.' });
    var d = _leer(p.doc || 'default');
    d.rol = rol;
    return _json(d);
  }

  return _json({ error: 'accion', mensaje: 'Acción no reconocida.' });
}

function doPost(e) {
  var p;
  try { p = JSON.parse(e.postData.contents); }
  catch (err) { return _json({ error: 'formato' }); }

  // ── Entrar ──
  if (p.accion === 'entrar') {
    var rastro = String(p.rastro || 'anon').slice(0, 40);
    if (_bloqueado(rastro)) {
      _apuntar('bloqueo', '', '', rastro);
      return _json({ error: 'bloqueado', mensaje: 'Demasiados intentos. Espere una hora.' });
    }
    var rol = CODIGOS[String(p.codigo || '').trim()];
    if (!rol) {
      var n = _sumarFallo(rastro);
      _apuntar('codigo-invalido', '', '', rastro + ' intento ' + n);
      return _json({ error: 'codigo', mensaje: 'Código incorrecto.', restantes: MAX_FALLOS - n });
    }
    _apuntar('entrada', rol, '', rastro);
    return _json({ ok: true, token: _nuevoToken(rol), rol: rol, horas: VIDA_TOKEN / 3600 });
  }

  // ── Guardar ──
  if (p.accion === 'guardar') {
    var rolG = _rolDe(p.token);
    if (!rolG) return _json({ error: 'sesion', mensaje: 'Sesión vencida. Vuelva a ingresar el código.' });
    if (rolG !== 'editor') {
      _apuntar('escritura-negada', rolG, p.doc, '');
      return _json({ error: 'permiso', mensaje: 'Su código es de solo consulta.' });
    }

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) return _json({ error: 'ocupado', mensaje: 'Almacén ocupado, reintente.' });
    try {
      var doc = p.doc || 'default';
      var actual = _leer(doc).version;
      if (p.version !== undefined && Number(p.version) !== actual) {
        return _json({ conflicto: true, version: actual });
      }
      var nueva = actual + 1;
      var trozos = _escribir(doc, p.estado, nueva);
      _apuntar('guardado', rolG, doc, 'v' + nueva + ' en ' + trozos + ' trozo(s)');
      return _json({ ok: true, version: nueva, trozos: trozos });
    } catch (err) {
      _apuntar('error', rolG, p.doc, String(err));
      return _json({ error: 'servidor', mensaje: String(err) });
    } finally {
      lock.releaseLock();
    }
  }

  return _json({ error: 'accion' });
}

// ══════════════ MANTENIMIENTO ══════════════

/** Ejecútela a mano desde el editor para bajar un respaldo a Drive. */
function respaldarADrive() {
  var d = _leer('proyectos-tym');
  if (!d.estado) { Logger.log('Sin datos que respaldar.'); return; }
  var nombre = 'respaldo_proyectos-tym_v' + d.version + '_' +
               Utilities.formatDate(new Date(), 'America/Tegucigalpa', 'yyyy-MM-dd_HHmm') + '.json';
  var f = DriveApp.createFile(nombre, JSON.stringify(d.estado), MimeType.PLAIN_TEXT);
  Logger.log('Respaldo creado: ' + f.getUrl());
}
