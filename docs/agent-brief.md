# pactlock (ex SyntaX) — brief para agentes

Este bloque se genera desde `docs/agent-brief.md`, que es la **única fuente** de lo que leen
todos los runtimes. No lo edites en `CLAUDE.md` ni en `AGENTS.md`: se pisa y el test de drift
falla. Editá el brief y corré `npm run docs`.

## Qué es pactlock

**Lockfile y política para entornos de agente: qué capacidades tiene tu agente, cuánto cuestan,
y si son las que el equipo aceptó.**

Un entorno de agente (skills, MCP servers, reglas, agentes, hooks, permisos) queda declarado en
un manifest como **contrato de equipo** (`pactlock.yaml`), con su línea base de integridad en el
lock (`pactlock.lock`). pactlock responde tres preguntas, en este orden de prioridad:

1. **¿Es el entorno que acordamos?** `verify --strict` falla en CI cuando alguien derivó.
   Aceptar una capacidad nueva es una decisión explícita de una persona (`accept`), no una
   actualización de hash. **Este es el corazón del producto.**
2. **¿Qué puede hacer el agente?** Permisos amplios combinados con MCP que escriben, hooks que
   ejecutan código: mínimo privilegio para agentes.
3. **¿Cuánto cuesta?** `doctor` mide el costo de arranque en tokens por runtime. Es el gancho:
   gratis, solo lectura, una línea. No es el producto.

Compilar el entorno a cada runtime (`build`) es una **opción condicionada**, no el destino: se
construye solo si el punto de decisión A de `docs/implementation-plan.md` encuentra evidencia de
que alguien lo necesita. Hay al menos cinco herramientas que ya sincronizan configuración entre
runtimes (ver `docs/landscape.md`).

## Foco vigente: lo que no se hace

Antes de proponer o empezar trabajo, verificá que no cae en ninguna de estas. Si cae, no se hace
sin que el usuario lo decida explícitamente:

- **No es un sincronizador de configuración.** `agentsync`, `vsync`, `agents`, `agent-sync` y
  Plexus ya lo hacen. `build`/`emit` no se empiezan antes del punto de decisión A.
- **No es un escáner de contenido malicioso.** Detectar tool poisoning o prompt injection en
  descripciones es terreno de Snyk Agent Scan (ex mcp-scan). pactlock es complementario: Snyk
  dice si una herramienta es maliciosa; pactlock dice si el equipo corre lo que acordó y con qué
  permisos.
- **No compite solo en costo de tokens.** Hay varias herramientas de "context budget" para MCP.
  `doctor` es la puerta de entrada, no la tesis.
- **No es un catálogo ni un recomendador** (ver abajo, "Qué dejó de ser").
- **No es run-time.** Escribe archivos y se va; no observa ni corta ejecuciones del agente.
- **No es una UI.** Ningún visor web hasta que la CLI produzca datos que valga la pena explorar.
- **No suma runtimes con escritura.** Adapters nuevos entran **en modo lectura** (sirven a `doctor`
  y `verify`), no con `emit`.

Si una idea nueva no fortalece la pregunta 1 o la 2, o no hace que más gente pruebe `doctor`,
probablemente es derrape. Anotala en `docs/backlog.md` con su motivo en vez de construirla.

## Nombre: pactlock (ex SyntaX)

**El producto se llama `pactlock`** (`docs/adr/0001-nombre-pactlock.md`). SyntaX es el nombre
histórico: se conserva solo en las secciones de historia.

**Estado de la migración:** pasos 1 a 7 del ADR 0001 hechos (2026-09-29). El código, el binario,
los mensajes, los archivos del contrato y el algoritmo del digest dicen `pactlock`; el repo se
renombró en GitHub, la carpeta dejó de estar anidada, y el `grep` final solo encuentra menciones
deliberadas. Lo único que falta para cerrar la fase 0-M es su puerta de salida:
`pactlock verify --strict` limpio sobre este repo.

Reglas de la migración:

- **Se hace de una sola vez**, siguiendo el inventario y el orden del ADR 0001. Nunca un rename
  parcial (por ejemplo, el binario sí y los archivos del contrato no).
- **Sin compatibilidad con los nombres viejos:** no hay usuarios externos. La única excepción es
  que `doctor` sigue reconociendo los `*.syntax-backup-*` huérfanos del producto anterior.
- **El algoritmo del digest se renombra en la misma migración**, con vectores nuevos. Después de
  la primera publicación, los identificadores de algoritmo quedan congelados.
- Mover la carpeta y renombrar el repo en GitHub lo hace el usuario.

## Qué dejó de ser

Un buscador e instalador de skills. Esa tesis se abandonó: el catálogo lo ganan por volumen los
registries grandes y lo absorben los propios vendors. Si encontrás código de búsqueda en GitHub,
favoritos, recomendador por palabras clave o UI de kits, es residuo: se borra, no se extiende.
`src/legacy/` ya no existe — vivía ahí y se eliminó en la fase 0-A. Si `build` alguna vez se
activa, el `applyPlan` que necesita se recupera del historial de git.

## Los objetos universales

Ocho. Los cuatro últimos son los que rompen la portabilidad entre runtimes y por eso importan más
de lo que parece:

`Skill` · `MCP` · `Agent` · `Rule` · `Command` · `Hook` · `Permission` · `Env/Secret`

El manifest es **capability-first**: `capabilities` declara qué se necesita (control de
navegador), `components` declara cómo se cumple (`chrome-devtools-mcp`, con fallback a
`playwright-mcp`). Un target elige el provider que soporta en vez de fallar. La no-equivalencia
entre runtimes es el mecanismo del diseño, no un bug a tapar.

## Estado real

Implementado: `doctor` con cinco checks y `--deep` (levanta cada MCP server por stdio y mide los
tokens de sus schemas), el contrato de adapters, los adapters de Claude Code y Codex en modo
lectura, y la franja `import` + `verify` (con `--strict`) + `accept` para **skills**.

No implementado todavía: check de permisos, salida de la CLI en inglés, publicación en npm,
GitHub Action, MCP y demás objetos en el manifest, `build`, `rollback`, resolución de origen en
el lock, y el visor web de reportes.

Al describir el proyecto, no presentes como funcionando lo que está en la lista de no
implementado.

Antes de proponer trabajo nuevo, leé en este orden:

1. `docs/implementation-plan.md`: el orden vigente, las puertas de salida y los puntos de decisión.
   Si el trabajo no está en la fase actual, no se empieza sin que el usuario lo decida.
2. `docs/backlog.md`: deuda y riesgos, con el motivo por el que se dejaron pendientes. Es probable
   que la idea ya esté anotada ahí.
3. `docs/landscape.md`: qué ya existe afuera. Si otra herramienta lo resuelve bien, no se
   reconstruye.

## Las tres capas

Son distintas y no se mezclan. Confundirlas es el error más caro de este dominio:

| Capa | Archivo | Quién lo escribe | Responde |
|---|---|---|---|
| Observación | *(en memoria)* | los adapters, con `read()` | qué hay en disco |
| Contrato | `pactlock.yaml` | personas | qué queremos, y por qué |
| Integridad | `pactlock.lock` | la herramienta | la forma canónica de lo observado |

Un **digest** es integridad, no versión: responde *"¿esto cambió?"*, no *"¿qué versión es?"* ni
*"¿cómo lo reinstalo?"*. Tampoco es integridad byte a byte — normaliza finales de línea, BOM y
unicode de rutas, porque si no `verify` sería inservible en un equipo mixto. La spec completa, con
vectores de prueba, está en `docs/digest.md`.

Un **pin** es lo otro: origen y versión, para poder reinstalar lo mismo. Va en el manifest y
todavía no lo llena nadie.

## Reglas duras

- **Git es del usuario.** Nunca `git init`, `add`, `commit`, `push`, `reset` ni ninguna otra
  operación de git. El usuario maneja su historial.
- **Todo lo que escribe en un proyecto ajeno es reversible.** Backup antes de pisar, y el backup
  tiene que ser listable y revertible por un comando. Backups sueltos acumulándose en el repo del
  usuario es un bug, no una función.
- **Nada entra al registry sin verificar** que el repo existe, que el paquete resuelve y que la
  ruta de la skill es real. Un item que no se puede instalar de forma determinista no entra.
- **Los secretos nunca se escriben a disco.** Van como placeholder para que el usuario los
  complete; así no termina commiteando una clave.
- **Las licencias viajan con la skill.** Las skills de `anthropics/skills` son Apache 2.0, cuya
  sección 4(a) exige entregar copia de la licencia junto al trabajo. La copia recursiva arrastra
  el `LICENSE.txt` sola. Si alguna vez se copia selectivamente, hay que seguir llevándolo. Ver
  `docs/licensing.md`.
- **`import` observa; no infiere intención.** Adopta cada skill en los targets donde realmente
  está, y el primer `verify` sale limpio. Que la unión deba existir en todos los targets es una
  *política de convergencia*, no se deduce del disco: se pide con `--mirror` y queda escrita como
  `targetPolicy` en el manifest. La herramienta distingue "encontré esto" de "el equipo quiere
  esto" y nunca dice "supuse que el equipo quiere esto".
- **`verify` nunca corrige.** Aceptar drift tiene que ser una acción deliberada de una persona. Una
  herramienta que se autorepara esconde justo lo que vino a mostrar.
- **`doctor` no escribe nunca.** Eso no se negocia: es lo que permite correrlo en un repo ajeno
  sin pedir confianza. Por defecto tampoco lanza procesos; la única excepción es `--deep`, que
  ejecuta los comandos del `.mcp.json` auditado para medirlos. Por eso es opt-in, avisa antes, y
  la parte que ejecuta vive aislada en `src/doctor/probe.js`.
- **Los números del reporte se declaran con su incertidumbre.** El conteo de tokens va con `≈` y
  lo que no se midió se dice explícitamente. Un titular inflado destruye la credibilidad de todo
  el reporte, que es el activo del producto.

## Dónde está cada cosa

```
src/cli.js              dispatch de comandos
src/doctor/             checks, orquestación y reporte
src/targets/            contract.js + un adapter por runtime
src/manifest/           schema, parser restringido, digest, lock, escritura atómica
src/observe.js          la capa de observación, compartida por import y verify
src/import.js           observación -> contrato
src/verify.js           contrato vs. disco, con exit codes para CI
src/registry/           mapa capability -> providers
src/fs/                 utilidades de disco seguras
docs/implementation-plan.md  orden vigente, puertas de salida y puntos de decisión
docs/landscape.md       qué herramientas existen afuera y en qué se diferencia pactlock
docs/adr/               decisiones cerradas (0001: el nombre pactlock)
docs/backlog.md         pendientes, deuda y riesgos conocidos
docs/digest.md          spec del digest, con vectores de prueba
docs/direction.md       por qué se hizo cada cambio de rumbo, y el foco vigente
docs/licensing.md       análisis de licencias de skills
pactlock.yaml           el contrato de este propio repo (generado por import)
pactlock.lock           su línea base de integridad
```

## Cómo sumar un runtime

Es la extensión más frecuente y tiene que ser barata. Mientras `build` no exista, un runtime nuevo
entra **solo en modo lectura**: `detect`, `supports` y `read`, sin `emit`. Crear `src/targets/<id>.js` que exporte el
contrato de `src/targets/contract.js`: `id`, `label`, `detect(root)`, `supports` (declarado como
datos: qué objetos sabe expresar y en qué archivo o directorio), y `read(root)`. Registrarlo en
`src/targets/index.js`. El reporte de pérdida sale solo de `supports` — no se escribe código
específico por par de runtimes.
