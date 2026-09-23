"""Admit reviewed generation job records, then run optimise-premium.py."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = Path(__file__).with_name('premium-jobs.json')
jobs = {job['key']: job for job in json.loads(path.read_text(encoding='utf-8'))}
for candidate in sorted((root / 'artifacts/redesign').glob('*.json'), key=lambda p: p.stat().st_mtime):
    record = json.loads(candidate.read_text(encoding='utf-8'))
    if isinstance(record, dict) and all(key in record for key in ('key', 'source', 'prompt', 'screens', 'kind', 'name')):
        jobs[record['key']] = record
path.write_text(json.dumps(list(jobs.values()), indent=2) + '\n', encoding='utf-8')
print(f'{len(jobs)} reviewed asset records')
