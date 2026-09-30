# Licencias de skills

Leer antes de tocar cualquier código que copie skills. Este análisis venía en la cabecera de
`src/lib/install.js` y se conserva textualmente porque sigue siendo correcto y es fácil de romper
sin darse cuenta.

## La cadena de redistribución

El instalador del producto anterior (SyntaX; el código se borró, queda en el historial de git) no
redistribuía nada por sí mismo: clonaba desde el repo original y la copia ocurría en la máquina
del usuario. El análisis sigue vigente porque `build`, si alguna vez existe, hereda el problema.

Pero ese usuario después normalmente commitea `.claude/skills/` o `.agents/skills/` en su propio
repo. **Ahí sí redistribuye**, y la obligación de licencia pasa a ser suya. La herramienta tiene
que dejarlo cubierto sin que se entere.

## Apache 2.0, sección 4(a)

Las skills de `anthropics/skills` son Apache 2.0. La sección 4(a) exige entregar una copia de la
licencia junto con el trabajo redistribuido.

Cada carpeta de skill trae su `LICENSE.txt`, así que **la copia recursiva lo arrastra sola** y el
usuario queda cubierto sin hacer nada.

## La regla que hay que sostener

Si alguna vez se cambia la copia recursiva por algo más selectivo —copiar solo `SKILL.md`,
filtrar archivos "innecesarios", excluir binarios o fuentes para bajar el peso— **hay que seguir
llevando `LICENSE.txt` sí o sí**.

Es exactamente el tipo de optimización que parece inofensiva (`canvas-design` arrastra decenas de
fuentes `.ttf`) y que rompe el cumplimiento de licencia de todos los usuarios de golpe.

## Al sumar componentes al registry

Registrar la licencia de cada item y verificar que sea OSS antes de incluirlo. Un componente cuya
licencia no se puede determinar no entra: no hay forma de garantizarle al usuario que su
redistribución posterior es legal.
