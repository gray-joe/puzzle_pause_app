var response = http.get(BRIDGE_URL + '/code?afterId=' + output.loginAfterId);
if (response.status !== 200) throw new Error('Unable to read new login code: ' + response.body);
output.loginCode = json(response.body).code;
