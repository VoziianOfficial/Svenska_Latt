"""Current release contract; earlier 018/019/020 proposals remain archived."""
from pathlib import Path
import runpy
root=Path(__file__).resolve().parents[1]
release='noun-tables-release.py' if (root/'supabase/migrations/202611270024_noun_tables.sql').exists() else 'pronouns-release.py'
runpy.run_path(str(Path(__file__).with_name(release)),run_name='__main__')
