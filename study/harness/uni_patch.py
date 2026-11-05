# Drop tsconfig project references whose directories aren't in the public repository.
import os, re
p = "tsconfig.json"; s = open(p).read()
def keep(m): return m.group(0) if os.path.exists(m.group(1)) else ""
s2 = re.sub(r'\{\s*"path":\s*"([^"]+)"\s*\},?\s*', keep, s)
s2 = re.sub(r',(\s*\])', r'\1', s2)
assert s2 != s; open(p, "w").write(s2)
