"""Current release contract; earlier 018/019/020 proposals remain archived."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('pronouns-release.py')),run_name='__main__')
