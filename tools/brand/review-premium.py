"""Validate shipped crops and build contact sheets at phone display sizes."""
import hashlib, json, math
from pathlib import Path
from collections import Counter
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
out = root / 'artifacts/redesign/asset-review'
out.mkdir(parents=True, exist_ok=True)
records = json.loads((root / 'apps/game/src/design/art/premium-assets.json').read_text(encoding='utf-8'))
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 12)
errors = []
for record in records:
    for crop, variant in record['variants'].items():
        path = root / 'apps/game/public' / variant['src'].lstrip('/')
        with Image.open(path) as image:
            if image.size != (variant['width'], variant['height']): errors.append(f"{record['key']} {crop}: size mismatch")
        if hashlib.sha256(path.read_bytes()).hexdigest() != variant['sha256']: errors.append(f"{record['key']} {crop}: hash mismatch")
        if crop == 'thumb' and variant['bytes'] > 20000: errors.append(f"{record['key']}: thumbnail over 20 KB")
ordered = sorted(records, key=lambda r: (r['kind'], r['key']))
for start in range(0, len(ordered), 30):
    batch = ordered[start:start+30]
    canvas = Image.new('RGB', (1200, math.ceil(len(batch)/6)*200), '#101713')
    draw = ImageDraw.Draw(canvas)
    for i, record in enumerate(batch):
        x,y = (i%6)*200, (i//6)*200
        size = (96,96) if record['kind'] in ('character','crest','trophy') else (180,120) if record['kind'] in ('environment','story','ambience') else (140,140)
        variant = record['variants']['thumb' if size[0] == 96 else 'card']
        with Image.open(root / 'apps/game/public' / variant['src'].lstrip('/')) as image:
            image.thumbnail(size, Image.Resampling.LANCZOS)
            canvas.paste(image,(x+(200-image.width)//2,y+8))
        draw.text((x+6,y+160),record['key'],font=font,fill='#e7eee1')
        draw.text((x+6,y+177),f"{size[0]} x {size[1]} display",font=font,fill='#a3b09b')
    canvas.save(out / f'contact-{start//30+1}.png')
report = {'assets':len(records),'crops':len(records)*3,'byKind':dict(Counter(r['kind'] for r in records)),
          'bytes':sum(v['bytes'] for r in records for v in r['variants'].values()),'errors':errors,
          'runtime3DModels':0,'review':'Contact sheets use real phone-scale display sizes; inspect separately from validation.'}
(out / 'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
if errors: raise SystemExit(1)
