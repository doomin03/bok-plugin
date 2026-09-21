"""Read owner-maintained docs/comparison-targets.json without modifying donor projects."""
import json
from pathlib import Path


def load_targets(filename):
    filename = Path(filename).resolve()
    config = json.loads(filename.read_text(encoding='utf-8-sig'))
    targets = config.get('targets')
    if not isinstance(targets, list) or not targets:
        raise ValueError('Owner must specify at least one comparison target in docs/comparison-targets.json')
    result = {}
    for target in targets:
        identity = target.get('id')
        if not isinstance(identity, str) or not identity.strip() or identity in result:
            raise ValueError('Comparison target IDs must be unique non-empty strings')
        for field in ('projectPath', 'description'):
            if not isinstance(target.get(field), str) or not target[field].strip():
                raise ValueError(f'{identity}: owner must supply {field}')
        root = (filename.parent / target['projectPath']).resolve()
        if not root.is_dir():
            raise ValueError(f'{identity}: projectPath does not exist: {root}')
        sources = target.get('sourcePaths')
        if not isinstance(sources, list) or not sources:
            raise ValueError(f'{identity}: sourcePaths must name existing source files or directories')
        resolved = []
        for value in sources:
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f'{identity}: invalid sourcePaths entry')
            source = (root / value).resolve()
            if not source.is_relative_to(root) or not source.exists():
                raise ValueError(f'{identity}: source path missing or outside project: {value}')
            resolved.append(str(source))
        result[identity] = {**target, 'projectPath': str(root), 'sourcePaths': resolved,
                            'configPath': str(filename)}
    return result
