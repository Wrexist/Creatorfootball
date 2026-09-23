"""Add completed individual manager generations to the existing art pipeline.

Creative generation is separate. This step only preserves sources, crops, and
optimizes the approved outputs with the existing reproducible WebP pipeline.
"""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
incoming = json.loads((ROOT / 'artifacts/manager-cast-jobs.json').read_text(encoding='utf-8'))
expression_file = ROOT / 'artifacts/manager-expression-jobs.json'
if expression_file.exists():
    incoming += json.loads(expression_file.read_text(encoding='utf-8'))
path = ROOT / 'tools/brand/premium-jobs.json'
jobs = json.loads(path.read_text(encoding='utf-8'))
by_key = {job['key']: job for job in jobs}
source_dir = ROOT / 'artifacts/manager-art-sources'
source_dir.mkdir(parents=True, exist_ok=True)
for item in incoming:
    job = {k: v for k, v in item.items() if k not in ('id', 'expression')}
    source = Path(job['source'])
    target = source_dir / (job['name'] + '.png')
    shutil.copy2(source, target)
    job['generationSource'] = job['source']
    job['source'] = target.as_posix()
    by_key[job['key']] = job
path.write_text(json.dumps(list(by_key.values()), indent=2) + '\n', encoding='utf-8')
print(f'Added/updated {len(incoming)} character generations; original sources retained locally.')
