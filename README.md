# Evaluación de Cumplimiento — Proyectos Tiempo y Material

Versión en línea del papel de trabajo **H0 IF 00 15 11**, para publicar en GitHub Pages
con almacén en una hoja de Google. No usa `localStorage`: el estado vive en el servidor,
así que todos los que entran ven lo mismo y los cambios se propagan solos.

Desplegable **desde una cuenta personal de Google**. No requiere Google Workspace.

Desarrollado por José V. Molina · Contralor · GSQ Honduras S.A.

---

## Cómo se protege el acceso

El HTML de GitHub es público, pero **no contiene datos ni claves**. Al abrirlo aparece
una reja que pide un código. El código se envía al Apps Script, se valida **del lado del
servidor** y devuelve un token de sesión de 8 horas. Sin token, el script no entrega nada:
ni el estado, ni la versión, ni un solo hallazgo.

Hay dos códigos con permisos distintos:

| Rol | Puede |
|---|---|
| `editor` | Capturar, guardar, cerrar revisión, administrar |
| `lector` | Ver y descargar el Excel. Los campos quedan bloqueados y el ⚙ se oculta |

El rol lo decide el servidor, no la URL. Un lector no puede escribir aunque manipule el
JavaScript en su navegador, porque el rechazo ocurre en el Apps Script.

Extras incluidos: bitácora de entradas, códigos inválidos y guardados en la hoja
`BITACORA`; freno de 8 intentos fallidos por hora; y bloqueo optimista por número de
versión para que nadie pise el trabajo de otro.

---

## Despliegue

### 1. Crear el almacén

1. Hoja de cálculo nueva en su Drive personal.
2. **Extensiones ▸ Apps Script**. Borre lo que haya y pegue `Code.gs` completo.
3. **Cambie los códigos** al inicio del archivo:

   ```js
   var CODIGOS = {
     'SUR-CONTRALORIA-2026': 'editor',
     'SUR-CONSULTA-2026':    'lector'
   };
   ```

   Use algo que no se adivine. Puede agregar más códigos, uno por persona, para que la
   bitácora distinga quién entró.

4. **Implementar ▸ Nueva implementación ▸ Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Autorice y copie la URL que termina en `/exec`.

> «Cualquier persona» significa que el script *responde* a cualquiera, no que cualquiera
> *vea* los datos. La reja está adentro. Es lo que permite que entren compañeros sin
> cuenta de Google — útil si GSQ trabaja con Microsoft 365.

Las hojas `ESTADO` y `BITACORA` se crean solas en el primer uso.

### 2. Pegar la URL

En `index.html`, busque `var REMOTO` y pegue la URL:

```js
var REMOTO = {
  url: 'https://script.google.com/macros/s/AKfycb.../exec',
  doc: 'proyectos-tym',
  intervalo: 30000,
  ...
```

La URL no es un secreto: sin código no sirve de nada.

### 3. Publicar

```bash
git init
git add index.html README.md Code.gs
git commit -m "Papel de trabajo H0 IF 00 15 11 en línea"
git branch -M main
git remote add origin https://github.com/USUARIO/REPO.git
git push -u origin main
```

**Settings ▸ Pages ▸ Source: Deploy from a branch ▸ main / (root)**.
Queda en `https://USUARIO.github.io/REPO/`.

### 4. Repartir

Un solo enlace para todos. Lo que cambia es el código que le da a cada persona.

---

## Comportamiento

- **Guardado:** 1.2 s después de dejar de escribir. El indicador va de
  *Cambios sin guardar* → *Guardando* → *Guardado en línea*.
- **Cambios de otros:** consulta cada 30 s y refresca. Si usted tiene ediciones sin
  guardar, no las pisa: avisa y espera.
- **Conflicto:** si alguien guardó primero, el servidor rechaza y avisa.
- **Sesión vencida:** la reja reaparece sola y pide el código otra vez.
- **Pestaña oculta:** deja de consultar para cuidar la cuota.

## Cuotas de una cuenta personal

Una cuenta gratuita tiene alrededor de 90 minutos de ejecución al día, contra unas 6 horas
en Workspace. Con `intervalo: 30000`, cada pestaña abierta hace unas 120 consultas por
hora. Con 5 pestañas simultáneas todo el día podría apretarse; si aparecen errores de
cuota, suba a `60000`.

## Límites

- El estado se guarda **en trozos de 40 000 caracteres** repartidos en varias celdas, así
  que ya no choca con el tope de 50 000 de una celda de Sheets.
- Sin conexión no guarda. El indicador lo dice, pero no hay cola de reintentos.
- **Último en guardar gana** dentro de una misma versión. No hay fusión por celda.
- El token se guarda en `sessionStorage` (solo el token, nunca los datos): se borra al
  cerrar la pestaña.

## Respaldo

- **Descargar respaldo** baja un `.json` con todo, incluido el historial.
- **Restaurar respaldo** lo sube y lo guarda en el almacén compartido.
- En el editor de Apps Script, la función `respaldarADrive()` deja una copia fechada en
  su Drive. Puede ponerle un activador diario con **Activadores ▸ Añadir activador**.

## Si cambia los códigos

Actualice `CODIGOS`, vuelva a implementar (**Implementar ▸ Gestionar implementaciones ▸
editar ▸ Nueva versión**) y avise. Las sesiones abiertas siguen vivas hasta que venzan;
para cortarlas de una vez, en el editor ejecute
`CacheService.getScriptCache().removeAll([])`.
