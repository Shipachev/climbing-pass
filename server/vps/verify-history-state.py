#!/usr/bin/python3
"""Verify a legacy history import without printing personal state."""
import json
from pathlib import Path
import sys


def compare(source, before, after):
    if not isinstance(source, list) or after.get('schemaVersion') != 2:
        raise ValueError('Unexpected history/state format')
    passes = []
    visits = []
    for item in source:
        pass_id = 'legacy-' + str(item['id'])
        passes.append({'id': pass_id, 'start': item['start'], 'end': item['end'],
                       'total': item['total'], 'status': item['status']})
        for index, date in enumerate(item['visits']):
            visits.append({'id': f'{pass_id}-visit-{index}', 'passId': pass_id, 'date': date})
    if after.get('passes') != passes or after.get('visits') != visits:
        raise ValueError('Imported IDs, dates, order, duplicate visits or pass fields differ from source')
    if before.get('programs'):
        for kind in ['programs', 'versions', 'drafts']:
            if before.get(kind) != after.get(kind):
                raise ValueError('Existing ' + kind + ' changed during import')
    return len(passes), len(visits)


def main():
    if len(sys.argv) != 4:
        raise SystemExit('Usage: verify-history-state.py source before-state after-state')
    source, before, after = [json.loads(Path(path).read_text()) for path in sys.argv[1:]]
    passes, visits = compare(source, before, after)
    print(f'History verified: {passes} passes, {visits} visits; IDs, dates, order and duplicate visits preserved. Existing programs preserved.')


if __name__ == '__main__':
    main()
