"""Phone review corrections: eliminate sheet bleed and make manager icons headshots."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
path = Path(__file__).with_name('premium-jobs.json')
jobs = json.loads(path.read_text(encoding='utf-8'))
trim = {'crest.redmere','crest.saltpine','crest.verrow','kit.home','object.club-bus',
        'object.football-elite','object.magnetic-board','object.report-folder',
        'object.medical-bag','object.streaming-desk','object.turnstile-ticket'}
for job in jobs:
    if job['key'] in trim and not job.get('isolationCropReviewed'):
        x,y,w,h=job['sourceRegion']
        job['sourceRegion']=[x+w*.04,y+h*.04,w*.92,h*.92]
        job['isolationCropReviewed']=True
    if job['key'] in {'object.football-elite','object.magnetic-board'} and not job.get('lowerEdgeReviewed'):
        job['sourceRegion'][3] *= .95
        job['lowerEdgeReviewed'] = True
    if job['key'].startswith('manager.'):
        job['cropRegions']={'thumb':[.22,0,.54,.38],'card':[.12,0,.76,.60]}
    if job['key'] in trim or job['key'].startswith('manager.'):
        (root/'artifacts/redesign'/f"{job['key'].replace('.', '-')}.json").write_text(json.dumps(job)+'\n',encoding='utf-8')
path.write_text(json.dumps(jobs,indent=2)+'\n',encoding='utf-8')
