# Pendientes

Lo que quedó abierto, incluido lo sutil y lo que va a doler más adelante. Se escribe acá para que
no viva solo en la cabeza de quien lo notó.

Convención: **bloquea** = hay que resolverlo antes del próximo hito. **vigilar** = no urge, pero
empeora si se ignora.

---

## Identidad y publicación

| | Qué | Por qué importa |
|---|---|---|
| bloquea `npx` | **Nombre decidido: `pactlock`** (ADR 0001, 2026-09-23; `syntax` estaba tomado en npm). La migración del repo está hecha (fase 0-M, pasos 1 a 5); falta publicar. | Sin nombre publicable no hay `npx pactlock doctor`, y ese comando de una línea es todo el mecanismo de adopción del producto. |
| vigilar | **Path anidado `SyntaX/SyntaX`.** | Se resuelve en la migración (paso 6 de 0-M): el usuario mueve la carpeta a `C:\Proyectos GRANDES\pactlock` y renombra el repo en GitHub. |

## `doctor` — lo que le falta para ser el gancho

`--deep` ya está implementado: levanta cada server por stdio, pide `tools/list` y cuenta los
tokens de los schemas. En este repo el arranque pasó de ≈3.482 a ≈15.992 tokens — la parte que
faltaba era el 77% del total. Lo que queda:

| | Qué | Por qué importa |
|---|---|---|
| bloquea | **El tokenizador sigue siendo `chars/4`.** | Ahora pesa mucho más: los schemas son JSON, donde la aproximación subestima más. Los ≈15.992 son piso, no techo. Cambiarlo toca solo `src/doctor/tokenize.js`, pero hay que decidir tokenizador y modelo de referencia. |
| vigilar | **`--deep` no mide servers remotos (http).** Se declaran omitidos con su motivo. | Medirlos implica salir a la red con credenciales ajenas. Si se implementa, tiene que ser una decisión explícita de quien corre el comando, no el default. |
| vigilar | **La versión de protocolo MCP está fija en `2025-06-18`.** | Un server que solo hable una versión distinta puede rechazar el handshake y aparecer como caído sin serlo. Hay que probar contra servers viejos antes de confiar en ese diagnóstico. |
| vigilar | **`--deep` ejecuta comandos del repo auditado.** Avisa antes y está detrás del flag. | Si algún día `verify` corre en CI con `--deep`, eso significa ejecutar el `.mcp.json` de cada PR. Decisión de seguridad que hay que tomar a conciencia, no heredar por comodidad. |
| vigilar | **Runtime detectado pero vacío da un reporte inútil**: `sin objetos · ≈0 tokens · Sin hallazgos`. | Visto en un proyecto real. Debería decir por qué (`.claude/` existe pero no tiene skills ni MCP). |
| corregido 2026-09-27 | **Codex sí tiene config MCP de proyecto.** Se afirmaba (README, `supports` del adapter, test) que era solo de usuario. Codex carga `.codex/config.toml` del proyecto si el proyecto está marcado como confiable, y le suma la config de usuario. Corregidos el `supports`, el test y la prosa del README; la salida de ejemplo del README se recaptura en la fase 1. | Un hallazgo falso publicado destruye la credibilidad del reporte. Lección: cada afirmación sobre un runtime lleva fecha y fuente en `landscape.md`, porque los runtimes cambian rápido. |
| vigilar | **Sin check de permisos.** El objeto `permission` se lee pero nadie lo evalúa. | Un `allow` amplio junto a MCPs con capacidad de escritura es el hallazgo con consecuencias de seguridad, y es de los pocos que nadie más va a mostrar. |
| vigilar | **Exit code siempre 0.** | Deliberado hasta que exista `verify --strict`. Anotado para que nadie lo "arregle" antes de tiempo. |
| vigilar | **Los fixtures de test viven en `fixtures/`, fuera de `test/`.** | El runner de Node ejecuta *todo* lo que hay bajo `test/`, así que un fixture que espera stdin cuelga la suite entera. Ya pasó una vez. Si alguien agrega fixtures, van en `fixtures/`. |

## El registry de capabilities — el riesgo de repetir el error viejo

**`src/registry/capabilities.js` está curado a mano.** Es exactamente la mecánica que abandonamos:
alguien tiene que mantenerlo, y cubre solo lo que ya conoce. Hoy detecta tres colisiones porque
conoce esos providers; un equipo con otras herramientas no recibe ningún hallazgo.

Dos salidas, y hay que elegir antes de que el archivo crezca:

1. **Derivarlo del uso.** Cada `doctor` que corre aporta qué componentes conviven. La colisión se
   infiere en vez de declararse. Es el activo del que habla `direction.md`, pero requiere
   telemetría — decisión de producto, no técnica.
2. **Detectar solapamiento sin registry.** Comparar descripciones de skills entre sí y nombres de
   tools entre servers. Generaliza a componentes desconocidos, a costa de más falsos positivos.

Mientras tanto: **no engordar el archivo a mano más allá de lo que se verifica.** Si crece a
cincuenta entradas curadas, volvimos al catálogo.

**Decidido (2026-09-23):** la salida 1 se hace sin telemetría, con el corpus de repos públicos de
la fase 2 del plan; la salida 2 la complementa donde el corpus no alcanza.

## Correcciones a entradas anteriores de este backlog

**Un primer diseño de `accept` aceptaba demasiado.** Trataba `modified` y `unexpected` como "bajo
riesgo" y los aceptaba en una corrida a ciegas. Está mal: un `unexpected` es una capacidad
ejecutable nueva para el agente, y aceptarlo es **establecer confianza**, no actualizar
información. Además "es reversible" solo vale si está en git — pisar el digest del lock no lo es
por sí mismo. De ahí que `accept` sea interactivo, que no exista un `--all` genérico, y que la
acción se nombre en vez de inferirse del estado.

**Se prometía atomicidad que no existía.** `writeAllAtomic` hace dos renames: cada uno es atómico,
los dos juntos no son una transacción. El comentario decía "los dos archivos o ninguno" y era
falso. Ahora se promete lo que sí se cumple —interrupción detectable, con journal y
`manifestDigest`— y el comentario del código lo dice.

**Digest ≠ pin.** Una versión previa de este documento describía el digest como sustituto del pin.
Está mal y ordenarlo cambió el diseño: un digest es **integridad** (*"¿esto cambió?"*), un pin es
**origen y versión** (*"¿cómo reinstalo lo mismo?"*). Confundirlos dejaría a un equipo convencido
de tener reproducibilidad cuando lo que tiene es detección de manipulación. Están en archivos
distintos a propósito: pin en `pactlock.yaml`, digest en `pactlock.lock`.

**El digest tampoco es integridad byte a byte.** Normaliza EOL, BOM y unicode de rutas, así que dos
árboles con bytes distintos pueden dar el mismo valor. Es deliberado —sin eso `verify` no serviría
en un equipo mixto— pero hay que decirlo así y no prometer los bytes exactos. Ver `digest.md`.

**El costo se sumaba entre runtimes.** `static-cost` hacía `flatMap` sobre todos los snapshots:
contaba 12 skills donde la unión real son 9, y sumaba `CLAUDE.md` junto con `AGENTS.md`. El titular
de ≈15.992 tokens estaba inflado por sumar dos entornos que nunca corren a la vez. Corregido: el
costo es por target. El número real de Claude Code es ≈14.887 y el de Codex ≈2.145.

## Contrato y manifest — deuda antes de `build`

| | Qué | Por qué importa |
|---|---|---|
| bloquea `build` | **`emit` no está implementado en ningún adapter.** Solo existe `read`. | El `supports` declarativo produce el reporte de pérdida, pero esa derivación nunca se ejerció contra una compilación real. La afirmación de que "migrar entre N runtimes no cuesta N²" está sin probar. |
| bloquea `build` | **El adapter de Codex lee TOML con una expresión regular.** | Alcanza para contar y comparar. Para *escribir* `config.toml` hace falta un parser de verdad. |
| bloquea `build` | **`mode: 'merge-markdown'` está declarado y no implementado.** | ¿Qué pasa cuando el proyecto ya tiene un `CLAUDE.md` escrito por una persona? Pisarlo es inaceptable. Los marcadores de `emit-docs.mjs` son una respuesta posible, pero hay que decidirlo. |
| bloquea `build` | **Los secretos no tienen mecanismo de resolución.** El schema exige `${secret}`, pero nadie define de dónde sale el valor: ¿`.env`? ¿keychain del sistema? ¿prompt interactivo? | Es la causa más común de instalación fallida y no está diseñado. |
| bloquea `accept` | **No existe el comando para actualizar la línea base.** Hoy la única forma de aceptar drift es `import --force`, que reescribe el manifest entero y pierde los `why`. | Aceptar drift tiene que ser deliberado *y* quirúrgico. Está nombrado (`accept`) para que no se invente otra cosa después. |
| vigilar | **`import` crea pero no fusiona.** Con `--force` se pierde todo lo escrito a mano, `why` incluido. | Es el mismo problema de `merge-markdown` en otra forma. Hasta que exista el merge, conviene no tocar el manifest a mano si se va a reimportar. |
| vigilar | **`scripts/emit-docs.mjs` es un segundo pipeline de compilación.** | Cuando `build` exista, tiene que absorberlo. Si no, quedan dos formas de generar documentación y van a divergir — el problema que el script existe para evitar. |

## `accept` y el lock — lo que quedó abierto

| | Qué | Por qué importa |
|---|---|---|
| vigilar | **`allowDivergence` es una lista de targets, no un modelo de variantes.** La solución de fondo sería que cada variante tenga identidad propia. | Con la lista, una divergencia entre otros targets sigue reportándose, que era el agujero del booleano. Pero seguimos sin poder decir *en qué* se diferencian legítimamente. |
| vigilar | **El lock creció bastante** con el inventario por archivo: `canvas-design` sola aporta decenas de entradas. | Se asumió a cambio de que `accept` pueda decir qué cambió. Si el archivo se vuelve incómodo de revisar, la salida es un formato más compacto, no volver a un digest ciego. |
| vigilar | **`import --relock` bendice lo que coincide.** Solo rehace las entradas cuyo digest no cambió; las que difieren conservan el digest viejo para que `verify` las siga reportando. | La frontera de confianza se sostiene, pero es una ruta que hay que revisar cada vez que se toque el formato del lock. |

## La franja de skills — lo que quedó afuera

`import` y `verify` cubren skills. Antes de extenderlos:

| | Qué | Por qué importa |
|---|---|---|
| bloquea MCP | **Sanitización antes de serializar.** El manifest se commitea; serializar un `.mcp.json` tal cual escribiría credenciales en él. | Hoy la franja lo esquiva porque las skills no llevan `env`. Es lo primero a diseñar cuando entren los MCP. |
| vigilar | **"Las skills no tienen secretos" es un matiz, no un absoluto.** Una skill puede tener credenciales hardcodeadas en cualquier archivo. | La franja no serializa su contenido, así que el riesgo es bajo — pero hay que seguir sin imprimir contenido ni rutas sensibles en los reportes. |
| vigilar | **La evidencia multiplataforma recién existe cuando CI corra.** Está el workflow y está `scripts/report-eol.mjs`, que dice qué finales de línea recibió cada runner en vez de suponerlos. | Hasta el primer verde en las tres plataformas, el determinismo del digest sigue siendo una promesa. En esta máquina Windows el checkout llega con CRLF y `verify` pasa, así que hay evidencia parcial. |
| vigilar | **Una extensión nueva en la allowlist del digest cambia los digests de ese formato.** | Exige bump del nombre del algoritmo y actualizar los vectores de `docs/digest.md`. Está escrito allá, pero es fácil de pasar por alto en un PR chico. |

## Legacy — cerrado el 2026-09-29

**`src/legacy/` no tenía fecha de vencimiento.** Su condición de borrado era que `build` portara
el `applyPlan` de `apply-plan.mjs`, pero `build` ahora es condicional, así que esa condición podía
no cumplirse nunca. **Decidido (2026-09-23) y hecho (2026-09-29):** borrado en la fase 0-A.

Nada en `src/` lo importaba, así que el borrado no tocó ningún camino de ejecución. Si la rama de
compilación se activa, `applyPlan` se recupera del historial de git: ahí está la única copia, y es
a propósito. El módulo tampoco tenía tests —se recortaron al migrar—, así que no había red que
avisara si alguien lo tocaba; una razón más para no dejarlo.

## Proceso y equipo

| | Qué | Por qué importa |
|---|---|---|
| vigilar | **CI corre en Node 22 solamente.** `engines` dice `>=20.11`. | O se prueba el piso declarado, o se sube el piso. Hoy la declaración no está respaldada. |
| vigilar | **La extensibilidad del contrato está sin probar.** Hay dos adapters y los escribió la misma persona el mismo día. | La afirmación "sumar un runtime es barato" recién se verifica cuando alguien más escriba el tercero sin tocar el núcleo. Hasta entonces es una hipótesis de diseño. |
| vigilar | **El `.mcp.json` de este repo mantiene la colisión de navegador a propósito**, igual que el drift entre `.claude/skills` y `.agents/skills`. | Es el fixture del dogfood. Está anotado en `AGENTS.md` para que nadie lo "arregle" en silencio y nos deje sin caso de demo. |
| vigilar | **La sección propia de cada runtime en `emit-docs.mjs` es una semilla, no una plantilla.** Solo se escribe cuando el archivo no existe; después, todo lo que está fuera de los marcadores se respeta. Editar el array `specific` no actualiza el `CLAUDE.md` que ya está en disco, y `--check` tampoco lo nota, porque solo compara el bloque entre marcadores. | Pasó el 2026-09-29 con la ruta del proyecto: se editó la semilla, `docs:check` dio verde y el archivo vivo seguía viejo. El paso 6 del ADR 0001 dice "actualizar la ruta en `scripts/emit-docs.mjs`" y por eso es engañoso: hay que tocar los dos. Que lo de afuera sea de la persona es correcto; lo que falta es que la divergencia entre semilla y archivo vivo se vea. |

## Idioma

**Decidido (2026-09-23): la CLI pasa a inglés por default**, con español disponible, y los tests
hacen match por clave de mensaje (ADR de idioma, fase 0; migración en la fase 1). La
documentación interna puede seguir en castellano. Lo que sigue es el contexto anterior.

El README está en inglés y el resto —CLI, `agent-brief`, `direction`, `digest`, este archivo— en
castellano. Es una incoherencia deliberada: sostenible mientras el equipo sea hispanohablante y el
público de afuera solo lea el README.

Los ejemplos de salida del README quedan en castellano porque son salida real; traducirlos
mostraría algo que la herramienta no imprime. Si en algún momento se quiere coherencia completa,
la decisión de fondo es **traducir la salida de la CLI**, y eso arrastra los tests, que hacen match
sobre los mensajes.

## Riesgos de producto

No son tareas, son cosas que hay que mirar de vez en cuando. El argumento completo está en
[`direction.md`](direction.md).

- **Convergencia.** `AGENTS.md` ya se estandarizó entre vendors. Si skills y MCP convergen
  también, la capa de traducción pierde razón de ser. La apuesta es que hooks, permisos y
  workflows no van a converger, porque ahí está la diferenciación de cada vendor. Si empiezan a
  converger, hay que replantear.
- **El comprador.** El individuo no paga por esto; paga un equipo que necesita entornos auditables
  entre editores distintos. `verify` ya existe; ahora la pieza cara que hay que validar antes de
  construir es `build` (punto de decisión A del plan).
- **Nada recolecta el activo todavía.** La matriz de compatibilidad y el corpus de fallas son lo
  que compone, y hoy cada `doctor` que corre se pierde. **Asignado:** fase 2 del plan, con un corpus
  de repos públicos y sin telemetría.
- **El mercado se movió.** Hay sincronizadores, medidores de costo y Snyk Agent Scan (ver
  `landscape.md`). Revisar ese archivo en cada punto de decisión.
