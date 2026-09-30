import { active } from '../../targets/contract.js'
import { countTokens, countTokensFromBytes } from '../tokenize.js'

// Lo que cada runtime inyecta en cada arranque, antes de que la persona escriba
// una palabra. Es el titular del reporte y la razón por la que agregar
// herramientas puede empeorar al agente en vez de mejorarlo.
//
// El costo se calcula POR TARGET, nunca como un total sumado. Sumarlo entre
// runtimes contaba dos veces la misma skill instalada en los dos, y sumaba
// CLAUDE.md junto con AGENTS.md cuando una sesión carga uno solo. Nadie corre
// los dos a la vez: el número que importa es cuánto cuesta arrancar cada uno.
//
// Este check mide solo lo que se lee del disco. Los schemas de tools de los MCP
// servers —que suelen ser la porción más grande— requieren levantar cada server,
// y eso vive detrás de `--deep`. Lo que no se midió se declara: un total que
// dice ser completo y no lo es se descubre a la primera y arrastra la
// credibilidad de todo el reporte.
export default {
  id: 'static-cost',
  title: 'Costo de arranque',

  run({ snapshots, probes }) {
    const byTarget = snapshots
      .filter((snapshot) => snapshot.present)
      .map((snapshot) => costOf(snapshot, probes))
      .filter((entry) => entry.total > 0 || entry.unmeasured.length)

    return { cost: byTarget.length ? { byTarget } : null, findings: [] }
  }
}

function costOf(snapshot, probes) {
  const parts = []
  const unmeasured = []

  const rules = snapshot.objects.rule || []
  if (rules.length) {
    parts.push({
      label: 'reglas',
      tokens: rules.reduce((total, rule) => total + countTokensFromBytes(rule.bytes), 0),
      detail: rules.map((rule) => rule.id).join(', ')
    })
  }

  const skills = active(snapshot.objects.skill)
  if (skills.length) {
    parts.push({
      label: 'descripciones de skills',
      tokens: skills.reduce(
        (total, skill) => total + countTokens(`${skill.name || skill.id} ${skill.description}`),
        0
      ),
      detail: `${skills.length} skills`
    })
  }

  const agents = snapshot.objects.agent || []
  if (agents.length) {
    parts.push({
      label: 'descripciones de agentes',
      tokens: agents.reduce(
        (total, agent) => total + countTokens(`${agent.name || agent.id} ${agent.description}`),
        0
      ),
      detail: `${agents.length} agentes`
    })
  }

  const commands = snapshot.objects.command || []
  if (commands.length) {
    parts.push({
      label: 'comandos',
      tokens: commands.reduce((total, command) => total + countTokens(command.id), 0),
      detail: `${commands.length} comandos`
    })
  }

  // Solo los servers de ESTE target. La atribución sale sola de que cada
  // snapshot trae los suyos: de Codex solo se leen los del .codex/config.toml
  // del proyecto; los de la config de usuario no se ven y no se le imputan.
  const servers = snapshot.objects.mcp || []

  if (servers.length && !probes) {
    unmeasured.push({
      label: `schemas de ${servers.length} MCP servers`,
      reason: 'requiere levantar cada server: doctor --deep',
      items: servers.map((server) => server.id)
    })
  }

  if (servers.length && probes) {
    // El desglose por server importa tanto como el total: sin él, el número es
    // un reproche sin acción posible.
    const medidos = servers
      .map((server) => probes.find((probe) => probe.ok && probe.id === server.id))
      .filter(Boolean)

    if (medidos.length) {
      parts.push({
        label: 'schemas de herramientas MCP',
        tokens: medidos.reduce((total, probe) => total + probe.tokens, 0),
        detail: `${medidos.reduce((total, probe) => total + probe.count, 0)} herramientas en ${medidos.length} servers`,
        breakdown: medidos
          .map((probe) => ({ label: probe.id, tokens: probe.tokens, count: probe.count }))
          .sort((a, b) => b.tokens - a.tokens)
      })
    }

    for (const server of servers) {
      const probe = probes.find((entry) => entry.id === server.id)
      if (probe && !probe.ok) {
        unmeasured.push({ label: `schemas de ${server.id}`, reason: probe.reason })
      }
    }
  }

  return {
    target: snapshot.target,
    label: snapshot.label,
    total: parts.reduce((sum, part) => sum + part.tokens, 0),
    parts: parts.sort((a, b) => b.tokens - a.tokens),
    unmeasured
  }
}
