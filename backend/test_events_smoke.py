import requests
import pprint

API_BASE = 'http://localhost:8000'

def smoke_events(username='apple'):
    pp = pprint.PrettyPrinter(indent=2)
    print('Creating event...')
    r = requests.post(f"{API_BASE}/events/{username}", json={"title": "smoke event", "start": "2025-10-22T09:00:00", "end": "2025-10-22T10:00:00"})
    print('status', r.status_code)
    pp.pprint(r.json())
    if r.status_code != 200:
        return
    event = r.json().get('event')
    eid = event.get('_id')
    print('Updating event...')
    r = requests.put(f"{API_BASE}/events/{username}/{eid}", json={"title": "smoke updated", "start": "2025-10-22T09:30:00", "end": "2025-10-22T10:30:00"})
    print('status', r.status_code)
    pp.pprint(r.json())
    print('Getting schedule...')
    r = requests.get(f"{API_BASE}/schedule/{username}")
    print('status', r.status_code)
    pp.pprint(r.json())
    print('Deleting event...')
    r = requests.delete(f"{API_BASE}/events/{username}/{eid}")
    print('status', r.status_code)
    pp.pprint(r.json())

if __name__ == '__main__':
    smoke_events()
