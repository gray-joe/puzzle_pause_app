var response = http.get(BRIDGE_URL + '/watermark');
if (response.status !== 200) throw new Error('Unable to read login watermark: ' + response.body);
output.loginAfterId = json(response.body).id;
