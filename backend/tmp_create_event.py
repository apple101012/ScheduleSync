import requests
API='http://localhost:8000'
print('POST /events/apple')
r = requests.post(API+'/events/apple', json={'title':'Manual Test','start':'2025-10-24T10:00:00','end':'2025-10-24T11:00:00'})
print(r.status_code, r.text)
print('GET /schedule/apple')
r2 = requests.get(API+'/schedule/apple')
print(r2.status_code)
print(r2.json())
