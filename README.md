# Smartclic Storybook — Extensión VSCode

Extensión exclusiva para la arquitectura y flujo de trabajo de **Smartclic**. No está diseñada para uso general: depende del sistema de componentes, variables y convenciones de código propias del proyecto.

---

## Funcionalidades

### 1. IntelliSense de componentes Vue

Autocompletado y documentación en archivos `.vue` y `.html` para los componentes de la librería `@erp-mf/erp2-components-vue`.

- **Nombre del componente** (`<v-button`, `<v-text`, etc.): sugerencias filtradas con imagen de preview al pasar el cursor.
- **Atributos**: al escribir dentro de un tag, lista todos los props disponibles con descripción y valor por defecto.
- **Valores de atributo**: al escribir dentro de `type="..."`, `size="..."`, etc., lista los valores válidos con descripción y vista previa de la variante.
- **Slots**: al escribir `<template #` o `<template v-slot:` dentro de un componente, autocompleta los slots disponibles con nombre y descripción.
- **Hover**: al posicionar el cursor sobre el nombre de un componente muestra su imagen de preview, descripción y lista de slots; sobre un atributo muestra su descripción, valor por defecto y valores permitidos.
- **Clases utilitarias**: en `class="..."`, `:class="..."` o `v-bind:class`, autocompleta las clases de `_clases.scss` mostrando las propiedades CSS que aplica.

La extensión carga los datos desde `node_modules/@erp-mf/erp2-components-vue/smartclic-data.json` si existe en el workspace; de lo contrario usa el archivo empaquetado dentro de la extensión.

---

### 2. Linter SCSS (`scss-smartclic`)

Detecta y corrige violaciones de las convenciones SCSS del proyecto en archivos `.scss`. Todas las violaciones son **errores** (no advertencias) porque causan el rechazo de un MR.

La extensión busca automáticamente el archivo `_variables.scss` de cada micro frontend en `src/assets/styles/_variables.scss` subiendo desde el archivo SCSS editado.

#### Convenciones que se aplican

**F3 — Alias `vars.` obligatorio**

Todo uso de una variable SCSS en la parte del valor debe usar el alias `vars.`:

```scss
// ❌ Error — sin alias
height: $pix-30;

// ❌ Error — alias incorrecto
height: v.$pix-30;

// ✅ Correcto
height: vars.$pix-30;
```

Tiene **autofix al guardar** y **acción de código** (bombilla).

---

**F1 — Valor literal con variable existente**

Si ya existe una variable para ese valor, usar la variable:

```scss
// ❌ Error — $pix-30 existe en _variables.scss
height: 30px;

// ✅ Correcto
height: vars.$pix-30;
```

Aplica a cualquier tipo de valor que coincida exactamente con una variable (dimensiones, box-shadow, etc.).
Tiene **autofix al guardar** y **acción de código**.

---

**F2 — Valor literal sin variable**

Si se usa un valor con unidad CSS (px, %, em, rem, vw, vh, pt) y no existe ninguna variable para él:

```scss
// ❌ Error — $pix-37 no existe, debe crearse
height: 37px;
```

**Sin autofix**: el desarrollador debe crear la variable en `_variables.scss`.

---

**F4 — Color hardcodeado con variable existente**

Los colores que coincidan con una variable de color deben usar la sintaxis `var(--name, vars.$name)`:

```scss
// ❌ Error — $blue-light: #5293f4 existe
color: #5293f4;

// ✅ Correcto
color: var(--blue-light, vars.$blue-light);
```

Tiene **autofix al guardar** y **acción de código**.

---

**F5 — Color hardcodeado sin variable**

Color que no tiene variable correspondiente en `_variables.scss`:

```scss
// ❌ Error — #abcdef no tiene variable
color: #abcdef;
```

**Sin autofix**: el desarrollador debe crear la variable o usar una existente.

---

**F6 — Variable de color sin envoltura `var()`**

Las variables de color deben usarse siempre con `var()` para permitir theming vía CSS custom properties:

```scss
// ❌ Error — $blue-light es un color
color: vars.$blue-light;

// ✅ Correcto
color: var(--blue-light, vars.$blue-light);
```

Tiene **autofix al guardar** y **acción de código**.

---

**F6b — Variable de color bare sin alias**

En archivos que no importan variables con `@use`, una referencia bare a `$colorVar` también se detecta y corrige:

```scss
// ❌ Error — $orange es un color y no se usa var()
color: $orange;

// ✅ Correcto (autofix genera la forma canónica sin alias)
color: var(--orange, $orange);
```

Tiene **autofix al guardar** y **acción de código**.

---

**F7 — Import `@use` faltante**

Si el archivo usa `vars.$nombre` sin tener el `@use` correspondiente, se reporta una advertencia con la sugerencia del import correcto.

---

#### Herramientas de color SCSS

Además del linter, la extensión provee asistencia visual para variables de color:

- **Swatches inline**: aparece un pequeño cuadrado de color a la izquierda de cada línea donde se use una variable de color (`vars.$blue`, `$orange`, etc.). Soporta hex, `rgb()` y `rgba()`. Clic abre el color picker (read-only: muestra el color sin modificar la referencia).
- **Completions de color**: al escribir `$` dentro del valor de una propiedad CSS, muestra solo las variables de color registradas en `_variables.scss`, con el valor hex en la descripción y el snippet `var(--name, vars.$name)` como texto a insertar.

---

#### Comportamiento del linter

| Evento | Acción |
|--------|--------|
| Abrir un archivo `.scss` | Lint inmediato |
| Editar el archivo | Lint con 400ms de debounce |
| Guardar el archivo | Aplica automáticamente todos los fixes disponibles (F1, F3, F4, F6, F6b) |
| Bombilla (💡) sobre un error | Permite aplicar el fix de forma manual y selectiva |

---

### 3. Panel Import Map

Panel lateral (en el Explorador → **Import Map**) que muestra el estado de todos los micro frontends registrados en `importmap.json` y permite gestionar su entorno sin tocar los archivos manualmente.

#### Estados de un MFE

| Ícono | Color | Descripción |
|-------|-------|-------------|
| ✔ `pass` | Verde | Corriendo — puerto activo |
| ⟳ `sync~spin` | Amarillo | Compilando — muestra porcentaje en tiempo real (`compilando... 42%`) |
| ✖ `error` | Rojo | Error de compilación |
| ⊘ `circle-slash` | Rojo | Offline — configurado como local pero el puerto no responde |
| ○ `radio-button-off` | Azul | Dev — apuntando al servidor remoto |
| ? `question` | Amarillo | Personalizado — URL no coincide con local ni dev |

#### Botones por MFE (inline)

| Botón | Cuándo aparece | Acción |
|-------|----------------|--------|
| ⇄ | Tiene URL alternativa | Alterna entre local y dev en `importmap.json` |
| ▶ | Local pero offline | Lanza el servidor de desarrollo en segundo plano |
| ■ | Corriendo (gestionado o externo) | Detiene el proceso |
| `$(output)` | Gestionado por la extensión (compilando / running / error) | Abre el panel **Output** directo en el canal de ese MFE |

> El botón de logs solo está disponible para procesos iniciados con ▶ desde la extensión. Si el MFE fue iniciado manualmente en otra terminal, los logs no son capturados.

#### Botones del panel (barra de título)

| Botón | Acción |
|-------|--------|
| `$(home)` Todo local | Cambia todos los MFEs a sus URLs locales |
| `$(cloud)` Todo dev | Cambia todos los MFEs a sus URLs de desarrollo |
| `$(refresh)` Recargar | Relee los tres archivos importmap |

#### Modo IP

El primer ítem del panel muestra `localhost` o la IPv4 de red del equipo. Haz clic para alternar. Útil para probar en dispositivos móviles en la misma red local.

#### Inicio y parada de MFEs

Al hacer clic en ▶ la extensión localiza el repositorio en el workspace y ejecuta el comando correcto:

- `npm run start` — `erp-mf-root-config`, `erp-mf-common`
- `npm run serve` — resto de MFEs

El proceso corre en segundo plano. El output está disponible en el panel **Output** (`Ctrl+Shift+U`) en el canal `MFE: <nombre>`, o directamente usando el botón `$(output)` que aparece junto al ■ una vez iniciado el proceso. El ícono y el porcentaje de compilación se actualizan en tiempo real conforme webpack emite progreso.

Si VS Code se cierra y el proceso sigue activo en el puerto, la extensión lo detecta al reabrir y muestra ✔ con botón ■ para detenerlo.

#### Archivos que se leen

| Archivo | Propósito |
|---------|-----------|
| `importmap.json` | Estado activo — el que se modifica al cambiar entorno |
| `importmap-local.json` | URLs locales (`//localhost:xxxx/...`) |
| `importmap-dev.json` | URLs del servidor de desarrollo remoto |

Solo se muestran entradas con nombre `@sreasons/*`. La extensión normaliza automáticamente los alias de clave que difieren entre archivos:

| Alias en `importmap-local.json` | Clave canónica |
|---------------------------------|----------------|
| `@sreasons/root-config` | `@sreasons/erp-mf-root-config` |
| `@sreasons/erp-mf-comun` | `@sreasons/erp-mf-common` |
| `@sreasons/erp-mf-seguridad` | `@sreasons/erp-mf-security` |

---

### 4. Snippets y completions SCSS

#### Breakpoints

Escribe `bk` (o cualquier prefijo) dentro de un archivo `.scss` para ver las opciones disponibles:

| Prefijo | Snippet generado |
|---------|-----------------|
| `bk` | Tres bloques `@include breakpoint(...)` para LG, XL y XXL |
| `bklg` | `@include resol.breakpoint(vars.$bp-res-lg, min) { }` |
| `bkxl` | `@include resol.breakpoint(vars.$bp-res-xl, min) { }` |
| `bkxxl` | `@include resol.breakpoint(vars.$bp-res-xxl, min) { }` |

El alias (`vars.`, `resol.`) se ajusta automáticamente según los `@use` presentes en el archivo.

#### Variables de color

Al escribir `$` en el valor de una propiedad CSS aparecen solo las variables de color de `_variables.scss`. Ver sección **Herramientas de color SCSS** arriba.

#### Fragmentos de snippet

Fragmentos adicionales en archivos `.scss`. Escribe el prefijo y presiona `Tab`.

---

### 5. Crear Componente

Clic derecho sobre una carpeta en el Explorador → **Smartclic: Crear Componente**.

Genera la estructura base de un nuevo componente siguiendo las convenciones del proyecto.

---

#### Detección automática del importmap

La extensión busca `importmap-local.json` en el siguiente orden:

1. La propia carpeta del workspace y sus subcarpetas directas
2. Las carpetas hermanas (mismo nivel que el workspace) y sus subcarpetas directas — excluye `node_modules`

Esto permite que la extensión funcione correctamente aunque solo tengas abierto un MFE (ej: `erp-mf-logistica`): encontrará el importmap en `erp-mf-root-config/src/` automáticamente.

Si no se encuentra, el panel muestra un aviso con el tooltip detallando exactamente qué rutas se buscaron.

---

## Instalación

Instalar el archivo `.vsix` en VS Code:

1. Abre VS Code
2. `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
3. Selecciona el archivo `.vsix`
4. Recarga VS Code cuando lo solicite

La extensión funciona con cualquier workspace que contenga archivos `.vue`, `.html` o `.scss`. El panel Import Map aparece automáticamente en el Explorador si se detectan los archivos importmap.

## Contexto del proyecto

- Librería de componentes: `erp2-componentes-vue`
- Micro frontends: proyectos que consumen la librería y a los que se aplica el linter SCSS
- Variables del proyecto: `src/assets/styles/_variables.scss` en cada micro frontend
- Importación estándar:

```scss
@use '@/assets/styles/variables' as vars;
@use '@/assets/styles/mixin' as resol;
```
