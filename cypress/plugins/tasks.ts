import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

export function pluginTasks() {
  const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const destination = path.resolve('cypress/.plugins', runId)
  mkdirSync(destination, { recursive: true })
  const container = process.env.BAE_E2E_CHARGING_CONTAINER || 'charging-docker-charging-1'
  const python = process.env.BAE_E2E_PYTHON || 'python3'
  // The charging image installs Django and its dependencies into Python 3.9,
  // while Ubuntu's unrelated system python3 may also be present.
  const chargingPython = process.env.BAE_E2E_CHARGING_PYTHON || 'python3.9'

  function run(command: string, args: string[], input?: Buffer): string {
    const result = spawnSync(command, args, { input, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 })
    if (result.error || result.status !== 0) {
      throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout}`)
    }
    return result.stdout.trim()
  }
  function docker(script: string, input?: Buffer) {
    return run('docker', ['exec', '-i', container, chargingPython, '-c', script], input)
  }

  function manage(args: string[], input?: Buffer) {
    return docker(`import pathlib, subprocess, sys
candidates = [pathlib.Path.cwd() / 'manage.py', pathlib.Path.cwd() / 'src/manage.py',
 pathlib.Path('/business-ecosystem-charging-backend/src/manage.py'),
 pathlib.Path('/opt/business-ecosystem-charging-backend/src/manage.py')]
entry = next((p for p in candidates if p.is_file()), None)
if entry is None: raise RuntimeError('Cannot locate charging manage.py; check container working directory')
subprocess.run([sys.executable, str(entry)] + ${JSON.stringify(args)}, cwd=str(entry.parent), check=True)
`, input)
  }

  return {
    'plugins:build'(options: { domain: 'service' | 'resource'; requiresFile: boolean; version?: string; purpose?: string }) {
      return JSON.parse(run(python, ['cypress/plugins/fixture.py', JSON.stringify({
        destination, run_id: runId, domain: options.domain, requires_file: options.requiresFile,
        version: options.version || '1.0', purpose: options.purpose || 'journey'
      })]))
    },
    // Fixture setup uses the real CLI, independently of the administration UI test.
    'plugins:install'(file: string) {
      if (!file.startsWith(destination + path.sep)) throw new Error('Expected a generated plugin fixture')
      docker(`import pathlib, subprocess, sys, tempfile
candidates = [pathlib.Path.cwd() / 'manage.py', pathlib.Path.cwd() / 'src/manage.py',
 pathlib.Path('/business-ecosystem-charging-backend/src/manage.py'),
 pathlib.Path('/opt/business-ecosystem-charging-backend/src/manage.py')]
manage = next((p for p in candidates if p.is_file()), None)
if manage is None: raise RuntimeError('Cannot locate charging manage.py; check container working directory')
with tempfile.NamedTemporaryFile(suffix='.zip') as package:
 package.write(sys.stdin.buffer.read()); package.flush()
 subprocess.run([sys.executable, str(manage), 'loadplugin', package.name], cwd=str(manage.parent), check=True)
`, readFileSync(file))
      return null
    },
    'plugins:events'() {
      return JSON.parse(docker(`import json, pathlib, fcntl
p = pathlib.Path('/tmp/bae-e2e-plugins-${runId}.jsonl')
if p.exists():
 with p.open() as source:
  fcntl.flock(source, fcntl.LOCK_SH)
  print(json.dumps([json.loads(line) for line in source if line.strip()]))
else: print('[]')`))
    },
    'plugins:pending'(productId: string) {
      const output = manage(['shell', '-c', `from wstore.ordering.models import PendingTermination; print(PendingTermination.objects.filter(product_id=${JSON.stringify(productId)}).count())`])
      const count = Number(output.split('\n').pop())
      if (!Number.isFinite(count)) throw new Error(`Cannot read pending termination count: ${output}`)
      return count
    },
    'plugins:recover'() {
      manage(['retry_pending_terminations'])
      return null
    },
    'plugins:fail'(failure: { pluginId: string; hook: string; entityName?: string } | null) {
      docker(`import json, pathlib, os
p = pathlib.Path('/tmp/bae-e2e-plugins-${runId}.failure.json')
temporary = p.with_suffix('.new')
temporary.write_text(${JSON.stringify(JSON.stringify(failure || {}))})
os.replace(temporary, p)`)
      return null
    }
  }
}
