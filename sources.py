import requests

HEADERS = {"User-Agent": "job-hunter-agent/0.1"}


def from_remotive():
    r = requests.get("https://remotive.com/api/remote-jobs", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return [
        {
            "id": f"remotive-{j['id']}",
            "source": "Remotive",
            "title": j.get("title", ""),
            "company": j.get("company_name", ""),
            "url": j.get("url", ""),
            "description": j.get("description", ""),
            "tags": j.get("tags", []),
        }
        for j in r.json()["jobs"]
    ]


def from_arbeitnow():
    r = requests.get("https://www.arbeitnow.com/api/job-board-api", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return [
        {
            "id": f"arbeitnow-{j['slug']}",
            "source": "Arbeitnow",
            "title": j.get("title", ""),
            "company": j.get("company_name", ""),
            "url": j.get("url", ""),
            "description": j.get("description", ""),
            "tags": j.get("tags", []) + j.get("job_types", []),
        }
        for j in r.json()["data"]
    ]


def from_remoteok():
    r = requests.get("https://remoteok.com/api", headers=HEADERS, timeout=30)
    r.raise_for_status()
    # the first item is a legal notice, not a job, so skip anything without "position"
    return [
        {
            "id": f"remoteok-{j['id']}",
            "source": "RemoteOK",
            "title": j.get("position", ""),
            "company": j.get("company", ""),
            "url": j.get("url", ""),
            "description": j.get("description", ""),
            "tags": j.get("tags", []),
        }
        for j in r.json()
        if "position" in j
    ]


def fetch_all():
    jobs = []
    for name, fn in [
        ("Remotive", from_remotive),
        ("Arbeitnow", from_arbeitnow),
        ("RemoteOK", from_remoteok),
    ]:
        try:
            got = fn()
            print(f"{name}: {len(got)} jobs")
            jobs += got
        except Exception as e:
            print(f"{name}: failed - {str(e)[:100]}")
    return jobs


if __name__ == "__main__":
    all_jobs = fetch_all()
    print("Total:", len(all_jobs))
    for j in all_jobs[:3]:
        print(j["source"], "|", j["title"], "|", j["company"])