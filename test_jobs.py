import requests

r = requests.get(
    "https://remotive.com/api/remote-jobs",
    params={"search": "python", "limit": 5},
    timeout=20,
)
r.raise_for_status()

for job in r.json()["jobs"]:
    print(job["title"], "|", job["company_name"], "|", job["url"])