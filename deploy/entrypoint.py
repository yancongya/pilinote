"""Initialize runtime defaults without replacing existing user configuration."""
import os
from pathlib import Path
import shutil
import sys


def initialize(runtime: Path, defaults: Path):
    for name in ('data', 'downloads', 'logs', 'temp', 'static/screenshots', 'term-bases'):
        (runtime / name).mkdir(parents=True, exist_ok=True)
    for source in defaults.glob('*.csv'):
        target = runtime / 'term-bases' / source.name
        if not target.exists():
            shutil.copyfile(source, target)


if __name__ == '__main__':
    initialize(Path(os.environ['PILINOTE_RUNTIME_DIR']), Path('/app/term-bases'))
    if len(sys.argv) < 2:
        raise SystemExit('Container command required')
    os.execvp(sys.argv[1], sys.argv[1:])
