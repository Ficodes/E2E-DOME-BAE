"""Build self-contained E2E plugins; no dependencies beyond Python's stdlib."""
import json
import sys
import zipfile
from pathlib import Path


def build(destination, run_id, domain, requires_file, version, purpose):
    name = f"E2E {purpose} {domain} {'file' if requires_file else 'form'} {run_id}"
    plugin_id = name.lower().replace(" ", "-")
    manifest = {
        "name": name, "type": domain, "author": "DOME E2E",
        "version": version, "module": "fixture.Handler",
        "requires_file": requires_file, "media_types": ["text/plain"] if requires_file else [],
        "overrides": [], "pull_accounting": False,
        "form_order": ["display_name", "region", "enabled", "notes", "reference"],
        "form": {
            "display_name": {"type": "text", "label": "Display name", "mandatory": True},
            "region": {"type": "select", "label": "Region", "mandatory": True,
                       "default": "eu", "options": [{"text": "Europe", "value": "eu"},
                                                       {"text": "United States", "value": "us"}]},
            "enabled": {"type": "checkbox", "label": "Enabled", "mandatory": True, "default": False},
            "notes": {"type": "textarea", "label": "Notes", "default": "Fixture notes"},
            "reference": {"type": "text", "label": "Optional reference"},
        },
    }
    # Locks protect complete JSON records across Gunicorn workers. Records are
    # scoped by run, then filtered by plugin/entity in Cypress (never globally reset).
    source = '''import fcntl
import json
import time
from pathlib import Path
from wstore.asset_manager.resource_plugins.plugin import ServicePlugin, ResourcePlugin
from wstore.asset_manager.resource_plugins.plugin_error import PluginError

RUN_ID = %r
PLUGIN_ID = %r
VERSION = %r
DOMAIN = %r
ROOT = Path('/tmp/bae-e2e-plugins-' + RUN_ID)

def serialize(value):
    if isinstance(value, dict) or isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return {key: str(getattr(value, key)) for key in
            ('id', 'pk', 'name', 'actor_id', 'product_id', 'item_id') if hasattr(value, key)}

def hook(method):
    def invoke(self, *args):
        documents = [arg for arg in args if isinstance(arg, dict)]
        failure_path = Path(str(ROOT) + '.failure.json')
        failure = json.loads(failure_path.read_text()) if failure_path.exists() else {}
        rejected = (failure.get('pluginId') == PLUGIN_ID and failure.get('hook') == method
                    and (not failure.get('entityName') or any(
                        doc.get('name') == failure['entityName'] for doc in documents)))
        event = {'pluginId': PLUGIN_ID, 'version': VERSION, 'hook': method,
                 'time': time.time_ns(), 'rejected': rejected,
                 'args': [serialize(arg) for arg in args]}
        with open(str(ROOT) + '.jsonl', 'a') as output:
            fcntl.flock(output, fcntl.LOCK_EX)
            output.write(json.dumps(event, default=str) + '\\n')
            output.flush()
        if rejected:
            raise PluginError('E2E deliberate rejection: ' + method)
    return invoke

class Handler(ServicePlugin if DOMAIN == 'service' else ResourcePlugin):
    pass

for entity in (DOMAIN + '_spec', 'product_spec', 'product_offering'):
    for phase in ('pre', 'post'):
        for operation in ('creation', 'update'):
            method = 'on_' + phase + '_' + entity + '_' + operation
            setattr(Handler, method, hook(method))
for event in ('activation', 'termination'):
    method = 'on_' + DOMAIN + '_' + event
    setattr(Handler, method, hook(method))
''' % (run_id, plugin_id, version, domain)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    path = destination / f"{plugin_id}-{version}.zip"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("package.json", json.dumps(manifest))
        archive.writestr("fixture.py", source)
    return {"id": plugin_id, "name": name, "type": domain,
            "version": version, "requiresFile": requires_file, "path": str(path)}


if __name__ == "__main__":
    options = json.loads(sys.argv[1])
    print(json.dumps(build(**options)))
