"""Offline output-quality screening. No model calls, credentials, or DB writes."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from title_output_quality import audit_pages, single_source_pages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-pages', type=Path)
    parser.add_argument('--frozen-cases', type=Path)
    parser.add_argument('--saved-proposals', type=Path)
    parser.add_argument('--pins', type=Path, required=True,
        help='JSON with a sources mapping of absolute input paths to SHA256')
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    if bool(args.source_pages) == bool(args.frozen_cases or args.saved_proposals):
        parser.error('Choose source-pages OR both frozen-cases and saved-proposals')
    if not args.source_pages and not (args.frozen_cases and args.saved_proposals):
        parser.error('Both frozen input files are required')
    pins = json.loads(args.pins.read_text())['sources']
    inputs = [p for p in [args.source_pages, args.frozen_cases, args.saved_proposals] if p]
    hashes = {str(p.resolve()): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
    for path, digest in hashes.items():
        if pins.get(path) != digest:
            raise ValueError('Input hash does not match its provenance pin: ' + path)
    if args.source_pages:
        pages = json.loads(args.source_pages.read_text())['pages']
    else:
        read = lambda p: [json.loads(line) for line in p.open() if line.strip()]
        pages = single_source_pages(read(args.frozen_cases), read(args.saved_proposals))
    report = audit_pages(pages)
    report['inputSha256'] = hashes
    args.output_dir.mkdir(parents=True, exist_ok=False)
    # A run writes new files only. Never overwrite an older audit.
    with (args.output_dir/'quality-report.json').open('x') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write('\n')
    with (args.output_dir/'quality-review-queue.csv').open('x', newline='') as f:
        fields = ['Finding ID', 'Check', 'Level', 'Source ID', 'O*NET description', 'Activity ID', 'Original title', 'Proposal ID', 'Proposed title', 'Explanation']
        writer = csv.writer(f); writer.writerow(fields)
        safe = lambda v: "'"+v if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')) else v
        for item in report['findings']:
            for p in item['proposals']:
                writer.writerow([safe(v) for v in [item['id'], item['kind'], item['level'], item['sourceId'], item['description'], p['activityId'], p['originalTitle'], p['proposalId'], p['title'], item['explanation']]])
    print(json.dumps({k:v for k,v in report.items() if k!='findings'}))


if __name__ == '__main__':
    main()
