import subprocess
import os
import sys

# Clean proxy env vars so subprocess doesn't route traffic through the sandbox proxy
for var in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']:
    if var in os.environ:
        del os.environ[var]

# Run gcloud command to get the logs
cmd = [
    "gcloud", "logging", "read",
    "resource.type=cloud_run_revision AND resource.labels.service_name=dangiola-app",
    "--limit=50",
    "--format=value(textPayload)"
]

print("Fetching Cloud Run logs...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:")
print(res.stdout)
print("STDERR:")
print(res.stderr)
print("Exit code:", res.returncode)
