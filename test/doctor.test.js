import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runDoctor } from '../src/doctor/index.js'
import { renderReport } from '../src/doctor/report.js'

// Un proyecto de prueba con los problemas que doctor tiene que encontrar:
// drift entre runtimes, dos providers de navegador, un backup huérfano, una
// carpeta de skill sin SKILL.md y un server sin credencial.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pactlock-doctor-'))

  writeSkill(join(root, '.claude/skills/frontend-design'), 'Dirección visual y jerarquía.')
  writeSkill(join(root, '.claude/skills/webapp-testing'), 'Prueba la experiencia real.')
  writeSkill(join(root, '.claude/skills/ui-ux-pro-max'), 'Base de datos de diseño.')
  writeSkill(join(root, '.agents/skills/frontend-design'), 'Dirección visual y jerarquía.')

  mkdirSync(join(root, '.claude/skills/rota'), { recursive: true })
  mkdirSync(join(root, '.claude/skills/vieja.syntax-backup-2026-01-01'), { recursive: true })

  writeFileSync(
    join(root, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        'chrome-devtools': { command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
        playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
        figma: { command: 'npx', args: ['-y', 'figma-mcp'], env: { FIGMA_API_KEY: '' } }
      }
    })
  )

  writeFileSync(join(root, 'CLAUDE.md'), '# Reglas\n\nGit es del usuario.\n')
  writeFileSync(join(root, 'AGENTS.md'), '# Reglas\n\nGit es del usuario.\n')

  return root
}

function writeSkill(dir, description) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${dir.split(/[\\/]/).pop()}\ndescription: ${description}\n---\n\nCuerpo.\n`)
}

function findingsOf(report, checkId) {
  return report.checks.find((check) => check.id === checkId)?.findings || []
}

test('detecta las skills que están en un runtime y no en el otro', () => {
  const report = runDoctor(fixture())
  const findings = findingsOf(report, 'drift')
  const skills = findings.find((finding) => finding.message.includes('skills'))

  assert.ok(skills, 'esperaba un hallazgo de drift de skills')
  assert.deepEqual(skills.items, ['ui-ux-pro-max', 'webapp-testing'])
})

test('no reporta como drift lo que el runtime no sabe expresar', () => {
  // Codex no declara soporte de hooks ni permisos: su ausencia es una
  // limitación declarada, no un drift. Confundir las dos cosas llenaría el
  // reporte de ruido inaccionable.
  const report = runDoctor(fixture())
  const mensajes = findingsOf(report, 'drift').map((finding) => finding.message)

  assert.ok(!mensajes.some((mensaje) => mensaje.includes('hook')))
  assert.ok(!mensajes.some((mensaje) => mensaje.includes('permiso')))
})

test('detecta dos providers de la misma capability', () => {
  const report = runDoctor(fixture())
  const findings = findingsOf(report, 'providers')
  const navegador = findings.find((finding) => finding.message.includes('navegador'))

  assert.ok(navegador)
  assert.equal(navegador.severity, 'alta')
  assert.equal(navegador.items.length, 2)
})

test('marca la confianza cuando el solapamiento es parcial', () => {
  const report = runDoctor(fixture())
  const diseño = findingsOf(report, 'providers').find((finding) =>
    finding.message.includes('Criterio visual')
  )

  assert.ok(diseño)
  assert.equal(diseño.confidence, 'media')
  assert.equal(diseño.severity, 'media')
})

test('encuentra backups huérfanos, carpetas rotas y credenciales faltantes', () => {
  const report = runDoctor(fixture())
  const findings = findingsOf(report, 'orphans')

  assert.ok(findings.find((finding) => finding.message.includes('backups huérfanos')))
  assert.ok(findings.find((finding) => finding.message.includes('sin SKILL.md')))

  const credenciales = findings.find((finding) => finding.message.includes('sin credenciales'))
  assert.ok(credenciales)
  assert.ok(credenciales.items[0].includes('FIGMA_API_KEY'))
})

test('reconoce backups de pactlock y de SyntaX, y exige ignorar cada familia', () => {
  const root = fixture()
  mkdirSync(join(root, '.claude/skills/nueva.pactlock-backup-2026-09-24'), { recursive: true })

  const backupsDe = (gitignore) => {
    writeFileSync(join(root, '.gitignore'), gitignore)
    return findingsOf(runDoctor(root), 'orphans').find((finding) =>
      finding.message.includes('backups huérfanos')
    )
  }

  const soloViejos = backupsDe('*.syntax-backup-*\n')
  assert.deepEqual(soloViejos.items, [
    '.claude/skills/nueva.pactlock-backup-2026-09-24',
    '.claude/skills/vieja.syntax-backup-2026-01-01'
  ])
  assert.match(soloViejos.detail, /se commitean/, 'un .gitignore que cubre solo una familia no alcanza')

  assert.doesNotMatch(backupsDe('*.syntax-backup-*\n*.pactlock-backup-*\n').detail, /se commitean/)
})

test('el costo declara explícitamente lo que no midió', () => {
  const report = runDoctor(fixture())
  const claude = report.cost.byTarget.find((entry) => entry.target === 'claude-code')

  assert.ok(claude.total > 0)
  assert.equal(claude.unmeasured.length, 1)
  assert.match(claude.unmeasured[0].reason, /doctor --deep/)
})

test('el costo es por runtime y no suma lo que se instaló en los dos', () => {
  // Regresión: sumar los snapshots contaba dos veces la skill instalada en
  // ambos targets, y CLAUDE.md junto con AGENTS.md. Nadie corre los dos
  // runtimes a la vez; un titular inflado se descubre a la primera.
  const report = runDoctor(fixture())
  const claude = report.cost.byTarget.find((entry) => entry.target === 'claude-code')
  const codex = report.cost.byTarget.find((entry) => entry.target === 'codex')

  assert.equal(claude.parts.find((part) => part.label.includes('skills')).detail, '3 skills')
  assert.equal(codex.parts.find((part) => part.label.includes('skills')).detail, '1 skills')
  assert.equal(claude.parts.find((part) => part.label === 'reglas').detail, 'CLAUDE.md')
  assert.equal(codex.parts.find((part) => part.label === 'reglas').detail, 'AGENTS.md')
})

test('el reporte de pérdida sale del supports declarado, no de código por par', () => {
  const report = runDoctor(fixture())
  const codex = report.loss.find((entry) => entry.target === 'codex')

  assert.ok(codex)
  // La config MCP del proyecto viaja, pero Codex solo la carga si cada persona
  // marcó el proyecto como confiable: el reporte tiene que decirlo.
  assert.ok(codex.caveats.some((caveat) => caveat.kind === 'mcp' && /confiable/.test(caveat.note)))
})

test('doctor no escribe nada', () => {
  const root = fixture()
  const antes = snapshotTree(root)
  runDoctor(root)
  assert.deepEqual(snapshotTree(root), antes)
})

test('un proyecto sin ningún runtime no rompe el reporte', () => {
  const root = mkdtempSync(join(tmpdir(), 'pactlock-vacio-'))
  const report = runDoctor(root)

  assert.equal(report.environment.length, 0)
  assert.match(renderReport(report), /No se detectó ningún runtime/)
})

function snapshotTree(root) {
  return readdirSync(root, { recursive: true }).map(String).sort()
}

test('no reporta CLAUDE.md y AGENTS.md como drift: son la misma regla por runtime', () => {
  const report = runDoctor(fixture())
  const mensajes = findingsOf(report, 'drift').map((finding) => finding.message)

  assert.ok(!mensajes.some((mensaje) => mensaje.includes('archivo de reglas de')))
})

test('sí reporta un runtime que se quedó sin archivo de reglas', () => {
  const root = fixture()
  rmSync(join(root, 'AGENTS.md'))
  const report = runDoctor(root)

  const hallazgo = findingsOf(report, 'drift').find((finding) =>
    finding.message.includes('no tiene archivo de reglas')
  )
  assert.ok(hallazgo)
  assert.equal(hallazgo.severity, 'alta')
})
