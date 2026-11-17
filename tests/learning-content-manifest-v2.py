"""Current release contract; earlier 018/019 proposals remain archived."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('greetings-release.py')),run_name='__main__')
