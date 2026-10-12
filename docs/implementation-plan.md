# Plan de implementación de pactlock (ex SyntaX)

Estado de referencia: 23 de septiembre de 2026. Revisado el mismo día para alinearlo con el foco
vigente de `docs/direction.md`, con el relevamiento de `docs/landscape.md` y con el nombre nuevo
(`docs/adr/0001-nombre-pactlock.md`).

Este documento convierte la dirección de producto en una secuencia ejecutable. No reemplaza
`docs/backlog.md`: el backlog conserva deuda y riesgos con su motivo; este plan decide el
**orden**, las **puertas de salida** y los **puntos donde el producto se replantea**. Cada ítem
del backlog marcado *bloquea* tiene una fase asignada acá; si aparece uno nuevo, se asigna o se
explica por qué no.

## Qué cambió en esta revisión

La versión anterior tomaba el compilador como destino por defecto (fases 2 a 8) y dejaba la
auditoría como alternativa en el punto de decisión A. El relevamiento del mercado invierte eso:

- sincronizar configuración entre runtimes ya lo hacen al menos cinco herramientas;
- medir el costo en tokens de MCP también, varias con gate en CI;
- Snyk Agent Scan cubre la detección de contenido malicioso y el tool pinning por hash.

Lo que queda sin resolver es el **contrato de equipo verificado en CI, con aceptación deliberada y
mínimo privilegio**. Por eso:

1. el camino por defecto pasa a ser **auditar y verificar** (contrato, permisos, más objetos en
   modo lectura);
2. la compilación (`build`, `emit`, `rollback`, resolución remota) pasa a ser una **rama
   condicional** que solo se activa con evidencia en el punto de decisión A;
3. la telemetría deja de ser condición del corpus: el corpus se arma **sobre repos públicos**;
4. se suman al primer incremento la salida de la CLI en inglés, la GitHub Action y los adapters de
   lectura de Cursor y Gemini CLI, porque determinan quién puede probar la herramienta.

## Resultado buscado

Un equipo con editores distintos adopta su entorno de agente en un contrato (`import`), ve cuánto
cuesta y qué puede hacer el agente (`doctor`), acepta cada capacidad nueva a propósito (`accept`)
y **falla en CI cuando el entorno de alguien derivó del acordado o viola su política de
permisos** (`verify --strict`).

```text
disco existente -> import -> contrato + política -> verify --strict (CI del equipo)
      |                          |
   doctor                 accept (a propósito)
```

Tres preguntas, en orden de prioridad:

1. ¿El entorno que corro es el que acordamos? → `verify --strict` + `accept`
2. ¿Qué puede hacer el agente? → check de permisos en `doctor` y política en `verify`
3. ¿Cuánto me cuesta este entorno? → `doctor`

## Qué no es este plan

Las reglas de foco están en `docs/agent-brief.md` ("Foco vigente: lo que no se hace"). En corto:
no es un sincronizador, no es un escáner de contenido malicioso, no es un catálogo, no es
run-time, no es una UI, y no suma runtimes con escritura antes del punto de decisión A.
`src/registry/capabilities.js` no crece a mano.

## Línea de base real

Existe y tiene tests:

- `doctor` con cinco checks y `doctor --deep` (mide schemas MCP por stdio), costo por target;
- adapters de Claude Code y Codex en modo lectura, contrato declarativo con `supports`;
- `import`, `verify` (con `--strict`) y `accept` para **skills**;
- digest normalizado entre plataformas con vectores (`docs/digest.md`) e inventario por archivo;
- escritura de manifest+lock con interrupción detectable (journal + `manifestDigest`), sin
  prometer atomicidad entre los dos archivos;
- CI en Windows, macOS y Linux (Node 22).

No existe: check de permisos, salida en inglés, publicación en npm, GitHub Action, adapters de
Cursor o Gemini CLI, objetos distintos de skill en el manifest, parser TOML real, CI en el piso de
Node declarado. Tampoco nada de la rama de compilación (`build`, `emit`, `rollback`, resolución
de origen, `merge-markdown`, resolución de secretos).

**Drift conocido:**

- el README dice que el entorno "se compila a cada runtime", pero `build` no existe.

Se corrige en la fase 0-A. El drift del brief sobre `accept` ya se corrigió en esta
revisión.

## Principios

1. **Observar no es decidir.** `import` describe el disco. La convergencia, la confianza y la
   aceptación de drift las expresa una persona, y quedan escritas.
2. **Digest no es pin.** Integridad responde "¿cambió?"; resolución responde "¿cómo lo obtengo
   igual?". Viven en campos distintos y nunca se sustituyen.
3. **Aceptar es autorizar.** Una capacidad nueva (skill, MCP, hook, permiso) se acepta de a una,
   con nombre, y nunca en bloque sin haberla visto.
4. **Los secretos no se serializan.** Ni en el manifest, el lock, los reportes, el journal, los
   logs, los backups ni el corpus.
5. **La pérdida y la incertidumbre son parte del resultado.** Un target que no puede expresar algo
   lo dice. Los tokens llevan `≈` y lo que no se midió se declara.
6. **Nunca se ejecuta código ajeno por default.** `--deep` es opt-in y avisa, y el corpus público
   **jamás** corre `--deep`.
7. **Franjas verticales.** Cada objeto entra completo (schema, lectura, import, verify, accept,
   política, tests de no filtración) antes de empezar el siguiente.
8. **Git es del usuario.** Ninguna fase ejecuta operaciones de git.

## Decisiones de la fase 0

Van como ADRs breves en `docs/adr/`. Cada una tiene una propuesta; el ADR la confirma o la cambia.

| Decisión | Propuesta | Por qué ahora |
|---|---|---|
| **Nombre** | **Decidido (ADR 0001): `pactlock`.** Paquete y binario `pactlock`, archivos `pactlock.yaml`/`pactlock.lock`, algoritmo `pactlock-skill-tree-v1`. Sin compatibilidad con los nombres viejos (no hay usuarios externos). SyntaX queda como nombre histórico. | Bloquea `npx`, que es todo el mecanismo de adopción. `syntax` está tomado y `agent-pact` choca con el marketplace AgentPact. |
| **Idioma de la CLI** | Inglés por default; español disponible (`--lang es` o locale). Los tests hacen match por clave de mensaje, no por texto. | El público es internacional. Traducir después obliga a reescribir los tests dos veces. |
| **Tokenizador de referencia** | Elegir modelo/tokenizador de referencia, conservar `≈` y declarar el método en el reporte. | `chars/4` subestima los schemas JSON, que son el 77% del costo medido. |
| **Corpus** | Corpus sobre repos públicos, sin telemetría: solo lectura, sin `--deep`, sin guardar contenido ni secretos, y publicación **solo agregada** (nunca se nombra un repo por un hallazgo de seguridad). La telemetría opt-in se decide después, en la fase 5. | Es el activo que compone y hoy se pierde. Así se empieza sin pedir confianza a nadie. |
| **Versionado de formatos** | Campo `version` en el manifest y el lock desde la primera publicación, con migraciones explícitas. | Una vez publicado, cambiar el formato sin versión rompe a los usuarios. |
| **`--deep` en CI** | No se ejecuta sobre la configuración de los PRs por default; queda documentado como decisión de seguridad. | Correr `--deep` en CI es ejecutar el `.mcp.json` de cada PR. |
| **`src/legacy/`** | Se borra en la fase 0. Queda en el historial de git; si la rama de compilación se activa, se porta desde ahí. | Su condición de borrado dependía de `build`, que ahora es condicional: sin esta decisión, no se borra nunca. |

## Fase 0: migrar el nombre y alinear la documentación

**Objetivo:** que el producto tenga su nombre definitivo y que nada se contradiga antes de agregar
superficie.

### 0-M: migración a pactlock (primero, de una sola vez)

El inventario completo y el orden están en el ADR 0001. En resumen:

1. línea base con los nombres viejos: suite verde y `verify` limpio sobre este repo;
2. código: `package.json` (`name`, `bin`, sin `"private": true`), las constantes de archivos
   (`pactlock.yaml`, `pactlock.lock`, `.pactlock-journal.json`, `*.pactlock-tmp-*`,
   `*.pactlock-prev-*`, `.pactlock/`), `clientInfo` del handshake MCP, y la ayuda y los mensajes
   de la CLI. `doctor` sigue reconociendo los `*.syntax-backup-*` huérfanos;
3. algoritmo: `pactlock-skill-tree-v1` / `pactlock-skill-file-v1`, con vectores nuevos en
   `docs/digest.md` y `test/digest.test.js`; comprobar que solo cambia el prefijo;
4. contrato propio: `pactlock.yaml` conservando los `why`, lock regenerado, `verify --strict`
   limpio;
5. documentación: README ("formerly SyntaX" una sola vez), brief con marcadores
   `PACTLOCK:BRIEF`, specs y ejemplos;
6. fuera del repo (lo hace el usuario): renombrar el repo en GitHub a `pactlock` y mover la
   carpeta a `C:\Proyectos GRANDES\pactlock`, sin anidar; después, actualizar la ruta en
   `scripts/emit-docs.mjs`;
7. comprobación final con `grep -ri syntax`: solo quedan la detección de backups viejos y las
   menciones históricas.

**Estado (2026-09-29):** pasos 1 a 7 hechos. `src/legacy/` borrado (fase 0-A), repo renombrado en
GitHub y carpeta movida a `pactlock`, sin anidar. La ruta que el paso 6 pedía actualizar en
`scripts/emit-docs.mjs` ya no se escribe: el brief declara la restricción (fuera de OneDrive) sin
la ruta absoluta, que es de cada máquina.

**Puerta todavía abierta:** `verify --strict` sale con exit 1. `.agents/skills` tiene las 9
skills y el contrato declara 3 en codex: 6 `unexpected` y 2 `diverged`. Resolverlo es una
decisión del usuario (`accept --adopt` o revertir la copia), no limpieza.

**Puerta de salida de 0-M:** suite verde, `pactlock verify --strict` limpio sobre este repo, y el
`grep` final sin residuos.

### 0-A: alinear

- escribir el resto de los ADRs de la tabla anterior;
- README: nuevo tagline según el foco, quitar lo que describe `build` como existente, y agregar una
  sección breve de "cómo se relaciona con Snyk Agent Scan y los sincronizadores";
- documentar el flujo canónico y los exit codes de cada comando en un solo lugar;
- ~~borrar `src/legacy/`~~ hecho el 2026-09-29 (el usuario commitea);
- asignar cada ítem *bloquea* del backlog a una fase de este plan o a la rama condicional.

**Puerta de salida:** el brief, el README, la ayuda de la CLI y el código dicen lo mismo; los
ADRs están escritos. Es una fase de días, no de semanas.

## Fase 1: publicar la cuña (`doctor` + `verify --strict` + `accept`)

**Objetivo:** que una persona ajena al proyecto pueda probarlo en un minuto, en inglés, y dejarlo
como política de CI.

Trabajo en `doctor` (todo sigue siendo solo lectura):

- **check de permisos:** `allow` amplio combinado con MCP que escriben, y hooks que ejecutan
  código. Es la capacidad nueva más importante de la fase;
- tokenizador de referencia según el ADR, con el método declarado en el reporte;
- un runtime detectado pero vacío explica por qué (hoy dice `sin objetos · ≈0 tokens`);
- probar el handshake de `--deep` contra servers con otras versiones de protocolo antes de
  reportar uno como caído;
- **adapters de lectura para Cursor y Gemini CLI**, con el criterio de **cero cambios en el
  núcleo**. Amplían a quién le sirve `doctor` y, de paso, prueban la extensibilidad del contrato
  del lado de la lectura.

Trabajo de distribución:

- publicar `pactlock` en npm (el nombre ya quedó listo en 0-M); el binario probado con `npx` en un
  directorio limpio;
- la salida de la CLI en inglés según el ADR, con los tests migrados a claves;
- **GitHub Action** que corre `verify --strict` (sin `--deep`) y falla el PR, con un ejemplo
  copiable en el README;
- CI verde en Windows, macOS y Linux, en Node 20.11 y 22 (o subir `engines` honestamente);
- los formatos del manifest y el lock versionados desde la primera publicación;
- un GIF o una grabación de terminal de `doctor` en el README y una release `v0.3`.

**Puerta de salida:** una persona ajena al proyecto corre `npx pactlock doctor` en su repo y
entiende el reporte sin ayuda; un repo de ejemplo usa la Action y un PR con drift falla; CI verde
en la matriz declarada.

## Fase 2: corpus público y primer informe

**Objetivo:** juntar el activo que compone (la matriz de lo que existe en entornos reales) sin
telemetría, y publicar el primer resultado.

- listar repos públicos que declaran `.mcp.json`, `.claude/`, `.agents/` o `AGENTS.md`,
  respetando los límites y términos de la API de GitHub;
- correr `doctor` en modo lectura, **sin `--deep` y sin ejecutar nada del repo**, y guardar solo
  métricas agregables: conteos, costos estimados, providers presentes, patrones de permisos y
  drift. Nunca contenido, rutas sensibles ni valores;
- publicar un informe agregado ("State of Agent Environments"): costo típico de arranque,
  providers duplicados, frecuencia de permisos amplios, drift entre runtimes, cada número con su
  incertidumbre y su método;
- **derivar las colisiones del corpus** en lugar de curar `capabilities.js` (salida 1 del backlog),
  y, donde no alcance, detectar solapamientos comparando descripciones y nombres de tools, con la
  tasa de falsos positivos declarada;
- el script del corpus es reproducible y vive en el repo, para que otro pueda rehacer los números.

**Puerta de salida:** el informe está publicado con su método; `capabilities.js` deja de crecer a
mano; el corpus puede volver a correrse con un comando.

### Validación de demanda (en paralelo a las fases 1 y 2, no bloquea)

Adaptada a un proyecto de una persona. Se registran señales concretas, no impresiones:

- issues y pedidos de gente ajena, y qué objeto piden primero (MCP, permisos, hooks, compilación);
- repos públicos que usan la GitHub Action (se pueden buscar);
- conversaciones que salen de los posts y del informe;
- de ser posible, 3 a 5 equipos que corran `import -> verify --strict` en un repo propio, midiendo
  el tiempo hasta el primer diagnóstico, qué hallazgos les importaron y si lo dejarían en CI.

### Punto de decisión A

Se toma unas **8 semanas después de la publicación de la fase 1** y se escribe en
`docs/direction.md`:

- **Por default: auditar y verificar.** Seguir con las fases 3 y 4 (más objetos en el contrato, en
  modo lectura, y política de permisos).
- **Activar la rama de compilación** solo si hay pedidos concretos y repetidos de compilar entre
  runtimes que los sincronizadores existentes no resuelven, y se puede nombrar en qué no los
  resuelven.
- **Si no aparece nadie que lo adopte en CI**, elegir a propósito el camino de open source sin
  negocio (`direction.md`, "Mercado"): el proyecto sigue valiendo como herramienta y como
  evidencia de trabajo, y se dice así.

## Fase 3: MCP en el contrato (lectura, import, verify, accept)

**Objetivo:** cubrir la parte de mayor costo y mayor riesgo del entorno real, sin escribir en él.

- **sanitizar `env`, headers y argumentos sensibles antes de serializar**: es lo primero, no un
  agregado;
- extender la observación, el schema, `import`, el digest, el lock, `verify` y `accept` a MCP;
- un parser TOML real para leer Codex (reemplaza la expresión regular);
- alcance visible: Codex suma la config de usuario (no viaja con el repo) y la del proyecto
  (`.codex/config.toml`, que viaja pero solo carga en proyectos marcados como confiables por cada
  persona); el reporte dice las dos cosas y no afirma lo que no puede ver;
- aceptar un MCP nuevo es aceptar una capacidad ejecutable: `accept` interactivo, igual que un
  `unexpected`;
- tests con credenciales señuelo en todos los artefactos.

**Puerta de salida:** ningún fixture con credenciales señuelo filtra valores al manifest, el lock,
el JSON, los logs ni el journal; un MCP agregado o modificado sin aceptar hace fallar
`verify --strict` en los tres adapters principales.

## Fase 4: permisos y hooks como política

**Objetivo:** la apuesta del producto. Según `direction.md`, permisos y hooks son lo que no va a
converger entre vendors, y es donde vive el valor de seguridad.

- `permission` en el contrato: análisis semántico por runtime y pérdida explícita entre modelos de
  permisos que no son equivalentes;
- una **política declarativa** en el manifest (por ejemplo: sin `allow` amplio en proyectos con MCP
  que escriben), evaluada por `verify --strict`, con excepciones que llevan su `why`;
- `hook`: ejecuta código, así que exige una frontera de confianza fuerte y `accept` interactivo
  para cada hook nuevo;
- `command` y `agent`: reutilizan la maquinaria de skills;
- `env/secret`: como referencia y política, nunca como valor.

**Puerta de salida:** ningún `kind` que el schema acepta tiene un estado operativo ambiguo; cada
target dice soportado, degradado o no representable; una violación de política hace fallar CI con
un mensaje que explica qué, dónde y cómo aceptarlo a propósito.

### Punto de decisión B: convergencia

Antes y después de la fase 4 se revisa si skills, MCP, hooks o permisos están convergiendo entre
vendors (actualizar `docs/landscape.md`). Si convergen, el valor se concentra en la política y la
verificación, y se replantea antes de sumar más runtimes.

## Fase 5: corpus continuo y producto de equipo

**Objetivo:** que el activo siga creciendo y se convierta en algo que un equipo usaría a diario.

- volver a correr el corpus periódicamente y publicar la evolución;
- una matriz de compatibilidad por capability y runtime, con nivel de confianza y evidencia;
- políticas de organización, excepciones con motivo y reportes auditables;
- decidir la telemetría opt-in (esquema público, payload inspeccionable antes de enviar, sin
  nombres, rutas, contenido ni secretos), solo si el corpus público ya no alcanza;
- evaluar un visor web solo si hay datos que valga la pena explorar.

## Rama de compilación (condicional)

Solo se activa si el punto de decisión A lo decide. Conserva el diseño de la versión anterior de
este plan, porque sigue siendo correcto si hace falta. Además de los principios generales, aplica:
**el plan va antes de la escritura** (`build` sin `--apply` no modifica un byte), **sin origen
verificable no hay materialización** (lo que no tiene resolución sale `blocked`) y **toda
escritura es reversible y listable**.

ADRs propios de la rama: la semántica de `build` (preview; `--apply` autoriza; `--json` expone el
mismo plan), el origen local (`local:<ruta>` + el digest del lock), los backups
(`.pactlock/backups/<operation-id>/` con retención explícita) y la resolución de secretos (entorno,
después un archivo indicado explícitamente, después un prompt; nunca se persisten).

| Fase | Contenido | Puerta de salida |
|---|---|---|
| **C1: `build` sin escritura** | Modelo intermedio normalizado; `planBuild` con `create/update/merge/skip/remove/blocked`; `plan`/`emit` en el contrato, sin lógica por pares; costo, colisiones, secretos faltantes y componentes sin resolver en el plan; golden tests en tres plataformas. | Explica de forma determinista qué escribiría en Claude Code y Codex para las skills de un fixture, con toda la pérdida, y no modifica un byte. |
| **C2: skills, apply y rollback** | Resolución `local:`; `emit` de skills; validación contra traversal, symlinks y junctions; operación con ID, backup administrado, journal; `rollback --list` / `rollback <id>`; las licencias viajan; fault injection. | En un fixture, `import --mirror -> build -> --apply -> verify --strict -> rollback` termina limpio; el segundo `--apply` no produce cambios; el rollback devuelve el digest inicial. |
| **C3: resolución remota** | El lock separa `integrity` de `resolution`; Git por SHA, npm por versión exacta; nunca inventa un origen; cache por contenido; `verify` valida el lock sin red. | Dos máquinas con cache vacío obtienen el mismo árbol; una referencia sin pin falla antes de escribir. |
| **C4: reglas y merge no destructivo** | Bloques administrados con marcadores; el contenido humano se preserva byte a byte; `import` fusiona y conserva los `why`; absorbe `scripts/emit-docs.mjs`. | Las reglas humanas sobreviven a compilaciones repetidas; `CLAUDE.md`/`AGENTS.md` salen de `build`. |
| **C5: MCP con escritura** | Merge estructural de JSON y TOML; secretos solo en memoria durante `--apply`; capability-first con fallback declarado como pérdida. | Un MCP compila y revierte en ambos targets sin filtrar señuelos. |
| **C6: tercer runtime con `emit`** | Elegido por uso real; cero cambios en el núcleo; guía de conformance para adapters externos. | Entra con un archivo en `src/targets/`, su registro y sus tests. |

## Camino crítico

```text
Fase 0  migrar a pactlock + alinear + ADRs      (días)
  -> Fase 1  publicar: doctor + verify --strict + accept, en inglés, npm, Action, permisos
  -> Fase 2  corpus público + primer informe      (en paralelo: validación de demanda)
  -> Punto de decisión A  (~8 semanas después de publicar)
       default -> Fase 3  MCP en el contrato
               -> Fase 4  permisos y hooks como política  --> Punto de decisión B
               -> Fase 5  corpus continuo + producto de equipo
       con evidencia -> rama de compilación C1..C6
```

La fase 2 puede empezar apenas `doctor` sea estable, aunque la fase 1 no haya cerrado la
distribución. La rama de compilación nunca bloquea las fases 3 a 5.

## Política de pruebas

Cada cambio cubre, según corresponda:

- unitarias de schema, parsers y normalización;
- contract tests que corren contra **todos** los adapters registrados;
- golden tests de reportes JSON;
- end-to-end en un directorio temporal;
- la matriz Windows/macOS/Linux y Node mínimo/actual;
- fixtures con CRLF/LF, BOM, unicode, symlinks/junctions y permisos limitados, en `fixtures/` y no
  en `test/` (el runner ejecuta todo lo que hay bajo `test/`);
- secretos señuelo buscados en todos los artefactos producidos, **incluido el corpus**;
- los mensajes se testean por clave, no por texto, para que la CLI bilingüe no duplique tests;
- una extensión nueva en la allowlist del digest exige un bump del algoritmo y vectores nuevos;
- en la rama de compilación, además: fault injection, idempotencia (el segundo `--apply` no
  produce cambios) y reversibilidad (apply + rollback devuelve el digest del árbol inicial).

Una franja no está terminada mientras solo funcione el camino feliz.

## Definición de terminado del producto base

- `doctor` cuantifica costo, permisos y drift por target con incertidumbre explícita, en inglés,
  y se corre con `npx`;
- `import` adopta sin inventar intención para skills, MCP, permisos y hooks;
- `verify --strict` sirve como política de CI (GitHub Action incluida), evalúa la política de
  permisos y nunca corrige;
- `accept` autoriza cambios de a uno sin destruir metadata humana;
- Claude Code, Codex, Cursor y Gemini CLI se leen con el mismo contrato de adapters;
- existe al menos un informe público del corpus con su método;
- ningún secreto aparece en archivos, salidas, reportes ni en el corpus;
- la documentación pública describe solo lo que efectivamente funciona.

La compilación no forma parte del producto base; tiene su propia definición si la rama se activa.

## Próximo incremento concreto

**La fase 0 completa y el arranque de la fase 1:**

1. ejecutar la migración a pactlock (0-M) siguiendo el ADR 0001, y escribir el resto de los ADRs
   de la fase 0;
2. corregir el README (tagline, sin `build` como existente, relación con Snyk y los
   sincronizadores); `src/legacy/` ya está borrado;
3. agregar el check de permisos y arreglar el reporte de runtime vacío en `doctor` (solo lectura,
   bajo riesgo, alto valor de demo);
4. migrar los mensajes de la CLI a claves con inglés por default;
5. sumar Node 20.11 a la matriz de CI;
6. publicar `pactlock` en npm, junto con la GitHub Action, y anunciarlo con el primer
   post: el hallazgo del 74% sobre el propio repo.
